import { describe, expect, it } from 'vitest';
import { App } from '../../src/app/app';
import { installPageGuards } from '../../src/app/page';
import { playClockTick, playEventSound, playWaveWarning, type SfxAudio } from '../../src/app/sfx';
import { BattleSession } from '../../src/app/session';
import { M01 } from '../../src/data/missions/m01';
import type { MissionDef } from '../../src/data/schema';
import { EVENT_SOUND, ONE_SHOT_NAMES, SFX } from '../../src/data/sounds';
import { createMemoryStorage } from '../../src/meta';
import { createBattle, type SimEvent } from '../../src/sim';
import type { SimEventType } from '../../src/sim/types';
import { createFakeAudio, createFakeUi, createFakeView } from './app-helpers';

function ev(type: SimEventType, extra: Partial<SimEvent> = {}): SimEvent {
  return {
    type,
    side: 0,
    source: 'none',
    unit: -1,
    unitId: -1,
    kind: null,
    weapon: null,
    x: 1234,
    row: 0,
    x2: 0,
    row2: 0,
    target: 'none',
    targetIndex: -1,
    value: 0,
    hit: false,
    dir: 0,
    cause: null,
    order: null,
    support: null,
    text: null,
    ...extra,
  };
}

interface Played {
  name: string;
  x: number | null;
  opts?: { volume?: number; pitch?: number };
}

function recorder(): { audio: SfxAudio; played: Played[] } {
  const played: Played[] = [];
  const audio: SfxAudio = {
    play: (name, opts) => void played.push({ name, x: null, opts }),
    playAt: (name, x, opts) => void played.push({ name, x, opts }),
    endBattleMusic: () => false,
  };
  return { audio, played };
}

describe('the sounds the app plays for events', () => {
  it('names only sounds that exist', () => {
    for (const name of Object.values(EVENT_SOUND)) expect(ONE_SHOT_NAMES).toContain(name);
    expect(ONE_SHOT_NAMES).toContain('victorySting');
    expect(ONE_SHOT_NAMES).toContain('defeatSting');
  });

  it('plays the victory or defeat sting for the end of the battle', () => {
    const { audio, played } = recorder();
    playEventSound(audio, ev('battleEnded', { side: 0 }), 0);
    playEventSound(audio, ev('battleEnded', { side: 1 }), 0);
    playEventSound(audio, ev('battleEnded', { side: -1 }), 0);
    expect(played.map((p) => p.name)).toEqual(['victorySting', 'defeatSting', 'defeatSting']);
  });

  it('leaves the sting to the battle music when the music has one ready', () => {
    const { audio, played } = recorder();
    const ends: [boolean, boolean][] = [];
    audio.endBattleMusic = (won, sting) => {
      ends.push([won, sting]);
      return true;
    };
    playEventSound(audio, ev('battleEnded', { side: 0 }), 0);
    playEventSound(audio, ev('battleEnded', { side: 1 }), 0);
    expect(played).toEqual([]);
    expect(ends).toEqual([
      [true, true],
      [false, true],
    ]);
  });

  it('sounds a trench taken where it is, lower and quieter when the enemy takes it', () => {
    const { audio, played } = recorder();
    playEventSound(audio, ev('trenchCaptured', { side: 0, x: 900 }), 0);
    playEventSound(audio, ev('trenchCaptured', { side: 1, x: 2400 }), 0);
    expect(played[0]).toEqual({ name: 'trenchCaptured', x: 900, opts: undefined });
    expect(played[1]).toEqual({ name: 'trenchCaptured', x: 2400, opts: SFX.enemyCapture });
    expect(SFX.enemyCapture.volume).toBeLessThan(1);
    expect(SFX.enemyCapture.pitch).toBeLessThan(1);
  });

  it('sounds wire parting, a smoke canister, a grenade leaving a hand and a pillbox giving way at their place', () => {
    const { audio, played } = recorder();
    playEventSound(audio, ev('wireDestroyed', { x: 500 }), 0);
    playEventSound(audio, ev('smokeSpawned', { x: 600 }), 0);
    playEventSound(audio, ev('projectile', { weapon: 'grenade', x: 700 }), 0);
    playEventSound(audio, ev('structureDestroyed', { target: 'pillbox', x: 800 }), 0);
    expect(played.map((p) => [p.name, p.x])).toEqual([
      ['wireSnap', 500],
      ['smokePop', 600],
      ['grenadeThrow', 700],
      ['pillboxCollapse', 800],
    ]);
  });

  it('leaves to the renderer what it already sounds: shells, rockets, HQ ruin, other structures, shots', () => {
    const { audio, played } = recorder();
    playEventSound(audio, ev('projectile', { weapon: 'mortar' }), 0);
    playEventSound(audio, ev('projectile', { weapon: 'rocket' }), 0);
    playEventSound(audio, ev('structureDestroyed', { target: 'hq' }), 0);
    playEventSound(audio, ev('shot', { weapon: 'rifle' }), 0);
    playEventSound(audio, ev('explosion'), 0);
    playEventSound(audio, ev('supplyDelivered'), 0);
    playEventSound(audio, ev('trainDone'), 0);
    playEventSound(audio, ev('orderChanged', { order: 'advance' }), 0);
    expect(played).toEqual([]);
  });

  it('plays the radio call for the player’s support only', () => {
    const { audio, played } = recorder();
    playEventSound(audio, ev('supportCalled', { side: 0, support: 'smoke' }), 0);
    playEventSound(audio, ev('supportCalled', { side: 1, support: 'artillery' }), 0);
    expect(played.map((p) => p.name)).toEqual(['supportCall']);
  });

  it('sounds the wave warning', () => {
    const { audio, played } = recorder();
    playWaveWarning(audio);
    expect(played.map((p) => p.name)).toEqual(['waveHorn']);
  });
});

