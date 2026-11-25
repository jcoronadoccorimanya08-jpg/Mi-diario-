import type { ISODate } from './dates';

export type Theme = 'system' | 'dark' | 'light' | 'black';
export type Accent = 'verde' | 'violeta' | 'lima' | 'rosa' | 'vino';
export type TextSize = 'normal' | 'grande';

/** 1 = muy mal … 5 = muy bien. */
export type Mood = 1 | 2 | 3 | 4 | 5;

/** Un trazo de tinta: puntos (x, y, presión) en coordenadas de la hoja (0–1000 de ancho), todo en enteros. */
export interface Stroke {
  /** Color (índice en INK_COLORS). */
  c: number;
  /** Grosor base. */
  w: number;
  /** Resaltador (semitransparente y ancho). */
  h?: true;
  /** x0, y0, p0, x1, y1, p1, … (p de 0 a 100). */
  p: number[];
}

export interface Page {
  strokes: Stroke[];
}

export type Paper = 'renglon-estrecho' | 'renglon' | 'renglon-ancho' | 'cuadros-chicos' | 'cuadros' | 'blanco';
export type PaperColor = 'crema' | 'blanco' | 'oscuro';

/** Un día del diario. */
export interface Entry {
  date: ISODate;
  mood?: Mood;
  /** Lo que pasó hoy (teclado o voz). */
  text?: string;
  /** Lo que pasó hoy, a mano (una o más hojas). */
  pages?: Page[];
  /** Lo mejor del día. */
  best?: string;
  /** Para mañana. */
  tomorrow?: string;
  tags?: string[];
  fav?: true;
  /** Plantilla usada («examen», «viaje», «dificil»). */
  template?: string;
  /** La primera vez que guardaste el día (cuenta para la racha). */
  savedAt?: string;
  updatedAt?: string;
}

export interface Settings {
  /** Desde cuándo cuenta la racha. */
  startDate: ISODate;
  paper: Paper;
  paperColor: PaperColor;
  /** Hora del aviso de la noche («HH:MM»). */
  remindAt: string;
  /** Tus etiquetas guardadas (se ofrecen como botones). */
  tags: string[];
  nick?: string;
  theme: Theme;
  accent?: Accent;
  textSize?: TextSize;
  /** Código de sincronización celular ↔ tablet (solo dentro de tus datos cifrados). */
  syncCode?: string;
  autoLockMinutes: number;
  lastBackupAt?: string;
  createdAt: string;
}

export interface AppState {
  schema: 1;
  settings: Settings;
  entries: Record<ISODate, Entry>;
}
