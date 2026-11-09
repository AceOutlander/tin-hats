/**
 * The campaign select screen and the per-campaign maps (FOUNDATIONS.md section 6, docs/campaigns/STALINGRAD_BUILD.md):
 * the registry's campaigns with their maps and map tracks, the Stalingrad situation map (bounds, the ten mission
 * markers at their real places, the rivers, the front line by date), the select screen's cards, and the app with its
 * one campaign since the British placeholders were removed (what is offered, the map on show, its music, the save
 * keeping the progress, and the unit types the British missions unlocked still counting).
 */
import { describe, expect, it } from 'vitest';
import { App, MAP_MUSIC } from '../../src/app/app';
import { buildCampaignCards } from '../../src/app/campaignView';
import { WEST_MAP, CAMPAIGN_MAP_VIEW, frontOn, projection } from '../../src/data/campaignMap';
import { STALINGRAD_MAP } from '../../src/data/campaignMapStalingrad';
import { CAMPAIGN_IDS, CAMPAIGNS } from '../../src/data/campaigns';
import { MISSIONS } from '../../src/data/missions';
import { STALINGRAD_MISSIONS } from '../../src/data/missions/stalingrad';
import { STALINGRAD_MUSIC } from '../../src/data/musicCampaigns';
import { createMemoryStorage, defaultSave, recordClear } from '../../src/meta';
import { layoutPins } from '../../src/ui/screens/mapLayout';
import { createFakeAudio, createFakeUi, createFakeView } from './app-helpers';

function makeApp(opts: { showUnreleased?: boolean; storage?: ReturnType<typeof createMemoryStorage> } = {}) {
  const view = createFakeView();
  const audio = createFakeAudio();
  const ui = createFakeUi();
  const storage = opts.storage ?? createMemoryStorage();
  const app = new App({ view, audio, storage, random: () => 0.25, showUnreleased: opts.showUnreleased });
  app.attachUi(ui);
  return { app, view, audio, ui, storage };
}

/** Where each mission really was (STALINGRAD.md and the task): degrees, within 0.1 of the marker. */
const REAL_PLACES: Record<number, { name: string; lon: number; lat: number }> = {
  1001: { name: 'Brest Fortress', lon: 23.66, lat: 52.08 },
  1002: { name: 'Dubno', lon: 25.73, lat: 50.42 },
  1003: { name: 'Dubosekovo, Volokolamsk', lon: 36.05, lat: 55.98 },
  1004: { name: 'Klin', lon: 36.73, lat: 56.33 },
  1005: { name: 'the central landing on the Volga', lon: 44.53, lat: 48.71 },
  1006: { name: 'Mamayev Kurgan', lon: 44.54, lat: 48.74 },
  1007: { name: 'Pavlov\'s House', lon: 44.53, lat: 48.72 },
  1008: { name: 'the Tractor Factory', lon: 44.58, lat: 48.79 },
  1009: { name: 'the Serafimovich bridgehead (Uranus)', lon: 42.74, lat: 49.58 },
  1010: { name: 'Pitomnik, inside the ring', lon: 44.04, lat: 48.73 },
};

/** The nearest distance (degrees) from a point to a polyline of lon/lat pairs. */
function distanceTo(pts: readonly number[], lon: number, lat: number): number {
  let best = Infinity;
  for (let i = 2; i < pts.length; i += 2) {
    const ax = pts[i - 2];
    const ay = pts[i - 1];
    const bx = pts[i];
    const by = pts[i + 1];
    const dx = bx - ax;
    const dy = by - ay;
    const t = Math.max(0, Math.min(1, ((lon - ax) * dx + (lat - ay) * dy) / (dx * dx + dy * dy || 1)));
    best = Math.min(best, Math.hypot(ax + dx * t - lon, ay + dy * t - lat));
  }
  return best;
}

