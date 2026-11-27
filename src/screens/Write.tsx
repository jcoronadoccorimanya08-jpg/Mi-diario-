import { useEffect, useRef, useState } from 'react';
import { celebrate } from '../components/Confetti';
import { Icon } from '../components/Icon';
import { InkPad } from '../components/Ink';
import { ScreenHeader } from '../components/ui';
import { MOODS, PAPERS, PAPER_COLORS, TEMPLATES } from '../lib/config';
import { addDays, formatLong, graceDay, type ISODate } from '../lib/dates';
import { dayStatus, hasContent, normTag, onThisDay, promptFor, streak, suggestTags, tagCounts } from '../lib/engine';
import { haptic, toast } from '../lib/feedback';
import { actions } from '../lib/store';
import type { AppState, Entry, Page, Paper, PaperColor } from '../lib/types';

type Mode = 'mano' | 'teclado';

/** En la tablet (pantalla grande) se empieza a mano; en el celular, con teclado o voz. */
const defaultMode = (): Mode => (typeof window !== 'undefined' && window.matchMedia?.('(min-width: 700px)').matches ? 'mano' : 'teclado');

/** Guarda lo que escribes un momento después de que paras (así no se cifra en cada letra). */
function useDebounced(fn: () => void, ms: number) {
  const t = useRef(0);
  const f = useRef(fn);
  f.current = fn;
  useEffect(() => () => window.clearTimeout(t.current), []);
  return {
    run: () => {
      window.clearTimeout(t.current);
      t.current = window.setTimeout(() => f.current(), ms);
    },
    flush: () => {
      window.clearTimeout(t.current);
      f.current();
    },
  };
}