describe('the clock tick', () => {
  it('ticks each whole second of the last ten once, louder in the last three, and never before', () => {
    const { audio, played } = recorder();
    let last = -1;
    for (let s = 14; s > 0; s -= 0.05) last = playClockTick(audio, s, last);
    expect(played.length).toBe(SFX.tickSeconds);
    expect(played.every((p) => p.name === 'timerTick')).toBe(true);
    const loud = played.filter((p) => p.opts?.volume !== undefined);
    expect(loud.length).toBe(SFX.loudSeconds);
    expect(loud[0].opts?.volume).toBe(SFX.loudTickVolume);
    expect(last).toBe(1);
  });

  it('does nothing for a clock that is not near its end, or has run out', () => {
    const { audio, played } = recorder();
    expect(playClockTick(audio, 60, -1)).toBe(-1);
    expect(playClockTick(audio, 10.4, -1)).toBe(-1);
    expect(playClockTick(audio, 0, -1)).toBe(-1);
    expect(played).toEqual([]);
  });
});

/** Mission 1 turned into a survival mission with a clock of the given length and a scripted enemy wave. */
function timed(seconds: number, wave = true): MissionDef {
  const m: MissionDef = structuredClone(M01);
  m.events = wave ? [{ type: 'wave', when: { at: 2 }, side: 1, forces: [{ kind: 'rifle', count: 1 }] }] : [];
  m.timer = { seconds, onExpire: 'win', label: 'Relief' };
  m.mode = 'survival';
  m.start[1].hasHq = false;
  m.start[1].forces = [];
  m.start[0].forces = [];
  return m;
}

function sessionFor(m: MissionDef, sound = () => true) {
  const battle = createBattle({ mission: m, difficulty: 'normal', seed: 3, upgrades: {}, commanders: ['human', 'ai'] });
  const audio = createFakeAudio();
  const session = new BattleSession(battle, 'normal', 3, createFakeView(), audio, { hints: () => true, sound, onEnded: () => undefined });
  return { session, audio };
}

