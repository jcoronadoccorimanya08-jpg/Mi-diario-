import { useState } from 'react';
import { PageView } from '../components/Ink';
import { ScreenHeader, SectionTitle } from '../components/ui';
import { MOODS } from '../lib/config';
import { addDays, formatLong, rangeDates, weekday, type ISODate } from '../lib/dates';
import { hasContent, search } from '../lib/engine';
import type { AppState, Entry } from '../lib/types';

const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

/** Tu año en colores: cada día con el color de tu ánimo. Toca un día para leerlo. */
export function CalendarScreen({ state, today, onOpenDay }: { state: AppState; today: ISODate; onOpenDay: (d: ISODate) => void }) {
  const [year, setYear] = useState(Number(today.slice(0, 4)));
  const [month, setMonth] = useState(Number(today.slice(5, 7)) - 1);
  const [read, setRead] = useState<ISODate | null>(null);
  const ym = `${year}-${String(month + 1).padStart(2, '0')}`;
  const first = `${ym}-01`;
  const days = rangeDates(first, addDays(`${month === 11 ? year + 1 : year}-${String(month === 11 ? 1 : month + 2).padStart(2, '0')}-01`, -1));
  const lead = (weekday(first) + 6) % 7;
  const e = read ? state.entries[read] : undefined;
  return (
    <main className="screen">
      <ScreenHeader eyebrow="Tu diario" title="Calendario" />
      <YearMoods state={state} year={year} today={today} onPick={setRead} onYear={setYear} />

      <section className="card">
        <div className="dy-month-nav">
          <button type="button" className="icon-btn" aria-label="Mes anterior" onClick={() => (month === 0 ? (setMonth(11), setYear(year - 1)) : setMonth(month - 1))}>
            ‹
          </button>
          <b>
            {MONTHS[month]} {year}
          </b>
          <button type="button" className="icon-btn" aria-label="Mes siguiente" onClick={() => (month === 11 ? (setMonth(0), setYear(year + 1)) : setMonth(month + 1))}>
            ›
          </button>
        </div>
        <div className="dy-cal" role="grid" aria-label={`${MONTHS[month]} ${year}`}>
          {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => (
            <span key={i} className="dy-cal-h">
              {d}
            </span>
          ))}
          {Array.from({ length: lead }, (_, i) => (
            <span key={`x${i}`} />
          ))}
          {days.map((d) => {
            const en = state.entries[d];
            const has = hasContent(en);
            return (
              <button key={d} type="button" className={`dy-cal-d ${d === today ? 'today' : ''} ${has ? 'has' : ''} ${en?.mood ? `m${en.mood}` : ''}`} disabled={d > today} onClick={() => setRead(d)} aria-label={`${formatLong(d)}${has ? ', escrito' : ''}`}>
                <span>{Number(d.slice(8))}</span>
                {en?.mood ? <i>{MOODS[en.mood - 1]!.face}</i> : has ? <i>•</i> : null}
                {en?.fav && <em>⭐</em>}
              </button>
            );
          })}
        </div>
      </section>

      {read && <DayRead state={state} date={read} entry={e} today={today} onEdit={() => onOpenDay(read)} onClose={() => setRead(null)} />}

      <SectionTitle>⭐ Tus favoritos</SectionTitle>
      <div className="card list">
        {search(state, { fav: true }).slice(0, 10).map((x) => (
          <button key={x.date} type="button" className="item bf-acc" onClick={() => setRead(x.date)}>
            <span className="txt">
              <b>
                {x.mood ? MOODS[x.mood - 1]!.face : ''} {formatLong(x.date)}
              </b>
              <span>{preview(x)}</span>
            </span>
          </button>
        ))}
        {!search(state, { fav: true }).length && <p className="muted bf-empty">Marca con ☆ los días que quieras volver a leer.</p>}
      </div>
    </main>
  );
}

export function preview(e: Entry): string {
  const t = (e.text ?? e.best ?? '').trim().split('\n')[0] ?? '';
  const hand = e.pages?.filter((p) => p.strokes.length).length ?? 0;
  return t ? (t.length > 90 ? `${t.slice(0, 90)}…` : t) : hand ? `✍️ ${hand} ${hand === 1 ? 'hoja' : 'hojas'} a mano` : '';
}

/** Un año entero de caritas en colores. */
function YearMoods({ state, year, today, onPick, onYear }: { state: AppState; year: number; today: ISODate; onPick: (d: ISODate) => void; onYear: (y: number) => void }) {
  const days = rangeDates(`${year}-01-01`, `${year}-12-31`);
  return (
    <section className="card">
      <div className="dy-month-nav">
        <button type="button" className="icon-btn" aria-label="Año anterior" onClick={() => onYear(year - 1)}>
          ‹
        </button>
        <b>Tu año {year}</b>
        <button type="button" className="icon-btn" aria-label="Año siguiente" onClick={() => onYear(year + 1)}>
          ›
        </button>
      </div>
      <div className="dy-year" role="img" aria-label={`Tu ánimo en ${year}, día por día`}>
        {days.map((d) => {
          const en = state.entries[d];
          return <button key={d} type="button" tabIndex={-1} className={`dy-y ${en?.mood ? `m${en.mood}` : hasContent(en) ? 'has' : ''} ${d > today ? 'fut' : ''}`} onClick={() => d <= today && onPick(d)} aria-hidden="true" />;
        })}
      </div>
      <div className="dy-legend">
        {MOODS.map((m) => (
          <span key={m.v}>
            <i className={`dy-y m${m.v}`} /> {m.face}
          </span>
        ))}
      </div>
    </section>
  );
}

/** Leer un día (lo que escribiste y tus hojas a mano). */
export function DayRead({ state, date, entry, today, onEdit, onClose }: { state: AppState; date: ISODate; entry: Entry | undefined; today: ISODate; onEdit: () => void; onClose: () => void }) {
  const s = state.settings;
  return (
    <section className="card dy-read" aria-label={`Tu día ${formatLong(date)}`}>
      <div className="dy-head">
        <h2 className="card-title">
          {entry?.mood ? MOODS[entry.mood - 1]!.face : ''} {formatLong(date)} {entry?.fav ? '⭐' : ''}
        </h2>
        <button type="button" className="icon-btn" aria-label="Cerrar" onClick={onClose}>
          ✕
        </button>
      </div>
      {!hasContent(entry) && <p className="muted">Ese día no escribiste nada.</p>}
      {entry?.text && <p className="dy-read-text">{entry.text}</p>}
      {entry?.pages
        ?.filter((p) => p.strokes.length)
        .map((p, i) => (
          <PageView key={i} page={p} paper={s.paper} color={s.paperColor} header={formatLong(date)} />
        ))}
      {entry?.best && (
        <p>
          <b>⭐ Lo mejor:</b> {entry.best}
        </p>
      )}
      {entry?.tomorrow && (
        <p>
          <b>➡️ Para mañana:</b> {entry.tomorrow}
        </p>
      )}
      {!!entry?.tags?.length && <p className="muted">{entry.tags.map((t) => `#${t}`).join(' ')}</p>}
      <button type="button" className="btn" onClick={onEdit} disabled={date > today}>
        ✏️ {hasContent(entry) ? 'Editar este día' : 'Escribir este día'}
      </button>
    </section>
  );
}
