/**
 * Preview page for the battle HUD: mounts it over a plain gradient with a mock
 * AppApi and an animated mock HudState. Dev server only, not part of the build.
 *
 * Query parameters:
 *   control=1 | <unit kind>   start in direct control (1 = assault trooper, which has an ability)
 *   targeting=<support kind>  start with a support waiting for a target
 *   paused=1                  start paused
 *   units=N  supports=N       number of training buttons (1..9) and support buttons (0..3)
 *   timer=SECONDS  urgent=1   show a countdown instead of the objective
 *   survival=1                no enemy HQ bar
 *   banner=0  hint=0          suppress the announcement or the tutorial hint
 *   tip=<target>              show a tutorial tip pointing at train-sapper, order-advance, minimap, supplies, support-smoke or field
 *   rich=1  broke=1           plenty of supplies, or none
 *   bg=bright | dark          battlefield stand-in brightness
 *   guides=1                  mark the band where units walk
 *   font=wide                 swap the display font for a wide one to stress the layout
 *   painter=0                 use the HUD's built-in fallback icons
 *   fps=1                     show the "Show FPS" readout
 */
import '../src/ui/theme.css';
import { FACTIONS } from '../src/data/factions';
import type { SupportKind, UnitKind } from '../src/data/schema';
import type {
  AppApi,
  CampaignView,
  ControlState,
  HudAction,
  HudState,
  SupportButtonState,
  TipState,
  TipTarget,
  TrainButtonState,
} from '../src/ui/contracts';
import { createHud, type Hud } from '../src/ui/hud/index';

const params = new URLSearchParams(location.search);
const flag = (key: string): boolean => params.get(key) === '1';
const count = (key: string, fallback: number, max: number): number => {
  const raw = params.get(key);
  if (raw === null) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.max(0, Math.min(max, Math.floor(n))) : fallback;
};

const british = FACTIONS.british;
const german = FACTIONS.german;

interface RosterEntry {
  kind: UnitKind;
  cost: number;
  pop: number;
  trainTime: number;
  fielded: number;
  ability: string | null;
}

const ROSTER: RosterEntry[] = [
  { kind: 'sapper', cost: 50, pop: 1, trainTime: 6, fielded: 4, ability: null },
  { kind: 'rifle', cost: 60, pop: 1, trainTime: 5, fielded: 7, ability: null },
  { kind: 'lmg', cost: 130, pop: 2, trainTime: 9, fielded: 2, ability: null },
  { kind: 'assault', cost: 110, pop: 1, trainTime: 7, fielded: 3, ability: 'Grenade' },
  { kind: 'mortar', cost: 180, pop: 2, trainTime: 12, fielded: 1, ability: null },
  { kind: 'sniper', cost: 160, pop: 1, trainTime: 11, fielded: 0, ability: null },
  { kind: 'medic', cost: 90, pop: 1, trainTime: 8, fielded: 1, ability: null },
  { kind: 'at', cost: 150, pop: 2, trainTime: 10, fielded: 0, ability: null },
  { kind: 'tank', cost: 420, pop: 5, trainTime: 20, fielded: 1, ability: 'Coax MG' },
];

const SUPPORTS: { kind: SupportKind; cooldown: number; charge: number }[] = [
  { kind: 'artillery', cooldown: 45, charge: 1 },
  { kind: 'smoke', cooldown: 30, charge: 0.35 },
  { kind: 'airStrike', cooldown: 80, charge: 0.8 },
];

const POP_CAP = 40;
const MAP_LENGTH = 9000;

const roster = ROSTER.slice(0, Math.max(1, count('units', ROSTER.length, ROSTER.length)));
const supportDefs = SUPPORTS.slice(0, count('supports', SUPPORTS.length, SUPPORTS.length));

