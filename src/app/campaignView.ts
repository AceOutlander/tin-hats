/**
 * Builds the view models of the menu screens (campaign map, briefing,
 * Quartermaster, settings, result) from the save and the data. Pure functions:
 * no DOM, so they run in unit tests.
 */
import { APP } from '../data/app';
import { CAMPAIGNS, CAMPAIGN_IDS, UPCOMING_CAMPAIGNS, type UpcomingCampaign } from '../data/campaigns';
import { missionEra } from '../data/eras';
import { upgradeTextFor } from '../data/upgradeText';
import { DIFFICULTIES, DIFFICULTY_LIST } from '../data/difficulty';
import { FACTIONS } from '../data/factions';
import { MEDALS } from '../data/medals';
import type { CampaignId, Difficulty, FactionId, MissionDef, SupportKind, UnitKind, UpgradeDef, UpgradeEffect } from '../data/schema';
import {
  canBuy,
  canBuyCharge,
  chargesOf,
  canRefund,
  isCleared,
  isFree,
  isUnlocked,
  loadoutOptions,
  levelCost,
  maxLevel,
  missionRoster,
  newsFor,
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
import type { ArmouryItemView, CampaignCardView, CampaignView, MedalResultView, MissionCard, ResultView, UpgradeView } from '../ui/contracts';

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
  /** The campaign on the map: its mission ids and missions, in order. */
  ids: readonly number[];
  missions: readonly MissionDef[];
  /** Every mission of every campaign the player can play: unit types unlocked anywhere count everywhere. */
  all: readonly MissionDef[];
  /** Every mission open on the map (the debug hook or the admin panel). */
  unlockAll: boolean;
  /** Reached by the player's own progress, in its own campaign: what is new in a briefing is worked out from this. */
  progressed: Reached;
  /**
   * Unit types the player fields: every mission reached by the player's own progress, in any campaign, unlocks its
   * types (a mission an unlock-all opened brings only its own, as when a player reaches it; owner, 2026-11-09).
   */
  unlocked: UnitKind[];
}

/**
 * The progress of a save on the campaign `missions`, with `campaigns` every campaign the player can play (each in its
 * own order; default the one campaign). A mission is reached when it is the first of its campaign or the one before
 * it there has been cleared.
 */
export function progressOf(
  save: SaveData,
  missions: readonly MissionDef[],
  unlockAll: boolean,
  campaigns: readonly (readonly MissionDef[])[] = [missions],
): Progress {
  const ids = missions.map((m) => m.id);
  const lists = campaigns.some((c) => c === missions) ? campaigns : [missions, ...campaigns];
  const idLists = lists.map((c) => c.map((m) => m.id));
  const progressed: Reached = (id) => idLists.some((list) => isUnlocked(save, list, id));
  const all = lists.flat();
  const unlocked = unitsUnlocked(save, all, progressed);
  return { ids, missions, all, unlockAll, progressed, unlocked };
}

