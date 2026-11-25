/**
 * Puente con el widget de Android (app «Rachas»). Solo cuando Mi Diario se abre desde esa app: Chrome le
 * entrega a la página un canal (postMessage) y por ahí mandamos SOLO la racha, la montaña, las caritas de la
 * semana, la pregunta del día y la fecha de «hace un año». Nunca lo que escribes.
 */
import { useSyncExternalStore } from 'react';
import { addDays, addMonths, appDay, diffDays, rangeDates, type ISODate } from './dates';
import { dayStatus, hasContent, mountain, promptFor, streak } from './engine';
import type { Accent, AppState, Mood } from './types';

export interface WidgetFrame {
  today: ISODate;
  dayNumber: number;
  streak: number;
  /** Ya escribiste hoy y con qué % (null si todavía no). */
  closedPct: number | null;
  days: { d: ISODate; p: number; w: boolean }[];
  /** Tu ánimo de los últimos 7 días (0 si no pusiste). */
  moods: { d: ISODate; m: Mood | 0 }[];
  prompt: string;
  /** «Hace un año hoy»: solo la fecha y la carita. */
  yearAgo: { d: ISODate; m: Mood | 0 } | null;
}

export interface WidgetPayload extends WidgetFrame {
  v: 1;
  app: 'midiario';
  accent: Accent;
  remindAt: string;
  ahead: WidgetFrame[];
}

export function buildWidgetFrame(state: AppState, now: Date): WidgetFrame {
  const today = appDay(now);
  const st = dayStatus(state, today, now);
  const ago = addMonths(today, -12);
  const old = state.entries[ago];
  return {
    today,
    dayNumber: today < state.settings.startDate ? 0 : diffDays(state.settings.startDate, today) + 1,
    streak: streak(state, now),
    closedPct: st.kind === 'written' ? st.pct : null,
    days: mountain(state, now).map((m) => ({ d: m.date, p: m.pct, w: m.written })),
    moods: rangeDates(addDays(today, -6), today).map((d) => ({ d, m: state.entries[d]?.mood ?? 0 })),
    prompt: promptFor(today),
    yearAgo: hasContent(old) ? { d: ago, m: old!.mood ?? 0 } : null,
  };
}

export const AHEAD_DAYS = 2;

export function buildWidgetPayload(state: AppState, now: Date): WidgetPayload {
  return {
    v: 1,
    app: 'midiario',
    ...buildWidgetFrame(state, now),
    accent: state.settings.accent ?? 'verde',
    remindAt: state.settings.remindAt,
    ahead: Array.from({ length: AHEAD_DAYS }, (_, i) => buildWidgetFrame(state, new Date(`${addDays(appDay(now), i + 1)}T16:00:00Z`))),
  };
}

// ---------- Canal con la app «Rachas» ----------
/** Paquete de la app nativa «Rachas». */
const APP_PACKAGE = 'io.github.jcoronadoccorimanya08.rachas';

/**
 * ¿El origen es el de Chrome hablando en nombre de la app «Rachas»? Chrome actual lo manda como
 * «android-app://<sitio>» (el origen solo guarda el sitio, sin el paquete); versiones anteriores, como
 * «android-app://<sitio>/<paquete>» o «android-app://<paquete>». Chrome solo abre este canal a una app que
 * assetlinks.json verifica para este sitio, y ahí solo está Rachas. Una página web no puede fingir este origen.
 */
export function isRachasOrigin(origin: string, self: string): boolean {
  if (origin === self) return true;
  if (!origin.startsWith('android-app://')) return false;
  const parts = origin.slice('android-app://'.length).split(/[/?#]/);
  let host = '';
  try {
    host = new URL(self).host;
  } catch {
    /* sin sitio propio */
  }
  return parts.includes(APP_PACKAGE) || (host !== '' && parts[0] === host);
}

/** El primer mensaje del canal: lo manda Chrome (sin ventana de origen), con un solo puerto y con el origen de Rachas. */
export function isRachasChannel(e: { origin: string; source: unknown; ports: readonly unknown[] | null }, self: string): boolean {
  return e.source === null && !!e.ports && e.ports.length === 1 && isRachasOrigin(e.origin, self);
}

/** off: no hay app nativa · connecting: llegó el canal · ready: la app respondió · saved: el widget guardó tu resumen. */
export type BridgeStatus = 'off' | 'connecting' | 'ready' | 'saved';

let port: MessagePort | null = null;
let last: string | null = null;
let started = false;
let status: BridgeStatus = 'off';
const listeners = new Set<() => void>();

function setStatus(next: BridgeStatus) {
  if (status === next) return;
  status = next;
  for (const f of listeners) f();
}

/** Estado del canal con el widget, para mostrarlo en Ajustes. */
export function useBridgeStatus(): BridgeStatus {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => status,
    () => 'off',
  );
}

/** Escucha el canal de la app nativa. Se llama al cargar la página, antes de que Chrome entregue el puerto. */
export function initWidgetBridge(): void {
  if (started || typeof window === 'undefined') return;
  started = true;
  window.addEventListener('message', (e: MessageEvent) => {
    if (!isRachasChannel(e, window.location.origin)) return;
    port = e.ports[0]!;
    port.onmessage = (m: MessageEvent) => {
      const text = typeof m.data === 'string' ? m.data : '';
      if (text.startsWith('rachas:ok')) {
        setStatus('saved');
      } else if (text.startsWith('rachas:')) {
        // «hola»: la app ya escucha. Lo que se mandó antes pudo perderse, así que se manda otra vez.
        if (status !== 'saved') setStatus('ready');
        if (last) sendRaw(last);
      }
    };
    setStatus('connecting');
    if (last) sendRaw(last);
  });
}

/** Paquete con el que Chrome abre la app desde «Rachas» (document.referrer). */
const RACHAS_REFERRER = `android-app://${APP_PACKAGE}`;

export type WidgetHintKind = 'outside' | 'failed' | null;

/**
 * ¿Avisar que el widget no se actualiza? Solo en Android, abierta como app, si pasados unos segundos no llegó
 * el canal: «outside» si se abrió sin pasar por Rachas (por ejemplo, con el ícono que instaló Chrome),
 * «failed» si se abrió desde Rachas y aun así no conectó.
 */
export function widgetHint(o: { android: boolean; standalone: boolean; waited: boolean; status: BridgeStatus; referrer: string }): WidgetHintKind {
  if (!o.android || !o.standalone || !o.waited || o.status !== 'off') return null;
  return o.referrer.startsWith(RACHAS_REFERRER) ? 'failed' : 'outside';
}

function sendRaw(msg: string) {
  try {
    port?.postMessage(msg);
  } catch {
    port = null;
  }
}

export function sendWidget(payload: WidgetPayload): void {
  last = JSON.stringify(payload);
  sendRaw(last);
}