const train: TrainButtonState[] = roster.map((r) => ({
  kind: r.kind,
  name: british.unitNames[r.kind],
  cost: r.cost,
  pop: r.pop,
  queued: 0,
  progress: 0,
  fielded: r.fielded,
  affordable: true,
  ownOrder: null,
}));
if (train[1]) {
  train[1].queued = 2;
  train[1].progress = 0.4;
}
if (train[2]) {
  train[2].queued = 1;
  train[2].progress = 0.72;
}
if (train[8]) {
  train[8].queued = 1;
  train[8].progress = 0.2;
}

const supports: SupportButtonState[] = supportDefs.map((s) => ({
  kind: s.kind,
  name: british.supportNames[s.kind],
  charge: s.charge,
  secondsLeft: (1 - s.charge) * s.cooldown,
}));

function makeControl(kind: UnitKind): ControlState {
  const entry = ROSTER.find((r) => r.kind === kind) ?? ROSTER[1];
  return {
    kind: entry.kind,
    name: british.unitNames[entry.kind],
    hp: 64,
    maxHp: 100,
    hpShown: true,
    reload: 1,
    hasAbility: entry.ability !== null,
    abilityName: entry.ability ?? '',
    abilityCharge: 0.55,
  };
}

const MAX_UNITS = 96;
const unitHome = new Float32Array(MAX_UNITS);

const timerSeconds = flag('urgent') ? 24 : count('timer', 0, 3600);

/** A tutorial tip for the page's `tip` parameter, worded like the real ones. */
function tipFromQuery(): TipState | null {
  const target = params.get('tip') as TipTarget | null;
  if (target === null) return null;
  const texts: Partial<Record<TipTarget, string>> = {
    'train-sapper': 'Train a Sapper: more Sappers, more supplies. Tap the Sapper button.',
    'order-advance': 'Your army is ready. ADVANCE sends everyone forward to destroy the enemy HQ.',
    'order-fallBack': 'In trouble? FALL BACK pulls everyone into the HQ, where its machine gun covers them.',
    minimap: 'Drag the battlefield to look around, or touch the map strip up here to jump along it.',
    supplies: 'Supplies buy troops. Your Sappers carry them from the dump to your HQ.',
    'support-smoke': 'New: Smoke Screen. Tap it, then tap the ground in front of your men to hide them.',
    field: 'Tap one of your soldiers to take control of him. A joystick and a FIRE button appear.',
  };
  return { seq: 1, text: texts[target] ?? 'A tutorial tip.', target };
}

const state: HudState = {
  supplies: flag('rich') ? 2400 : flag('broke') ? 12 : 310,
  incomePerSec: 3.5,
  pop: 0,
  popCap: POP_CAP,
  order: 'hold',
  train,
  supports,
  targeting: null,
  control: null,
  timer: timerSeconds > 0 ? { label: 'Hold until relieved', secondsLeft: timerSeconds, urgent: false } : null,
  objective: 'Destroy the enemy HQ',
  hqHp: 1700,
  hqMaxHp: 2000,
  enemyHqHp: flag('survival') ? null : 620,
  enemyHqMaxHp: 2000,
  paused: flag('paused'),
  muted: false,
  banner: null,
  bannerSeq: 0,
  hint: null,
  tip: tipFromQuery(),
  fps: flag('fps') ? { seq: 1, fps: 58.6, avgMs: 17.1, worstMs: 41.8 } : null,
  minimap: {
    length: MAP_LENGTH,
    camX: 2400,
    camW: 1000,
    hq: [{ x: 160, hp: 0.85 }, flag('survival') ? null : { x: MAP_LENGTH - 160, hp: 0.31 }],
    trenchX: new Float32Array([2300, 4300, 6100, 7500]),
    trenchW: new Float32Array([320, 280, 320, 360]),
    trenchOwner: new Int8Array([0, -1, 1, 1]),
    trenchCount: 4,
    pillboxX: new Float32Array([5500, 7100]),
    pillboxSide: new Int8Array([1, 1]),
    pillboxCount: 2,
    unitX: new Float32Array(MAX_UNITS),
    unitSide: new Int8Array(MAX_UNITS),
    unitBig: new Int8Array(MAX_UNITS),
    unitCount: 0,
    colors: [british.look.tint, german.look.tint],
  },
};