export function WriteScreen({ state, date, today, now, onOpenDay }: { state: AppState; date: ISODate; today: ISODate; now: Date; onOpenDay: (d: ISODate) => void }) {
  const s = state.settings;
  const entry: Entry = state.entries[date] ?? { date };
  const [mode, setMode] = useState<Mode>(defaultMode);
  const [text, setText] = useState(entry.text ?? '');
  const [best, setBest] = useState(entry.best ?? '');
  const [tomorrow, setTomorrow] = useState(entry.tomorrow ?? '');
  const [pageIx, setPageIx] = useState(0);
  const [newTag, setNewTag] = useState('');
  const [paper, setPaper] = useState<Paper>(s.paper);
  const [paperColor, setPaperColor] = useState<PaperColor>(s.paperColor);
  const isToday = date === today;
  const st = dayStatus(state, date, now);
  const yesterday = addDays(today, -1);
  // De 00:00 a 03:59: si se te pasó escribir ayer, todavía cuenta (75 %).
  const yesterdayOpen = graceDay(now) === yesterday && dayStatus(state, yesterday, now).kind === 'open';
  const inGrace = !isToday && date === graceDay(now) && st.kind === 'open';
  const written = st.kind === 'written';
  const pages: Page[] = entry.pages?.length ? entry.pages : [{ strokes: [] }];
  const page = pages[Math.min(pageIx, pages.length - 1)]!;
  const run = streak(state, now);
  const memories = isToday ? onThisDay(state, today) : [];
  const template = TEMPLATES.find((t) => t.id === entry.template);
  const all = tagCounts(state);
  const suggestions = suggestTags(state, { ...entry, text, best, tomorrow });

  // Si cambias de día, se cargan sus textos.
  useEffect(() => {
    const e = state.entries[date];
    setText(e?.text ?? '');
    setBest(e?.best ?? '');
    setTomorrow(e?.tomorrow ?? '');
    setPageIx(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  const save = useDebounced(() => actions.editDay(date, { text, best, tomorrow }), 700);

  const saveDay = () => {
    save.flush();
    const willHave = hasContent({ ...entry, text, best, tomorrow });
    if (!willHave) {
      toast('Escribe algo (o elige tu carita) para guardar tu día.', 'neutral');
      return;
    }
    const first = !entry.savedAt;
    actions.editDay(date, { text, best, tomorrow }, { save: true });
    haptic([20, 40, 20]);
    if (first && isToday) {
      celebrate('day');
      toast(`¡Día guardado! Racha de ${run + (written ? 0 : 1)} 🔥`, 'reward');
    } else toast('Guardado.', 'success');
  };

  return (
    <main className="screen">
      <ScreenHeader
        eyebrow={formatLong(date)}
        title={isToday ? (s.nick ? `Hola, ${s.nick}` : 'Mi día') : inGrace ? 'Lo de ayer' : 'Otro día'}
        right={
          <div className="streak-pill" aria-label={`Racha de ${run} días`}>
            <Icon name="flame" size={18} /> {run}
          </div>
        }
      />
      {!isToday && (
        <button type="button" className="btn ghost" onClick={() => onOpenDay(today)}>
          ← Volver a hoy
        </button>
      )}
      {isToday && yesterdayOpen && (
        <section className="card dy-yesterday" role="alert">
          <p>
            <b>🌙 ¿Se te pasó escribir ayer?</b>
            <br />
            <span className="muted">Ya es otro día (cambia a las 00:00), pero hasta las 4:00 lo de ayer todavía cuenta: vale 75 % y tu racha sigue.</span>
          </p>
          <button type="button" className="btn primary" onClick={() => onOpenDay(yesterday)}>
            Escribir lo de ayer
          </button>
        </section>
      )}

      {memories.map((m) => (
        <button key={m.label} type="button" className="card dy-memory" onClick={() => onOpenDay(m.entry.date)}>
          <span>
            📖 {m.label} hoy {m.entry.mood ? MOODS[m.entry.mood - 1]!.face : ''}
          </span>
          <small className="muted">Toca para leer lo que escribiste</small>
        </button>
      ))}

      <section className="card">
        <h2 className="card-title">¿Cómo estuvo tu día?</h2>
        <div className="dy-moods" role="radiogroup" aria-label="Tu ánimo">
          {MOODS.map((m) => (
            <button key={m.v} type="button" role="radio" aria-checked={entry.mood === m.v} aria-label={m.label} className="dy-mood" onClick={() => actions.editDay(date, { mood: entry.mood === m.v ? undefined : m.v })}>
              {m.face}
            </button>
          ))}
        </div>
      </section>

      <section className="card dy-prompt">
        <span className="muted">Pregunta del día</span>
        <b>{promptFor(date)}</b>
        <div className="chips dy-templates">
          {TEMPLATES.map((t) => (
            <button key={t.id} type="button" className={`chip ${entry.template === t.id ? 'on' : ''}`} aria-pressed={entry.template === t.id} onClick={() => actions.editDay(date, { template: entry.template === t.id ? undefined : t.id })}>
              {t.label}
            </button>
          ))}
        </div>
        {template && (
          <ol className="dy-questions">
            {template.questions.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ol>
        )}
      </section>

      <section className="card">
        <div className="dy-head">
          <h2 className="card-title">Lo que pasó hoy</h2>
          <div className="segmented dy-mode" role="radiogroup" aria-label="Cómo escribir">
            <button type="button" role="radio" aria-checked={mode === 'mano'} onClick={() => setMode('mano')}>
              ✍️ A mano
            </button>
            <button type="button" role="radio" aria-checked={mode === 'teclado'} onClick={() => setMode('teclado')}>
              ⌨️ Teclado o voz
            </button>
          </div>
        </div>
        {mode === 'teclado' ? (
          <>
            <textarea
              className="field dy-text"
              rows={8}
              value={text}
              placeholder="Escribe con calma… Para dictar, toca el 🎤 de tu teclado."
              onChange={(e) => {
                setText(e.target.value);
                save.run();
              }}
              onBlur={save.flush}
              aria-label="Lo que pasó hoy"
            />
            {(entry.pages ?? []).some((p) => p.strokes.length) && <p className="fine">También tienes {entry.pages!.length} {entry.pages!.length === 1 ? 'hoja' : 'hojas'} a mano: cámbiate a «A mano» para verlas.</p>}
          </>
        ) : (
          <>
            <div className="dy-paper">
              <select
                className="field"
                value={paper}
                aria-label="Tipo de hoja"
                onChange={(e) => {
                  setPaper(e.target.value as Paper);
                  actions.setPaper(e.target.value as Paper);
                }}
              >
                {PAPERS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
              <select
                className="field"
                value={paperColor}
                aria-label="Color del papel"
                onChange={(e) => {
                  setPaperColor(e.target.value as PaperColor);
                  actions.setPaperColor(e.target.value as PaperColor);
                }}
              >
                {PAPER_COLORS.map((p) => (
                  <option key={p.id} value={p.id}>
                    Papel {p.label.toLowerCase()}
                  </option>
                ))}
              </select>
            </div>
            <InkPad
              key={`${date}-${pageIx}`}
              page={page}
              paper={paper}
              color={paperColor}
              header={formatLong(date)}
              onChange={(pg) => {
                const next = [...pages];
                next[Math.min(pageIx, pages.length - 1)] = pg;
                actions.editDay(date, { pages: next });
              }}
            />
            <div className="dy-pages">
              <button type="button" className="btn sm" disabled={pageIx === 0} onClick={() => setPageIx(pageIx - 1)}>
                ← Hoja anterior
              </button>
              <span className="muted">
                Hoja {Math.min(pageIx, pages.length - 1) + 1} de {pages.length}
              </span>
              {pageIx < pages.length - 1 ? (
                <button type="button" className="btn sm" onClick={() => setPageIx(pageIx + 1)}>
                  Siguiente →
                </button>
              ) : (
                <button
                  type="button"
                  className="btn sm"
                  disabled={!page.strokes.length}
                  onClick={() => {
                    actions.editDay(date, { pages: [...pages, { strokes: [] }] });
                    setPageIx(pages.length);
                  }}
                >
                  + Nueva hoja
                </button>
              )}
            </div>
          </>
        )}
      </section>

      <section className="card stack">
        <label className="lbl-field">
          <span>⭐ Lo mejor del día</span>
          <input
            className="field"
            value={best}
            maxLength={500}
            onChange={(e) => {
              setBest(e.target.value);
              save.run();
            }}
            onBlur={save.flush}
          />
        </label>
        <label className="lbl-field">
          <span>➡️ Para mañana</span>
          <input
            className="field"
            value={tomorrow}
            maxLength={500}
            onChange={(e) => {
              setTomorrow(e.target.value);
              save.run();
            }}
            onBlur={save.flush}
          />
        </label>
      </section>

      <section className="card">
        <h2 className="card-title">Etiquetas</h2>
        {suggestions.length > 0 && (
          <div className="chips dy-suggest">
            <span className="muted">¿Le pones?</span>
            {suggestions.map((t) => (
              <button key={t} type="button" className="chip" onClick={() => actions.toggleTag(date, t)}>
                + #{t}
              </button>
            ))}
          </div>
        )}
        <div className="chips">
          {all.slice(0, 16).map(({ tag }) => (
            <button key={tag} type="button" className={`chip ${(entry.tags ?? []).includes(tag) ? 'on' : ''}`} aria-pressed={(entry.tags ?? []).includes(tag)} onClick={() => actions.toggleTag(date, tag)}>
              #{tag}
            </button>
          ))}
        </div>
        <form
          className="dy-newtag"
          onSubmit={(e) => {
            e.preventDefault();
            if (!normTag(newTag)) return;
            actions.toggleTag(date, newTag);
            setNewTag('');
          }}
        >
          <input className="field" value={newTag} onChange={(e) => setNewTag(e.target.value)} placeholder="Nueva etiqueta: familia, u, gym…" aria-label="Nueva etiqueta" />
          <button type="submit" className="btn" disabled={!normTag(newTag)}>
            Agregar
          </button>
        </form>
        <p className="fine">Cada etiqueta nueva queda guardada como botón: la próxima vez solo la tocas.</p>
      </section>

      <section className="card dy-save">
        {written ? (
          <p>
            <b>Día guardado · {st.kind === 'written' ? st.pct : 0} %</b> <span className="muted">{st.kind === 'written' && st.late ? '(pasada la medianoche)' : '(a tiempo)'}. Puedes seguir escribiendo cuando quieras.</span>
          </p>
        ) : (
          <p className="muted">{isToday ? 'Antes de las 00:00 vale 100 %. Si se te pasa, hasta las 4:00 todavía puedes escribir «ayer» (75 %).' : inGrace ? 'Hasta las 4:00 todavía cuenta: si lo guardas ahora, vale 75 % y tu racha sigue.' : 'Los días pasados quedan en tu diario, pero no suman a la racha.'}</p>
        )}
        <div className="btn-row">
          <button type="button" className="btn primary dy-save-btn" onClick={saveDay}>
            <Icon name="check" /> {written ? 'Guardar cambios' : 'Guardar mi día'}
          </button>
          <button type="button" className={`btn ${entry.fav ? 'primary' : ''}`} aria-pressed={Boolean(entry.fav)} aria-label="Favorito" onClick={() => actions.toggleFav(date)}>
            {entry.fav ? '⭐' : '☆'}
          </button>
        </div>
      </section>
    </main>
  );
}
