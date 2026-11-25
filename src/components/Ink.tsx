import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { HIGHLIGHT, INK_COLORS, INK_COLORS_DARK, INK_NAMES, PAGE_H, PAGE_W } from '../lib/config';
import type { Page, Paper, PaperColor, Stroke } from '../lib/types';

/**
 * Una hoja para escribir a mano con el S Pen (o con el dedo, si lo activas).
 * - Solo el lápiz escribe: la palma no raya y el dedo desplaza la hoja.
 * - La presión cambia el grosor, como un lapicero.
 * - La tinta se guarda como trazos (no como foto): pesa poco y se ve nítida en cualquier pantalla.
 */

const PAPER_BG: Record<PaperColor, string> = { crema: '#fbf6e8', blanco: '#ffffff', oscuro: '#1b1e23' };
const LINE: Record<PaperColor, string> = { crema: '#bcd0e8', blanco: '#c7d6ea', oscuro: '#38404d' };
const MARGIN: Record<PaperColor, string> = { crema: '#e7a3a3', blanco: '#ec9e9e', oscuro: '#6e4148' };
const HEADER_INK: Record<PaperColor, string> = { crema: '#6b6252', blanco: '#666666', oscuro: '#9aa3ad' };
const SPACING: Partial<Record<Paper, number>> = { 'renglon-estrecho': 40, renglon: 52, 'renglon-ancho': 68, 'cuadros-chicos': 28, cuadros: 48 };
/** Donde empiezan los renglones (arriba va la fecha). */
const TOP = 120;
const MARGIN_X = 92;

export type Tool = 'pen' | 'highlight' | 'eraser';

export function drawPaper(ctx: CanvasRenderingContext2D, scale: number, paper: Paper, color: PaperColor, header: string) {
  const w = PAGE_W * scale;
  const h = PAGE_H * scale;
  ctx.fillStyle = PAPER_BG[color];
  ctx.fillRect(0, 0, w, h);
  const step = SPACING[paper];
  ctx.lineWidth = Math.max(1, 1.4 * scale);
  if (paper.startsWith('renglon') && step) {
    ctx.strokeStyle = LINE[color];
    for (let y = TOP; y < PAGE_H - 30; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y * scale);
      ctx.lineTo(w, y * scale);
      ctx.stroke();
    }
    ctx.strokeStyle = MARGIN[color];
    ctx.beginPath();
    ctx.moveTo(MARGIN_X * scale, 0);
    ctx.lineTo(MARGIN_X * scale, h);
    ctx.stroke();
  } else if (paper.startsWith('cuadros') && step) {
    ctx.strokeStyle = LINE[color];
    ctx.globalAlpha = 0.75;
    for (let y = step; y < PAGE_H; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y * scale);
      ctx.lineTo(w, y * scale);
      ctx.stroke();
    }
    for (let x = step; x < PAGE_W; x += step) {
      ctx.beginPath();
      ctx.moveTo(x * scale, 0);
      ctx.lineTo(x * scale, h);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  // La fecha arriba, como en un cuaderno.
  ctx.fillStyle = HEADER_INK[color];
  ctx.font = `600 ${Math.round(30 * scale)}px system-ui, sans-serif`;
  ctx.fillText(header, (paper.startsWith('renglon') ? MARGIN_X + 18 : 40) * scale, 78 * scale);
}

function inkColor(s: Stroke, dark: boolean): string {
  if (s.h) return HIGHLIGHT;
  return (dark ? INK_COLORS_DARK : INK_COLORS)[s.c] ?? INK_COLORS[0]!;
}