// Scatter stand-in units along the front: side 0 on the left, side 1 on the right.
{
  const m = state.minimap;
  let n = 0;
  for (let i = 0; i < 20; i++) {
    unitHome[n] = 500 + ((i * 367) % 3300);
    m.unitSide[n] = 0;
    m.unitBig[n] = i === 7 ? 1 : 0;
    n++;
  }
  for (let i = 0; i < 16; i++) {
    unitHome[n] = 4700 + ((i * 431) % 3600);
    m.unitSide[n] = 1;
    m.unitBig[n] = i === 3 || i === 11 ? 1 : 0;
    n++;
  }
  m.unitCount = n;
}

const controlParam = params.get('control');
if (controlParam) state.control = makeControl(controlParam === '1' ? 'assault' : (controlParam as UnitKind));
const targetingParam = params.get('targeting');
if (targetingParam) {
  const wanted = supports.find((s) => s.kind === targetingParam);
  if (wanted) {
    wanted.charge = 1;
    wanted.secondsLeft = 0;
    state.targeting = wanted.kind;
  }
}

const BANNERS = ['Enemy counter-attack!', 'Trench captured', 'Reinforcements have arrived', 'Panzers sighted on the ridge'];
const showBanner = params.get('banner') !== '0';
const showHint = params.get('hint') !== '0';
if (showHint) state.hint = 'Tap RIFLEMAN to train a soldier. Sappers haul in the supplies that pay for him.';

const actions: HudAction[] = [];
let stickX = 0;
let firing = false;

function popInUse(): number {
  let p = 0;
  for (let i = 0; i < train.length; i++) p += (train[i].fielded + train[i].queued) * train[i].pop;
  return p;
}

const emptyCampaign: CampaignView = {
  missions: [],
  pointsEarned: 0,
  pointsSpent: 0,
  pointsAvailable: 0,
  upgrades: [],
  settings: { muted: false, difficulty: 'normal', hints: true, musicVolume: 100, ambienceVolume: 100, sfxVolume: 100, reduceFlash: false, showBlood: true, showFps: false },
  difficulties: [],
};

const app: AppApi = {
  campaign: () => emptyCampaign,
  startMission: () => undefined,
  buyUpgrade: () => undefined,
  refundUpgrade: () => undefined,
  refundAll: () => undefined,
  setSetting: () => undefined,
  resetSave: () => undefined,
  replayHints: () => undefined,
  uiSound: () => undefined,
  dispatch(action: HudAction): void {
    // The HUD reuses one object for its per-frame stick repeat, so log a copy.
    actions.push({ ...action });
    if (actions.length > 400) actions.splice(0, 200);
    switch (action.type) {
      case 'train': {
        const t = train.find((b) => b.kind === action.kind);
        if (t && state.supplies >= t.cost && popInUse() + t.pop <= POP_CAP) {
          state.supplies -= t.cost;
          t.queued++;
        }
        break;
      }
      case 'order': {
        const t = action.kind === undefined ? undefined : train.find((b) => b.kind === action.kind);
        if (t) t.ownOrder = action.order;
        else state.order = action.order;
        break;
      }
      case 'followArmy':
        for (const t of train) if (action.kind === undefined || t.kind === action.kind) t.ownOrder = null;
        break;
      case 'support':
        state.targeting = action.kind;
        break;
      case 'cancelTargeting':
        state.targeting = null;
        break;
      case 'pause':
        state.paused = true;
        break;
      case 'resume':
        state.paused = false;
        break;
      case 'restart':
      case 'quit':
        state.paused = false;
        announce(action.type === 'restart' ? 'Mission restarted' : 'Back to the map');
        break;
      case 'toggleMute':
        state.muted = !state.muted;
        break;
      case 'stick':
        stickX = action.x;
        break;
      case 'fire':
        firing = action.down;
        break;
      case 'ability':
        if (state.control) state.control.abilityCharge = 0;
        break;
      case 'release':
        state.control = null;
        break;
      case 'minimap':
        state.minimap.camX = Math.max(
          0,
          Math.min(MAP_LENGTH - state.minimap.camW, action.frac * MAP_LENGTH - state.minimap.camW / 2),
        );
        break;
    }
  },
};