function missionCard(save: SaveData, p: Progress, m: MissionDef): MissionCard {
  // The names of the mission's date (src/data/eras.ts): Tank Hunters in June 1941, AT Rifle Teams from November.
  const era = missionEra(m, m.start[0].faction);
  const faction = { unitNames: era.names, unitBlurbs: era.blurbs, supportNames: era.supportNames };
  const cleared = {} as Record<Difficulty, boolean>;
  const replay = {} as Record<Difficulty, number>;
  for (const d of DIFFICULTY_LIST) {
    cleared[d] = isCleared(save, m.id, d);
    replay[d] = replayPercent(winsOn(save, m.id, d));
  }
  // NEW cards only for what this mission really unlocks for this player (owner, 2026-11-09), in any campaign.
  const news = newsFor(save, p.all, p.progressed, m);
  const unitCard = (kind: UnitKind): { kind: UnitKind; name: string; blurb: string } => ({
    kind,
    name: faction.unitNames[kind],
    blurb: faction.unitBlurbs[kind],
  });
  const loans = missionRoster(save, m, p.unlocked).loans.map((l) => ({ kind: l.kind, name: faction.unitNames[l.kind], count: l.count }));
  // The briefing's loadout: every call-in with charges held or lent for this mission (owner, 2026-11-09).
  const callIns = loadoutOptions(save, m.id).map((o) => ({ kind: o.kind, name: faction.supportNames[o.kind], owned: o.owned, loan: o.loan, chosen: o.chosen }));
  return {
    replayPercent: replay,
    loans,
    callIns,
    id: m.id,
    // The number the player sees: its place in its campaign (never the internal id; owner, 2026-11-09).
    number: p.ids.indexOf(m.id) + 1,
    title: m.title,
    location: m.location,
    date: m.date,
    dateIso: m.dateIso,
    theatre: m.theatre,
    mapPos: m.mapPos,
    briefing: m.briefing,
    objective: m.objective,
    intel: m.intel ? { enemy: [...m.intel.enemy], friendly: [...m.intel.friendly] } : undefined,
    orders: { ...FACTIONS[m.start[0].faction].orders },
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
    // In the words of the player's nation (owner, 2026-11-09): T-34 crews, not Churchill crews.
    ...upgradeTextFor(def, nation),
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
// `nation` is the player's nation in this campaign (its names in the Quartermaster and the Armoury); `campaigns` every
// campaign the player can play, for what is unlocked (default this one).
export function buildCampaignView(
  save: SaveData,
  missions: readonly MissionDef[],
  defs: readonly UpgradeDef[],
  unlockAll = false,
  nation: FactionId = 'british',
  campaigns: readonly (readonly MissionDef[])[] = [missions],
): CampaignView {
  const p = progressOf(save, missions, unlockAll, campaigns);
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
    loadoutSlots: MEDALS.loadoutSlots,
    armoury: buildArmoury(save, nation, p.unlocked, missions),
    training: { done: save.training.done, offer: trainingOffered(save), reward: MEDALS.trainingReward },
  };
}

/**
 * The campaign select screen's cards, in the order given: each campaign's name, dates, pitch, nation and flag, and how
 * far the save has got (missions cleared of all, the next mission to play), and whether it is the one on the map. A
 * campaign that opens after a mission is locked until that mission is cleared.
 */
export function buildCampaignCards(
  save: SaveData,
  campaigns: readonly { id: CampaignId; missions: readonly MissionDef[] }[],
  current: CampaignId,
): CampaignCardView[] {
  return campaigns.map((c) => {
    const def = CAMPAIGNS[c.id];
    const ids = c.missions.map((m) => m.id);
    const cleared = c.missions.filter((m) => isCleared(save, m.id)).length;
    const next = c.missions.find((m) => isUnlocked(save, ids, m.id) && !isCleared(save, m.id)) ?? null;
    const after = 'afterMission' in def.unlock ? def.unlock.afterMission : null;
    const locked = after !== null && !isCleared(save, after);
    return {
      id: c.id,
      title: def.title,
      subtitle: def.subtitle,
      years: def.years,
      comingSoon: false,
      pitch: def.card,
      nation: def.nation,
      nationName: FACTIONS[def.nation].name,
      flag: FACTIONS[def.nation].look.flag,
      cleared,
      total: c.missions.length,
      next: next ? { id: next.id, number: c.missions.indexOf(next) + 1, title: next.title } : null,
      locked,
      lockNote: locked && after !== null ? `Opens after ${missionLabel(after)}` : undefined,
      current: c.id === current,
    };
  });
}

/** A mission as the player knows it: "Stalingrad mission 3" (its campaign and its place there), never its internal id. */
export function missionLabel(missionId: number): string {
  for (const id of CAMPAIGN_IDS) {
    const index = CAMPAIGNS[id].missionIds.indexOf(missionId);
    if (index >= 0) return `${CAMPAIGNS[id].title} mission ${index + 1}`;
  }
  return 'an earlier mission';
}

/**
 * The select screen's greyed cards for the campaigns still to come (owner, 2026-11-09): name, nation and flag, years
 * and pitch, "Coming soon", no missions and never startable.
 */
export function buildUpcomingCards(upcoming: readonly UpcomingCampaign[] = UPCOMING_CAMPAIGNS): CampaignCardView[] {
  return upcoming.map((u) => ({
    id: u.id,
    title: u.title,
    subtitle: u.years,
    years: u.years,
    comingSoon: true,
    pitch: u.card,
    nation: u.nation,
    nationName: FACTIONS[u.nation].name,
    flag: FACTIONS[u.nation].look.flag,
    cleared: 0,
    total: 0,
    next: null,
    locked: true,
    lockNote: 'Coming soon',
    current: false,
  }));
}

/**
 * The Shop (the screen the Armoury was): the call-in charges for sale with the count held, the extras (the Battle for
 * Poland as a locked entry with its medal price: no purchase here), then every unit type (free, unlocked, or locked
 * with the mission that unlocks it; units are not sold since the owner's change of 2026-11-09). Names and blurbs are
 * those of the nation the player commands in the current campaign; other nations' names are never shown (owner,
 * 2026-11-08). The British names are the default (the proving ground); a campaign passes its own nation.
 */
export function buildArmoury(
  save: SaveData,
  nation: FactionId = 'british',
  unlocked: readonly UnitKind[] = [],
  missions: readonly MissionDef[] = [],
): ArmouryItemView[] {
  const own = FACTIONS[nation];
  const out: ArmouryItemView[] = [];
  for (const c of MEDALS.charges) {
    const kind: SupportKind = c.kind;
    out.push({
      id: kind,
      type: 'support',
      kind,
      name: own.supportNames[kind],
      blurb: APP.supportBlurbs[kind],
      price: c.price,
      isNew: false,
      free: false,
      owned: false,
      count: chargesOf(save, kind),
      canBuy: canBuyCharge(save, kind),
    });
  }
  out.push({
    id: 'poland',
    type: 'extra',
    kind: 'rifle',
    name: APP.polandName,
    blurb: APP.polandBlurb,
    price: MEDALS.polandPrice,
    isNew: false,
    free: false,
    owned: false,
    canBuy: false,
    lockedNote: APP.polandNote,
  });
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
  return out;
}

/** The victory screen's score breakdown. */
export function medalView(b: MedalBreakdown): MedalResultView {
  return {
    medals: b.medals,
    time: b.time ? { ...b.time } : null,
    casualties: { ...b.casualties },
    hq: b.hq ? { ...b.hq } : null,
    ...(b.structure ? { structure: { ...b.structure } } : {}),
    ...(b.bonus && b.bonus.total > 0 ? { bonus: b.bonus.total } : {}),
    base: b.base,
    difficultyMul: b.difficultyMul,
    replayPercent: Math.floor(b.replayFactor * 100 + 1e-9),
    ...(b.campaignBonus > 0 ? { campaignBonus: b.campaignBonus } : {}),
    ...(b.points > 0 ? { points: b.points } : {}),
  };
}

/** Why a battle ended, in words, for the result screen. `label` = the mission timer's label ("Nightfall"), if it has one. */
export function describeEnd(endReason: EndReason, won: boolean, label: string | null, text: string | null = null): string {
  const reason = endReason === 'none' ? APP.reasons.draw : APP.reasons[endReason];
  return (won ? reason.win : reason.lose).replace('{label}', label ?? 'Time').replace('{reason}', text ?? 'The battle is over');
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
    reason: describeEnd(s.endReason, won, s.director.timer?.label ?? (mission.timer ? mission.timer.label : null), s.director.endText),
    // The mission director's side objectives (FOUNDATIONS.md 3.4: the end screen, not the battle HUD).
    ...(s.director.side.length > 0
      ? { sideObjectives: s.director.side.map((so) => ({ text: so.text, done: so.status === 'done', bonus: so.bonus })) }
      : {}),
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
