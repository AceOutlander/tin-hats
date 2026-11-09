/**
 * Every vehicle's track is a belt wrapped round a convex loop of pulleys (src/art/vehicles/belt.ts). A pulley that sits
 * inside the loop (a return roller lower than the line from its neighbours, say) makes the belt wrap it the wrong way
 * round, nearly a full turn, and the tread lugs fan out round it like a cog. Each corner must turn less than half a
 * turn and the corners together exactly one turn.
 */
import { describe, expect, it } from 'vitest';
import { makeBelt } from '../../src/art/vehicles/belt';
import { TANK_LAYOUT, VEHICLE_LOOKS } from '../../src/data/artLayout';

describe('track belts', () => {
  it.each(VEHICLE_LOOKS)('%s wraps a convex loop of pulleys', (look) => {
    const L = TANK_LAYOUT[look];
    const belt = makeBelt(L.belt, L.trackThickness / 2);
    let total = 0;
    for (const arc of belt.arcs) {
      const sweep = arc.a1 - arc.a0;
      expect(sweep).toBeGreaterThanOrEqual(0);
      expect(sweep).toBeLessThan(Math.PI);
      total += sweep;
    }
    expect(total).toBeCloseTo(Math.PI * 2, 6);
  });
});
