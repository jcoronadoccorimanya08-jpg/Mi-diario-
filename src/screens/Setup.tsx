import { useRef, useState, type ReactNode } from 'react';
import { Icon } from '../components/Icon';
import { InstallCard } from '../components/InstallCard';
import { PatternPad } from '../components/PatternPad';
import { parseFile } from '../lib/backup';
import { APP_NAME } from '../lib/config';
import type { ISODate } from '../lib/dates';
import { toast } from '../lib/feedback';
import { createVault, initialState, openBackup } from '../lib/store';
import type { VaultRecord } from '../lib/vault';

type Step = { kind: 'welcome' } | { kind: 'pattern'; first?: string } | { kind: 'backup'; record: Pick<VaultRecord, 'lock' | 'data'> };

export function Setup({ today, updateBanner }: { today: ISODate; updateBanner?: ReactNode }) {
  const [step, setStep] = useState<Step>({ kind: 'welcome' });
  const [nick, setNick] = useState('');
  const [err, setErr] = useState<string>();
  const [reset, setReset] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  if (step.kind !== 'welcome') {
    const isBackup = step.kind === 'backup';
    return (
      <main className="lock">
        {updateBanner}
        <h1>{isBackup ? 'Patrón del respaldo' : step.first ? 'Repite tu patrón' : 'Crea tu patrón'}</h1>
        <p>{isBackup ? 'El que tenías cuando hiciste el respaldo. Será también tu patrón aquí.' : 'Une al menos 4 puntos. Con él se cifra tu diario: nadie más lo puede leer.'}</p>
        <PatternPad
          resetKey={reset}
          error={Boolean(err)}
          onComplete={async (p) => {
            if (step.kind === 'backup') {
              const st = await openBackup(step.record, p);
              if (!st) {
                setErr('Patrón incorrecto.');
                setReset((r) => r + 1);
                return;
              }
              await createVault(p, st);
              return;
            }
            if (p.split('-').length < 4) {
              setErr('Une al menos 4 puntos.');
              setReset((r) => r + 1);
              return;
            }
            if (!step.first) {
              setErr(undefined);
              setStep({ kind: 'pattern', first: p });
              setReset((r) => r + 1);
              return;
            }
            if (p !== step.first) {
              setErr('No coincide. Empecemos otra vez.');
              setStep({ kind: 'pattern' });
              setReset((r) => r + 1);
              return;
            }
            await createVault(p, initialState(today, nick));
          }}
        />
        <p className="pin-error" role="alert">
          {err ?? ''}
        </p>
        <button type="button" className="link-btn" onClick={() => setStep({ kind: 'welcome' })}>
          Volver
        </button>
      </main>
    );
  }

  return (
    <main className="screen onb">
      {updateBanner}
      <img className="onb-logo" src={`${import.meta.env.BASE_URL}icons/icon-192.png`} alt="" width={72} height={72} />
      <h1 className="onb-title">{APP_NAME}</h1>
      <p className="muted">Tu diario de cada día: a mano con tu lápiz, con teclado o por voz. Con racha, calendario de tu ánimo y tus recuerdos. Todo cifrado y solo en tus dispositivos.</p>
      <label className="lbl-field">
        <span>¿Cómo te llamo? (opcional)</span>
        <input className="field" value={nick} onChange={(e) => setNick(e.target.value)} maxLength={24} />
      </label>
      <button type="button" className="btn primary" onClick={() => setStep({ kind: 'pattern' })}>
        Empezar mi diario
      </button>
      <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
        <Icon name="upload" size={18} /> Ya tengo un respaldo
      </button>
      <input
        ref={fileRef}
        type="file"
        accept=".txt,.json,text/plain,application/json"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (!f) return;
          try {
            const r = parseFile(await f.text());
            setStep({ kind: 'backup', record: r.record });
          } catch (er) {
            toast(er instanceof Error ? er.message : 'Archivo inválido.', 'error');
          }
        }}
      />
      <InstallCard appName={APP_NAME} />
    </main>
  );
}
