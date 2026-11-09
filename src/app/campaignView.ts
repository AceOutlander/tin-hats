/**
 * Builds the view models of the menu screens (campaign map, briefing,
 * Quartermaster, settings, result) from the save and the data. Pure functions:
 * no DOM, so they run in unit tests.
 */
import { APP } from '../data/app';
import { missionEra } from '../data/eras';
import { DIFFICULTIES, DIFFICULTY_LIST } from '../data/difficulty';
import { FACTIONS } from '../data/factions';
import { MEDALS } from '../data/medals';
import type { Difficulty, FactionId, MissionDef, UnitKind, UpgradeDef, UpgradeEffect } from '../data/schema';
import {
  canBuy,
  canBuyItem,
  canRefund,
  isCleared,
  isFree,
  isUnlocked,
  levelCost,
  maxLevel,
  missionRoster,
  newsFor,
  ownsItem,
  playerUnitKinds,
  pointsAvailable,
  pointsSpent,
  replayPercent,
  trainingOffered,
  unitsUnlocked,
  unlockingMission,
  upgradeLevel,
  winsOn,
  type MedalBreakdown,
  type Reached,
  type SaveData,
} from '../meta';
import type { Battle, EndReason } from '../sim';
import type { ArmouryItemView, CampaignView, MedalResultView, MissionCard, ResultView, UpgradeView } from '../ui/contracts';

/** "+10% health" for one effect; an empty string for an effect that changes nothing. */
export function describeEffect(effect: UpgradeEffect): string {
  // A call-in rate divides the cooldown: shown as the cooldown it takes off ("-17% cooldown").
  const change = effect.stat === 'supportRate' ? 1 / effect.mul : effect.mul;
  const percent = Math.round((change - 1) * 100);
  if (percent === 0) return '';
  return `${percent > 0 ? '+' : '-'}${Math.abs(percent)}% ${APP.statLabels[effect.stat]}`;
}

/** "+10% health, +5% damage" for one level's effects. */
export function describeLevel(effects: readonly UpgradeEffect[]): string {
  const parts: string[] = [];
  for (const e of effects) {
    const text = describeEffect(e);
    if (text) parts.push(text);
  }
  return parts.length > 0 ? parts.join(', ') : APP.effectNone;
}

/** How the campaign screens see a save's progress (worked out once per view). */
export interface Progress {
  ids: readonly number[];
  missions: readonly MissionDef[];
  /** Every mission open on the map (the debug hook or the admin panel). */
  unlockAll: boolean;
  /** Reached by the player's own progress: what is new in a briefing is worked out from this. */
  progressed: Reached;
  /**
   * Unit types the player fields: every mission reached by the player's own progress unlocks its types (a mission an
   * unlock-all opened brings only its own, as when a player reaches it).
   */
  unlocked: UnitKind[];
}

export function progressOf(save: SaveData, missions: readonly MissionDef[], unlockAll: boolean): Progress {
  const ids = missions.map((m) => m.id);
  const progressed: Reached = (id) => isUnlocked(save, ids, id);
  const unlocked = unitsUnlocked(save, missions, progressed);
  return { ids, missions, unlockAll, progressed, unlocked };
}

function missionCard(save: SaveData, p: Progress, m: MissionDef): MissionCard {
  // The names of the mission's date (src/data/eras.ts): Tank Hunters in June 1941, PTRD Teams from November.
  const era = missionEra(m, m.start[0].faction);
  const faction = { unitNames: era.names, unitBlurbs: era.blurbs, supportNames: era.supportNames };
  const cleared = {} as Record<Difficulty, boolean>;
  const replay = {} as Record<Difficulty, number>;
  for (const d of DIFFICULTY_LIST) {
    cleared[d] = isCleared(save, m.id, d);
    replay[d] = replayPercent(winsOn(save, m.id, d));
  }
  // NEW cards only for what this mission really unlocks for this player (owner, 2026-11-09).
  const news = newsFor(save, p.missions, p.progressed, m);
  const unitCard = (kind: UnitKind): { kind: UnitKind; name: string; blurb: string } => ({
    kind,
    name: faction.unitNames[kind],
    blurb: faction.unitBlurbs[kind],
  });
  const loans = missionRoster(save, m, p.unlocked).loans.map((l) => ({ kind: l.kind, name: faction.unitNames[l.kind], count: l.count }));
  return {
    replayPercent: replay,
    loans,
    id: m.id,
    title: m.title,
    location: m.location,
    date: m.date,
    theatre: m.theatre,
    mapPos: m.mapPos,
    briefing: m.briefing,
    objective: m.objective,
    unlocked: p.unlockAll || isUnlocked(save, p.ids, m.id),
    cleared,
    newUnit: news.units.length > 0 ? unitCard(news.units[0]) : null,
    moreNewUnits: news.units.slice(1).map(unitCard),
    newSupport: news.support
      ? { kind: news.support, name: faction.supportNames[news.support], blurb: APP.supportBlurbs[news.support] }
      : null,
  };
}

/**
 * One Quartermaster card. Its group is named in the player's own nation (the unit or call-in it belongs to); HQ and
 * sapper upgrades share one group.
 */
