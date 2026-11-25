import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { sync } from './lib/syncSetup';
import { ConfettiHost } from './components/Confetti';
import { PrintView } from './components/PrintView';
import { BottomNav, ToastHost, type Tab } from './components/ui';
import { UpdateBanner, useServiceWorker } from './components/UpdateBanner';
import { WidgetHint } from './components/WidgetHint';
import { canShareFiles, downloadBackupText, serializeBackup, shareBackupText } from './lib/backup';
import { diffDays, localDateOf, type ISODate } from './lib/dates';
import { toast } from './lib/feedback';
import { useMediaQuery, useToday } from './lib/hooks';
import { applyLook, readLook, type Look } from './lib/look';
import { actions, currentBackup, getState, lock, onSaveError, useStore } from './lib/store';
import { buildWidgetPayload, sendWidget } from './lib/widget';
import { CalendarScreen } from './screens/Calendar';
import { LockScreen } from './screens/Lock';
import { ProgressScreen, type PrintRange } from './screens/Progress';
import { SearchScreen } from './screens/Search';
import { Setup } from './screens/Setup';
import { WriteScreen } from './screens/Write';

function useLook(look: Look) {
  const prefersDark = useMediaQuery('(prefers-color-scheme: dark)');
  useLayoutEffect(() => {
    applyLook(look, prefersDark);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [look.theme, look.accent, look.size, prefersDark]);
}

/** «Ahora», refrescado cada 30 s (para la racha). */
function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    const tick = () => setNow(new Date());
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
  }, []);
  return now;
}

export function App() {
  const sw = useServiceWorker();
  const { phase, state, hasBio } = useStore();
  const today = useToday();
  const now = useNow();
  const [tab, setTab] = useState<Tab>('hoy');
  const [day, setDay] = useState<ISODate | null>(null);
  const [print, setPrint] = useState<PrintRange | null>(null);
  const [curtain, setCurtain] = useState(false);
  const hiddenAt = useRef<number | null>(null);

  useLook(state ? { theme: state.settings.theme, accent: state.settings.accent ?? 'verde', size: state.settings.textSize ?? 'normal' } : readLook());
  useEffect(() => onSaveError((m) => toast(m, 'error')), []);

  // Widget de Android: si Mi Diario se abrió desde «Rachas», le manda la racha y las caritas (nunca el texto).
  useEffect(() => {
    if (state) sendWidget(buildWidgetPayload(state, now));
  }, [state, now]);

  // Bloqueo automático y cortina de privacidad al salir de la app.
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt.current = Date.now();
        setCurtain(true);
        return;
      }
      const minutes = getState()?.settings.autoLockMinutes ?? 1;
      if (hiddenAt.current !== null && Date.now() - hiddenAt.current >= minutes * 60_000) lock();
      hiddenAt.current = null;
      setCurtain(false);
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  useEffect(() => {
    if (phase !== 'unlocked') {
      setTab('hoy');
      setDay(null);
    }
  }, [phase]);

  // Al desbloquear: trae lo último de tu otro dispositivo (y sube lo pendiente).
  useEffect(() => {
    if (phase === 'unlocked') void sync.syncNow();
  }, [phase]);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [tab, day]);

  const updateBanner = <UpdateBanner needRefresh={sw.needRefresh} onUpdate={sw.update} />;

  if (phase === 'loading') return <div className="app" aria-busy="true" />;
  if (phase === 'setup')
    return (
      <>
        <Setup today={today} updateBanner={updateBanner} />
        <ToastHost />
      </>
    );
  if (phase === 'locked' || !state)
    return (
      <>
        <LockScreen hasBio={hasBio} updateBanner={updateBanner} />
        <ToastHost />
      </>
    );

  if (print) return <PrintView state={state} range={print} onDone={() => setPrint(null)} />;

  const lastBackup = state.settings.lastBackupAt ? localDateOf(state.settings.lastBackupAt) : null;
  const needBackup = lastBackup ? diffDays(lastBackup, today) >= 7 : diffDays(state.settings.startDate, today) >= 3;

  const quickBackup = async () => {
    try {
      const rec = await currentBackup();
      if (!rec) return;
      const text = serializeBackup(rec);
      if (canShareFiles()) {
        if ((await shareBackupText(text)) === 'cancelled') return;
      } else downloadBackupText(text);
      actions.markBackup();
      toast('Respaldo listo. Guárdalo en Drive o mándatelo por WhatsApp.', 'success');
    } catch {
      toast('No se pudo crear el respaldo. Prueba desde Avance → Respaldo.', 'error');
    }
  };

  const openDay = (d: ISODate) => {
    setDay(d === today ? null : d);
    setTab('hoy');
  };

  return (
    <>
      <div className="app">
        {updateBanner}
        <WidgetHint />
        {tab === 'hoy' && needBackup && (
          <div className="bf-alert dy-backup" role="note">
            <span>🛡️ {lastBackup ? `Tu último respaldo fue hace ${diffDays(lastBackup, today)} días.` : 'Todavía no hiciste un respaldo de tu diario.'}</span>
            <button type="button" className="btn sm" onClick={() => void quickBackup()}>
              Respaldar
            </button>
          </div>
        )}
        {tab === 'hoy' && <WriteScreen state={state} date={day ?? today} today={today} now={now} onOpenDay={openDay} />}
        {tab === 'calendario' && <CalendarScreen state={state} today={today} onOpenDay={openDay} />}
        {tab === 'buscar' && <SearchScreen state={state} today={today} onOpenDay={openDay} />}
        {tab === 'avance' && <ProgressScreen state={state} today={today} now={now} hasBio={hasBio} onPrint={setPrint} />}
      </div>
      <BottomNav
        tab={tab}
        onChange={(t) => {
          setTab(t);
          if (t === 'hoy') setDay(null);
        }}
        alerts={{ hoy: needBackup }}
      />
      <ToastHost />
      <ConfettiHost />
      {curtain && (
        <div className="curtain" aria-hidden="true">
          <img src={`${import.meta.env.BASE_URL}icons/icon-192.png`} alt="" />
        </div>
      )}
    </>
  );
}
