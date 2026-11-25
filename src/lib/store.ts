/**
 * Estado de Mi Diario + bloqueo con patrón y huella.
 * Mientras la app está abierta, la llave de los datos vive solo en memoria. Cada cambio se cifra y se guarda al instante.
 */
import { useSyncExternalStore } from 'react';
import { biometricSupport, prfWithBiometric, registerBiometric } from './biometric';
import { APP_NAME } from './config';
import {
  KDF_ITERATIONS,
  decryptBytes,
  decryptJSON,
  deriveKey,
  encryptBytes,
  encryptJSON,
  fromB64,
  importDataKey,
  keyFromPrf,
  newDataKey,
  randomBytes,
  toB64,
} from './crypto';
import { type ISODate } from './dates';
import { mergeEntries, normTag } from './engine';
import { sanitizeState } from './sanitize';
import type { Accent, AppState, Entry, Paper, PaperColor, Settings, TextSize } from './types';
import { deleteVault, readVault, requestPersistence, writeVault, type LockRecord, type VaultRecord } from './vault';

export type Phase = 'loading' | 'setup' | 'locked' | 'unlocked';

interface Snapshot {
  phase: Phase;
  state: AppState | null;
  hasBio: boolean;
  /** Modo prueba: una copia en memoria con fecha simulada. Nunca se guarda. */
  test: { date: ISODate } | null;
}

let snap: Snapshot = { phase: 'loading', state: null, hasBio: false, test: null };
/** Tus datos reales mientras estás en modo prueba (lo que se ve es una copia). */
let real: AppState | null = null;

/** El estado que se guarda: el real, aunque estés en modo prueba. */
function realState(): AppState | null {
  return snap.test ? real : snap.state;
}
let dkRaw: Uint8Array<ArrayBuffer> | null = null;
let dataKey: CryptoKey | null = null;
let lockRec: LockRecord | null = null;
let writing: Promise<void> = Promise.resolve();
const listeners = new Set<() => void>();
const errorListeners = new Set<(m: string) => void>();

function emit() {
  for (const l of listeners) l();
}
function set(next: Partial<Snapshot>) {
  snap = { ...snap, ...next };
  emit();
}

export function useStore(): Snapshot {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => snap,
    () => snap,
  );
}

export function getState(): AppState | null {
  return snap.state;
}

export function onSaveError(cb: (m: string) => void): () => void {
  errorListeners.add(cb);
  return () => errorListeners.delete(cb);
}

function persist(): Promise<void> {
  writing = writing.then(async () => {
    const st = realState();
    if (!dataKey || !st || !lockRec) return;
    try {
      await writeVault({ v: 2, savedAt: Date.now(), lock: lockRec, data: await encryptJSON(dataKey, st) });
    } catch {
      for (const l of errorListeners) l('No se pudo guardar. Revisa el espacio del teléfono.');
    }
  });
  return writing;
}

export function flush(): Promise<void> {
  return writing;
}

const commitListeners = new Set<(s: AppState, remote: boolean) => void>();
let applyingRemote = false;

/** Avisa cada vez que se guarda algo de verdad (no en modo prueba). remote: vino de la nube. */
export function onCommit(cb: (s: AppState, remote: boolean) => void): () => void {
  commitListeners.add(cb);
  return () => commitListeners.delete(cb);
}

function commit(next: AppState) {
  set({ state: next });
  if (!snap.test) {
    void persist();
    for (const l of commitListeners) l(next, applyingRemote);
  }
}

/** Lo que llegó de tu otro dispositivo: se guarda aquí sin volver a subirlo. */
export function applyRemoteState(next: AppState) {
  if (snap.phase !== 'unlocked' || snap.test) return;
  applyingRemote = true;
  try {
    commit(next);
  } finally {
    applyingRemote = false;
  }
}

/** El estado real (null si está bloqueada o en modo prueba). */
export function realStateForSync(): AppState | null {
  return snap.phase === 'unlocked' && !snap.test ? snap.state : null;
}

/** Guarda (o quita) tu código de sincronización dentro de tus datos cifrados. */
export function setSyncCode(code: string | undefined) {
  if (!snap.state || snap.test) return;
  const settings = { ...snap.state.settings };
  if (code) settings.syncCode = code;
  else delete settings.syncCode;
  commit({ ...snap.state, settings });
}

// ---------- Modo prueba ----------

/** Entra al modo prueba con una copia de tus datos y la fecha dada. Lo que marques no se guarda. */
export function enterTest(date: ISODate) {
  if (snap.phase !== 'unlocked' || !snap.state || snap.test) return;
  real = snap.state;
  set({ state: structuredClone(real), test: { date } });
}

export function setTestDate(date: ISODate) {
  if (snap.test) set({ test: { date } });
}

/** Sale del modo prueba: vuelven tus datos reales, intactos. */
export function exitTest() {
  if (!snap.test) return;
  const back = real;
  real = null;
  set({ state: back, test: null });
}

