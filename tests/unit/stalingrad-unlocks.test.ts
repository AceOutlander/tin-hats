/**
 * The Stalingrad campaign's unit unlocks (v0.12.0 rules, owner 2026-11-09; DECISIONS 334): each mission unlocks its
 * types by mission progress, as data in its file (newUnit, unlocks, its unit list); once unlocked a type fields in
 * every later mission as the player's own nation's version for that mission's era. Played in order from a fresh save:
 * the unlock order suits the history and the teaching, every unit a mission needs is unlocked by then or loaned, the
 * NEW UNIT cards and the in-battle "New:" hints come only for the units that mission unlocks, and nothing a mission
 * unlocks goes unannounced.
 */
import { describe, expect, it } from 'vitest';
import { buildCampaignView } from '../../src/app/campaignView';
import { missionEra } from '../../src/data/eras';
import { MEDALS } from '../../src/data/medals';
import { STALINGRAD_MISSIONS } from '../../src/data/missions/stalingrad';
import type { MissionDef, UnitKind } from '../../src/data/schema';
import { UNITS } from '../../src/data/units';
import { UPGRADES } from '../../src/data/upgrades';
import {
  defaultSave,
  isUnlocked,
  missionRoster,
  missionUnlocks,
  newsFor,
  playerUnitKinds,
  recordClear,
  unitsUnlocked,
  withNews,
  type MissionNews,
  type Roster,
  type SaveData,
} from '../../src/meta';

const IDS = STALINGRAD_MISSIONS.map((m) => m.id);

/** The order the design settles on (DECISIONS 334): what each mission brings that the player did not have. */
const ORDER: Record<number, UnitKind[]> = {
  1001: ['lmg', 'at'],
  1002: ['tank', 'mortar'],
  1003: ['assault'],
  1004: ['medic', 'conscript'],
  1005: ['flame'],
  1006: ['sniper', 'aa'],
  1007: ['commander'],
  1008: [],
  1009: ['apc'],
  1010: [],
};

interface Step {
  m: MissionDef;
  /** What the player has unlocked when the mission starts (its own unlocks included). */
  unlocked: UnitKind[];
  /** What the player had before it: unlocked by earlier missions, and the signature kinds earlier missions list. */
  had: UnitKind[];
  roster: Roster;
  news: MissionNews;
  save: SaveData;
}

/** The campaign played in order from a fresh save, each mission cleared before the next. */
function walk(): Step[] {
  const save = defaultSave();
  const steps: Step[] = [];
  const listed: UnitKind[] = [];
  for (const m of STALINGRAD_MISSIONS) {
    const reached = (id: number): boolean => isUnlocked(save, IDS, id);
    expect(reached(m.id), `mission ${m.id} is reached`).toBe(true);
    const unlocked = unitsUnlocked(save, STALINGRAD_MISSIONS, reached);
    const before = unitsUnlocked(save, STALINGRAD_MISSIONS, reached, m.id, false);
    const had = [...new Set([...before, ...listed])];
    steps.push({
      m,
      unlocked,
      had,
      roster: missionRoster(save, m, unlocked),
      news: newsFor(save, STALINGRAD_MISSIONS, reached, m),
      save: structuredClone(save),
    });
    for (const k of m.units[0]) if (!listed.includes(k)) listed.push(k);
    recordClear(save, m.id, 'normal');
  }
  return steps;
}

const STEPS = walk();
const step = (id: number): Step => {
  const s = STEPS.find((x) => x.m.id === id);
  if (!s) throw new Error(`mission ${id} missing`);
  return s;
};

/** Every kind the player's side has in a mission without training it: the start forces and its own scripted waves. */
function provided(m: MissionDef): Set<UnitKind> {
  const out = new Set<UnitKind>(m.start[0].forces.map((f) => f.kind));
  for (const e of m.events) if (e.type === 'wave' && e.side === 0) for (const f of e.forces) out.add(f.kind);
  return out;
}

