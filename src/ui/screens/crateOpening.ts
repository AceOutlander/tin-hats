/**
 * A supply crate being opened: the padlock shakes, is torn off and flies away, the lid bursts open and the colour of
 * the rarity pours out; then the item is named. The crate was decided and saved before this was made (the app does
 * that), so the animation only shows it: a tap skips straight to the result, and closing the game mid-way loses
 * nothing.
 *
 * One swell of light that fades, never a strobe; with "Reduce flashing" on it is dimmer and slower. The rarity is
 * always written out with its marks, so the colour is never the only sign of it. Everything is drawn here, on first
 * use: nothing of it exists before a crate is opened.
 */
import { CRATES } from '../../data/crates';
import type { CrateOpenedView, RarityView } from '../contracts';
import { CRATE_SHUT, drawCrate, type CratePose } from '../shell/crateArt';
import { add, button, el } from '../shell/dom';

export interface CrateOpeningHooks {
  /** The three sounds of the opening. */
  sound(step: 'shake' | 'rip' | 'burst'): void;
  /** Paint the item's portrait (absent: the result shows none). `alive` says whether the canvas is still wanted. */
  paintItem?(canvas: HTMLCanvasElement, itemId: string, alive: () => boolean): void;
  /** The overlay is gone. */
  closed(): void;
}

export interface CrateOpeningHandle {
  el: HTMLElement;
  /** Jump to the result (a tap, Escape). */
  skip(): void;
  /** Take the overlay away. */
  close(): void;
  /** True once the result is on show. */
  revealed(): boolean;
}

/** A rarity as it is always shown: its marks and its name, edged in its colour. */
export function rarityBadge(rarity: RarityView, testid?: string): HTMLElement {
  const badge = el('span', 'th-rarity');
  badge.dataset.rarity = rarity.id;
  if (testid) badge.dataset.testid = testid;
  badge.style.setProperty('--th-rarity', rarity.colour);
  const marks = el('span', 'th-rarity-marks');
  marks.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < rarity.marks; i++) marks.append(el('i'));
  add(badge, rarity.marks > 0 && marks, el('span', 'th-rarity-name', rarity.name));
  return badge;
}

function rgb(hex: string): string {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(',');
}

const ease = (t: number): number => {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
};

