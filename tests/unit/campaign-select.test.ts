/**
 * The campaign select screen and the per-campaign maps (FOUNDATIONS.md section 6, docs/campaigns/STALINGRAD_BUILD.md):
 * the registry's campaigns with their maps and map tracks, the Stalingrad situation map (bounds, the ten mission
 * markers at their real places, the rivers, the front line by date), the select screen's cards, and the app playing
 * several campaigns (which are offered, the map on show, its music, the save keeping each campaign's progress, and
 * unit unlocks counting every offered campaign).
 */
import { describe, expect, it } from 'vitest';
import { App, MAP_MUSIC } from '../../src/app/app';
import { buildCampaignCards } from '../../src/app/campaignView';
import { BRITISH_MAP, CAMPAIGN_MAP_VIEW, frontOn, projection } from '../../src/data/campaignMap';
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
  it('gives every campaign its own map and map track: Stalingrad plays its own, the British "Between the Lines"', () => {
    for (const id of CAMPAIGN_IDS) {
      expect(CAMPAIGNS[id].map.bounds.lonMin).toBeLessThan(CAMPAIGNS[id].map.bounds.lonMax);
      expect(CAMPAIGNS[id].mapMusic).toBeTruthy();
    }
    expect(CAMPAIGNS.stalingrad.map).toBe(STALINGRAD_MAP);
    expect(CAMPAIGNS.stalingrad.mapMusic).toBe(STALINGRAD_MUSIC.map);
    expect(CAMPAIGNS.british.map).toBe(BRITISH_MAP);
    expect(CAMPAIGNS.british.mapMusic).toBe(MAP_MUSIC);
    expect(CAMPAIGN_IDS[0]).toBe('stalingrad');
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
    expect(frontOn(BRITISH_MAP, '1941-06-22')).toBeNull();
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
  it('show each campaign\'s name, dates, pitch, flag and progress, Stalingrad first', () => {
    const save = defaultSave();
    recordClear(save, 1001, 'normal');
    recordClear(save, 1002, 'hard');
    const cards = buildCampaignCards(
      save,
      [
        { id: 'stalingrad', missions: STALINGRAD_MISSIONS },
        { id: 'british', missions: MISSIONS },
      ],
      'stalingrad',
    );
    expect(cards.map((c) => c.id)).toEqual(['stalingrad', 'british']);
    const [s, b] = cards;
    expect(s).toMatchObject({ title: 'Stalingrad', subtitle: 'June 1941 to February 1943', nation: 'soviet', flag: 'sovietRed', cleared: 2, total: 10, current: true, locked: false });
    expect(s.pitch).toBe(CAMPAIGNS.stalingrad.card);
    expect(s.next).toEqual({ id: 1003, number: 3, title: 'The Volokolamsk Highway' });
    expect(b).toMatchObject({ nation: 'british', flag: 'unionJack', cleared: 0, total: 10, current: false });
    expect(b.next?.id).toBe(1);
  });

  it('says when every mission is cleared', () => {
    const save = defaultSave();
    for (const m of STALINGRAD_MISSIONS) recordClear(save, m.id, 'normal');
    const [s] = buildCampaignCards(save, [{ id: 'stalingrad', missions: STALINGRAD_MISSIONS }], 'stalingrad');
    expect(s.cleared).toBe(10);
    expect(s.next).toBeNull();
  });
});

