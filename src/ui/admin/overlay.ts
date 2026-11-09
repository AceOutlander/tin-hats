/**
 * The admin panel's debug view over the battlefield: a text readout (unit counts, the AI's plan and orders, spawn
 * and capture points) and a canvas with weapon ranges, unit outlines and the spawn and capture points. It never takes
 * a touch, and it only runs while one of its layers is on: the canvas redraws every animation frame (into arrays
 * made once), the readout a few times a second.
 */
import { ADMIN } from '../../data/admin';
import { CONFIG } from '../../data/config';
import { el } from '../shell/dom';
import type { AdminApi, AdminDebugFrame, OverlayLayer } from './contracts';

export interface DebugLayer {
  el: HTMLElement;
  set(layers: Record<OverlayLayer, boolean>): void;
  destroy(): void;
}

/** Room for every unit of the pool and plenty of points. */
const MAX_MARKS = 96;

/** Labels by MARK_* kind (contracts.ts). */
const MARK_NAMES: readonly string[] = ['HQ door', 'Edge', 'Wave', 'Trench', 'Building'];

export function createDebugLayer(api: AdminApi): DebugLayer {
  const root = el('div', 'th-admin-debug');
  root.dataset.testid = 'admin-debug';
  const canvas = el('canvas', 'th-admin-canvas');
  const text = el('pre', 'th-admin-readout');
  text.dataset.testid = 'admin-readout-text';
  root.append(canvas, text);
  const pen = canvas.getContext('2d');
  const frame: AdminDebugFrame = {
    boxes: new Float32Array(CONFIG.maxUnits * 4),
    boxSide: new Uint8Array(CONFIG.maxUnits),
    boxCount: 0,
    ranges: new Float32Array(CONFIG.maxUnits * 4),
    rangeCount: 0,
    marks: new Float32Array(MAX_MARKS * 3),
    markCount: 0,
    groundY: 0,
  };
  const layers: Record<OverlayLayer, boolean> = { readout: false, ranges: false, hitboxes: false, points: false };
  let raf = 0;
  let timer = 0;
  let w = 0;
  let h = 0;

  function size(): void {
    const dpr = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
    w = root.clientWidth;
    h = root.clientHeight;
    canvas.width = Math.max(1, Math.round(w * dpr));
    canvas.height = Math.max(1, Math.round(h * dpr));
    pen?.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function draw(): void {
    raf = window.requestAnimationFrame(draw);
    if (!pen) return;
    if (root.clientWidth !== w || root.clientHeight !== h) size();
    pen.clearRect(0, 0, w, h);
    if (!api.debugFrame(frame)) return;
    const colours = ADMIN.debug.sideColours;
    pen.lineWidth = 1;
    for (let i = 0; i < frame.boxCount; i++) {
      const b = i * 4;
      pen.strokeStyle = colours[frame.boxSide[i]];
      pen.strokeRect(frame.boxes[b], frame.boxes[b + 1], frame.boxes[b + 2], frame.boxes[b + 3]);
    }
    pen.globalAlpha = 0.55;
    for (let i = 0; i < frame.rangeCount; i++) {
      const r = i * 4;
      const y = frame.ranges[r + 2];
      pen.strokeStyle = colours[frame.ranges[r + 3] === 0 ? 0 : 1];
      pen.beginPath();
      pen.moveTo(frame.ranges[r], y);
      pen.lineTo(frame.ranges[r + 1], y);
      pen.moveTo(frame.ranges[r + 1], y - 4);
      pen.lineTo(frame.ranges[r + 1], y + 4);
      pen.stroke();
    }
    pen.globalAlpha = 1;
    pen.font = '10px monospace';
    pen.textAlign = 'center';
    for (let i = 0; i < frame.markCount; i++) {
      const m = i * 3;
      const x = frame.marks[m];
      const kind = frame.marks[m + 1];
      const owner = frame.marks[m + 2];
      pen.strokeStyle = owner === 0 || owner === 1 ? colours[owner] : ADMIN.debug.markColour;
      pen.fillStyle = pen.strokeStyle;
      pen.beginPath();
      pen.moveTo(x, frame.groundY - 60);
      pen.lineTo(x, frame.groundY + 20);
      pen.stroke();
      pen.fillText(MARK_NAMES[kind] ?? '', x, frame.groundY - 64);
    }
  }

  function readout(): void {
    text.textContent = api.readout();
  }

  function set(next: Record<OverlayLayer, boolean>): void {
    Object.assign(layers, next);
    const drawing = layers.ranges || layers.hitboxes || layers.points;
    canvas.hidden = !drawing;
    if (drawing && raf === 0) {
      size();
      raf = window.requestAnimationFrame(draw);
    } else if (!drawing && raf !== 0) {
      window.cancelAnimationFrame(raf);
      raf = 0;
    }
    text.hidden = !layers.readout;
    if (layers.readout && timer === 0) {
      readout();
      timer = window.setInterval(readout, ADMIN.debug.readoutMs);
    } else if (!layers.readout && timer !== 0) {
      window.clearInterval(timer);
      timer = 0;
    }
  }

  return {
    el: root,
    set,
    destroy() {
      if (raf !== 0) window.cancelAnimationFrame(raf);
      if (timer !== 0) window.clearInterval(timer);
      raf = 0;
      timer = 0;
      root.remove();
    },
  };
}