function enemyKinds(m: MissionDef): Set<UnitKind> {
  const out = new Set<UnitKind>([...m.units[1], ...m.start[1].forces.map((f) => f.kind)]);
  for (const e of m.events) if (e.type === 'wave' && e.side === 1) for (const f of e.forces) out.add(f.kind);
  return out;
}

describe('the Stalingrad unlock order', () => {
  it('brings each mission the types the design settles on, and only those', () => {
    for (const s of STEPS) expect(s.news.units, `mission ${s.m.id}`).toEqual(ORDER[s.m.id]);
  });

  it('starts mission 1 with sappers, riflemen and two basics: the DP gunner and the Tank Hunters', () => {
    expect(step(1001).unlocked).toEqual(['sapper', 'rifle', 'lmg', 'at']);
    expect(missionEra(step(1001).m, 'soviet').names.at).toBe('Tank Hunters');
    // The anti-tank kind is the PTRD Team from November 1941 (src/data/eras.ts), with no second unlock.
    expect(missionEra(step(1003).m, 'soviet').names.at).toBe('PTRD Team');
  });

  it('unlocks every type the player can field by the end of the campaign, and the Soviet conscripts', () => {
    const last = STEPS[STEPS.length - 1];
    expect([...last.unlocked].sort()).toEqual([...playerUnitKinds(), 'conscript'].sort());
  });

  it('writes the order as data in the mission files: newUnit first, then unlocks, every one in the unit list', () => {
    for (const s of STEPS) {
      const declared = [...(s.m.newUnit ? [s.m.newUnit] : []), ...(s.m.unlocks ?? [])];
      expect(declared, `mission ${s.m.id}`).toEqual(ORDER[s.m.id]);
      for (const kind of declared) expect(s.m.units[0], `mission ${s.m.id} lists ${kind}`).toContain(kind);
    }
  });

  it('never unlocks a type without announcing it: whatever a mission newly lists is its NEW', () => {
    for (const s of STEPS) {
      const fresh = missionUnlocks(s.m).filter((k) => !s.had.includes(k) && !MEDALS.free.includes(k));
      expect(fresh.sort(), `mission ${s.m.id}`).toEqual([...ORDER[s.m.id]].sort());
    }
  });

  it('lists in every mission all it has unlocked by then, so a replay never calls an old unit new', () => {
    for (const s of STEPS) {
      const missing = s.unlocked.filter((k) => !s.m.units[0].includes(k));
      expect(missing, `mission ${s.m.id}`).toEqual([]);
    }
  });

  it('keeps the signature conscripts listed in every Soviet mission from Klin on, once unlocked', () => {
    for (const s of STEPS) expect(s.m.units[0].includes('conscript'), `mission ${s.m.id}`).toBe(s.m.id >= 1004);
  });
});

