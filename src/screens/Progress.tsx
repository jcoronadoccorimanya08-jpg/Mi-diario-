import { useState } from 'react';
import { Mountain } from '../components/Mountain';
import { ScreenHeader, SectionTitle } from '../components/ui';
import { MOODS } from '../lib/config';
import { addDays, formatShort, weekdayShort, type ISODate } from '../lib/dates';
import { badges, bestStreak, monthSummary, mountain, streak, weekReview } from '../lib/engine';
import type { AppState } from '../lib/types';
import { Settings } from './Settings';

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

export type PrintRange = { from: ISODate; to: ISODate; title: string };

export function ProgressScreen({ state, today, now, hasBio, onPrint }: { state: AppState; today: ISODate; now: Date; hasBio: boolean; onPrint: (r: PrintRange) => void }) {
  const m = mountain(state, now);
  const avg = (i: number) => {
    const w = m.slice(Math.max(0, i - 6), i + 1);
    return w.reduce((s, x) => s + x.pct, 0) / w.length;
  };
  const best = bestStreak(state, now);
  const [ym, setYm] = useState(today.slice(0, 7));
  const sum = monthSummary(state, ym, today);
  const [y, mo] = ym.split('-').map(Number) as [number, number];
  const shift = (n: number) => {
    const t = y * 12 + (mo - 1) + n;
    setYm(`${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`);
  };
  const week = weekReview(state, today);
  const sunday = new Date(`${today}T12:00:00Z`).getUTCDay() === 0;
  return (
    <main className="screen">
      <ScreenHeader eyebrow="Tu hábito de escribir" title="Avance" />
      <div className="tiles">
        <div className="tile">
          <b>{streak(state, now)}</b>
          <span>Días seguidos</span>
        </div>
        <div className="tile">
          <b>{best}</b>
          <span>Tu mejor racha</span>
        </div>
      </div>
      <div className="chips dy-badges" aria-label="Insignias">
        {badges(best).map((b) => (
          <span key={b.days} className={`chip ${b.earned ? 'on' : ''}`}>
            {b.earned ? '🏅' : '🔒'} {b.name}
          </span>
        ))}
      </div>
      <section className="card">
        <h2 className="card-title">Tu montaña</h2>
        {m.length ? <Mountain data={m.map((x, i) => ({ date: x.date, pct: x.pct, avg7: avg(i), won: x.written }))} goal={100} /> : <p className="muted">Escribe tu primer día y aparece tu montaña.</p>}
        <p className="fine">100 %: escribiste antes de medianoche. 75 %: de madrugada.</p>
      </section>

      <SectionTitle aside={sunday ? '¡Hoy toca repaso!' : undefined}>Tu semana</SectionTitle>
      <section className="card list">
        {week.map((d) => (
          <div key={d.date} className="item">
            <span className="txt">
              <b>
                {weekdayShort(d.date)} {formatShort(d.date)} {d.mood ? MOODS[d.mood - 1]!.face : d.written ? '✍️' : '·'}
              </b>
              <span>{d.best ? `⭐ ${d.best}` : d.written ? 'Escribiste ✓' : 'Sin escribir'}</span>
            </span>
          </div>
        ))}
      </section>
      <button type="button" className="btn" onClick={() => onPrint({ from: addDays(today, -6), to: today, title: 'Mi semana' })}>
        📄 Exportar mi semana (PDF)
      </button>

      <SectionTitle>Tu mes</SectionTitle>
      <section className="card">
        <div className="dy-month-nav">
          <button type="button" className="icon-btn" aria-label="Mes anterior" onClick={() => shift(-1)}>
            ‹
          </button>
          <b>
            {MONTHS[mo - 1]} {y}
          </b>
          <button type="button" className="icon-btn" aria-label="Mes siguiente" onClick={() => shift(1)} disabled={ym >= today.slice(0, 7)}>
            ›
          </button>
        </div>
        <div className="tiles bf-tiles">
          <div className="tile">
            <b>
              {sum.written}
              <small>/{sum.days}</small>
            </b>
            <span>Días escritos</span>
          </div>
          <div className="tile">
            <b>{sum.moodAvg === null ? '—' : MOODS[Math.round(sum.moodAvg) - 1]!.face}</b>
            <span>Ánimo promedio{sum.moodAvg === null ? '' : ` (${String(sum.moodAvg).replace('.', ',')})`}</span>
          </div>
        </div>
        <div className="dy-moodbar" aria-label="Tus caritas del mes">
          {MOODS.map((x) => (
            <span key={x.v}>
              {x.face} <b>{sum.moods[x.v]}</b>
            </span>
          ))}
        </div>
        {sum.topWords.length > 0 && <p className="fine">Tus palabras: {sum.topWords.map((w) => w.w).join(', ')}</p>}
        {sum.topTags.length > 0 && <p className="fine">Tus etiquetas: {sum.topTags.map((t) => `#${t.tag} (${t.n})`).join(', ')}</p>}
        <button type="button" className="btn" onClick={() => onPrint({ from: `${ym}-01`, to: addDays(`${shiftYm(ym, 1)}-01`, -1), title: `Mi ${MONTHS[mo - 1]} ${y}` })}>
          📄 Exportar este mes (PDF)
        </button>
      </section>

      <Settings state={state} today={today} hasBio={hasBio} />
    </main>
  );
}

function shiftYm(ym: string, n: number): string {
  const [y, m] = ym.split('-').map(Number) as [number, number];
  const t = y * 12 + (m - 1) + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`;
}
