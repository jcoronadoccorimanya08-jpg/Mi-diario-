/**
 * Respaldo cifrado como texto (.txt): Chrome en Android no comparte .json, pero sí .txt (Drive, WhatsApp, Archivos).
 */
import { todayISO } from './dates';
import { isWrapped } from './crypto';
import type { VaultRecord } from './vault';

const APP_ID = 'midiario';
type BackupRecord = Pick<VaultRecord, 'v' | 'lock' | 'data'>;

export function backupFileName(): string {
  return `midiario-${todayISO()}.txt`;
}

export function serializeBackup(record: BackupRecord): string {
  return JSON.stringify({ app: APP_ID, kind: 'backup', schema: 2, exportedAt: new Date().toISOString(), vault: record });
}

export type ParsedFile = { kind: 'backup'; record: BackupRecord };

/**
 * Lee el JSON de un archivo o de un texto pegado, tolerando lo que se cuela al copiar: caracteres invisibles,
 * texto antes o después de las llaves y, si con eso no basta, espacios raros y comillas tipográficas.
 * Si solo se pegó el nombre del archivo, lo dice con claridad.
 */
export function readLooseJSON(text: string, invalid: string): unknown {
  const clean = text.replace(/[\u200b-\u200d\u2060\ufeff]/g, '').trim();
  const a = clean.indexOf('{');
  const b = clean.lastIndexOf('}');
  if (a < 0 || b <= a) {
    if (/\.(txt|json)\s*\.*$/i.test(clean) || /configuraci[oó]n|respaldo/i.test(clean)) throw new Error('Pegaste solo el nombre del archivo. Copia todo su texto (empieza con «{») o elige el archivo con el botón de cargar.');
    throw new Error(invalid);
  }
  const body = clean.slice(a, b + 1);
  const spaces = body.replace(/[\u00a0\u2007\u202f]/g, ' ');
  // Primero tal cual; después con espacios normales; al final, también con comillas rectas.
  for (const candidate of [body, spaces, spaces.replace(/[\u201c-\u201f\u2033]/g, '"')]) {
    try {
      return JSON.parse(candidate);
    } catch {
      /* sigue con el siguiente intento */
    }
  }
  throw new Error(invalid);
}

/** Reconoce un respaldo cifrado o una configuración. Lanza un Error claro si no sirve. */
export function parseFile(text: string): ParsedFile {
  const o = readLooseJSON(text, 'El texto no es válido.') as Record<string, unknown> | null;
  if (!o || o.app !== APP_ID) throw new Error('Este archivo no es de Mi Diario.');
  if (o.kind === 'backup') {
    const v = o.vault as Partial<VaultRecord> | undefined;
    if (!v || v.v !== 2 || !isWrapped(v.data) || !v.lock?.pattern || !isWrapped(v.lock.pattern.wrapped)) {
      throw new Error('Este respaldo es de una versión anterior o está dañado.');
    }
    return { kind: 'backup', record: { v: 2, lock: { pattern: v.lock.pattern }, data: v.data } };
  }
  throw new Error('Tipo de archivo desconocido.');
}

function textFile(text: string, name = backupFileName()): File {
  return new File([text], name, { type: 'text/plain' });
}

export function canShareFiles(): boolean {
  try {
    return typeof navigator.canShare === 'function' && navigator.canShare({ files: [textFile('{}')] });
  } catch {
    return false;
  }
}

export async function shareBackupText(text: string, name?: string): Promise<'shared' | 'cancelled'> {
  try {
    await navigator.share({ files: [textFile(text, name)], title: name ? 'Mi Diario' : 'Respaldo' });
    return 'shared';
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled';
    throw err;
  }
}

export function downloadBackupText(text: string, name?: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name ?? backupFileName();
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
