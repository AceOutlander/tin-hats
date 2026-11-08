/**
 * Scripted "puppet" scenes for the renderer preview (dev only): dev/render-preview.html?scene=<name>.
 *
 * The battle is created from a tweaked mission 1 and then never stepped. Instead each 1/30 s tick the scene moves its
 * units by hand (x, velX, facing, action, trench) and feeds the view the sim events of Phase 2 (projectiles,
 * explosions, call-ins, smoke, airdrops, pillbox and wire damage), so every one of those visuals can be looked at
 * before the simulation produces them.
 *
 *   trench    riflemen file into a trench, fire from it and climb out; an assault trooper runs straight across it
 *   tank      a tank drives over a trench past men firing from behind it, then turns round
 *   assault   mortar, grenade, rockets and a tank shell on a German trench, wire and pillbox
 *   support   smoke screen, artillery barrage, air strike and an airdrop
 *   turn      a line of soldiers about-faces and runs back (turn smoothness)
 *   wire      a soldier standing by a belt of German wire for scale, men struggling through a second belt, and a tank
 *             crushing a third flat
 */
import { CONFIG } from '../src/data/config';
import type { MissionDef, UnitAction, UnitKind } from '../src/data/schema';
import { UNITS } from '../src/data/units';
import type { BattleState, SimEvent, SimEventType, UnitState } from '../src/sim';

export type Emit = (type: SimEventType, fields: Partial<SimEvent>) => void;

interface Force {
  side: 0 | 1;
  kind: UnitKind;
  x: number;
  row: number;
}

export interface Scene {
  /** Camera centre (world x). */
  cam: number;
  forces: Force[];
  trenches?: { x: number; width: number; owner: 0 | 1 | -1 }[];
  pillboxes?: { x: number; side: 0 | 1 }[];
  wire?: { x: number; width: number; owner: 0 | 1 }[];
  /** One tick: scene time t (s) after the tick, the scene's units in `forces` order. */
  tick(t: number, k: Kit): void;
}

/** Put the scene's fortifications and forces into a copy of the mission (its own starting forces are dropped). */
export function sceneMission(base: MissionDef, sc: Scene): MissionDef {
  const m: MissionDef = structuredClone(base);
  m.start[0].forces = [];
  m.start[1].forces = [];
  for (const f of sc.forces) m.start[f.side].forces.push({ kind: f.kind, count: 1, x: f.x });
  m.trenches = (sc.trenches ?? []).map((t, i) => ({ id: i, x: t.x, width: t.width, slots: 8, owner: t.owner }));
  m.pillboxes = (sc.pillboxes ?? []).map((p, i) => ({ id: i, x: p.x, side: p.side, hpMul: 1 }));
  m.wire = (sc.wire ?? []).map((w, i) => ({ id: i, x: w.x, width: w.width, owner: w.owner }));
  return m;
}

/** Match the spawned units to the scene's forces (by side, kind and nearest x) and set their rows. */
export function sceneUnits(s: BattleState, sc: Scene): UnitState[] {
  const free: UnitState[] = [];
  for (let i = 0; i < s.unitCount; i++) if (s.units[i].alive) free.push(s.units[i]);
  return sc.forces.map((f) => {
    let best = -1;
    for (let i = 0; i < free.length; i++) {
      const u = free[i];
      if (u.side !== f.side || u.kind !== f.kind) continue;
      if (best < 0 || Math.abs(u.x - f.x) < Math.abs(free[best].x - f.x)) best = i;
    }
    if (best < 0) throw new Error(`scene: no ${f.kind} spawned for side ${f.side}`);
    const u = free.splice(best, 1)[0];
    const w = u as { -readonly [K in keyof UnitState]: UnitState[K] };
    w.row = f.row;
    w.x = w.prevX = f.x;
    w.facing = f.side === 0 ? 1 : -1;
    return u;
  });
}

type Mut = { -readonly [K in keyof UnitState]: UnitState[K] };

/** What a scene script works with during one tick. */
export class Kit {
  t = 0;
  dt = 1 / 30;
  constructor(
    readonly s: BattleState,
    readonly u: UnitState[],
    readonly emit: Emit,
  ) {}