// ---------- Bóveda ----------

export async function initStore(): Promise<void> {
  const v = await readVault();
  lockRec = v?.lock ?? null;
  set({ phase: v ? 'locked' : 'setup', state: null, hasBio: Boolean(v?.lock.bio) });
}

async function patternLock(pattern: string, raw: Uint8Array<ArrayBuffer>) {
  const salt = randomBytes(16);
  const kek = await deriveKey(pattern, salt, KDF_ITERATIONS);
  return { iter: KDF_ITERATIONS, salt: toB64(salt), wrapped: await encryptBytes(kek, raw) };
}

async function openWith(raw: Uint8Array<ArrayBuffer>, record: Pick<VaultRecord, 'data'>): Promise<AppState | null> {
  const key = await importDataKey(raw);
  const state = sanitizeState(await decryptJSON(key, record.data));
  if (!state) return null;
  dkRaw = raw;
  dataKey = key;
  return state;
}

async function unwrapWithPattern(lock: LockRecord, pattern: string): Promise<Uint8Array<ArrayBuffer> | null> {
  try {
    return await decryptBytes(await deriveKey(pattern, fromB64(lock.pattern.salt), lock.pattern.iter), lock.pattern.wrapped);
  } catch {
    return null;
  }
}

export async function createVault(pattern: string, state: AppState): Promise<void> {
  const raw = newDataKey();
  dkRaw = raw;
  dataKey = await importDataKey(raw);
  lockRec = { pattern: await patternLock(pattern, raw) };
  set({ phase: 'unlocked', state, hasBio: false });
  await persist();
  void requestPersistence();
}

export async function unlockWithPattern(pattern: string): Promise<boolean> {
  const v = await readVault();
  if (!v) {
    set({ phase: 'setup' });
    return false;
  }
  const raw = await unwrapWithPattern(v.lock, pattern);
  if (!raw) return false;
  const state = await openWith(raw, v);
  if (!state) return false;
  lockRec = v.lock;
  set({ phase: 'unlocked', state, hasBio: Boolean(v.lock.bio) });
  return true;
}

export async function unlockWithBiometric(): Promise<'ok' | 'fail' | 'unavailable'> {
  const v = await readVault();
  const bio = v?.lock.bio;
  if (!v || !bio) return 'unavailable';
  try {
    const prf = await prfWithBiometric(bio.credId, bio.prfSalt);
    const state = await openWith(await decryptBytes(await keyFromPrf(prf), bio.wrapped), v);
    if (!state) return 'fail';
    lockRec = v.lock;
    set({ phase: 'unlocked', state, hasBio: true });
    return 'ok';
  } catch {
    return 'fail';
  }
}

export async function verifyPattern(pattern: string): Promise<boolean> {
  const v = await readVault();
  return Boolean(v && (await unwrapWithPattern(v.lock, pattern)));
}

export async function changePattern(pattern: string): Promise<void> {
  if (!dkRaw || !lockRec) return;
  await writing;
  lockRec = { ...lockRec, pattern: await patternLock(pattern, dkRaw) };
  await persist();
}

export { biometricSupport };

export async function enableBiometric(): Promise<void> {
  if (!dkRaw || !lockRec) throw new Error('LOCKED');
  const reg = await registerBiometric(APP_NAME);
  const wrapped = await encryptBytes(await keyFromPrf(reg.prfOutput), dkRaw);
  lockRec = { ...lockRec, bio: { credId: reg.credId, prfSalt: reg.prfSalt, wrapped } };
  set({ hasBio: true });
  await persist();
}

export async function disableBiometric(): Promise<void> {
  if (!lockRec) return;
  const { bio: _bio, ...rest } = lockRec;
  void _bio;
  lockRec = rest;
  set({ hasBio: false });
  await persist();
}

export function lock() {
  if (snap.phase !== 'unlocked') return;
  dkRaw = null;
  dataKey = null;
  real = null;
  set({ phase: 'locked', state: null, test: null });
}

export async function wipeAll(): Promise<void> {
  await writing;
  dkRaw = null;
  dataKey = null;
  lockRec = null;
  await deleteVault();
  real = null;
  set({ phase: 'setup', state: null, hasBio: false, test: null });
}

// ---------- Respaldo ----------

export async function currentBackup(): Promise<Omit<VaultRecord, 'savedAt'> | null> {
  const st = realState();
  if (!dataKey || !lockRec || !st) return null;
  await writing;
  return { v: 2, lock: { pattern: lockRec.pattern }, data: await encryptJSON(dataKey, st) };
}

export async function openBackup(record: Pick<VaultRecord, 'lock' | 'data'>, pattern: string): Promise<AppState | null> {
  const raw = await unwrapWithPattern(record.lock, pattern);
  if (!raw) return null;
  try {
    return sanitizeState(await decryptJSON(await importDataKey(raw), record.data));
  } catch {
    return null;
  }
}

