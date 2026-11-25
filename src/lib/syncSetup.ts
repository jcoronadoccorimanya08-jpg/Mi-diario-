/** Sincronización de esta app (ver sync.ts). */
import { mergeEntries } from './engine';
import { applyRemoteState, onCommit, realStateForSync, setSyncCode } from './store';
import { createSync } from './sync';
import type { AppState } from './types';

export const sync = createSync<AppState>({
  app: 'midiario',
  getState: realStateForSync,
  getCode: (s) => s.settings.syncCode,
  // Tu código se queda (si llegó otro estado, igual sigue usando el mismo código).
  applyRemote: (s) => applyRemoteState({ ...s, settings: { ...s.settings, syncCode: realStateForSync()?.settings.syncCode ?? s.settings.syncCode } }),
  merge: (local, remote) => ({ ...remote, settings: { ...remote.settings, syncCode: local.settings.syncCode }, entries: mergeEntries(local.entries, remote.entries).entries }),
  onCommit,
});

export function linkSync(code: string) {
  sync.reset();
  setSyncCode(code);
  void sync.syncNow();
}

export function unlinkSync() {
  setSyncCode(undefined);
  sync.reset();
}
