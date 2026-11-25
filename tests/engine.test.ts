import { describe, expect, it } from 'vitest';
import { badges, dayStatus, mergeEntries, monthSummary, normTag, onThisDay, promptFor, search, streak, suggestTags, tagCounts } from '../src/lib/engine';
import { initialState } from '../src/lib/store';
import { sanitizeState } from '../src/lib/sanitize';
import type { AppState, Entry } from '../src/lib/types';

const lp = (date: string, hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number) as [number, number];
  return new Date(Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10), h + 4, m));
};
const day = (date: string, savedAt: string, extra: Partial<Entry> = {}): Entry => ({ date, text: 'algo', savedAt, updatedAt: savedAt, ...extra });
function base(): AppState {
  return initialState('2026-11-20');
}

describe('racha del diario', () => {
  it('antes de medianoche 100 %, de madrugada 75 %, sin escribir a las 4:00 se corta', () => {
    const s = base();
    s.entries['2026-11-20'] = day('2026-11-20', lp('2026-11-20', '22:30').toISOString());
    s.entries['2026-11-21'] = day('2026-11-21', lp('2026-11-22', '01:10').toISOString());
    const now = lp('2026-11-22', '15:00');
    expect(dayStatus(s, '2026-11-20', now)).toMatchObject({ kind: 'written', pct: 100 });
    expect(dayStatus(s, '2026-11-21', now)).toMatchObject({ kind: 'written', pct: 75, late: true });
    expect(streak(s, now)).toBe(2);
    expect(streak(s, lp('2026-11-23', '05:00'))).toBe(0);
  });
  it('un día vacío no cuenta aunque lo hayas abierto', () => {
    const s = base();
    s.entries['2026-11-20'] = { date: '2026-11-20', savedAt: lp('2026-11-20', '22:00').toISOString() };
    expect(dayStatus(s, '2026-11-20', lp('2026-11-21', '10:00')).kind).toBe('missed');
  });
  it('insignias por tu mejor racha', () => {
    expect(badges(30).filter((b) => b.earned).map((b) => b.days)).toEqual([7, 30]);
  });
  it('la pregunta del día es la misma todo el día y cambia con la fecha', () => {
    expect(promptFor('2026-11-25')).toBe(promptFor('2026-11-25'));
    const set = new Set(['2026-11-20', '2026-11-21', '2026-11-22', '2026-11-23', '2026-11-24'].map(promptFor));
    expect(set.size).toBeGreaterThan(1);
  });
});

