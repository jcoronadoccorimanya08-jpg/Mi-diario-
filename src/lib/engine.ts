/**
 * Reglas de Mi Diario: funciones puras (la hora «de ahora» siempre se pasa).
 */
import { BADGES, LATE_PCT, MOUNTAIN_DAYS, ON_TIME_PCT, PROMPTS } from './config';
import { addDays, addMonths, appDay, maxDate, rangeDates, todayISO, type ISODate } from './dates';
import type { AppState, Entry, Mood } from './types';

/** ¿El día tiene algo escrito (o dibujado, o al menos tu ánimo)? */
export function hasContent(e: Entry | undefined): boolean {
  if (!e) return false;
  return Boolean(e.mood || e.text?.trim() || e.best?.trim() || e.tomorrow?.trim() || e.pages?.some((p) => p.strokes.length));
}

export type DayStatus = { kind: 'before' } | { kind: 'open' } | { kind: 'written'; pct: number; late: boolean } | { kind: 'missed' };

/**
 * Escribir el día antes de medianoche vale 100 %; de 00:00 a 03:59 (todavía es «ayer»), 75 %.
 * Si a las 4:00 no escribiste, ese día vale 0 % y corta la racha.
 */
export function dayStatus(state: AppState, day: ISODate, now: Date): DayStatus {
  if (day < state.settings.startDate) return { kind: 'before' };
  const e = state.entries[day];
  // Escrito después de su día (pasadas las 4:00 del siguiente): queda en tu diario, pero no cuenta para la racha.
  if (e?.savedAt && hasContent(e) && appDay(new Date(e.savedAt)) === day) {
    const late = todayISO(new Date(e.savedAt)) !== day;
    return { kind: 'written', pct: late ? LATE_PCT : ON_TIME_PCT, late };
  }
  return appDay(now) > day ? { kind: 'missed' } : { kind: 'open' };
}

/** Días seguidos escribiendo. Hoy, si todavía no escribes, no corta. */
export function streak(state: AppState, now: Date): number {
  let d = appDay(now);
  let n = 0;
  if (dayStatus(state, d, now).kind === 'open') d = addDays(d, -1);
  while (d >= state.settings.startDate && dayStatus(state, d, now).kind === 'written') {
    n++;
    d = addDays(d, -1);
  }
  return n;
}

export function bestStreak(state: AppState, now: Date): number {
  const today = appDay(now);
  if (today < state.settings.startDate) return 0;
  let best = 0;
  let run = 0;
  for (const d of rangeDates(state.settings.startDate, today)) {
    const k = dayStatus(state, d, now).kind;
    if (k === 'written') best = Math.max(best, ++run);
    else if (k !== 'open') run = 0;
  }
  return best;
}

export function mountain(state: AppState, now: Date, days = MOUNTAIN_DAYS): { date: ISODate; pct: number; written: boolean }[] {
  const today = appDay(now);
  if (today < state.settings.startDate) return [];
  return rangeDates(maxDate(state.settings.startDate, addDays(today, -(days - 1))), today).map((date) => {
    const st = dayStatus(state, date, now);
    return { date, pct: st.kind === 'written' ? st.pct : 0, written: st.kind === 'written' };
  });
}

/** Insignias ganadas con tu mejor racha. */
export function badges(best: number): { days: number; name: string; earned: boolean }[] {
  return BADGES.map((b) => ({ ...b, earned: best >= b.days }));
}

/** La pregunta del día: cambia sola cada día (la misma todo el día). */
export function promptFor(date: ISODate): string {
  let h = 0;
  for (const ch of date) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PROMPTS[h % PROMPTS.length]!;
}

// ---------- Etiquetas ----------

