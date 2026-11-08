/** Inline SVG icons for the menus. Everything is drawn here: no image files. */
import type { Side, SupportKind, UnitKind } from '../../data/schema';
import { iconCanvas } from './dom';

const SVG_NS = 'http://www.w3.org/2000/svg';

interface PathSpec {
  d: string;
  /** CSS class that sets fill and stroke; without one the path is filled with currentColor. */
  cls?: string;
}

function svg(viewBox: string, className: string, paths: readonly PathSpec[]): SVGSVGElement {
  const node = document.createElementNS(SVG_NS, 'svg');
  node.setAttribute('viewBox', viewBox);
  node.setAttribute('class', className);
  node.setAttribute('aria-hidden', 'true');
  node.setAttribute('focusable', 'false');
  for (const p of paths) {
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', p.d);
    if (p.cls) path.setAttribute('class', p.cls);
    else path.setAttribute('fill', 'currentColor');
    node.append(path);
  }
  return node;
}

/** A Brodie "tin hat" seen from the side: shallow bowl, wide brim, chin strap. */
export function helmetIcon(className = 'th-helmet'): SVGSVGElement {
  return svg('0 0 200 112', className, [
    { cls: 'th-helmet-strap', d: 'M52 78 Q100 126 148 78' },
    { cls: 'th-helmet-dome', d: 'M40 66 C40 30 70 10 100 10 C130 10 160 30 160 66 Z' },
    { cls: 'th-helmet-shade', d: 'M112 11 C140 16 160 36 160 66 L128 66 C132 44 126 24 112 11 Z' },
    { cls: 'th-helmet-shine', d: 'M58 44 C62 30 76 20 92 17 C80 24 70 34 66 46 Z' },
    { cls: 'th-helmet-brim', d: 'M3 70 Q100 48 197 70 Q198 77 186 80 Q100 94 14 80 Q2 77 3 70 Z' },
    { cls: 'th-helmet-rim', d: 'M8 75 Q100 92 192 75' },
  ]);
}

function ringOfTeeth(cx: number, cy: number, rOuter: number, rRoot: number, teeth: number): string {
  let d = '';
  const step = (Math.PI * 2) / teeth;
  for (let i = 0; i < teeth; i++) {
    const a = i * step;
    const corners: [number, number][] = [
      [rRoot, a - step * 0.28],
      [rOuter, a - step * 0.16],
      [rOuter, a + step * 0.16],
      [rRoot, a + step * 0.28],
    ];
    for (const [r, ang] of corners) {
      const x = Math.round((cx + Math.cos(ang) * r) * 100) / 100;
      const y = Math.round((cy + Math.sin(ang) * r) * 100) / 100;
      d += `${d === '' ? 'M' : 'L'}${x} ${y}`;
    }
  }
  return `${d}Z`;
}

function starburst(cx: number, cy: number, rOuter: number, rInner: number, spikes: number): string {
  let d = '';
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 === 0 ? rOuter * (i % 4 === 0 ? 1 : 0.8) : rInner;
    const a = (i * Math.PI) / spikes - Math.PI / 2;
    const x = Math.round((cx + Math.cos(a) * r) * 100) / 100;
    const y = Math.round((cy + Math.sin(a) * r) * 100) / 100;
    d += `${i === 0 ? 'M' : 'L'}${x} ${y}`;
  }
  return `${d}Z`;
}

const COG = `${ringOfTeeth(12, 12, 10.5, 7.6, 8)}M12 8.4a3.6 3.6 0 1 0 0 7.2a3.6 3.6 0 1 0 0-7.2Z`;

export type GlyphName = 'back' | 'cog' | 'lock' | 'tick' | 'sound' | 'muted' | 'chevron' | 'cross';

const GLYPHS: Record<GlyphName, readonly PathSpec[]> = {
  back: [{ cls: 'th-line', d: 'M14.5 4.5 L7 12 L14.5 19.5' }],
  cog: [{ cls: 'th-evenodd', d: COG }],
  lock: [{ d: 'M5.5 11h13v9.5h-13Z' }, { cls: 'th-line', d: 'M8.5 11V8.2a3.5 3.5 0 0 1 7 0V11' }],
  tick: [{ cls: 'th-line', d: 'M5 12.5 L9.8 17.3 L19 7' }],
  sound: [{ d: 'M3.5 9h4l5.5-4.5v15L7.5 15h-4Z' }, { cls: 'th-line', d: 'M16.2 9a4.2 4.2 0 0 1 0 6M18.6 6.2a8.2 8.2 0 0 1 0 11.6' }],
  muted: [{ d: 'M3.5 9h4l5.5-4.5v15L7.5 15h-4Z' }, { cls: 'th-line', d: 'M16.5 9.5l5 5M21.5 9.5l-5 5' }],
  chevron: [{ d: 'M3 6.5l9 6.2 9-6.2v4.6l-9 6.2-9-6.2Z' }],
  cross: [{ cls: 'th-line', d: 'M6 6l12 12M18 6L6 18' }],
};

export function glyph(name: GlyphName, className = 'th-icon'): SVGSVGElement {
  return svg('0 0 24 24', className, GLYPHS[name]);
}

const SUPPORT_ICONS: Record<SupportKind, readonly PathSpec[]> = {
  artillery: [
    { d: starburst(24, 22, 19, 8, 9) },
    { cls: 'th-cut', d: starburst(24, 22, 8.5, 3.6, 7) },
    { d: 'M5 41h38v3H5Z' },
  ],
  smoke: [
    {
      d: 'M11 37a8.5 8.5 0 0 1-1.2-16.9A10.5 10.5 0 0 1 29.5 16a9.5 9.5 0 0 1 9 15.6A5.6 5.6 0 0 1 35 37Z',
    },
    { cls: 'th-cut', d: 'M15 30a4 4 0 0 1 0-8M24 27a5 5 0 0 1 6-7' },
    { d: 'M8 41h32v3H8Z' },
  ],
  airStrike: [
    { d: 'M3 25.5 L27 22 L31 6 L36 6 L34.5 21.5 L43 22.5 Q47 25 43 27.5 L34.5 28.5 L36 44 L31 44 L27 29 Z' },
    { d: 'M4 25.5 L3 18 L7 18 L11 24.3 Z M4 25.5 L3 33 L7 33 L11 26.7 Z' },
  ],
};

export function supportIcon(kind: SupportKind, className = 'th-support-icon'): SVGSVGElement {
  return svg('0 0 48 48', className, SUPPORT_ICONS[kind]);
}

export type PaintUnitIcon = (canvas: HTMLCanvasElement, kind: UnitKind, side: Side) => void;

/**
 * Paints how an upgrade looks in battle at `level` (1 to its maximum) into a canvas whose pixel size is already set;
 * returns false when it has no picture for that upgrade.
 */
export type PaintUpgradePreview = (canvas: HTMLCanvasElement, upgradeId: string, level: number) => boolean;

/**
 * A unit portrait for cards and group headings: the art track's painter when
 * the app supplied one, otherwise a plain tin hat so the layout still holds.
 */
export function unitIcon(kind: UnitKind, cssSize: number, paint: PaintUnitIcon | undefined): HTMLElement | SVGSVGElement {
  if (paint) {
    const canvas = iconCanvas(cssSize);
    try {
      paint(canvas, kind, 0);
      return canvas;
    } catch (err) {
      console.warn('Tin Hats UI: paintUnitIcon failed', err);
    }
  }
  const fallback = helmetIcon('th-helmet th-unit-icon');
  fallback.style.width = `${cssSize}px`;
  fallback.style.height = `${cssSize}px`;
  return fallback;
}
