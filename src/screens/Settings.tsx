import { useEffect, useRef, useState } from 'react';
import { Icon } from '../components/Icon';
import { PatternPad } from '../components/PatternPad';
import { SectionTitle } from '../components/ui';
import { canShareFiles, downloadBackupText, parseFile, serializeBackup, shareBackupText } from '../lib/backup';
import { diffDays, localDateOf, type ISODate } from '../lib/dates';
import { toast } from '../lib/feedback';
import { ACCENTS, THEMES } from '../lib/look';
import { actions, biometricSupport, changePattern, currentBackup, disableBiometric, enableBiometric, openBackup, replaceState, verifyPattern } from '../lib/store';
import type { AppState } from '../lib/types';
import type { VaultRecord } from '../lib/vault';

type Overlay = { kind: 'change' } | { kind: 'backup'; record: Pick<VaultRecord, 'lock' | 'data'>; merge: boolean } | null;

export function Settings({ state, today, hasBio }: { state: AppState; today: ISODate; hasBio: boolean }) {
  const s = state.settings;
  const [remind, setRemind] = useState(s.remindAt);
  const [nick, setNick] = useState(s.nick ?? '');
  const [bio, setBio] = useState<'yes' | 'maybe' | 'no'>('maybe');
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [paste, setPaste] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const mergeMode = useRef(false);
  useEffect(() => {
    void biometricSupport().then(setBio);
  }, []);

  const backup = async (mode: 'share' | 'copy') => {
    try {
      const rec = await currentBackup();
      if (!rec) return;
      const text = serializeBackup(rec);
      if (mode === 'copy') await navigator.clipboard.writeText(text);
      else if (canShareFiles()) {
        if ((await shareBackupText(text)) === 'cancelled') return;
      } else downloadBackupText(text);
      actions.markBackup();
      toast(mode === 'copy' ? 'Respaldo copiado. Pégalo en una nota privada o en Drive.' : 'Respaldo listo.', 'success');
    } catch {
      toast('No se pudo crear el respaldo. Prueba con «Copiar».', 'error');
    }
  };

  const readText = (text: string) => {
    try {
      const f = parseFile(text);
      setOverlay({ kind: 'backup', record: f.record, merge: mergeMode.current });
      setPaste(null);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Archivo inválido.', 'error');
    }
  };

  const last = s.lastBackupAt ? localDateOf(s.lastBackupAt) : null;
  return (
    <>
      <SectionTitle>Mi diario</SectionTitle>
      <section className="card stack">
        <label className="lbl-field">
          <span>Hora del aviso de la noche (en el widget)</span>
          <input className="field" type="time" value={remind} onChange={(e) => setRemind(e.target.value || remind)} onBlur={() => actions.setRemindAt(remind)} />
        </label>
        <label className="lbl-field">
          <span>Cómo te llamo (opcional)</span>
          <input className="field" value={nick} onChange={(e) => setNick(e.target.value)} onBlur={() => actions.setNick(nick)} />
        </label>
      </section>

      <SectionTitle>Apariencia</SectionTitle>
      <section className="card stack">
        <div className="segmented" role="radiogroup" aria-label="Tema">
          {THEMES.map(([t, l]) => (
            <button key={t} type="button" role="radio" aria-checked={s.theme === t} onClick={() => actions.setTheme(t)}>
              {l}
            </button>
          ))}
        </div>
        <div className="segmented" role="radiogroup" aria-label="Color">
          {ACCENTS.map(([a, l]) => (
            <button key={a} type="button" role="radio" aria-checked={(s.accent ?? 'verde') === a} onClick={() => actions.setAccent(a)}>
              {l}
            </button>
          ))}
        </div>
        <div className="segmented" role="radiogroup" aria-label="Letra">
          <button type="button" role="radio" aria-checked={(s.textSize ?? 'normal') === 'normal'} onClick={() => actions.setTextSize('normal')}>
            Letra normal
          </button>
          <button type="button" role="radio" aria-checked={s.textSize === 'grande'} onClick={() => actions.setTextSize('grande')}>
            Letra grande
          </button>
        </div>
      </section>

      <SectionTitle>Seguridad</SectionTitle>
      <section className="card list">
        <div className="item">
          <span className="txt">
            <b>Huella</b>
            <span>{hasBio ? 'Activada' : bio === 'no' ? 'Este teléfono no la permite aquí' : 'Entra sin dibujar el patrón'}</span>
          </span>
          {hasBio ? (
            <button type="button" className="btn sm" onClick={() => void disableBiometric().then(() => toast('Huella desactivada.'))}>
              Quitar
            </button>
          ) : bio !== 'no' ? (
            <button
              type="button"
              className="btn primary sm"
              onClick={async () => {
                try {
                  await enableBiometric();
                  toast('Huella activada.', 'success');
                } catch (e) {
                  const msg = e instanceof Error ? e.message : '';
                  toast(msg === 'NOPRF' ? 'Tu teléfono no permite usar la huella aquí.' : 'No se activó la huella.', 'error');
                  if (msg === 'NOPRF') setBio('no');
                }
              }}
            >
              <Icon name="fingerprint" size={17} /> Activar
            </button>
          ) : null}
        </div>
        <div className="item">
          <span className="txt">
            <b>Patrón</b>
            <span>Cámbialo cuando quieras</span>
          </span>
          <button type="button" className="btn sm" onClick={() => setOverlay({ kind: 'change' })}>
            Cambiar
          </button>
        </div>
        <div className="item">
          <span className="txt">
            <b>Bloqueo automático</b>
            <span>Al salir de la app</span>
          </span>
          <select className="field bf-mini" value={s.autoLockMinutes} onChange={(e) => actions.setAutoLock(Number(e.target.value))} aria-label="Bloqueo automático">
            <option value={0}>Al instante</option>
            <option value={1}>1 min</option>
            <option value={5}>5 min</option>
            <option value={15}>15 min</option>
          </select>
        </div>
      </section>

      <SectionTitle>Pasar mi diario (tablet ↔ celular)</SectionTitle>
      <section className="card stack">
        <p className="fine">1. En el dispositivo donde escribiste, toca «Compartir o guardar» (abajo) y mándate el archivo. 2. En el otro, toca «Juntar con este diario» y dibuja el patrón de ese dispositivo. Se junta día por día, sin borrar nada.</p>
        <button
          type="button"
          className="btn primary"
          onClick={() => {
            mergeMode.current = true;
            fileRef.current?.click();
          }}
        >
          <Icon name="upload" size={18} /> Juntar con este diario
        </button>
      </section>

      <SectionTitle>Respaldo</SectionTitle>
      <section className="card stack">
        <p className="fine">{!last ? 'Todavía no hiciste ningún respaldo.' : last === today ? 'Último respaldo: hoy.' : `Último respaldo: hace ${diffDays(last, today)} días.`} Va cifrado con tu patrón.</p>
        <div className="btn-row">
          <button type="button" className="btn primary" onClick={() => void backup('share')}>
            <Icon name="share" size={18} /> Compartir o guardar
          </button>
          <button type="button" className="btn" onClick={() => void backup('copy')}>
            <Icon name="copy" size={18} /> Copiar
          </button>
        </div>
        <div className="btn-row">
          <button
            type="button"
            className="btn"
            onClick={() => {
              mergeMode.current = false;
              fileRef.current?.click();
            }}
          >
            <Icon name="upload" size={18} /> Restaurar desde archivo
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => {
              mergeMode.current = false;
              setPaste('');
            }}
          >
            Pegar texto
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".txt,.json,text/plain,application/json"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) readText(await f.text());
          }}
        />
        {paste !== null && (
          <div className="stack">
            <textarea className="field" rows={4} value={paste} onChange={(e) => setPaste(e.target.value)} placeholder="Pega aquí el texto del respaldo" />
            <button type="button" className="btn primary" disabled={!paste.trim()} onClick={() => readText(paste)}>
              Abrir
            </button>
          </div>
        )}
      </section>
      <p className="fine bf-version">Mi Diario {__APP_VERSION__} · sin servidores · lo que escribes vive solo en tus dispositivos</p>

      {overlay?.kind === 'change' && <ChangePattern onClose={() => setOverlay(null)} />}
      {overlay?.kind === 'backup' && (
        <BackupPattern
          record={overlay.record}
          onClose={() => setOverlay(null)}
          onOpened={(st) => {
            if (overlay.merge) {
              const r = actions.mergeFrom(st);
              toast(`Listo: llegaron ${r.added} días y se juntaron ${r.joined}.`, 'success');
            } else {
              replaceState(st);
              toast('Respaldo restaurado.', 'success');
            }
            setOverlay(null);
          }}
        />
      )}
    </>
  );
}

