import { useState } from 'react';
import { ScreenHeader } from '../components/ui';
import { MOODS } from '../lib/config';
import { formatLong, type ISODate } from '../lib/dates';
import { search, tagCounts } from '../lib/engine';
import type { AppState, Mood } from '../lib/types';
import { DayRead, preview } from './Calendar';

/** Encuentra tus días por palabras (lo escrito con teclado o voz), etiqueta, ánimo o favoritos. */
export function SearchScreen({ state, today, onOpenDay }: { state: AppState; today: ISODate; onOpenDay: (d: ISODate) => void }) {
  const [q, setQ] = useState('');
  const [tag, setTag] = useState<string | undefined>();
  const [mood, setMood] = useState<Mood | undefined>();
  const [fav, setFav] = useState(false);
  const [read, setRead] = useState<ISODate | null>(null);
  const res = search(state, { text: q, tag, mood, fav });
  return (
    <main className="screen">
      <ScreenHeader eyebrow="Tu diario" title="Buscar" />
      <input className="field" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Busca una palabra: examen, mamá, viaje…" aria-label="Buscar" />
      <div className="chips">
        <button type="button" className={`chip ${fav ? 'on' : ''}`} aria-pressed={fav} onClick={() => setFav(!fav)}>
          ⭐ Favoritos
        </button>
        {MOODS.map((m) => (
          <button key={m.v} type="button" className={`chip ${mood === m.v ? 'on' : ''}`} aria-pressed={mood === m.v} aria-label={m.label} onClick={() => setMood(mood === m.v ? undefined : m.v)}>
            {m.face}
          </button>
        ))}
      </div>
      <div className="chips">
        {tagCounts(state).map(({ tag: t, n }) => (
          <button key={t} type="button" className={`chip ${tag === t ? 'on' : ''}`} aria-pressed={tag === t} onClick={() => setTag(tag === t ? undefined : t)}>
            #{t} <small>{n}</small>
          </button>
        ))}
      </div>
      <p className="fine">Lo escrito a mano no se busca por palabras (eso necesitaría internet): encuéntralo por fecha, etiqueta o ánimo.</p>
      {read && <DayRead state={state} date={read} entry={state.entries[read]} today={today} onEdit={() => onOpenDay(read)} onClose={() => setRead(null)} />}
      <div className="card list">
        {res.slice(0, 60).map((e) => (
          <button key={e.date} type="button" className="item bf-acc" onClick={() => setRead(e.date)}>
            <span className="txt">
              <b>
                {e.mood ? MOODS[e.mood - 1]!.face : ''} {formatLong(e.date)} {e.fav ? '⭐' : ''}
              </b>
              <span>{preview(e)}</span>
            </span>
          </button>
        ))}
        {!res.length && <p className="muted bf-empty">No hay días con eso todavía.</p>}
      </div>
    </main>
  );
}
