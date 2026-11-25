/**
 * Valida lo que entra (bóveda, respaldo o el diario de otro dispositivo). Lo que no sirve se descarta sin
 * romper lo demás. Nunca se pierde un día válido.
 */
import { INK_COLORS, PAPERS, PAPER_COLORS } from './config';
import { isValidISODate } from './dates';
import { isAccent, isTextSize, isTheme } from './look';
import { normTag } from './engine';
import type { AppState, Entry, Mood, Page, Paper, PaperColor, Settings, Stroke } from './types';

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown, max: number): string => (typeof v === 'string' ? v.slice(0, max) : '');
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const stamp = (v: unknown) => (typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? v : undefined);

function sanitizeStroke(v: unknown): Stroke | null {
  if (!isObj(v) || !Array.isArray(v.p)) return null;
  const p: number[] = [];
  for (const n of v.p) {
    if (typeof n !== 'number' || !Number.isFinite(n)) return null;
    p.push(Math.round(n));
    if (p.length > 30000) break;
  }
  if (p.length < 3 || p.length % 3 !== 0) return null;
  const c = typeof v.c === 'number' && v.c >= 0 && v.c < INK_COLORS.length ? Math.round(v.c) : 0;
  const w = typeof v.w === 'number' && v.w > 0 && v.w <= 60 ? Math.round(v.w * 10) / 10 : 3;
  return { c, w, ...(v.h === true ? { h: true as const } : {}), p };
}

function sanitizePages(v: unknown): Page[] {
  const out: Page[] = [];
  for (const pg of arr(v).slice(0, 20)) {
    if (!isObj(pg)) continue;
    const strokes = arr(pg.strokes).map(sanitizeStroke).filter((s): s is Stroke => s !== null);
    out.push({ strokes });
  }
  return out;
}

export function sanitizeEntries(v: unknown): Record<string, Entry> {
  const out: Record<string, Entry> = {};
  if (!isObj(v)) return out;
  for (const [d, e] of Object.entries(v)) {
    if (!isValidISODate(d) || !isObj(e)) continue;
    const mood = typeof e.mood === 'number' && e.mood >= 1 && e.mood <= 5 ? (Math.round(e.mood) as Mood) : undefined;
    const pages = sanitizePages(e.pages);
    const tags = [...new Set(arr(e.tags).map((t) => (typeof t === 'string' ? normTag(t) : '')).filter(Boolean))].slice(0, 20);
    const entry: Entry = { date: d };
    if (mood) entry.mood = mood;
    if (str(e.text, 20000)) entry.text = str(e.text, 20000);
    if (pages.length) entry.pages = pages;
    if (str(e.best, 500)) entry.best = str(e.best, 500);
    if (str(e.tomorrow, 500)) entry.tomorrow = str(e.tomorrow, 500);
    if (tags.length) entry.tags = tags;
    if (e.fav === true) entry.fav = true;
    if (str(e.template, 20)) entry.template = str(e.template, 20);
    if (stamp(e.savedAt)) entry.savedAt = stamp(e.savedAt);
    if (stamp(e.updatedAt)) entry.updatedAt = stamp(e.updatedAt);
    out[d] = entry;
  }
  return out;
}

function sanitizeSettings(v: unknown): Settings | null {
  if (!isObj(v) || !isValidISODate(v.startDate)) return null;
  return {
    startDate: v.startDate,
    paper: PAPERS.some((p) => p.id === v.paper) ? (v.paper as Paper) : 'renglon',
    paperColor: PAPER_COLORS.some((p) => p.id === v.paperColor) ? (v.paperColor as PaperColor) : 'crema',
    remindAt: typeof v.remindAt === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v.remindAt) ? v.remindAt : '22:30',
    tags: [...new Set(arr(v.tags).map((t) => (typeof t === 'string' ? normTag(t) : '')).filter(Boolean))].slice(0, 100),
    ...(str(v.nick, 24).trim() ? { nick: str(v.nick, 24).trim() } : {}),
    theme: isTheme(v.theme) ? v.theme : 'system',
    ...(isAccent(v.accent) ? { accent: v.accent } : {}),
    ...(isTextSize(v.textSize) ? { textSize: v.textSize } : {}),
    autoLockMinutes: [0, 1, 5, 15].includes(v.autoLockMinutes as number) ? (v.autoLockMinutes as number) : 1,
    ...(typeof v.lastBackupAt === 'string' ? { lastBackupAt: v.lastBackupAt } : {}),
    createdAt: typeof v.createdAt === 'string' ? v.createdAt : new Date().toISOString(),
  };
}

export function sanitizeState(v: unknown): AppState | null {
  if (!isObj(v) || v.schema !== 1) return null;
  const settings = sanitizeSettings(v.settings);
  if (!settings) return null;
  return { schema: 1, settings, entries: sanitizeEntries(v.entries) };
}