function PatternOverlay({ title, text, onClose, onPattern }: { title: string; text: string; onClose: () => void; onPattern: (p: string) => Promise<string | null> }) {
  const [err, setErr] = useState<string>();
  const [reset, setReset] = useState(0);
  const [busy, setBusy] = useState(false);
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" className="icon-btn overlay-close" aria-label="Cerrar" onClick={onClose}>
        <Icon name="x" />
      </button>
      <main className="lock">
        <h1>{title}</h1>
        <p>{text}</p>
        <PatternPad
          resetKey={reset}
          error={Boolean(err)}
          disabled={busy}
          onComplete={async (p) => {
            setBusy(true);
            const e = await onPattern(p);
            setBusy(false);
            setErr(e ?? undefined);
            setReset((r) => r + 1);
          }}
        />
        <p className="pin-error" role="alert">
          {busy ? 'Un momento…' : (err ?? '')}
        </p>
      </main>
    </div>
  );
}

function ChangePattern({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<'current' | 'new' | 'repeat'>('current');
  const [first, setFirst] = useState('');
  const text = step === 'current' ? 'Dibuja tu patrón actual.' : step === 'new' ? 'Dibuja el nuevo patrón.' : 'Repítelo para confirmar.';
  return (
    <PatternOverlay
      key={step}
      title="Cambiar patrón"
      text={text}
      onClose={onClose}
      onPattern={async (p) => {
        if (step === 'current') {
          if (!(await verifyPattern(p))) return 'Patrón incorrecto.';
          setStep('new');
          return null;
        }
        if (step === 'new') {
          setFirst(p);
          setStep('repeat');
          return null;
        }
        if (p !== first) {
          setStep('new');
          return 'No coincide. Dibuja otra vez el nuevo patrón.';
        }
        await changePattern(p);
        toast('Patrón actualizado. Haz un respaldo nuevo.', 'success');
        onClose();
        return null;
      }}
    />
  );
}

function BackupPattern({ record, onClose, onOpened }: { record: Pick<VaultRecord, 'lock' | 'data'>; onClose: () => void; onOpened: (s: AppState) => void }) {
  return (
    <PatternOverlay
      title="Patrón del respaldo"
      text="El que tenías cuando hiciste este respaldo."
      onClose={onClose}
      onPattern={async (p) => {
        const st = await openBackup(record, p);
        if (!st) return 'Patrón incorrecto.';
        onOpened(st);
        return null;
      }}
    />
  );
}