  /** True on the one tick when scene time passes t0. */
  at(t0: number): boolean {
    return this.t - this.dt < t0 && this.t >= t0;
  }

  private m(i: number): Mut {
    return this.u[i] as Mut;
  }

  act(i: number, action: UnitAction): void {
    const u = this.m(i);
    if (u.action !== action) {
      u.action = action;
      u.actionTime = 0;
    } else {
      u.actionTime += this.dt;
    }
  }

  face(i: number, dir: number): void {
    this.m(i).facing = dir >= 0 ? 1 : -1;
  }

  /** Walk toward x at speed (wu/s); returns true once there (then the unit stands idle unless told otherwise). */
  go(i: number, x: number, speed: number, then: UnitAction = 'idle'): boolean {
    const u = this.m(i);
    if (!u.alive) return true;
    const d = x - u.x;
    const step = speed * this.dt;
    if (Math.abs(d) <= step) {
      u.x = x;
      u.velX = 0;
      this.act(i, then);
      return true;
    }
    u.x += Math.sign(d) * step;
    u.velX = Math.sign(d) * speed;
    u.facing = d > 0 ? 1 : -1;
    this.act(i, 'move');
    return false;
  }

  stand(i: number, action: UnitAction = 'idle'): void {
    this.m(i).velX = 0;
    this.act(i, action);
  }

  trench(i: number, id: number): void {
    this.m(i).trenchId = id;
  }

  /** Aim, fire one round at (x2, row2) and reload, over a `period` s cycle that starts at t0 ('' = no shot event). */
  shootCycle(i: number, t0: number, period: number, x2: number, row2: number, weapon = 'rifle'): void {
    const u = this.u[i];
    if (!u.alive || this.t < t0) return;
    const p = (this.t - t0) % period;
    if (p < period * 0.35) this.stand(i, 'aim');
    else if (p < period * 0.35 + 0.12) this.stand(i, 'fire');
    else this.stand(i, 'reload');
    const fireAt = t0 + Math.floor((this.t - t0) / period) * period + period * 0.35;
    if (weapon && this.at(fireAt)) this.shot(i, x2, row2, weapon);
  }

  shot(i: number, x2: number, row2: number, weapon: string, hit = false): void {
    const u = this.u[i];
    this.emit('shot', { side: u.side, source: 'unit', unit: u.index, unitId: u.id, kind: u.kind, weapon, x: u.x, row: u.row, x2, row2, target: 'unit', targetIndex: -1, hit, dir: x2 >= u.x ? 1 : -1 });
  }

  /** A shell, grenade or rocket from unit i (or from a launch x when i < 0) that lands at x2 after `flight` s and explodes. */
  launch(i: number, weapon: string, x2: number, flight: number, radius: number, side = 0, fromX = 0, row = -1): void {
    const u = i >= 0 ? this.u[i] : null;
    this.emit('projectile', { side: u ? u.side : side, source: u ? 'unit' : 'none', unit: u ? u.index : -1, unitId: u ? u.id : -1, kind: u ? u.kind : null, weapon, x: u ? u.x : fromX, row: u ? u.row : row, x2, row2: -1, value: flight });
    this.later(flight, () => this.emit('explosion', { x: x2, value: radius, weapon, cause: 'explosive', row: -1 }));
  }

  kill(i: number, cause: 'bullet' | 'explosive' | 'antiTank', dir: number): void {
    const u = this.m(i);
    if (!u.alive) return;
    u.alive = false;
    u.hp = 0;
    this.emit('unitDied', { side: u.side, unit: u.index, unitId: u.id, kind: u.kind, x: u.x, row: u.row, cause, dir, targetIndex: u.side === 0 ? 1 : 0 });
  }

  private readonly timers: { t: number; fn: () => void }[] = [];

  /** Run fn `delay` s from now (on a tick). */
  later(delay: number, fn: () => void): void {
    this.timers.push({ t: this.t + delay, fn });
  }

  runTimers(): void {
    for (let i = this.timers.length - 1; i >= 0; i--) {
      if (this.timers[i].t <= this.t) {
        const f = this.timers[i].fn;
        this.timers.splice(i, 1);
        f();
      }
    }
  }
}

const TRENCH_X = 1950;

