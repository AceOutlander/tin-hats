/**
 * The campaign data: the game's missions (src/data/missions: the Stalingrad campaign since the British placeholders
 * were removed), in order, each self-consistent. The checks that ran on every British mission run on every campaign
 * mission; what each Stalingrad mission's design asks for is tests/unit/stalingrad-m1001-1005.test.ts and
 * tests/unit/stalingrad-unlocks.test.ts.
 */
import { describe, expect, it } from 'vitest';
import { CAMPAIGNS, campaignOf } from '../../src/data/campaigns';
import { MISSIONS, getMission } from '../../src/data/missions';
import { SUPPORTS } from '../../src/data/supports';
import { UNITS } from '../../src/data/units';

describe('the campaign', () => {
  it('lists every campaign mission in its campaign\'s order, with unique ids and keys, and none of the removed 1 to 10', () => {
    expect(MISSIONS.map((m) => m.id)).toEqual(CAMPAIGNS.stalingrad.missionIds);
    expect(new Set(MISSIONS.map((m) => m.id)).size).toBe(MISSIONS.length);
    expect(new Set(MISSIONS.map((m) => m.key)).size).toBe(MISSIONS.length);
    for (let id = 1; id <= 10; id++) expect(getMission(id), `mission ${id}`).toBeUndefined();
    for (const m of MISSIONS) {
      expect(getMission(m.id)).toBe(m);
      // FOUNDATIONS.md section 9: up to 32,000 wu; tutorials 6,000 to 9,000, so none shorter.
      expect(m.length, m.key).toBeGreaterThanOrEqual(6000);
      expect(m.length, m.key).toBeLessThanOrEqual(32000);
    }
  });

  it('gives survival missions a clock that wins and enemy waves, and assault missions an enemy HQ', () => {
    for (const m of MISSIONS) {
      if (m.mode === 'survival') {
        expect(m.timer?.onExpire, m.key).toBe('win');
        expect(m.events.some((e) => e.type === 'wave' && e.side === 1), m.key).toBe(true);
      } else {
        expect(m.start[1].hasHq, m.key).toBe(true);
      }
    }
  });

  it('accumulates player units from mission to mission and never lets anyone train a King Tiger', () => {
    for (let i = 1; i < MISSIONS.length; i++) {
      for (const kind of MISSIONS[i - 1].units[0]) expect(MISSIONS[i].units[0], `mission ${MISSIONS[i].id} keeps ${kind}`).toContain(kind);
    }
    for (const m of MISSIONS) {
      for (const side of [0, 1] as const) expect(m.units[side], m.key).not.toContain('heavyTank');
    }
  });

  it('is self-consistent: every trench, unit and support referenced exists, and every field is filled', () => {
    for (const m of MISSIONS) {
      const campaign = campaignOf(m.id);
      expect(campaign, m.key).not.toBeNull();
      const bounds = CAMPAIGNS[campaign ?? 'stalingrad'].map.bounds;
      const trenchIds = new Set(m.trenches.map((t) => t.id));
      expect(trenchIds.size, m.key).toBe(m.trenches.length);
      // The first missions of a campaign brief at more length.
      expect(m.briefing.length, m.key).toBeGreaterThanOrEqual(MISSIONS.indexOf(m) < 3 ? 3 : 1);
      for (const p of m.briefing) expect(p.length, m.key).toBeGreaterThan(20);
      expect(m.objective.length, m.key).toBeGreaterThan(10);
      expect(m.title.length * m.location.length * m.date.length, m.key).toBeGreaterThan(0);
      // On the campaign's own map.
      expect(m.mapPos.lon, m.key).toBeGreaterThan(bounds.lonMin);
      expect(m.mapPos.lon, m.key).toBeLessThan(bounds.lonMax);
      expect(m.mapPos.lat, m.key).toBeGreaterThan(bounds.latMin);
      expect(m.mapPos.lat, m.key).toBeLessThan(bounds.latMax);
      expect(m.expectedMinutes[0], m.key).toBeLessThanOrEqual(m.expectedMinutes[1]);
      for (const side of [0, 1] as const) {
        for (const kind of m.units[side]) expect(UNITS[kind], m.key).toBeDefined();
        for (const kind of m.supports[side]) expect(SUPPORTS[kind], m.key).toBeDefined();
        for (const f of m.start[side].forces) {
          if (f.trenchId !== undefined) expect(trenchIds.has(f.trenchId), `${m.key} force trench ${f.trenchId}`).toBe(true);
          if (f.x !== undefined) expect(f.x > 0 && f.x < m.length, m.key).toBe(true);
        }
      }
      for (const t of m.trenches) expect(t.x > 0 && t.x < m.length, m.key).toBe(true);
      for (const p of m.pillboxes) expect(p.x > 0 && p.x < m.length, m.key).toBe(true);
      for (const w of m.wire) expect(w.x > 0 && w.x < m.length, m.key).toBe(true);
      for (const e of m.events) {
        if ('trenchId' in e.when) expect(trenchIds.has(e.when.trenchId), `${m.key} event trench`).toBe(true);
        if (e.type === 'hint' || e.type === 'announce') expect(e.text.length, m.key).toBeGreaterThan(5);
      }
      for (const plan of [m.ai, m.bot]) {
        for (const step of plan.build) expect(m.units[plan === m.ai ? 1 : 0], `${m.key} plan ${step.kind}`).toContain(step.kind);
      }
    }
  });
});