describe('every unit a Stalingrad mission needs is unlocked by then or loaned', () => {
  it.each(STEPS.map((s) => [s.m.id, s] as const))('mission %i', (_id, s) => {
    const { m, roster } = s;
    const missing: string[] = [];
    // The reasonable-player bot plays the mission as its design needs it: everything it trains is unlocked by then.
    for (const b of m.bot.build) if (!roster.units.includes(b.kind)) missing.push(`bot trains ${b.kind}`);
    // The design's own list: unlocked by then (or by this mission).
    for (const k of m.units[0]) if (UNITS[k].trainable && !roster.units.includes(k)) missing.push(`listed ${k}`);
    // Enemy armour needs the anti-tank kind: unlocked, or lent (placed at the start or brought up by a scripted wave).
    const armour = [...enemyKinds(m)].some((k) => k === 'tank' || k === 'lightTank' || k === 'heavyTank' || k === 'apc');
    const lent = provided(m);
    for (const l of roster.loans) lent.add(l.kind);
    if (armour && !roster.units.includes('at') && !lent.has('at')) missing.push('anti-tank for the enemy armour');
    // Strongpoints (pillboxes, enemy-held trenches) need something that cracks them.
    const strong = m.pillboxes.length > 0 || m.trenches.some((t) => t.owner === 1);
    const crackers: UnitKind[] = ['assault', 'mortar', 'flame'];
    if (strong && !crackers.some((k) => roster.units.includes(k) || lent.has(k))) missing.push('a strongpoint cracker');
    expect(missing).toEqual([]);
  });

  it('lends only what the player cannot have unlocked yet: every placed kind not unlocked is a later unlock', () => {
    const order = STEPS.flatMap((s) => ORDER[s.m.id].map((k) => [k, s.m.id] as const));
    for (const s of STEPS) {
      for (const kind of provided(s.m)) {
        if (!UNITS[kind].trainable || s.roster.units.includes(kind)) continue;
        const at = order.find(([k]) => k === kind);
        expect(at, `mission ${s.m.id} lends ${kind}`).toBeDefined();
        expect(at?.[1] ?? 0, `mission ${s.m.id} lends ${kind}`).toBeGreaterThan(s.m.id);
      }
    }
  });
});

describe('NEW cards and "New:" hints only for the units a mission unlocks', () => {
  it('gives a "New:" hint, in the era\'s name, for every unit the mission unlocks, and none for another', () => {
    for (const s of STEPS) {
      const names = missionEra(s.m, 'soviet').names;
      const newHints = s.m.events.filter((e) => e.type === 'hint' && e.text.startsWith('New:'));
      for (const kind of ORDER[s.m.id]) {
        const hint = newHints.find((e) => e.type === 'hint' && e.about === kind);
        expect(hint, `mission ${s.m.id} hint about ${kind}`).toBeDefined();
        if (hint && hint.type === 'hint') expect(hint.text, `mission ${s.m.id}`).toContain(`New: ${names[kind]}`);
      }
      for (const e of newHints) {
        if (e.type !== 'hint') continue;
        expect(e.about, `mission ${s.m.id}: "${e.text}"`).toBeDefined();
        const fresh: string[] = [...ORDER[s.m.id], ...(s.m.newSupport ? [s.m.newSupport] : [])];
        expect(fresh, `mission ${s.m.id}: "${e.text}"`).toContain(e.about);
      }
    }
  });

  it('drops the "New:" hints of a replay: everything is unlocked by then', () => {
    const done = defaultSave();
    for (const id of IDS) recordClear(done, id, 'normal');
    const reached = (id: number): boolean => isUnlocked(done, IDS, id);
    for (const m of STALINGRAD_MISSIONS) {
      const news = newsFor(done, STALINGRAD_MISSIONS, reached, m);
      expect(news.units, `mission ${m.id}`).toEqual([]);
      const played = withNews(m, news);
      const left = played.events.filter((e) => e.type === 'hint' && e.text.startsWith('New:') && e.about !== undefined && UNITS[e.about as UnitKind] !== undefined);
      expect(left, `mission ${m.id}`).toEqual([]);
    }
  });

  it('shows the briefing\'s NEW UNIT cards, in the Soviet era names, as the player gets there', () => {
    for (const s of STEPS) {
      const view = buildCampaignView(s.save, STALINGRAD_MISSIONS, UPGRADES, false, 'soviet');
      const card = view.missions.find((c) => c.id === s.m.id);
      const shown = [...(card?.newUnit ? [card.newUnit] : []), ...(card?.moreNewUnits ?? [])];
      const names = missionEra(s.m, 'soviet').names;
      expect(shown.map((u) => u.kind), `mission ${s.m.id}`).toEqual(ORDER[s.m.id]);
      expect(shown.map((u) => u.name), `mission ${s.m.id}`).toEqual(ORDER[s.m.id].map((k) => names[k]));
      expect(card?.loans ?? [], `mission ${s.m.id} lends nothing through the Armoury`).toEqual([]);
    }
  });
});