function inside(ring: readonly number[], lon: number, lat: number): boolean {
  let hit = false;
  for (let i = 0, j = ring.length - 2; i < ring.length; j = i, i += 2) {
    const [xi, yi, xj, yj] = [ring[i], ring[i + 1], ring[j], ring[j + 1]];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

describe('the campaign registry', () => {
  it('gives every campaign its own map and map track: Stalingrad, the only one since the British placeholders went', () => {
    for (const id of CAMPAIGN_IDS) {
      expect(CAMPAIGNS[id].map.bounds.lonMin).toBeLessThan(CAMPAIGNS[id].map.bounds.lonMax);
      expect(CAMPAIGNS[id].mapMusic).toBeTruthy();
    }
    expect(CAMPAIGN_IDS).toEqual(['stalingrad']);
    expect(CAMPAIGNS.stalingrad.map).toBe(STALINGRAD_MAP);
    expect(CAMPAIGNS.stalingrad.mapMusic).toBe(STALINGRAD_MUSIC.map);
    expect(CAMPAIGNS.stalingrad.mapMusic).toBe(MAP_MUSIC);
    // Released with the removal of the British missions: the live site has a campaign to play.
    expect(CAMPAIGNS.stalingrad.released).toBe(true);
    // The western map is kept for the western campaigns to come, but no campaign uses it.
    for (const id of CAMPAIGN_IDS) expect(CAMPAIGNS[id].map).not.toBe(WEST_MAP);
  });

  it('lists the Stalingrad missions as the game\'s campaign missions, and no mission 1 to 10', () => {
    expect(MISSIONS.map((m) => m.id)).toEqual(STALINGRAD_MISSIONS.map((m) => m.id));
    expect(MISSIONS.map((m) => m.id)).toEqual(CAMPAIGNS.stalingrad.missionIds);
    for (const m of MISSIONS) expect(m.id, m.key).toBeGreaterThan(1000);
  });
});

describe('the Stalingrad situation map', () => {
  const proj = projection(STALINGRAD_MAP.bounds);

  it('covers lon 22 to 47 and lat 46 to 57.5 (STALINGRAD_BUILD.md)', () => {
    expect(STALINGRAD_MAP.bounds).toEqual({ lonMin: 22, lonMax: 47, latMin: 46, latMax: 57.5 });
    expect(proj.x(22)).toBeCloseTo(0);
    expect(proj.x(47)).toBeCloseTo(1);
    expect(proj.y(57.5)).toBeCloseTo(0);
    expect(proj.y(46)).toBeCloseTo(1);
  });

  it.each(STALINGRAD_MISSIONS.map((m) => [m.id, m] as const))('puts mission %i at its real place', (id, m) => {
    const real = REAL_PLACES[id];
    expect(Math.hypot(m.mapPos.lon - real.lon, m.mapPos.lat - real.lat), real.name).toBeLessThan(0.1);
  });

  it('draws the Volga through Stalingrad, the Don past Kalach and Voronezh, the Dnieper past Kiev, the Bug past Brest', () => {
    const river = (name: string): readonly number[] => {
      const r = (STALINGRAD_MAP.rivers ?? []).find((x) => x.name === name);
      if (!r) throw new Error(`no river ${name}`);
      return r.pts;
    };
    expect(distanceTo(river('volgaLower'), 44.52, 48.71)).toBeLessThan(0.05);
    expect(distanceTo(river('don'), 43.53, 48.69)).toBeLessThan(0.15);
    expect(distanceTo(river('don'), 39.2, 51.67)).toBeLessThan(0.2);
    expect(distanceTo(river('dnieper'), 30.52, 50.45)).toBeLessThan(0.05);
    expect(distanceTo(river('bug'), 23.66, 52.08)).toBeLessThan(0.05);
    for (const name of ['volgaLower', 'don', 'dnieper']) expect((STALINGRAD_MAP.rivers ?? []).find((r) => r.name === name)?.major).toBe(true);
  });

  it('names the towns of the brief', () => {
    const towns = STALINGRAD_MAP.labels.filter((l) => l.kind === 'city').map((l) => l.text);
    for (const t of ['Brest', 'Minsk', 'Kiev', 'Moscow', 'Kalinin', 'Klin', 'Voronezh', 'Rostov', 'Stalingrad', 'Kalach']) expect(towns).toContain(t);
  });

  it('has its front lines in date order, each running from above the map to below it', () => {
    const fronts = STALINGRAD_MAP.fronts ?? [];
    expect(fronts.length).toBeGreaterThanOrEqual(5);
    for (let i = 1; i < fronts.length; i++) expect(fronts[i].date > fronts[i - 1].date).toBe(true);
    for (const f of fronts) {
      expect(f.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      for (const line of f.lines) {
        expect(line.length % 2).toBe(0);
        expect(line[1], `${f.date} starts north of the map`).toBeGreaterThan(STALINGRAD_MAP.bounds.latMax);
        expect(line[line.length - 1], `${f.date} ends south of the map`).toBeLessThan(STALINGRAD_MAP.bounds.latMin);
      }
    }
  });

  it('moves the front with each mission\'s date: the frontier at Brest, Moscow in December, the Volga in 1942, the ring in 1943', () => {
    const on = (id: number): string | null => frontOn(STALINGRAD_MAP, STALINGRAD_MISSIONS.find((m) => m.id === id)?.dateIso)?.date ?? null;
    expect(on(1001)).toBe('1941-06-22');
    expect(on(1002)).toBe('1941-06-27');
    expect(on(1003)).toBe('1941-11-16');
    expect(on(1004)).toBe('1941-12-05');
    for (const id of [1005, 1006, 1007, 1008, 1009]) expect(on(id), `mission ${id}`).toBe('1942-09-13');
    expect(on(1010)).toBe('1943-01-10');
    const front = (date: string) => (STALINGRAD_MAP.fronts ?? []).find((f) => f.date === date);
    // The frontier ran past the fortress; in September 1942 the front reached the Volga in the city.
    expect(distanceTo(front('1941-06-22')?.lines[0] ?? [], 23.66, 52.08)).toBeLessThan(0.1);
    expect(distanceTo(front('1942-09-13')?.lines[0] ?? [], 44.52, 48.71)).toBeLessThan(0.05);
    // On 5 December 1941 the Germans held Klin, west of the line.
    expect(distanceTo(front('1941-12-05')?.lines[0] ?? [], 36.73, 56.33)).toBeLessThan(0.5);
    // In January 1943 the Sixth Army is a pocket round Gumrak and the city.
    const pocket = front('1943-01-10')?.pockets?.[0] ?? [];
    expect(inside(pocket, 44.35, 48.78), 'Gumrak').toBe(true);
    expect(inside(pocket, 43.53, 48.69), 'Kalach, outside').toBe(false);
    expect(frontOn(STALINGRAD_MAP, undefined)).toBeNull();
    expect(frontOn(WEST_MAP, '1941-06-22')).toBeNull();
  });

  it('keeps every marker on the map and a full touch apart at phone size, the city cluster included', () => {
    for (const [w, h] of [
      [600, 390],
      [520, 360],
      [1000, 700],
    ]) {
      const lay = layoutPins(
        STALINGRAD_MISSIONS.map((m) => m.mapPos.lon),
        STALINGRAD_MISSIONS.map((m) => m.mapPos.lat),
        w,
        h,
        proj,
      );
      for (let i = 0; i < lay.xs.length; i++) {
        expect(lay.xs[i]).toBeGreaterThanOrEqual(CAMPAIGN_MAP_VIEW.pinMarginPx - 0.5);
        expect(lay.xs[i]).toBeLessThanOrEqual(lay.size.w - CAMPAIGN_MAP_VIEW.pinMarginPx + 0.5);
        expect(lay.ys[i]).toBeGreaterThanOrEqual(CAMPAIGN_MAP_VIEW.pinMarginPx - 0.5);
        expect(lay.ys[i]).toBeLessThanOrEqual(lay.size.h - CAMPAIGN_MAP_VIEW.pinMarginPx + 0.5);
        for (let j = i + 1; j < lay.xs.length; j++) {
          expect(Math.hypot(lay.xs[i] - lay.xs[j], lay.ys[i] - lay.ys[j]), `${w}x${h}: ${i} and ${j}`).toBeGreaterThan(CAMPAIGN_MAP_VIEW.pinSeparationPx - 1);
        }
      }
      expect(lay.size.w / lay.size.h).toBeCloseTo(proj.aspect, 1);
    }
  });
});

describe('the campaign select cards', () => {
  it('show the campaign\'s name, dates, pitch, flag and progress (one card: Stalingrad)', () => {
    const save = defaultSave();
    recordClear(save, 1001, 'normal');
    recordClear(save, 1002, 'hard');
    const cards = buildCampaignCards(save, [{ id: 'stalingrad', missions: STALINGRAD_MISSIONS }], 'stalingrad');
    expect(cards.map((c) => c.id)).toEqual(['stalingrad']);
    const [s] = cards;
    expect(s).toMatchObject({ title: 'Stalingrad', subtitle: 'June 1941 to February 1943', nation: 'soviet', flag: 'sovietRed', cleared: 2, total: 10, current: true, locked: false });
    expect(s.pitch).toBe(CAMPAIGNS.stalingrad.card);
    expect(s.next).toEqual({ id: 1003, number: 3, title: 'The Volokolamsk Highway' });
  });

  it('says when every mission is cleared', () => {
    const save = defaultSave();
    for (const m of STALINGRAD_MISSIONS) recordClear(save, m.id, 'normal');
    const [s] = buildCampaignCards(save, [{ id: 'stalingrad', missions: STALINGRAD_MISSIONS }], 'stalingrad');
    expect(s.cleared).toBe(10);
    expect(s.next).toBeNull();
  });

  it('count no archived British progress', () => {
    const save = defaultSave();
    save.legacy = { cleared: { '1': ['normal'], '2': ['normal'] }, wins: { '1': { normal: 1 } } };
    const [s] = buildCampaignCards(save, [{ id: 'stalingrad', missions: STALINGRAD_MISSIONS }], 'stalingrad');
    expect(s.cleared).toBe(0);
    expect(s.next?.id).toBe(1001);
  });
});

describe('the app with its one campaign', () => {
  it('offers Stalingrad on the live site, as the only campaign (the title goes straight to its map)', () => {
    const { app } = makeApp();
    expect(app.offered.map((c) => c.id)).toEqual(['stalingrad']);
    const view = app.campaign();
    expect(view.campaigns?.map((c) => c.id)).toEqual(['stalingrad']);
    expect(view.campaignId).toBe('stalingrad');
    expect(view.campaignTitle).toBe('Stalingrad');
    expect(view.map).toBe(STALINGRAD_MAP);
    expect(view.missions.map((m) => m.id)).toEqual(STALINGRAD_MISSIONS.map((m) => m.id));
    expect(view.missions.map((m) => m.unlocked)).toEqual([true, false, false, false, false, false, false, false, false, false]);
    // The briefing's intelligence and the date the map's front line follows.
    expect(view.missions[0].intel?.enemy.length).toBeGreaterThan(0);
    expect(view.missions[0].dateIso).toBe('1941-06-22');
  });

  it('offers the same one campaign where unreleased campaigns show and after the admin panel\'s unlock', () => {
    expect(makeApp({ showUnreleased: true }).app.offered.map((c) => c.id)).toEqual(['stalingrad']);
    const { app } = makeApp();
    app.adminUnlockMissions();
    expect(app.offered.map((c) => c.id)).toEqual(['stalingrad']);
    expect(app.campaign().missions.every((m) => m.unlocked)).toBe(true);
  });

  it('ignores a campaign that does not exist', () => {
    const { app } = makeApp();
    app.selectCampaign('british' as never);
    expect(app.current.id).toBe('stalingrad');
  });

  it('plays the campaign\'s own map track, and the menu theme on the select screen', () => {
    const { app, audio } = makeApp();
    app.onScreen('title');
    app.onScreen('campaigns');
    expect(audio.music).toBe('menu');
    app.onScreen('campaign');
    expect(audio.music).toBe(STALINGRAD_MUSIC.map);
    expect(audio.prepared).toContain(STALINGRAD_MUSIC.map);
    app.onScreen('briefing');
    expect(audio.music).toBe(STALINGRAD_MUSIC.map);
    app.onScreen('campaigns');
    expect(audio.music).toBe('menu');
    app.onScreen('campaign');
    expect(audio.music).toBe(MAP_MUSIC);
  });

  it('lets go of the Stalingrad map track when a Stalingrad battle starts, and comes back to that campaign', () => {
    const { app, audio } = makeApp();
    app.onScreen('campaign');
    // Started from anywhere (the debug hooks), a mission puts its own campaign on the map.
    expect(app.beginMission(1001, 'normal', 1)).toBe(true);
    expect(app.current.id).toBe('stalingrad');
    expect(audio.releasedMusic).toContain(STALINGRAD_MUSIC.map);
    expect(app.session?.battle.state.sides[0].faction).toBe('soviet');
    // The British missions are gone: their ids start nothing.
    expect(app.beginMission(1, 'normal', 1)).toBe(false);
  });

  it('keeps the campaign\'s progress through a reload, and opens on the mission last played', () => {
    const storage = createMemoryStorage();
    {
      const { app } = makeApp({ storage });
      const save = app.save;
      recordClear(save, 1001, 'normal');
      recordClear(save, 1002, 'normal');
      save.lastMission = 1002;
      app.giveMedals(0);
    }
    const { app } = makeApp({ storage });
    expect(Object.keys(app.save.cleared).sort()).toEqual(['1001', '1002']);
    expect(app.current.id).toBe('stalingrad');
    expect(app.campaign().lastMission).toBe(1002);
    const cards = app.campaign().campaigns ?? [];
    expect(cards.map((c) => c.cleared)).toEqual([2]);
  });

  it('counts the unit types the British missions unlocked: no NEW DP gunner at Brest for a player who had the Bren', () => {
    const fresh = makeApp();
    expect(fresh.app.campaign().missions[0].newUnit?.kind).toBe('lmg');
    const veteran = makeApp();
    // What the step to save version 10 leaves for a player who reached the British mission 2.
    veteran.app.save.armoury = ['lmg'];
    expect(veteran.app.campaign().missions[0].newUnit?.kind).toBe('at');
    // And the Quartermaster and the Armoury speak the campaign's nation.
    expect(veteran.app.campaign().armoury?.find((a) => a.id === 'lmg')?.name).toBe('DP Gunner');
  });

  it('plays Basic Training as the nation of the campaign on the map: the Red Army', () => {
    const { app } = makeApp();
    app.startTraining();
    expect(app.session?.battle.state.sides[0].faction).toBe('soviet');
  });
});
