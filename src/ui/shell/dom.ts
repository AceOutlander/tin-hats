/** Small DOM helpers shared by the menu screens. */
import { STENCIL_HEIGHT, stencilPath } from './stencilFont';

const SVG_NS = 'http://www.w3.org/2000/svg';

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** Append children, skipping null and false so callers can write conditions inline. */
export function add<T extends Element>(parent: T, ...children: (Node | string | null | false | undefined)[]): T {
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    parent.append(child);
  }
  return parent;
}

export function clear(node: Element): void {
  while (node.firstChild) node.removeChild(node.firstChild);
}

export interface ButtonSpec {
  testid: string;
  /** Visible caption (plain text); omit when `content` supplies the inside. */
  label?: string;
  /** Extra class names on top of th-btn. */
  className?: string;
  /** Accessible name when the caption is an icon or needs more words. */
  aria?: string;
  content?: (Node | string)[];
  /** Skip the standard th-btn look (map pins, toggles that style themselves). */
  bare?: boolean;
  onTap: () => void;
}

/** A real <button>: Enter, Space, mouse and touch all arrive as `click`. */
export function button(spec: ButtonSpec): HTMLButtonElement {
  const base = spec.bare ? '' : 'th-btn';
  const node = el('button', [base, spec.className ?? ''].filter((c) => c !== '').join(' '));
  node.type = 'button';
  node.dataset.testid = spec.testid;
  if (spec.aria) node.setAttribute('aria-label', spec.aria);
  if (spec.label !== undefined) node.append(el('span', 'th-btn-label', spec.label));
  if (spec.content) node.append(...spec.content);
  node.addEventListener('click', (ev) => {
    ev.preventDefault();
    if (node.disabled) return;
    spec.onTap();
  });
  return node;
}

/** One run of stencil lettering as an inline SVG, one em tall, coloured by `color`. */
export function stencilSvg(text: string): SVGSVGElement {
  const run = stencilPath(text);
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${Math.max(1, run.width)} ${STENCIL_HEIGHT}`);
  svg.setAttribute('class', 'th-stencil-run');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', run.d);
  path.setAttribute('fill', 'currentColor');
  svg.append(path);
  return svg;
}

/**
 * A stencil heading. Each word is its own SVG inside a wrapping flex row, so
 * long titles break between words; the text itself is exposed for assistive
 * tech through aria-label.
 */
export function stencil<K extends 'h1' | 'h2' | 'h3' | 'div' | 'span'>(tag: K, text: string, className = ''): HTMLElementTagNameMap[K] {
  const node = el(tag, className ? `th-stencil ${className}` : 'th-stencil');
  setStencil(node, text);
  return node;
}

export function setStencil(node: HTMLElement, text: string): void {
  if (node.dataset.text === text) return;
  node.dataset.text = text;
  node.setAttribute('aria-label', text);
  if (node.tagName === 'DIV' || node.tagName === 'SPAN') node.setAttribute('role', 'img');
  clear(node);
  for (const word of text.split(/\s+/)) {
    if (word.length > 0) node.append(stencilSvg(word));
  }
}

/** A canvas sized in CSS px with a device-pixel backing store. */
export function iconCanvas(cssSize: number, className = 'th-unit-icon'): HTMLCanvasElement {
  const canvas = el('canvas', className);
  const dpr = Math.min(3, Math.max(1, window.devicePixelRatio || 1));
  canvas.width = Math.round(cssSize * dpr);
  canvas.height = Math.round(cssSize * dpr);
  canvas.style.width = `${cssSize}px`;
  canvas.style.height = `${cssSize}px`;
  canvas.setAttribute('aria-hidden', 'true');
  return canvas;
}

/** m:ss for battle durations. */
export function formatTime(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(s / 60);
  const rest = s % 60;
  return `${m}:${rest < 10 ? '0' : ''}${rest}`;
}

/** Thousands separators without depending on the device locale. */
export function formatCount(value: number): string {
  const n = Math.round(value);
  const digits = String(Math.abs(n));
  let out = '';
  for (let i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 === 0) out += ',';
    out += digits[i];
  }
  return n < 0 ? `-${out}` : out;
}
