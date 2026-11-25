import { useEffect, useState } from 'react';
import { renderPage } from './Ink';
import { MOODS } from '../lib/config';
import { formatLong, rangeDates } from '../lib/dates';
import { hasContent } from '../lib/engine';
import type { AppState } from '../lib/types';
import type { PrintRange } from '../screens/Progress';

/**
 * Tu diario como cuaderno para imprimir o «Guardar como PDF» (desde el menú de imprimir de Android).
 * Las hojas a mano se dibujan como imágenes nítidas. Todo pasa en tu teléfono.
 */
export function PrintView({ state, range, onDone }: { state: AppState; range: PrintRange; onDone: () => void }) {
  const [imgs, setImgs] = useState<Record<string, string[]> | null>(null);
  const days = rangeDates(range.from, range.to).filter((d) => hasContent(state.entries[d]));
  useEffect(() => {
    const out: Record<string, string[]> = {};
    const c = document.createElement('canvas');
    for (const d of days) {
      const pages = state.entries[d]?.pages?.filter((p) => p.strokes.length) ?? [];
      out[d] = pages.map((p) => {
        renderPage(c, p, 700, state.settings.paper, state.settings.paperColor === 'oscuro' ? 'blanco' : state.settings.paperColor, formatLong(d));
        return c.toDataURL('image/png');
      });
    }
    setImgs(out);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);
  useEffect(() => {
    if (!imgs) return;
    const done = () => onDone();
    window.addEventListener('afterprint', done, { once: true });
    const t = window.setTimeout(() => window.print(), 300);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('afterprint', done);
    };
  }, [imgs, onDone]);
  return (
    <div className="print-view" aria-label="Vista para imprimir">
      <div className="print-bar no-print">
        <span>Preparando tu PDF… En el menú elige «Guardar como PDF».</span>
        <button type="button" className="btn sm" onClick={onDone}>
          Cerrar
        </button>
      </div>
      <h1 className="print-title">{range.title}</h1>
      {!days.length && <p>No hay días escritos en estas fechas.</p>}
      {days.map((d) => {
        const e = state.entries[d]!;
        return (
          <article key={d} className="print-day">
            <h2>
              {e.mood ? MOODS[e.mood - 1]!.face : ''} {formatLong(d)} {e.fav ? '⭐' : ''}
            </h2>
            {e.text && <p className="print-text">{e.text}</p>}
            {(imgs?.[d] ?? []).map((src, i) => (
              <img key={i} src={src} alt={`Hoja ${i + 1} a mano`} className="print-page" />
            ))}
            {e.best && (
              <p>
                <b>⭐ Lo mejor:</b> {e.best}
              </p>
            )}
            {e.tomorrow && (
              <p>
                <b>➡️ Para mañana:</b> {e.tomorrow}
              </p>
            )}
            {!!e.tags?.length && <p className="print-tags">{e.tags.map((t) => `#${t}`).join(' ')}</p>}
          </article>
        );
      })}
    </div>
  );
}
