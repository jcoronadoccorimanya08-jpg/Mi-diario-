import type { Mood, Paper, PaperColor } from './types';

export const APP_NAME = 'Mi Diario';

/** Escribir el día antes de medianoche vale 100 %; de 00:00 a 03:59, 75 %. */
export const ON_TIME_PCT = 100;
export const LATE_PCT = 75;
export const MOUNTAIN_DAYS = 14;
/** Insignias por días seguidos escribiendo. */
export const BADGES: { days: number; name: string }[] = [
  { days: 7, name: 'Una semana' },
  { days: 30, name: 'Un mes' },
  { days: 90, name: 'Tres meses' },
  { days: 365, name: 'Un año' },
];

export const MOODS: { v: Mood; face: string; label: string }[] = [
  { v: 1, face: '😞', label: 'Muy mal' },
  { v: 2, face: '😕', label: 'Mal' },
  { v: 3, face: '😐', label: 'Normal' },
  { v: 4, face: '🙂', label: 'Bien' },
  { v: 5, face: '😄', label: 'Muy bien' },
];

/** Colores de tinta (azul, negro, rojo, verde). En papel oscuro, el «negro» se ve claro. */
export const INK_COLORS = ['#1f4fb5', '#1d1d1f', '#c0392b', '#1e7d4f'];
export const INK_COLORS_DARK = ['#8ab4ff', '#ececec', '#ff8a7a', '#7ed6a5'];
export const INK_NAMES = ['Azul', 'Negro', 'Rojo', 'Verde'];
export const HIGHLIGHT = '#ffd84d';

export const PAPERS: { id: Paper; label: string }[] = [
  { id: 'renglon-estrecho', label: 'Renglón estrecho' },
  { id: 'renglon', label: 'Renglón normal' },
  { id: 'renglon-ancho', label: 'Renglón ancho' },
  { id: 'cuadros-chicos', label: 'Cuadros chicos' },
  { id: 'cuadros', label: 'Cuadros grandes' },
  { id: 'blanco', label: 'En blanco' },
];

export const PAPER_COLORS: { id: PaperColor; label: string }[] = [
  { id: 'crema', label: 'Crema' },
  { id: 'blanco', label: 'Blanco' },
  { id: 'oscuro', label: 'Oscuro' },
];

/** Ancho virtual de la hoja; el alto sigue la proporción de un cuaderno A5. */
export const PAGE_W = 1000;
export const PAGE_H = 1414;

/** La pregunta del día cambia sola (se elige por la fecha). */
export const PROMPTS = [
  '¿Qué te hizo sonreír hoy?',
  '¿Qué aprendiste hoy?',
  '¿Qué fue lo más difícil del día y cómo lo enfrentaste?',
  '¿A quién le agradeces hoy y por qué?',
  '¿Qué harías distinto si repitieras este día?',
  '¿Qué te dio energía hoy? ¿Qué te la quitó?',
  '¿De qué te sientes orgulloso hoy?',
  '¿Qué conversación te quedó dando vueltas?',
  '¿Qué pequeño avance hiciste hacia tus metas?',
  '¿Cómo cuidaste tu cuerpo hoy?',
  '¿Qué te preocupa y qué sí depende de ti?',
  '¿Qué momento de hoy quieres recordar en un año?',
  '¿Qué te sorprendió hoy?',
  '¿A quién ayudaste o quién te ayudó?',
  '¿Qué hábito te acercó a la persona que quieres ser?',
  '¿Qué te dijo tu cuerpo hoy (cansancio, hambre, ganas)?',
  '¿Qué estudiaste y qué se te quedó?',
  '¿Qué te gustaría decirle a tu yo de mañana?',
  '¿Qué cosa simple disfrutaste hoy?',
  '¿Qué decisión tomaste hoy y por qué?',
  '¿Cómo estuvo tu ánimo en la mañana, la tarde y la noche?',
  '¿Qué te hubiera gustado hacer y no hiciste?',
  '¿Qué te dio paz hoy?',
  '¿Qué aprendiste de alguien hoy?',
  '¿Qué meta pequeña vas a cumplir mañana?',
  '¿Qué te hizo reír?',
  '¿Qué noticia o idea te quedó dando vueltas?',
  '¿Qué agradeces de tu familia hoy?',
  '¿Qué te dio miedo y qué hiciste con eso?',
  '¿Cómo describirías hoy en tres palabras?',
];

/** Plantillas para días especiales: preguntas guía arriba de la hoja. */
export const TEMPLATES: { id: string; label: string; questions: string[] }[] = [
  { id: 'examen', label: '📚 Día de examen', questions: ['¿Cómo te fue y qué te preguntaron?', '¿Qué hiciste bien al prepararte?', '¿Qué cambiarías para el próximo?'] },
  { id: 'viaje', label: '🧳 Viaje', questions: ['¿Dónde estuviste y con quién?', '¿Qué fue lo más bonito que viste?', '¿Qué no quieres olvidar de este lugar?'] },
  { id: 'dificil', label: '🌧️ Día difícil', questions: ['¿Qué pasó? Escríbelo sin juzgarte.', '¿Qué sentiste en el cuerpo?', '¿Qué es una cosa pequeña que te puede ayudar mañana?'] },
];