function announce(text: string): void {
  state.banner = text;
  state.bannerSeq++;
}

function paintStandInIcon(canvas: HTMLCanvasElement, kind: UnitKind, side: 0 | 1): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  const ink = '#14150f';
  const tint = side === 0 ? british.look.tint : german.look.tint;
  const u = Math.min(w / 46, h / 40);
  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.scale(u, u);
  ctx.translate(-23, -20);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = ink;
  ctx.fillStyle = ink;
  const line = (x1: number, y1: number, x2: number, y2: number, width: number): void => {
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  };
  if (kind === 'tank' || kind === 'heavyTank') {
    ctx.fillRect(5, 22, 34, 6);
    ctx.beginPath();
    ctx.ellipse(22, 31, 18, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(14, 14, 15, 9);
    line(28, 17.5, 43, 16, 2.6);
    ctx.fillStyle = tint;
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.arc(9 + i * 6.5, 31, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    // Stick soldier facing right.
    ctx.beginPath();
    ctx.arc(20, 9, 4, 0, Math.PI * 2);
    ctx.fill();
    line(20, 13, 20, 25, 3.2);
    line(20, 25, 15, 37, 3.2);
    line(20, 25, 26, 37, 3.2);
    line(20, 16, 28, 20, 2.8);
    line(20, 16, 25, 22, 2.8);
    ctx.fillStyle = tint;
    ctx.beginPath();
    ctx.ellipse(20, 6.5, 7, 2.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(20, 6.5, 4.4, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = ink;
    switch (kind) {
      case 'sapper':
        ctx.fillStyle = tint;
        ctx.fillRect(26, 15, 10, 8);
        ctx.strokeRect(26, 15, 10, 8);
        break;
      case 'lmg':
        line(22, 20, 42, 17, 2.6);
        line(38, 18, 40, 25, 1.4);
        break;
      case 'assault':
        line(24, 20, 34, 19, 2.6);
        line(29, 20, 29, 25, 2);
        break;
      case 'mortar':
        line(32, 37, 40, 18, 3.4);
        line(36, 28, 43, 37, 1.6);
        break;
      case 'sniper':
        line(22, 20, 44, 16, 1.8);
        line(28, 17, 34, 16, 2.6);
        break;
      case 'medic':
        ctx.fillStyle = '#e9dfc3';
        ctx.fillRect(27, 15, 10, 10);
        ctx.fillStyle = '#9c2b1f';
        ctx.fillRect(31, 16.5, 2, 7);
        ctx.fillRect(28.5, 19, 7, 2);
        break;
      case 'at':
        line(14, 15, 38, 12, 4);
        break;
      default:
        line(22, 20, 40, 17, 2);
        break;
    }
  }
  ctx.restore();
}

const game = document.getElementById('game');
const ui = document.getElementById('ui');
if (!game || !ui) throw new Error('ui-hud: missing #game or #ui');

const bg = params.get('bg');
if (bg === 'bright' || bg === 'dark') game.classList.add(bg);
if (flag('guides')) game.classList.add('guides');
const hud: Hud = createHud(ui, app, params.get('painter') === '0' ? {} : { paintUnitIcon: paintStandInIcon });
if (params.get('font') === 'wide' && ui.firstElementChild instanceof HTMLElement) {
  ui.firstElementChild.style.fontFamily = 'Verdana, sans-serif';
}

// A tap on the stand-in battlefield: place the pending support, otherwise take or drop direct control.
game.addEventListener('pointerdown', () => {
  if (state.paused) return;
  if (state.targeting !== null) {
    const s = supports.find((b) => b.kind === state.targeting);
    const def = SUPPORTS.find((d) => d.kind === state.targeting);
    if (s && def) {
      s.charge = 0;
      s.secondsLeft = def.cooldown;
      announce(`${s.name} inbound`);
    }
    state.targeting = null;
  } else {
    state.control = state.control ? null : makeControl('assault');
  }
});

let last = performance.now();
let clock = 0;
let nextBanner = 0.1;
let bannerIndex = 0;

function step(dt: number): void {
  clock += dt;
  state.supplies += state.incomePerSec * dt;
  state.incomePerSec = 3.5 + Math.sin(clock * 0.4) * 0.6;

  for (let i = 0; i < train.length; i++) {
    const t = train[i];
    if (t.queued > 0) {
      t.progress += dt / roster[i].trainTime;
      if (t.progress >= 1) {
        t.progress = 0;
        t.queued--;
        t.fielded++;
      }
    } else {
      t.progress = 0;
    }
  }
  state.pop = popInUse();
  for (let i = 0; i < train.length; i++) {
    const t = train[i];
    t.affordable = state.supplies >= t.cost && state.pop + t.pop <= POP_CAP;
  }

  for (let i = 0; i < supports.length; i++) {
    const s = supports[i];
    if (s.charge < 1) {
      s.charge = Math.min(1, s.charge + dt / supportDefs[i].cooldown);
      s.secondsLeft = (1 - s.charge) * supportDefs[i].cooldown;
    }
  }

  const timer = state.timer;
  if (timer) {
    timer.secondsLeft = Math.max(0, timer.secondsLeft - dt);
    timer.urgent = timer.secondsLeft <= 30;
  }

  const c = state.control;
  if (c) {
    c.reload = firing ? (c.reload >= 1 ? 0 : Math.min(1, c.reload + dt * 1.6)) : Math.min(1, c.reload + dt * 1.6);
    c.abilityCharge = Math.min(1, c.abilityCharge + dt / 8);
    c.hp = Math.max(8, c.hp - dt * 0.8);
    const m = state.minimap;
    m.camX = Math.max(0, Math.min(MAP_LENGTH - m.camW, m.camX + stickX * 600 * dt));
  }

  state.hqHp = 1700 + Math.sin(clock * 0.3) * 250;
  if (state.enemyHqHp !== null) state.enemyHqHp = Math.max(0, 620 - clock * 6);
  const m = state.minimap;
  if (m.hq[0]) m.hq[0].hp = state.hqHp / state.hqMaxHp;
  if (m.hq[1] && state.enemyHqHp !== null) m.hq[1].hp = state.enemyHqHp / state.enemyHqMaxHp;
  for (let i = 0; i < m.unitCount; i++) {
    m.unitX[i] = unitHome[i] + Math.sin(clock * 0.5 + i) * 120 + (m.unitSide[i] === 0 ? 1 : -1) * Math.min(400, clock * 12);
  }

  if (showBanner && clock >= nextBanner) {
    announce(BANNERS[bannerIndex % BANNERS.length]);
    bannerIndex++;
    nextBanner = clock + 9;
  }
}

const exposed = window as unknown as {
  __ready: boolean;
  __hud: Hud;
  __state: HudState;
  __actions: HudAction[];
};
exposed.__hud = hud;
exposed.__state = state;
exposed.__actions = actions;

function frame(now: number): void {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  state.minimap.camW = (window.innerWidth / Math.max(1, window.innerHeight)) * 540;
  if (!state.paused) step(dt);
  hud.update(state);
  exposed.__ready = true;
  requestAnimationFrame(frame);
}

step(0.2);
requestAnimationFrame(frame);