export const SCENES: Record<string, Scene> = {
  trench: {
    cam: TRENCH_X + 60,
    trenches: [{ x: TRENCH_X, width: 300, owner: 0 }],
    forces: [
      { side: 0, kind: 'rifle', x: 1610, row: 0 },
      { side: 0, kind: 'rifle', x: 1650, row: 1 },
      { side: 0, kind: 'rifle', x: 1690, row: 2 },
      { side: 0, kind: 'rifle', x: 1730, row: 3 },
      { side: 0, kind: 'assault', x: 1580, row: 2 },
      { side: 1, kind: 'rifle', x: 2480, row: 1 },
      { side: 1, kind: 'rifle', x: 2530, row: 2 },
    ],
    tick(t, k) {
      const slots = [1860, 1915, 1985, 2040];
      for (let i = 0; i < 4; i++) {
        const leaving = t > 9 && (i === 1 || i === 3);
        if (leaving) {
          k.trench(i, -1);
          if (k.go(i, 2150 + i * 30, 52)) k.shootCycle(i, 12, 1.9, 2480, 1);
          continue;
        }
        if (k.go(i, slots[i], 48)) {
          k.trench(i, 0);
          k.face(i, 1);
          k.shootCycle(i, 4.6 + i * 0.37, 1.7 + i * 0.13, 2480 + (i % 2) * 50, 1 + (i % 2));
        }
      }
      if (t > 1.2) k.go(4, 2330, 92, 'aim');
      k.face(5, -1);
      k.face(6, -1);
      k.shootCycle(5, 2, 2.1, 1960, 2);
      k.shootCycle(6, 2.6, 2.4, 2010, 3);
    },
  },

  tank: {
    cam: TRENCH_X + 80,
    trenches: [{ x: TRENCH_X, width: 260, owner: 0 }],
    forces: [
      { side: 0, kind: 'tank', x: 1560, row: 2 },
      { side: 0, kind: 'rifle', x: 1720, row: 0 },
      { side: 0, kind: 'rifle', x: 1770, row: 1 },
      { side: 0, kind: 'rifle', x: 1820, row: 0 },
      { side: 0, kind: 'rifle', x: 1900, row: 3 },
      { side: 1, kind: 'rifle', x: 2520, row: 1 },
      { side: 1, kind: 'rifle', x: 2580, row: 3 },
    ],
    tick(t, k) {
      if (t < 13) k.go(0, 2210, 55, 'aim');
      else k.go(0, 1900, 45, 'aim');
      if (k.at(4) || k.at(9)) k.launch(0, 'tankGun', 2560, 0.6, 60);
      k.shootCycle(1, 0.5, 1.3, 2520, 1);
      k.shootCycle(2, 0.8, 1.1, 2580, 3);
      k.shootCycle(3, 1.1, 1.5, 2520, 1);
      k.trench(4, 0);
      k.shootCycle(4, 0.3, 1.6, 2580, 3);
      k.face(5, -1);
      k.face(6, -1);
      k.shootCycle(5, 1, 1.9, 1900, 3);
      k.shootCycle(6, 1.5, 2.2, 1800, 1);
    },
  },

  assault: {
    cam: 4060,
    trenches: [{ x: 4120, width: 220, owner: 1 }],
    pillboxes: [{ x: 4430, side: 1 }],
    wire: [{ x: 3830, width: 160, owner: 1 }],
    forces: [
      { side: 0, kind: 'mortar', x: 3560, row: 1 },
      { side: 0, kind: 'assault', x: 3700, row: 2 },
      { side: 0, kind: 'at', x: 3640, row: 3 },
      { side: 0, kind: 'tank', x: 3460, row: 0 },
      { side: 0, kind: 'rifle', x: 3720, row: 0 },
      { side: 1, kind: 'rifle', x: 4060, row: 0 },
      { side: 1, kind: 'rifle', x: 4110, row: 2 },
      { side: 1, kind: 'rifle', x: 4170, row: 3 },
      { side: 1, kind: 'lmg', x: 4290, row: 1 },
    ],
    tick(t, k) {
      for (let i = 5; i < 8; i++) {
        k.trench(i, 0);
        k.face(i, -1);
        k.shootCycle(i, 0.4 + i * 0.3, 1.8, 3700, 2);
      }
      k.face(8, -1);
      if (k.u[8].alive) k.stand(8, t > 0.5 ? 'fire' : 'aim');
      if (t > 0.5 && Math.floor(t * 8) !== Math.floor((t - k.dt) * 8) && Math.floor(t) % 3 !== 2) k.shot(8, 3720, 0, 'lmg');
      // Mortar: set up, then three bombs (the last one cuts the wire).
      const mp = (t - 1.5 + 3) % 3;
      k.stand(0, t < 1 ? 'deploy' : t < 1.5 ? 'aim' : mp < 0.25 ? 'fire' : mp < 2 ? 'reload' : 'aim');
      if (k.at(1.5)) k.launch(0, 'mortar', 4100, 1.7, 70);
      if (k.at(4.5)) k.launch(0, 'mortar', 4160, 1.7, 70);
      if (k.at(7.5)) k.launch(0, 'mortar', 3830, 1.2, 70);
      if (k.at(8.7)) {
        k.emit('wireDestroyed', { targetIndex: 0, side: 1, x: 3830, cause: 'explosive' });
        (k.s.wires[0] as { alive: boolean }).alive = false;
      }
      if (k.at(3.25)) k.kill(5, 'explosive', 1);
      // Assault trooper: dash up, throw a grenade into the trench, then fire.
      if (t > 1 && t < 4.4) k.go(1, 3940, 95);
      else if (t >= 4.4 && t < 5.3) k.stand(1, 'throw');
      else if (t >= 5.3) k.shootCycle(1, 5.3, 0.6, 4170, 3, 'smg');
      if (k.at(4.76)) k.launch(1, 'grenade', 4150, 0.85, 55);
      if (k.at(5.65)) k.kill(7, 'explosive', 1);
      // Anti-tank: two rockets into the pillbox.
      k.shootCycle(2, 0.6, 3.6, 4430, -1, '');
      if (k.at(1.86) || k.at(5.46)) {
        k.launch(2, 'rocket', 4430, 1.3, 30);
        const second = t > 3;
        k.later(1.3, () => {
          const p = k.s.pillboxes[0] as { hp: number; alive: boolean; maxHp: number };
          p.hp = second ? 0 : p.maxHp * 0.35;
          k.emit('structureHit', { target: 'pillbox', targetIndex: 0, side: 1, x: 4400, value: 100, cause: 'antiTank', dir: 1 });
          if (second) {
            p.alive = false;
            k.emit('structureDestroyed', { target: 'pillbox', targetIndex: 0, side: 1, x: 4430 });
          }
        });
      }
      // Tank: a shell into the machine gun nest.
      k.stand(3, 'aim');
      if (k.at(8.4)) k.launch(3, 'tankGun', 4290, 0.9, 60);
      if (k.at(9.3)) k.kill(8, 'explosive', 1);
      k.shootCycle(4, 0.2, 1.5, 4110, 2);
    },
  },

  support: {
    cam: 2950,
    forces: [
      { side: 0, kind: 'rifle', x: 2480, row: 1 },
      { side: 0, kind: 'rifle', x: 2530, row: 3 },
      { side: 0, kind: 'medic', x: 2420, row: 2 },
      { side: 1, kind: 'rifle', x: 3020, row: 0 },
      { side: 1, kind: 'rifle', x: 3070, row: 2 },
      { side: 1, kind: 'rifle', x: 3120, row: 3 },
      { side: 1, kind: 'lmg', x: 3180, row: 1 },
      { side: 1, kind: 'rifle', x: 3240, row: 2 },
    ],
    tick(_t, k) {
      for (let i = 3; i < 8; i++) {
        k.face(i, -1);
        k.shootCycle(i, 0.3 * i, 2 + 0.2 * i, 2500, 1 + (i % 3), i === 6 ? 'lmg' : 'rifle');
      }
      k.shootCycle(0, 0.2, 1.8, 3070, 2);
      k.shootCycle(1, 0.9, 1.6, 3120, 3);
      // Smoke screen in front of the British.
      if (k.at(0.4)) k.emit('supportIncoming', { side: 0, support: 'smoke', x: 2720, value: 1.5 });
      if (k.at(1.9)) {
        k.emit('smokeSpawned', { x: 2720, value: 170 });
        (k.s.smokes as { alive: boolean; x: number; radius: number; timeLeft: number; duration: number }[]).push({ alive: true, x: 2720, radius: 170, timeLeft: 9, duration: 9 });
      }
      for (const sm of k.s.smokes as { alive: boolean; timeLeft: number }[]) {
        if (!sm.alive) continue;
        sm.timeLeft -= k.dt;
        if (sm.timeLeft <= 0) sm.alive = false;
      }
      // Artillery barrage on the German line.
      if (k.at(1)) k.emit('supportIncoming', { side: 0, support: 'artillery', x: 3130, value: 2.5 });
      const shells = [3060, 3190, 3010, 3240, 3120, 3150];
      for (let r = 0; r < shells.length; r++) {
        if (k.at(2.4 + r * 0.45)) k.launch(-1, 'artilleryShell', shells[r], 1.1, 110, 0, shells[r] - 1300);
      }
      if (k.at(3.6)) k.kill(3, 'explosive', 1);
      if (k.at(4.4)) k.kill(5, 'explosive', -1);
      // Air strike along the line, then an airdrop for the British.
      if (k.at(6)) k.emit('supportIncoming', { side: 0, support: 'airStrike', x: 3150, value: 3.5 });
      const rockets = [3010, 3080, 3150, 3220, 3290];
      for (let r = 0; r < rockets.length; r++) {
        if (k.at(9.15 + r * 0.12)) k.launch(-1, 'airRocket', rockets[r], 0.35, 90, 0, rockets[r] - 140);
      }
      if (k.at(9.6)) k.kill(4, 'explosive', 1);
      if (k.at(9.8)) k.kill(6, 'explosive', 1);
      if (k.at(10.5)) k.emit('airdrop', { side: 0, x: 2600, value: 150 });
      k.stand(2, 'idle');
    },
  },

  turn: {
    cam: 2000,
    forces: [
      { side: 0, kind: 'rifle', x: 1800, row: 0 },
      { side: 0, kind: 'lmg', x: 1850, row: 1 },
      { side: 0, kind: 'sapper', x: 1900, row: 2 },
      { side: 0, kind: 'at', x: 1950, row: 3 },
      { side: 0, kind: 'tank', x: 2150, row: 1 },
    ],
    tick(t, k) {
      for (let i = 0; i < 4; i++) {
        const out = Math.floor(t / 2.4) % 2 === 0;
        k.go(i, out ? 2300 : 1700, i === 2 ? 70 : 64);
      }
      k.go(4, Math.floor(t / 4) % 2 === 0 ? 2450 : 1950, 40);
    },
  },

  wire: {
    cam: 3000,
    wire: [
      { x: 2720, width: 100, owner: 1 },
      { x: 3000, width: 160, owner: 1 },
      { x: 3330, width: 120, owner: 1 },
    ],
    forces: [
      { side: 0, kind: 'rifle', x: 2655, row: 2 },
      { side: 0, kind: 'rifle', x: 2890, row: 1 },
      { side: 0, kind: 'assault', x: 2850, row: 3 },
      { side: 0, kind: 'lmg', x: 2820, row: 0 },
      { side: 0, kind: 'tank', x: 3150, row: 1 },
    ],
    tick(t, k) {
      k.stand(0, 'idle');
      // Through the middle belt at the sim's wire speed (CONFIG.wireSlow), full speed outside it.
      const goals = [0, 3150, 3150, 3150];
      for (let i = 1; i < 4; i++) {
        const u = k.u[i];
        const inside = Math.abs(u.x - 3000) <= 80;
        const speed = UNITS[u.kind].speed * (inside ? CONFIG.wireSlow : 1);
        if (t > 0.3 * i) k.go(i, goals[i], speed);
        else k.stand(i);
      }
      // The tank drives into the right-hand belt and crushes it.
      if (t > 1) k.go(4, 3480, 40);
      else k.stand(4);
      const wr = k.s.wires[2] as { alive: boolean; id: number };
      if (wr.alive && k.u[4].x > 3330 - 60 - 40) {
        k.emit('wireDestroyed', { targetIndex: wr.id, side: 1, x: 3330, cause: null });
        wr.alive = false;
      }
    },
  },
};