export function openCrateOverlay(
  parent: HTMLElement,
  opened: CrateOpenedView,
  text: { skip: string; done: string; newItem: string },
  hooks: CrateOpeningHooks,
): CrateOpeningHandle {
  const O = CRATES.opening;
  const K = (O.strength as Record<string, { reach: number; alpha: number; rays: number } | undefined>)[opened.rarity.id] ?? O.strength.common;
  const win = parent.ownerDocument.defaultView ?? window;

  const root = el('div', 'th-crate-open');
  root.dataset.testid = 'crate-opening';
  root.dataset.phase = 'opening';
  root.dataset.rarity = opened.rarity.id;
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  const what = opened.item ? opened.item.name : opened.duplicateLine;
  root.setAttribute('aria-label', `${opened.crate.name}: ${opened.rarity.name}. ${what}`);
  const canvas = el('canvas', 'th-crate-open-canvas');
  canvas.setAttribute('aria-hidden', 'true');
  const skipHint = el('p', 'th-crate-open-skip', text.skip);
  skipHint.dataset.testid = 'crate-skip';

  // The result: the crate's name, the rarity in words and marks, then the item or what the duplicate paid.
  const reveal = el('div', 'th-paper th-crate-reveal');
  reveal.dataset.testid = 'crate-reveal';
  reveal.hidden = true;
  const head = el('div', 'th-crate-reveal-head');
  add(head, el('span', 'th-crate-reveal-from', opened.crate.name), rarityBadge(opened.rarity, 'crate-rarity'));
  const body = el('div', 'th-crate-reveal-body');
  let portrait: HTMLCanvasElement | null = null;
  if (opened.item) {
    if (hooks.paintItem) {
      portrait = el('canvas', 'th-crate-reveal-pic');
      portrait.width = 144;
      portrait.height = 144;
      portrait.setAttribute('aria-hidden', 'true');
      body.append(portrait);
    }
    const words = el('div', 'th-crate-reveal-text');
    const name = el('h2', 'th-crate-reveal-name', opened.item.name);
    name.dataset.testid = 'crate-item';
    add(words, el('span', 'th-crate-reveal-new', text.newItem), name, el('p', 'th-crate-reveal-for', opened.item.appliesTo), el('p', 'th-crate-reveal-blurb', opened.item.blurb));
    body.append(words);
  } else {
    const line = el('p', 'th-crate-reveal-dup', opened.duplicateLine);
    line.dataset.testid = 'crate-duplicate';
    body.append(line);
  }
  let gone = false;
  let shown = false;
  const done = button({
    testid: 'crate-done',
    label: text.done,
    className: 'th-btn-primary',
    onTap: () => close(),
  });
  done.dataset.primary = '';
  add(reveal, head, body, done);
  add(root, canvas, skipHint, reveal);
  parent.append(root);

  const ctx = canvas.getContext('2d');
  let w = 0;
  let h = 0;
  function size(): void {
    const rect = root.getBoundingClientRect();
    const dpr = Math.min(2, Math.max(1, win.devicePixelRatio || 1));
    w = Math.max(1, Math.round(rect.width * dpr));
    h = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
  }

  // The steps, in seconds from the start.
  const tRip = O.shake;
  const tBurst = tRip + O.rip;
  const tFlash = tBurst + O.burst * 0.5;
  const rise = O.flash * (opened.reduced ? O.reducedSlow : 1);
  const peak = K.alpha * (opened.reduced ? O.reducedAlpha : 1);
  const tReveal = tFlash + rise + 0.25;
  /** The light that stays once the swell has faded, as a share of its peak. */
  const STEADY = 0.3;
  let start = -1;
  /** True once a tap has skipped to the result: no more sounds, and the light is at its low steady level. */
  let skipped = false;
  const played = { shake: 0, rip: false, burst: false };
  let raf = 0;
  /** The animation's time when the result came on show (-1 before). */
  let revealAt = -1;

  function showResult(): void {
    if (shown || gone) return;
    shown = true;
    root.dataset.phase = 'revealed';
    skipHint.hidden = true;
    reveal.hidden = false;
    if (portrait && opened.item && hooks.paintItem) hooks.paintItem(portrait, opened.item.id, () => !gone);
    done.focus({ preventScroll: true });
  }

  /** The glow's brightness (0..1) at time t: nothing, one swell to the peak, then a fade to a low steady light. */
  function glowAt(t: number): number {
    if (skipped) return peak * STEADY;
    if (t < tFlash) return 0;
    const up = ease((t - tFlash) / rise);
    if (t < tFlash + rise) return peak * up;
    const down = ease((t - tFlash - rise) / O.fade);
    return peak * (1 - (1 - STEADY) * down);
  }

  function draw(t: number): void {
    if (!ctx) return;
    size();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const short = Math.min(w, h);
    const crateW = short * 0.46;
    // Once the result is on show the crate slides to the left, clear of the slip that names what it held.
    if (shown && revealAt < 0) revealAt = t;
    const aside = revealAt < 0 ? 0 : ease((t - revealAt) / 0.35);
    const cx = w * (0.5 - 0.27 * aside);
    const baseY = h * 0.7;
    const mouthY = baseY - crateW * 0.62 + crateW * 0.06;
    const glow = glowAt(t);
    const colour = rgb(opened.rarity.colour);
    if (glow > 0.003) {
      const reach = short * K.reach * (0.55 + 0.45 * (skipped ? 1 : ease((t - tFlash) / (rise + O.fade))));
      const g = ctx.createRadialGradient(cx, mouthY, 0, cx, mouthY, reach);
      g.addColorStop(0, `rgba(${colour},${glow})`);
      g.addColorStop(0.35, `rgba(${colour},${glow * 0.5})`);
      g.addColorStop(1, `rgba(${colour},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      // Rays fanning up out of the crate, turning slowly: more of them for a higher rarity.
      const turn = t * 0.12;
      ctx.save();
      ctx.translate(cx, mouthY);
      ctx.fillStyle = `rgba(${colour},${glow * 0.38})`;
      for (let i = 0; i < K.rays; i++) {
        const a = -Math.PI * (0.06 + (0.88 * (i + 0.5)) / K.rays) + Math.sin(turn + i) * 0.03;
        const half = (Math.PI * 0.22) / K.rays;
        const len = reach * (0.75 + 0.25 * Math.sin(i * 2.1 + turn * 3));
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(a - half) * len, Math.sin(a - half) * len);
        ctx.lineTo(Math.cos(a + half) * len, Math.sin(a + half) * len);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }
    // The crate over the light that pours out of it.
    const pose: CratePose = { ...CRATE_SHUT };
    if (skipped || t >= tBurst + O.burst) {
      pose.lid = 1;
      pose.lockGone = true;
    } else if (t < tRip) {
      // The shake grows as it goes on.
      const k = t / O.shake;
      const swing = Math.sin(t * O.shakeHz * Math.PI * 2);
      pose.lockSwing = ((O.shakeDegrees * Math.PI) / 180) * swing * (0.4 + 0.6 * k);
      pose.wobble = 0.006 * swing * k;
    } else {
      // Torn off by something unseen: up and away to the right, spinning; the lid follows a moment later.
      const f = (t - tRip) / (O.rip + O.burst);
      pose.lockFlyX = f * 1.5;
      pose.lockFlyY = -f * 1.3 + f * f * 0.9;
      pose.lockSpin = f * 9;
      pose.lockGone = f >= 1;
      pose.lid = t < tBurst ? 0 : ease((t - tBurst) / O.burst);
    }
    drawCrate(ctx, cx, baseY, crateW, opened.crate.tint, pose);
  }

  function frame(now: number): void {
    if (gone) return;
    if (start < 0) start = now;
    const t = (now - start) / 1000;
    if (!skipped) {
      if (played.shake === 0 || (played.shake === 1 && t >= O.shake * 0.5 && t < tRip)) {
        played.shake++;
        hooks.sound('shake');
      }
      if (!played.rip && t >= tRip) {
        played.rip = true;
        hooks.sound('rip');
      }
      if (!played.burst && t >= tBurst) {
        played.burst = true;
        hooks.sound('burst');
      }
      if (t >= tReveal) showResult();
    }
    draw(t);
    raf = win.requestAnimationFrame(frame);
  }

  function skip(): void {
    if (shown || gone) return;
    skipped = true;
    showResult();
  }

  function close(): void {
    if (gone) return;
    gone = true;
    win.cancelAnimationFrame(raf);
    root.remove();
    hooks.closed();
  }

  // A tap anywhere skips to the result; once it is on show only its button closes it.
  root.addEventListener('pointerdown', (ev) => {
    if (shown) return;
    ev.preventDefault();
    skip();
  });

  if (ctx) raf = win.requestAnimationFrame(frame);
  else showResult();

  return { el: root, skip, close, revealed: () => shown };
}