describe('etiquetas, buscar y recordar', () => {
  it('normaliza etiquetas y las ordena por uso', () => {
    expect(normTag(' #Familia ')).toBe('familia');
    expect(normTag('Gimnasio día')).toBe('gimnasio-dia');
    const s = base();
    s.settings.tags = ['u', 'gym', 'familia'];
    s.entries['2026-11-20'] = day('2026-11-20', '2026-11-20T23:00:00Z', { tags: ['gym'] });
    s.entries['2026-11-21'] = day('2026-11-21', '2026-11-21T23:00:00Z', { tags: ['gym', 'u'] });
    expect(tagCounts(s).map((t) => t.tag)).toEqual(['gym', 'u', 'familia']);
  });
  it('sugiere tus etiquetas si aparecen en lo que escribiste', () => {
    const s = base();
    s.settings.tags = ['gym', 'familia'];
    expect(suggestTags(s, { date: '2026-11-25', text: 'Hoy fui al GYM temprano' })).toEqual(['gym']);
  });
  it('busca sin tildes ni mayúsculas, por etiqueta y favoritos', () => {
    const s = base();
    s.entries['2026-11-20'] = day('2026-11-20', '2026-11-20T23:00:00Z', { text: 'Examen de Anatomía', tags: ['u'], fav: true });
    s.entries['2026-11-21'] = day('2026-11-21', '2026-11-21T23:00:00Z', { text: 'Cena con la familia' });
    expect(search(s, { text: 'anatomia' }).map((e) => e.date)).toEqual(['2026-11-20']);
    expect(search(s, { tag: 'u' })).toHaveLength(1);
    expect(search(s, { fav: true })).toHaveLength(1);
    expect(search(s, {})).toHaveLength(2);
  });
  it('hace un mes y hace un año', () => {
    const s = base();
    s.entries['2025-11-25'] = day('2025-11-25', '2025-11-25T23:00:00Z', { mood: 4 });
    s.entries['2026-10-25'] = day('2026-10-25', '2026-10-25T23:00:00Z');
    expect(onThisDay(s, '2026-11-25').map((x) => x.label)).toEqual(['Hace un año', 'Hace un mes']);
  });
  it('resumen del mes: días escritos, ánimo y palabras', () => {
    const s = base();
    s.entries['2026-11-20'] = day('2026-11-20', '2026-11-20T23:00:00Z', { mood: 4, text: 'Estudié anatomía con mucha calma' });
    s.entries['2026-11-21'] = day('2026-11-21', '2026-11-21T23:00:00Z', { mood: 2, text: 'Anatomía otra vez' });
    const m = monthSummary(s, '2026-11', '2026-11-25');
    expect(m).toMatchObject({ days: 25, written: 2, moodAvg: 3 });
    expect(m.topWords[0]).toEqual({ w: 'anatomia', n: 2 });
  });
});

describe('pasar el diario entre dispositivos', () => {
  it('junta día por día sin perder nada', () => {
    const page = { strokes: [{ c: 0, w: 3, p: [1, 2, 50, 3, 4, 50] }] };
    const tablet: Record<string, Entry> = {
      '2026-11-20': day('2026-11-20', '2026-11-20T23:00:00Z', { pages: [page], text: undefined }),
      '2026-11-22': day('2026-11-22', '2026-11-22T23:00:00Z', { text: 'en la tablet', updatedAt: '2026-11-22T23:30:00Z' }),
    };
    const phone: Record<string, Entry> = {
      '2026-11-21': day('2026-11-21', '2026-11-21T23:00:00Z'),
      '2026-11-22': day('2026-11-22', '2026-11-22T22:00:00Z', { text: 'en el celu', tags: ['u'], updatedAt: '2026-11-22T22:10:00Z' }),
    };
    const r = mergeEntries(tablet, phone);
    expect(r.added).toBe(1);
    expect(r.joined).toBe(1);
    expect(r.entries['2026-11-22']).toMatchObject({ text: 'en la tablet\n\nen el celu', tags: ['u'], savedAt: '2026-11-22T22:00:00Z' });
    expect(r.entries['2026-11-20']?.pages).toHaveLength(1);
    expect(mergeEntries(tablet, tablet).joined).toBe(0);
  });
  it('valida trazos y descarta lo dañado', () => {
    const st = sanitizeState({ schema: 1, settings: { startDate: '2026-11-20' }, entries: { '2026-11-20': { pages: [{ strokes: [{ c: 0, w: 3, p: [1, 2, 3] }, { p: [1, 'x'] }] }], tags: ['#Gym'] }, malo: {} } });
    expect(st?.entries['2026-11-20']?.pages?.[0]?.strokes).toHaveLength(1);
    expect(st?.entries['2026-11-20']?.tags).toEqual(['gym']);
    expect(Object.keys(st?.entries ?? {})).toEqual(['2026-11-20']);
  });
});

describe('días escritos después', () => {
  it('quedan en tu diario pero no cuentan para la racha', () => {
    const s = base();
    s.entries['2026-11-20'] = day('2026-11-20', lp('2026-11-22', '20:00').toISOString());
    expect(dayStatus(s, '2026-11-20', lp('2026-11-22', '21:00')).kind).toBe('missed');
    expect(search(s, {})).toHaveLength(1);
  });
});
