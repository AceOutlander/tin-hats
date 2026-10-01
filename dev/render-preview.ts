/**
 * Renderer preview: mission 1 through the real simulation (bot vs AI) drawn by
 * the real battlefield view, with the app-style fixed-step loop.
 *
 * Extra query parameters for looking at the effects: weather=rain|clear|auto,
 * dark=0..1 (night tint), commanders=idle (nobody gives orders), audio=1 (a mock
 * audio sink that records its calls in window.__TH.audioLog), and window.__TH.emit(type, fields)
 * to feed the view a sim event the phase 1 sim does not produce yet (explosion, projectile,
 * supportIncoming, airdrop, structureDestroyed ...).
 * scene=trench|tank|assault|support|turn plays a scripted puppet scene instead of the simulation (see ./scenes.ts).
 */
import { CONFIG } from '../src/data/config';
import { MISSIONS } from '../src/data/missions';
import type { MissionDef, TheatreId, TimeOfDay, UnitKind } from '../src/data/schema';
import { BattleViewImpl, createBattleView, type AudioSink, type BattleView, type WeatherMode } from '../src/render';
import { createBattle, type Battle, type SimEvent, type SimEventType } from '../src/sim';
import { Kit, SCENES, sceneMission, sceneUnits } from './scenes';

declare global {
  interface Window {
    __ready?: boolean;
    __TH?: {
      battle: Battle;
      reattach: (theatre: TheatreId, time: TimeOfDay) => void;
      view: BattleView;
      stats: () => ReturnType<BattleView['getStats']>;
      skip: (seconds: number) => void;
      setCenter: (x: number) => void;
      setTimeScale: (k: number) => void;
      setFollow: (on: boolean) => void;
      frontX: () => number;
      /** Feed a synthetic sim event to the view (for looking at effects the phase-1 sim does not emit yet). */
      emit: (type: SimEventType, fields: Partial<SimEvent>) => void;
      /** Sound calls received by the mock audio sink (?audio=1): "play:name", "at:name", "loop:name", "stop:name". */
      audioLog: string[];
    };
  }
}

/** Records what the view asks of the audio engine. */
function mockAudio(log: string[]): AudioSink {
  return {
    play: (name) => log.push(`play:${name}`),
    playAt: (name) => log.push(`at:${name}`),
    startLoop: (name) => log.push(`loop:${name}`),
    stopLoop: (name) => log.push(`stop:${name}`),
    setListener: () => undefined,
  };
}

const params = new URLSearchParams(location.search);
const num = (name: string, def: number): number => {
  const v = Number(params.get(name));
  return params.has(name) && Number.isFinite(v) ? v : def;
};

let timeScale = num('timeScale', 1);
let follow = params.get('follow') !== '0';
const weather = (params.get('weather') ?? 'auto') as WeatherMode;
const seed = num('seed', 1);
const visualSeed = num('vseed', 7);
const DT = 1 / CONFIG.tickRate;
const MAX_STEPS = 240;
const scene = SCENES[params.get('scene') ?? ''] as (typeof SCENES)[string] | undefined;

/** Test kit: extra mixed armies (?army=N per side) and Phase 2 fortifications (?fort=1). */
function testMission(theatreOver?: TheatreId, timeOver?: TimeOfDay): MissionDef {
  const base = MISSIONS[0];
  const army = num('army', 0);
  const fort = params.get('fort') === '1';
  const theatre = theatreOver ?? (params.get('theatre') as TheatreId | null);
  const time = timeOver ?? (params.get('time') as TimeOfDay | null);
  if (army <= 0 && !fort && !theatre && !time && !scene) return base;
  const m: MissionDef = scene ? sceneMission(base, scene) : structuredClone(base);
  if (theatre) m.theatre = theatre;
  if (time) m.timeOfDay = time;
  if (scene) return m;
  const mix: UnitKind[] = ['rifle', 'rifle', 'lmg', 'assault', 'rifle', 'mortar', 'sniper', 'medic', 'at', 'rifle', 'rifle', 'tank'];
  for (let side = 0; side < 2; side++) {
    const dir = side === 0 ? 1 : -1;
    const hqX = side === 0 ? CONFIG.hqInset : m.length - CONFIG.hqInset;
    for (let i = 0; i < army; i++) {
      m.start[side].forces.push({ kind: mix[i % mix.length], count: 1, x: hqX + dir * (900 + (i % 20) * 34 + Math.floor(i / 20) * 9) });
    }
  }
  if (fort) {
    m.trenches = [
      { id: 0, x: 1900, width: 260, slots: 8, owner: 0 },
      { id: 1, x: 4100, width: 200, slots: 6, owner: 1 },
    ];
    m.pillboxes = [{ id: 0, x: 4400, side: 1, hpMul: 1 }];
    m.wire = [{ id: 0, x: 3700, width: 220, owner: 1 }];
  }
  return m;
}

function newBattle(theatre?: TheatreId, time?: TimeOfDay): Battle {
  const idle = params.get('commanders') === 'idle' || scene !== undefined;
  return createBattle({ mission: testMission(theatre, time), difficulty: 'normal', seed, upgrades: {}, commanders: idle ? ['idle', 'idle'] : ['bot', 'ai'] });
}

let battle = newBattle();