export function drawStroke(ctx: CanvasRenderingContext2D, s: Stroke, scale: number, dark: boolean) {
  const p = s.p;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = inkColor(s, dark);
  if (s.h) {
    ctx.globalAlpha = dark ? 0.28 : 0.38;
    ctx.lineWidth = s.w * 4 * scale;
    ctx.beginPath();
    ctx.moveTo(p[0]! * scale, p[1]! * scale);
    for (let i = 3; i < p.length; i += 3) ctx.lineTo(p[i]! * scale, p[i + 1]! * scale);
    if (p.length === 3) ctx.lineTo(p[0]! * scale + 0.1, p[1]! * scale);
    ctx.stroke();
    ctx.restore();
    return;
  }
  if (p.length === 3) {
    ctx.fillStyle = ctx.strokeStyle;
    ctx.beginPath();
    ctx.arc(p[0]! * scale, p[1]! * scale, (s.w * scale * (0.55 + p[2]! / 110)) / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  // Tramos suaves: cada uno con el grosor de su presión.
  for (let i = 3; i < p.length; i += 3) {
    const x0 = p[i - 3]!;
    const y0 = p[i - 2]!;
    const x1 = p[i]!;
    const y1 = p[i + 1]!;
    const pr = (p[i - 1]! + p[i + 2]!) / 2;
    ctx.lineWidth = s.w * scale * (0.55 + pr / 110);
    ctx.beginPath();
    ctx.moveTo(x0 * scale, y0 * scale);
    ctx.lineTo(x1 * scale, y1 * scale);
    ctx.stroke();
  }
  ctx.restore();
}

/** Dibuja una hoja completa (también sirve para leerla en el calendario o para el PDF). */
export function renderPage(canvas: HTMLCanvasElement, page: Page, cssWidth: number, paper: Paper, color: PaperColor, header: string) {
  const dpr = Math.min(3, window.devicePixelRatio || 1);
  const scale = cssWidth / PAGE_W;
  canvas.width = Math.round(cssWidth * dpr);
  canvas.height = Math.round(cssWidth * (PAGE_H / PAGE_W) * dpr);
  canvas.style.width = `${cssWidth}px`;
  canvas.style.height = `${cssWidth * (PAGE_H / PAGE_W)}px`;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawPaper(ctx, scale, paper, color, header);
  for (const s of page.strokes) drawStroke(ctx, s, scale, color === 'oscuro');
}

/** Solo lectura: una hoja escrita, del ancho que le toque. */
export function PageView({ page, paper, color, header }: { page: Page; paper: Paper; color: PaperColor; header: string }) {
  const wrap = useRef<HTMLDivElement>(null);
  const cv = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const el = wrap.current;
    const c = cv.current;
    if (!el || !c) return;
    const draw = () => renderPage(c, page, el.clientWidth, paper, color, header);
    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(el);
    return () => ro.disconnect();
  }, [page, paper, color, header]);
  return (
    <div ref={wrap} className="ink-wrap">
      <canvas ref={cv} className="ink-canvas" role="img" aria-label={`Hoja escrita a mano: ${header}`} />
    </div>
  );
}

interface Props {
  page: Page;
  paper: Paper;
  color: PaperColor;
  header: string;
  onChange: (page: Page) => void;
}

const WIDTHS: [number, string][] = [
  [2.2, 'Fino'],
  [3.4, 'Medio'],
  [5.2, 'Grueso'],
];