function upgradeView(save: SaveData, defs: readonly UpgradeDef[], def: UpgradeDef, nation: FactionId): UpgradeView {
  const max = maxLevel(def);
  const own = FACTIONS[nation];
  const support = def.support ?? null;
  const group = support !== null ? own.supportNames[support] : def.unit !== null && def.unit !== 'sapper' ? own.unitNames[def.unit] : APP.upgradeHqGroup;
  return {
    id: def.id,
    name: def.name,
    description: def.description,
    unit: def.unit,
    support,
    group,
    level: Math.min(upgradeLevel(save, def.id), max),
    maxLevel: max,
    cost: levelCost(def, Math.min(upgradeLevel(save, def.id), max) + 1),
    levelText: def.levels.slice(0, max).map(describeLevel),
    canBuy: canBuy(save, defs, def.id),
    canRefund: canRefund(save, def.id),
  };
}

/**
 * Everything the campaign map, briefing, Quartermaster and settings screens show. `unlockAll` (the debug hook) opens
 * every mission without recording any clear.
 */
// Every campaign so far is played as the British; a campaign of another nation passes its own (as buildArmoury).
export function buildCampaignView(
  save: SaveData,
  missions: readonly MissionDef[],
  defs: readonly UpgradeDef[],
  unlockAll = false,
  nation: FactionId = 'british',
): CampaignView {
  const p = progressOf(save, missions, unlockAll);
  return {
    missions: missions.map((m) => missionCard(save, p, m)),
    lastMission: p.ids.includes(save.lastMission) ? save.lastMission : 0,
    pointsEarned: pointsAvailable(save) + pointsSpent(save, defs),
    pointsSpent: pointsSpent(save, defs),
    pointsAvailable: pointsAvailable(save),
    upgrades: defs.map((d) => upgradeView(save, defs, d, nation)),
    settings: { ...save.settings },
    difficulties: DIFFICULTY_LIST.map((id) => ({ id, name: DIFFICULTIES[id].name })),
    medals: save.medals,
    armoury: buildArmoury(save, nation, p.unlocked, missions),
    training: { done: save.training.done, offer: trainingOffered(save), reward: MEDALS.trainingReward },
  };
}

/**
 * The Armoury: every unit type (free, unlocked, or locked with the mission that unlocks it; units are not sold since
 * the owner's change of 2026-11-09), then the plane call-ins for sale. Names and blurbs are those of the nation the
 * player commands in the current campaign; other nations' names are never shown (owner, 2026-11-08). Every campaign
 * so far is played as the British; a campaign of another nation passes its own.
 */
export function buildArmoury(
  save: SaveData,
  nation: FactionId = 'british',
  unlocked: readonly UnitKind[] = [],
  missions: readonly MissionDef[] = [],
): ArmouryItemView[] {
  const own = FACTIONS[nation];
  const out: ArmouryItemView[] = [];
  for (const u of MEDALS.units) {
    if (!playerUnitKinds().includes(u.kind)) continue;
    const free = isFree(u.kind);
    const owned = free || unlocked.includes(u.kind) || save.armoury.includes(u.kind);
    const by = owned ? null : unlockingMission(u.kind, missions);
    out.push({
      id: u.kind,
      type: 'unit',
      kind: u.kind,
      name: own.unitNames[u.kind],
      blurb: own.unitBlurbs[u.kind],
      price: 0,
      isNew: u.isNew,
      free,
      owned,
      canBuy: false,
      lockedNote: owned ? undefined : by ? `Mission ${missions.indexOf(by) + 1}` : 'Coming later',
    });
  }
  for (const item of MEDALS.armoury) {
    out.push({
      id: item.id,
      type: item.type,
      kind: item.id,
      name: own.supportNames[item.id],
      blurb: APP.supportBlurbs[item.id],
      price: item.price,
      isNew: item.isNew,
      free: false,
      owned: ownsItem(save, item.id),
      canBuy: canBuyItem(save, item.id),
    });
  }
  return out;
}

/** The victory screen's score breakdown. */
export function medalView(b: MedalBreakdown): MedalResultView {
  return {
    medals: b.medals,
    time: b.time ? { ...b.time } : null,
    casualties: { ...b.casualties },
    hq: b.hq ? { ...b.hq } : null,
    base: b.base,
    difficultyMul: b.difficultyMul,
    replayPercent: Math.floor(b.replayFactor * 100 + 1e-9),
  };
}

/** Why a battle ended, in words, for the result screen. `label` = the mission timer's label ("Nightfall"), if it has one. */
export function describeEnd(endReason: EndReason, won: boolean, label: string | null): string {
  const reason = endReason === 'none' ? APP.reasons.draw : APP.reasons[endReason];
  return (won ? reason.win : reason.lose).replace('{label}', label ?? 'Time');
}

/** The result screen's figures for a battle that has ended. */
export function buildResult(
  battle: Battle,
  difficulty: Difficulty,
  pointsAwarded: number,
  nextMissionId: number | null,
  medals: MedalBreakdown | null = null,
): ResultView {
  const s = battle.state;
  const mission = battle.config.mission;
  const won = s.winner === 0;
  const stats = s.sides[0].stats;
  return {
    won,
    missionId: mission.id,
    title: mission.title,
    reason: describeEnd(s.endReason, won, mission.timer ? mission.timer.label : null),
    difficulty,
    timeSec: s.time,
    unitsTrained: stats.trained,
    unitsLost: stats.lost,
    enemiesKilled: stats.kills,
    suppliesGathered: Math.floor(stats.suppliesGathered),
    pointsAwarded,
    nextMissionId,
    medals: medals ? medalView(medals) : null,
  };
}