describe('sound in the battle session', () => {
  it('ticks the mission clock through the last ten seconds, once a second', () => {
    const { session, audio } = sessionFor(timed(14, false));
    for (let i = 0; i < 30 * 13; i++) session.step();
    const ticks = audio.played.filter((n) => n === 'timerTick');
    expect(ticks.length).toBe(SFX.tickSeconds);
  });

  it('is silent at fast-forward speed, and the clock tick follows the same rule', () => {
    const { session, audio } = sessionFor(timed(14, false), () => false);
    for (let i = 0; i < 30 * 13; i++) session.step();
    expect(audio.played).toEqual([]);
  });

  it('blows the horn for the enemy wave it announces, and only then', () => {
    const { session, audio } = sessionFor(timed(60));
    for (let i = 0; i < 30 * 4; i++) session.step();
    expect(audio.played.filter((n) => n === 'waveHorn').length).toBe(1);
    // A scripted wave that nobody is told about is silent (assault mission, no text).
    const quiet: MissionDef = structuredClone(M01);
    quiet.events = [{ type: 'wave', when: { at: 1 }, side: 1, forces: [{ kind: 'rifle', count: 1 }] }];
    const other = sessionFor(quiet);
    for (let i = 0; i < 30 * 3; i++) other.session.step();
    expect(other.audio.played).not.toContain('waveHorn');
  });
});

describe('the audio follows the page and the pause', () => {
  function rig() {
    const view = createFakeView();
    const audio = createFakeAudio();
    const app = new App({ view, audio, storage: createMemoryStorage(), random: () => 0.25 });
    app.attachUi(createFakeUi());
    const doc = Object.assign(new EventTarget(), { visibilityState: 'visible' as DocumentVisibilityState });
    const win = new EventTarget();
    installPageGuards(app, audio, doc as unknown as Document, win as unknown as Window);
    const hide = (): void => {
      doc.visibilityState = 'hidden';
      doc.dispatchEvent(new Event('visibilitychange'));
    };
    const show = (): void => {
      doc.visibilityState = 'visible';
      doc.dispatchEvent(new Event('visibilitychange'));
    };
    return { app, audio, doc, win, hide, show };
  }

  it('silences the menus when the page is hidden and brings sound back when it returns', () => {
    const { audio, hide, show } = rig();
    expect(audio.suspended).toBe(false);
    hide();
    expect(audio.suspended).toBe(true);
    show();
    expect(audio.suspended).toBe(false);
  });

  it('pauses a battle when the page is hidden and keeps it, and its sound, paused on return', () => {
    const { app, audio, hide, show } = rig();
    app.startMission(1, 'normal');
    expect(app.loop.paused).toBe(false);
    hide();
    expect(app.loop.paused).toBe(true);
    expect(audio.suspended).toBe(true);
    show();
    expect(app.loop.paused).toBe(true);
    expect(audio.suspended).toBe(true);
    app.dispatch({ type: 'resume' });
    expect(audio.suspended).toBe(false);
  });

  it('suspends the audio on pause and resumes it on resume', () => {
    const { app, audio } = rig();
    app.startMission(1, 'normal');
    app.dispatch({ type: 'pause' });
    expect(audio.suspended).toBe(true);
    app.dispatch({ type: 'resume' });
    expect(audio.suspended).toBe(false);
  });

  it('pauses the battle but not the menus’ sound when only focus is lost, and hides on pagehide', () => {
    const { app, audio, win } = rig();
    app.startMission(1, 'normal');
    win.dispatchEvent(new Event('blur'));
    expect(app.loop.paused).toBe(true);
    app.dispatch({ type: 'resume' });
    win.dispatchEvent(new Event('pagehide'));
    expect(audio.suspended).toBe(true);
  });

  it('saves the mute switch, applies it at once, and restores it on the next start', () => {
    const storage = createMemoryStorage();
    const audio = createFakeAudio();
    const app = new App({ view: createFakeView(), audio, storage, random: () => 0.25 });
    app.attachUi(createFakeUi());
    app.startMission(1, 'normal');
    app.dispatch({ type: 'toggleMute' });
    expect(audio.muted).toBe(true);
    // Muting from the pause menu works the same.
    app.dispatch({ type: 'pause' });
    app.dispatch({ type: 'toggleMute' });
    expect(audio.muted).toBe(false);
    app.dispatch({ type: 'toggleMute' });
    expect(audio.muted).toBe(true);
    const again = createFakeAudio();
    new App({ view: createFakeView(), audio: again, storage, random: () => 0.25 });
    expect(again.muted).toBe(true);
    // And from the settings screen.
    app.setSetting('muted', false);
    expect(audio.muted).toBe(false);
  });
});