/** La hoja para escribir, con su barra de herramientas. */
export function InkPad({ page, paper, color, header, onChange }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const cv = useRef<HTMLCanvasElement>(null);
  const [tool, setTool] = useState<Tool>('pen');
  const [ink, setInk] = useState(0);
  const [width, setWidth] = useState(WIDTHS[1]![0]);
  const [finger, setFinger] = useState(false);
  const [undo, setUndo] = useState<Page[]>([]);
  const [redo, setRedo] = useState<Page[]>([]);
  const cur = useRef<{ id: number; stroke: Stroke } | null>(null);
  const scroll = useRef<{ id: number; y: number } | null>(null);
  const scaleRef = useRef(1);
  const pageRef = useRef(page);
  pageRef.current = page;
  const dark = color === 'oscuro';

  const redraw = useCallback(() => {
    const el = wrap.current;
    const c = cv.current;
    if (!el || !c) return;
    scaleRef.current = el.clientWidth / PAGE_W;
    renderPage(c, pageRef.current, el.clientWidth, paper, color, header);
  }, [paper, color, header]);

  useLayoutEffect(() => {
    redraw();
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(redraw);
    ro.observe(el);
    return () => ro.disconnect();
  }, [redraw, page]);

  const commit = (next: Page) => {
    setUndo((u) => [...u.slice(-49), pageRef.current]);
    setRedo([]);
    onChange(next);
  };

  const point = (e: PointerEvent | React.PointerEvent) => {
    const r = cv.current!.getBoundingClientRect();
    const s = scaleRef.current;
    const pr = e.pointerType === 'pen' || e.pressure > 0 ? Math.round(Math.min(1, Math.max(0.05, e.pressure || 0.5)) * 100) : 50;
    return [Math.round((e.clientX - r.left) / s), Math.round((e.clientY - r.top) / s), pr] as const;
  };

  const eraseAt = (x: number, y: number) => {
    const rad = 16;
    const keep = pageRef.current.strokes.filter((s) => {
      for (let i = 0; i < s.p.length; i += 3) if (Math.abs(s.p[i]! - x) < rad && Math.abs(s.p[i + 1]! - y) < rad) return false;
      return true;
    });
    if (keep.length !== pageRef.current.strokes.length) {
      const next = { strokes: keep };
      pageRef.current = next;
      commit(next);
    }
  };

  const drawSegment = (s: Stroke, from: number) => {
    const ctx = cv.current?.getContext('2d');
    if (!ctx) return;
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // El resaltador es semitransparente: se redibuja la hoja y encima el trazo entero (si no, se oscurece).
    if (s.h) redraw();
    drawStroke(ctx, s.h ? s : { ...s, p: s.p.slice(Math.max(0, from - 3)) }, scaleRef.current, dark);
  };

  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const drawing = e.pointerType === 'pen' || e.pointerType === 'mouse' || (e.pointerType === 'touch' && finger);
    if (!drawing) {
      // El dedo desplaza la hoja (y la palma no raya).
      if (!cur.current) scroll.current = { id: e.pointerId, y: e.clientY };
      return;
    }
    e.preventDefault();
    cv.current?.setPointerCapture(e.pointerId);
    const [x, y, p] = point(e);
    if (tool === 'eraser') {
      cur.current = { id: e.pointerId, stroke: { c: 0, w: 0, p: [] } };
      eraseAt(x, y);
      return;
    }
    const stroke: Stroke = { c: ink, w: width, ...(tool === 'highlight' ? { h: true as const } : {}), p: [x, y, p] };
    cur.current = { id: e.pointerId, stroke };
    drawSegment(stroke, 0);
  };

  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (scroll.current && scroll.current.id === e.pointerId) {
      window.scrollBy(0, scroll.current.y - e.clientY);
      scroll.current = { id: e.pointerId, y: e.clientY };
      return;
    }
    const c = cur.current;
    if (!c || c.id !== e.pointerId) return;
    const events = typeof e.nativeEvent.getCoalescedEvents === 'function' ? e.nativeEvent.getCoalescedEvents() : [e.nativeEvent];
    for (const ev of events.length ? events : [e.nativeEvent]) {
      const [x, y, p] = point(ev);
      if (tool === 'eraser') {
        eraseAt(x, y);
        continue;
      }
      const s = c.stroke.p;
      const dx = x - s[s.length - 3]!;
      const dy = y - s[s.length - 2]!;
      if (dx * dx + dy * dy < 4) continue;
      const from = s.length;
      s.push(x, y, p);
      if (!c.stroke.h) drawSegment(c.stroke, from);
    }
    if (c.stroke.h) drawSegment(c.stroke, 0);
  };

  const onUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (scroll.current?.id === e.pointerId) scroll.current = null;
    const c = cur.current;
    if (!c || c.id !== e.pointerId) return;
    cur.current = null;
    if (tool === 'eraser' || c.stroke.p.length < 3) return;
    const next = { strokes: [...pageRef.current.strokes, c.stroke] };
    pageRef.current = next;
    commit(next);
  };

  useEffect(() => {
    // Sin el menú de mantener presionado ni la lupa del sistema sobre la hoja.
    const c = cv.current;
    if (!c) return;
    const stop = (ev: Event) => ev.preventDefault();
    c.addEventListener('contextmenu', stop);
    return () => c.removeEventListener('contextmenu', stop);
  }, []);

  return (
    <div className="ink">
      <div className="ink-tools" role="toolbar" aria-label="Herramientas de escritura">
        {INK_NAMES.map((n, i) => (
          <button
            key={n}
            type="button"
            className={`ink-color ${tool === 'pen' && ink === i ? 'on' : ''}`}
            style={{ background: (dark ? INK_COLORS_DARK : INK_COLORS)[i] }}
            aria-label={`Lápiz ${n.toLowerCase()}`}
            aria-pressed={tool === 'pen' && ink === i}
            onClick={() => {
              setInk(i);
              setTool('pen');
            }}
          />
        ))}
        <button type="button" className={`ink-btn ${tool === 'highlight' ? 'on' : ''}`} aria-pressed={tool === 'highlight'} onClick={() => setTool('highlight')}>
          🖍️ <span>Resaltar</span>
        </button>
        <button type="button" className={`ink-btn ${tool === 'eraser' ? 'on' : ''}`} aria-pressed={tool === 'eraser'} onClick={() => setTool('eraser')}>
          🧽 <span>Borrar</span>
        </button>
        <select className="ink-width" value={width} onChange={(e) => setWidth(Number(e.target.value))} aria-label="Grosor">
          {WIDTHS.map(([w, l]) => (
            <option key={w} value={w}>
              {l}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="ink-btn"
          disabled={!undo.length}
          aria-label="Deshacer"
          onClick={() => {
            const prev = undo[undo.length - 1]!;
            setUndo(undo.slice(0, -1));
            setRedo([...redo, pageRef.current]);
            onChange(prev);
          }}
        >
          ↶
        </button>
        <button
          type="button"
          className="ink-btn"
          disabled={!redo.length}
          aria-label="Rehacer"
          onClick={() => {
            const nxt = redo[redo.length - 1]!;
            setRedo(redo.slice(0, -1));
            setUndo([...undo, pageRef.current]);
            onChange(nxt);
          }}
        >
          ↷
        </button>
        <label className="ink-finger">
          <input type="checkbox" checked={finger} onChange={(e) => setFinger(e.target.checked)} />
          <span>Escribir con el dedo</span>
        </label>
      </div>
      <div ref={wrap} className="ink-wrap">
        <canvas ref={cv} className="ink-canvas" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} aria-label="Hoja para escribir a mano" />
      </div>
    </div>
  );
}