export function replaceState(next: AppState) {
  commit(next);
}

// ---------- Estado inicial ----------

export function initialState(startDate: ISODate, nick?: string): AppState {
  const settings: Settings = {
    startDate,
    paper: 'renglon',
    paperColor: 'crema',
    remindAt: '22:30',
    tags: [],
    ...(nick?.trim() ? { nick: nick.trim().slice(0, 24) } : {}),
    theme: 'system',
    autoLockMinutes: 1,
    createdAt: new Date().toISOString(),
  };
  return { schema: 1, settings, entries: {} };
}

// ---------- Acciones ----------

function update(fn: (s: AppState) => AppState) {
  if (!snap.state) return;
  commit(fn(snap.state));
}
function updateSettings(fn: (s: Settings) => Settings) {
  update((st) => ({ ...st, settings: fn(st.settings) }));
}

export const actions = {
  /**
   * Cambia algo del día (texto, ánimo, hojas…). Guardar el día la primera vez marca «savedAt», que es lo que
   * cuenta para la racha; después cada cambio solo actualiza «updatedAt».
   */
  editDay(date: ISODate, patch: Partial<Omit<Entry, 'date'>>, opts: { save?: boolean } = {}) {
    update((st) => {
      const prev = st.entries[date] ?? { date };
      const next: Entry = { ...prev, ...patch, date, updatedAt: new Date().toISOString() };
      for (const k of Object.keys(next) as (keyof Entry)[]) if (next[k] === undefined || next[k] === '') delete next[k];
      if (opts.save && !next.savedAt) next.savedAt = new Date().toISOString();
      return { ...st, entries: { ...st.entries, [date]: next } };
    });
  },
  toggleTag(date: ISODate, raw: string) {
    const tag = normTag(raw);
    if (!tag) return;
    update((st) => {
      const prev = st.entries[date] ?? { date };
      const has = (prev.tags ?? []).includes(tag);
      const tags = has ? (prev.tags ?? []).filter((t) => t !== tag) : [...(prev.tags ?? []), tag];
      const entry: Entry = { ...prev, updatedAt: new Date().toISOString() };
      if (tags.length) entry.tags = tags;
      else delete entry.tags;
      const saved = st.settings.tags.includes(tag) ? st.settings.tags : [...st.settings.tags, tag];
      return { ...st, settings: { ...st.settings, tags: saved }, entries: { ...st.entries, [date]: entry } };
    });
  },
  forgetTag(raw: string) {
    const tag = normTag(raw);
    updateSettings((s) => ({ ...s, tags: s.tags.filter((t) => t !== tag) }));
  },
  toggleFav(date: ISODate) {
    update((st) => {
      const prev = st.entries[date] ?? { date };
      const entry: Entry = { ...prev };
      if (entry.fav) delete entry.fav;
      else entry.fav = true;
      return { ...st, entries: { ...st.entries, [date]: entry } };
    });
  },
  /** Junta el diario de otro dispositivo (de su respaldo) con este. Devuelve cuántos días llegaron. */
  mergeFrom(other: AppState): { added: number; joined: number } {
    let res = { added: 0, joined: 0 };
    update((st) => {
      const m = mergeEntries(st.entries, other.entries);
      res = { added: m.added, joined: m.joined };
      const tags = [...new Set([...st.settings.tags, ...other.settings.tags])];
      const startDate = other.settings.startDate < st.settings.startDate ? other.settings.startDate : st.settings.startDate;
      return { ...st, settings: { ...st.settings, tags, startDate }, entries: m.entries };
    });
    return res;
  },
  setPaper(paper: Paper) {
    updateSettings((s) => ({ ...s, paper }));
  },
  setPaperColor(paperColor: PaperColor) {
    updateSettings((s) => ({ ...s, paperColor }));
  },
  setRemindAt(remindAt: string) {
    if (/^([01]\d|2[0-3]):[0-5]\d$/.test(remindAt)) updateSettings((s) => ({ ...s, remindAt }));
  },
  setNick(nick: string) {
    updateSettings((s) => {
      const next = { ...s };
      if (nick.trim()) next.nick = nick.trim().slice(0, 24);
      else delete next.nick;
      return next;
    });
  },
  setTheme(theme: Settings['theme']) {
    updateSettings((s) => ({ ...s, theme }));
  },
  setAccent(accent: Accent) {
    updateSettings((s) => {
      const next = { ...s };
      if (accent === 'verde') delete next.accent;
      else next.accent = accent;
      return next;
    });
  },
  setTextSize(size: TextSize) {
    updateSettings((s) => {
      const next = { ...s };
      if (size === 'normal') delete next.textSize;
      else next.textSize = size;
      return next;
    });
  },
  setAutoLock(minutes: number) {
    updateSettings((s) => ({ ...s, autoLockMinutes: minutes }));
  },
  markBackup() {
    updateSettings((s) => ({ ...s, lastBackupAt: new Date().toISOString() }));
  },
};