/**
 * Where the fighting is: halfway between the two sides' leading combat units,
 * or just ahead of the player's line while the armies are far apart.
 */
function frontX(viewW = 1000): number {
  const s = battle.state;
  let p = -Infinity;
  let e = Infinity;
  for (let i = 0; i < s.unitCount; i++) {
    const u = s.units[i];
    if (!u.alive || u.inside || u.kind === 'sapper') continue;
    if (u.side === 0) p = Math.max(p, u.x);
    else e = Math.min(e, u.x);
  }
  if (p === -Infinity && e === Infinity) return s.sides[0].hq?.x ?? 0;
  if (p === -Infinity) return e;
  if (e === Infinity || e - p > viewW * 0.8) return p + viewW * 0.15;
  return (p + e) / 2;
}

async function main(): Promise<void> {
  const el = document.getElementById('game');
  if (!el) throw new Error('no #game element');
  const view = await createBattleView(el);
  const audioLog: string[] = [];
  if (params.get('audio') === '1') view.setAudio(mockAudio(audioLog));
  view.attach(battle, { playerSide: 0, weather, visualSeed });
  if (params.has('dark')) view.setDarkness(num('dark', 0));
  if (params.has('zoom') && view instanceof BattleViewImpl) view.setDebugZoom(num('zoom', 1));
  view.onTapUnit = (id) => {
    view.setControlled(id);
    console.log(`tap unit ${id}`);
  };
  view.onTapGround = (x) => {
    view.setControlled(-1);
    console.log(`tap ground ${x.toFixed(0)}`);
  };

  // Puppet scene: the units are moved by the script and the events come from it; the simulation never steps.
  const q = battle.events as unknown as { emit(t: SimEventType): SimEvent; clear(): void };
  const kit = scene ? new Kit(battle.state, sceneUnits(battle.state, scene), (type, fields) => Object.assign(q.emit(type), fields)) : null;
  const step = (): void => {
    if (!scene || !kit) {
      battle.step();
      return;
    }
    q.clear();
    const s = battle.state;
    for (let i = 0; i < s.unitCount; i++) (s.units[i] as { prevX: number; x: number }).prevX = s.units[i].x;
    kit.dt = DT;
    kit.t += DT;
    kit.runTimers();
    scene.tick(kit.t, kit);
  };
  const skip = (seconds: number): void => {
    view.setEffectsEnabled(false);
    const n = Math.round(seconds / DT);
    for (let i = 0; i < n && !battle.state.over; i++) {
      step();
      view.afterStep();
    }
    view.setEffectsEnabled(true);
  };
  skip(num('skip', 0));
  if (scene && !params.has('cam')) {
    follow = false;
    view.camera.setCenter(scene.cam, true);
  } else if (params.has('cam')) {
    follow = false;
    view.camera.setCenter(num('cam', 0.5) * battle.state.length, true);
  } else if (follow) {
    view.camera.setCenter(frontX(view.camera.viewWidthWu), true);
  }

  const statsEl = document.getElementById('stats');
  const showStats = params.get('stats') === '1' && statsEl !== null;
  if (statsEl && showStats) statsEl.hidden = false;

  let acc = 0;
  let frames = 0;
  view.setFrameHandler((dtMs) => {
    const dt = (Math.min(dtMs, 250) / 1000) * timeScale;
    view.setEffectsEnabled(timeScale <= 4);
    acc += dt;
    let steps = 0;
    while (acc >= DT && steps < MAX_STEPS) {
      step();
      view.afterStep();
      acc -= DT;
      steps++;
    }
    if (steps >= MAX_STEPS) acc = 0;
    if (follow) view.camera.setCenter(frontX(view.camera.viewWidthWu));
    view.render(acc / DT, dt);
    frames++;
    if (frames === 1) requestAnimationFrame(() => requestAnimationFrame(() => (window.__ready = true)));
    if (showStats && statsEl && frames % 15 === 0) {
      const s = view.getStats();
      statsEl.textContent =
        `fps ${s.fps.toFixed(0)}  render ${s.renderMs.toFixed(2)} ms  afterStep ${s.afterStepMs.toFixed(3)} ms\n` +
        `units ${s.unitViewsDrawn}/${s.unitViews}  images ${s.imagesVisible}/${s.images}  tracers ${s.tracers}  particles ${s.particles}\n` +
        `t ${battle.state.time.toFixed(1)} s  canvas ${s.canvasW}x${s.canvasH} @${s.dpr}`;
    }
  });

  window.__TH = {
    get battle() {
      return battle;
    },
    reattach: (theatre, time) => {
      battle = newBattle(theatre, time);
      view.attach(battle, { playerSide: 0, weather, visualSeed });
    },
    view,
    stats: () => view.getStats(),
    skip,
    setCenter: (x) => {
      follow = false;
      view.camera.setCenter(x, true);
    },
    setTimeScale: (k) => {
      timeScale = k;
    },
    setFollow: (on) => {
      follow = on;
    },
    frontX: () => frontX(view.camera.viewWidthWu),
    emit: (type, fields) => {
      const ev = battle.events as unknown as { emit(t: SimEventType): SimEvent; clear(): void };
      Object.assign(ev.emit(type), fields);
      view.afterStep();
      ev.clear();
    },
    audioLog,
  };
}

main().catch((err: unknown) => {
  console.error(err);
});