/** «Familia», «#familia» y « familia » son la misma etiqueta. */
export function normTag(t: string): string {
  return t
    .trim()
    .replace(/^#+/, '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9ñ_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24);
}

/** Tus etiquetas, de la más usada a la menos (incluye las guardadas aunque todavía no las uses). */
export function tagCounts(state: AppState): { tag: string; n: number }[] {
  const m = new Map<string, number>();
  for (const t of state.settings.tags) m.set(t, 0);
  for (const e of Object.values(state.entries)) for (const t of e.tags ?? []) m.set(t, (m.get(t) ?? 0) + 1);
  return [...m.entries()].map(([tag, n]) => ({ tag, n })).sort((a, b) => b.n - a.n || a.tag.localeCompare(b.tag));
}

const clean = (t: string) =>
  ` ${t
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9ñ]+/g, ' ')} `;

/** Etiquetas que ya tienes y que aparecen en lo que escribiste («fui al gym» → #gym). */
export function suggestTags(state: AppState, e: Entry): string[] {
  const t = clean([e.text, e.best, e.tomorrow].filter(Boolean).join(' '));
  return tagCounts(state)
    .map((x) => x.tag)
    .filter((tag) => !(e.tags ?? []).includes(tag) && tag.length >= 2 && t.includes(` ${tag.replace(/-/g, ' ')} `));
}

// ---------- Buscar y recordar ----------

export function search(state: AppState, q: { text?: string; tag?: string; fav?: boolean; mood?: Mood }): Entry[] {
  const words = clean(q.text ?? '')
    .split(' ')
    .filter((w) => w.length >= 2);
  return Object.values(state.entries)
    .filter((e) => hasContent(e))
    .filter((e) => !q.tag || (e.tags ?? []).includes(q.tag))
    .filter((e) => !q.fav || e.fav)
    .filter((e) => !q.mood || e.mood === q.mood)
    .filter((e) => {
      if (!words.length) return true;
      const t = clean([e.text, e.best, e.tomorrow, ...(e.tags ?? [])].filter(Boolean).join(' '));
      return words.every((w) => t.includes(w));
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}

/** «Hace una semana / un mes / un año hoy»: los días que escribiste en esas fechas. */
export function onThisDay(state: AppState, today: ISODate): { label: string; entry: Entry }[] {
  const out: { label: string; entry: Entry }[] = [];
  const add = (label: string, d: ISODate) => {
    const e = state.entries[d];
    if (hasContent(e)) out.push({ label, entry: e! });
  };
  add('Hace un año', addMonths(today, -12));
  add('Hace un mes', addMonths(today, -1));
  add('Hace una semana', addDays(today, -7));
  return out;
}

const STOP = new Set(
  'que de la el en y a los las un una por con no se lo me mi es al del como para mas pero muy ya hoy fue estaba estoy tengo porque cuando todo nos le les su sus tan bien era ser ha he hay mucho poco este esta eso esto yo tu te o si sin sobre tambien solo despues antes luego'.split(' '),
);

export interface MonthSummary {
  days: number;
  written: number;
  moodAvg: number | null;
  moods: Record<Mood, number>;
  topWords: { w: string; n: number }[];
  topTags: { tag: string; n: number }[];
}

/** Tu mes: días escritos, ánimo promedio, palabras y etiquetas que más usaste (lo escrito a mano no se cuenta). */
export function monthSummary(state: AppState, ym: string, today: ISODate): MonthSummary {
  const first = `${ym}-01`;
  const last = addDays(addMonths(first, 1), -1);
  const to = last < today ? last : today;
  const dates = first <= to ? rangeDates(first, to) : [];
  const es = dates.map((d) => state.entries[d]).filter((e): e is Entry => hasContent(e));
  const moods = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } as Record<Mood, number>;
  let sum = 0;
  let n = 0;
  const words = new Map<string, number>();
  const tags = new Map<string, number>();
  for (const e of es) {
    if (e.mood) {
      moods[e.mood]++;
      sum += e.mood;
      n++;
    }
    for (const w of clean([e.text, e.best, e.tomorrow].filter(Boolean).join(' ')).split(' ')) if (w.length >= 4 && !STOP.has(w)) words.set(w, (words.get(w) ?? 0) + 1);
    for (const t of e.tags ?? []) tags.set(t, (tags.get(t) ?? 0) + 1);
  }
  const top = <K,>(m: Map<K, number>) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  return {
    days: dates.length,
    written: es.length,
    moodAvg: n ? Math.round((sum / n) * 10) / 10 : null,
    moods,
    topWords: top(words).map(([w, c]) => ({ w, n: c })),
    topTags: top(tags).map(([tag, c]) => ({ tag, n: c })),
  };
}

/** Repaso de la semana: tus últimos 7 días con su carita y lo mejor de cada uno. */
export function weekReview(state: AppState, today: ISODate): { date: ISODate; mood?: Mood; best?: string; written: boolean }[] {
  return rangeDates(addDays(today, -6), today).map((date) => {
    const e = state.entries[date];
    return { date, mood: e?.mood, best: e?.best, written: hasContent(e) };
  });
}

// ---------- Pasar el diario de un dispositivo a otro ----------

/**
 * Junta dos diarios día por día sin perder nada: si un día está en los dos, queda el más reciente y se le
 * agregan las hojas y el texto del otro que no estén repetidos. La racha usa la primera vez que guardaste.
 */
export function mergeEntries(mine: Record<ISODate, Entry>, other: Record<ISODate, Entry>): { entries: Record<ISODate, Entry>; added: number; joined: number } {
  const out: Record<ISODate, Entry> = { ...mine };
  let added = 0;
  let joined = 0;
  for (const [d, o] of Object.entries(other)) {
    const m = out[d];
    if (!m || !hasContent(m)) {
      if (hasContent(o)) {
        out[d] = o;
        added++;
      }
      continue;
    }
    if (JSON.stringify(m) === JSON.stringify(o) || !hasContent(o)) continue;
    const [newer, older] = (o.updatedAt ?? '') > (m.updatedAt ?? '') ? [o, m] : [m, o];
    const pages = [...(newer.pages ?? [])];
    for (const p of older.pages ?? []) if (p.strokes.length && !pages.some((x) => JSON.stringify(x) === JSON.stringify(p))) pages.push(p);
    const text = [newer.text?.trim(), older.text?.trim() && older.text.trim() !== newer.text?.trim() ? older.text.trim() : ''].filter(Boolean).join('\n\n');
    const tags = [...new Set([...(newer.tags ?? []), ...(older.tags ?? [])])];
    const saved = [m.savedAt, o.savedAt].filter((x): x is string => Boolean(x)).sort()[0];
    out[d] = {
      ...older,
      ...newer,
      ...(text ? { text } : {}),
      ...(pages.length ? { pages } : {}),
      ...(tags.length ? { tags } : {}),
      ...(saved ? { savedAt: saved } : {}),
      ...(m.fav || o.fav ? { fav: true as const } : {}),
    };
    joined++;
  }
  return { entries: out, added, joined };
}

export function wordCount(e: Entry | undefined): number {
  return clean([e?.text, e?.best, e?.tomorrow].filter(Boolean).join(' '))
    .split(' ')
    .filter(Boolean).length;
}