describe('the app with several campaigns', () => {
  it('offers only the released campaigns on the live site (one: the title goes straight to its map)', () => {
    const { app } = makeApp();
    expect(app.offered.map((c) => c.id)).toEqual(['british']);
    const view = app.campaign();
    expect(view.campaigns?.map((c) => c.id)).toEqual(['british']);
    expect(view.campaignId).toBe('british');
    expect(view.map).toBe(BRITISH_MAP);
    expect(view.missions[0].id).toBe(1);
  });

  it('offers Stalingrad first where unreleased campaigns show, opens on it, and switches on a card', () => {
    const { app } = makeApp({ showUnreleased: true });
    expect(app.offered.map((c) => c.id)).toEqual(['stalingrad', 'british']);
    let view = app.campaign();
    expect(view.campaignId).toBe('stalingrad');
    expect(view.campaignTitle).toBe('Stalingrad');
    expect(view.map).toBe(STALINGRAD_MAP);
    expect(view.missions.map((m) => m.id)).toEqual(STALINGRAD_MISSIONS.map((m) => m.id));
    expect(view.missions.map((m) => m.unlocked)).toEqual([true, false, false, false, false, false, false, false, false, false]);
    // The briefing's intelligence and the date the map's front line follows.
    expect(view.missions[0].intel?.enemy.length).toBeGreaterThan(0);
    expect(view.missions[0].dateIso).toBe('1941-06-22');
    app.selectCampaign('british');
    view = app.campaign();
    expect(view.campaignId).toBe('british');
    expect(view.campaigns?.find((c) => c.current)?.id).toBe('british');
    expect(view.missions[0].id).toBe(1);
  });

  it('shows the unreleased campaigns after the admin panel\'s unlock', () => {
    const { app } = makeApp();
    app.adminUnlockMissions();
    expect(app.offered.map((c) => c.id)).toEqual(['stalingrad', 'british']);
  });

  it('plays each campaign\'s own map track, and the menu theme on the select screen', () => {
    const { app, audio } = makeApp({ showUnreleased: true });
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
    app.selectCampaign('british');
    app.onScreen('campaign');
    expect(audio.music).toBe(MAP_MUSIC);
  });

  it('lets go of the Stalingrad map track when a Stalingrad battle starts, and comes back to that campaign', () => {
    const { app, audio } = makeApp({ showUnreleased: true });
    app.selectCampaign('british');
    app.onScreen('campaign');
    // Started from anywhere (the debug hooks), a mission puts its own campaign on the map.
    expect(app.beginMission(1001, 'normal', 1)).toBe(true);
    expect(app.current.id).toBe('stalingrad');
    expect(audio.releasedMusic).toContain(STALINGRAD_MUSIC.map);
    expect(app.session?.battle.state.sides[0].faction).toBe('soviet');
  });

  it('keeps each campaign\'s progress through a reload, and opens on the campaign last played', () => {
    const storage = createMemoryStorage();
    {
      const { app } = makeApp({ showUnreleased: true, storage });
      const save = app.save;
      recordClear(save, 1001, 'normal');
      recordClear(save, 1002, 'normal');
      recordClear(save, 1, 'hard');
      save.lastMission = 1;
      app.giveMedals(0);
    }
    const { app } = makeApp({ showUnreleased: true, storage });
    expect(Object.keys(app.save.cleared).sort()).toEqual(['1', '1001', '1002']);
    expect(app.current.id).toBe('british');
    const cards = app.campaign().campaigns ?? [];
    expect(cards.map((c) => c.cleared)).toEqual([2, 1]);
  });

  it('counts unit unlocks across the offered campaigns: Brest\'s DP gunner is no NEW card in the British mission 2', () => {
    const live = makeApp();
    recordClear(live.app.save, 1, 'normal');
    expect(live.app.campaign().missions.find((m) => m.id === 2)?.newUnit?.kind).toBe('lmg');
    const dev = makeApp({ showUnreleased: true });
    dev.app.selectCampaign('british');
    recordClear(dev.app.save, 1, 'normal');
    expect(dev.app.campaign().missions.find((m) => m.id === 2)?.newUnit).toBeNull();
    // And the Quartermaster and the Armoury speak the campaign's nation.
    dev.app.selectCampaign('stalingrad');
    expect(dev.app.campaign().armoury?.find((a) => a.id === 'lmg')?.name).toBe('DP Gunner');
  });

  it('plays Basic Training as the nation of the campaign on the map', () => {
    const { app } = makeApp({ showUnreleased: true });
    app.startTraining();
    expect(app.session?.battle.state.sides[0].faction).toBe('soviet');
    app.endSession();
    app.selectCampaign('british');
    app.startTraining();
    expect(app.session?.battle.state.sides[0].faction).toBe('british');
  });
});
