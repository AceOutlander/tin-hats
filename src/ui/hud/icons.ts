/**
 * HUD glyphs as inline SVG, drawn on a 24 x 24 grid and coloured with currentColor.
 * Original shapes; markup is static and inserted once when the HUD is built.
 */

const STROKE = 'fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"';

function svg(body: string): string {
  return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${body}</svg>`;
}

export const ICONS = {
  /** Supply crate. */
  crate: svg(
    `<path ${STROKE} stroke-width="2" d="M3 6.5h18v12H3z"/>` +
      `<path ${STROKE} stroke-width="1.6" d="M3 10.5h18M9 10.5v8M15 10.5v8"/>`,
  ),
  /** Brodie helmet, side on: population. */
  helmet: svg(
    '<path d="M1.5 15.6c1.7-1 3.6-1.5 5-1.7C6.8 9.600 8.6 6.5 12 6.5s5.2 3.1 5.5 7.4c1.4 0.2 3.3 0.7 5 1.7' +
      '-1.2 1.7-5.3 2.4-10.5 2.4S2.7 17.3 1.5 15.6z"/>',
  ),
  soundOn: svg(
    '<path d="M3 9.5h3.5l5-4.5v14l-5-4.5H3z"/>' +
      `<path ${STROKE} stroke-width="2" d="M15 9a4.5 4.5 0 010 6M17.8 6.2a8.5 8.5 0 010 11.6"/>`,
  ),
  soundOff: svg(
    '<path d="M3 9.5h3.5l5-4.5v14l-5-4.5H3z"/>' + `<path ${STROKE} stroke-width="2.2" d="M15.5 9.5l5 5M20.5 9.5l-5 5"/>`,
  ),
  pause: svg('<path d="M6 4.5h4.2v15H6zM13.8 4.5H18v15h-4.2z"/>'),
  play: svg('<path d="M7 4.5v15l12-7.5z"/>'),
  restart: svg(`<path ${STROKE} stroke-width="2.4" d="M18.5 13a6.5 6.5 0 11-2.2-5.9"/><path d="M19.5 2.8v6.4h-6.4z"/>`),
  quit: svg(`<path ${STROKE} stroke-width="2.2" d="M10 4.5H4.5v15H10M9.5 12H20M16 8l4 4-4 4"/>`),
  close: svg(`<path ${STROKE} stroke-width="3" d="M6 6l12 12M18 6L6 18"/>`),
  /** Orders: chevrons toward home, a shield, chevrons toward the enemy. */
  fallBack: svg(`<path ${STROKE} stroke-width="3.4" d="M11.5 5l-7 7 7 7M20 5l-7 7 7 7"/>`),
  hold: svg(
    '<path d="M12 2.3l8.2 3v6.4c0 4.8-3.4 8.3-8.2 10-4.800-1.7-8.2-5.2-8.2-10V5.3z"/>' +
      '<path fill="rgba(20,21,15,0.55)" d="M7 10.2h10v2.6H7z"/>',
  ),
  advance: svg(`<path ${STROKE} stroke-width="3.4" d="M4 5l7 7-7 7M12.5 5l7 7-7 7"/>`),
  /** Order scope: three helmets for the whole army, and a company pennant for "follow the army order". */
  army: svg(
    '<path d="M7.4 12.4c0-3.400 2-5.800 4.6-5.800s4.6 2.400 4.6 5.800z"/>' +
      '<path d="M1.4 18.8c0-3.400 2-5.800 4.6-5.800s4.6 2.400 4.6 5.800zM13.4 18.8c0-3.400 2-5.800 4.6-5.800s4.6 2.400 4.6 5.800z"/>' +
      '<path d="M0.6 18.6h10.8v1.8H0.6zM12.6 18.6h10.8v1.8H12.6zM6.6 12.2h10.8v1.6H6.6z"/>',
  ),
  follow: svg('<path d="M5 2.5h2.2v19H5z"/><path d="M7.2 3.5L20.5 8 7.2 12.5z"/>'),
  /** Supports: shell burst, smoke cloud, aircraft. */
  artillery: svg(
    '<path d="M12 1.5l2.1 6.3 5.7-3.6-3.3 5.9 6 1.4-6 2.1 3.3 5.9-5.7-3.3L12 22.5l-2.1-6.300-5.7 3.3 3.3-5.9-6-2.1 6-1.4-3.3-5.9 5.7 3.6z"/>',
  ),
  smoke: svg(
    '<path d="M6.8 19a4.3 4.3 0 01-0.9-8.500 5.8 5.8 0 0111.2-1.7A4.9 4.9 0 0117.6 19z"/>' +
      `<path ${STROKE} stroke-width="1.6" d="M5 22h9M16.5 22h3"/>`,
  ),
  airStrike: svg(
    '<path d="M12 1.5c1 0 1.6 1.2 1.7 2.8l0.3 4.5 8.5 4.7v2.3L14 13.5l-0.5 5 2.8 2v1.7L12 21l-4.3 1.2v-1.7l2.8-2-0.5-5' +
      '-8.5 2.3v-2.3L10 8.8l0.3-4.5c0.1-1.6 0.7-2.8 1.7-2.8z"/>',
  ),
  /** Direct control. */
  fire: svg(
    `<circle ${STROKE} stroke-width="2.2" cx="12" cy="12" r="6.5"/>` +
      `<path ${STROKE} stroke-width="2.2" d="M12 1.8v5M12 17.2v5M1.8 12h5M17.2 12h5"/>` +
      '<circle cx="12" cy="12" r="1.8"/>',
  ),
  ability: svg('<path d="M12 2l2.9 6.3 6.9 0.8-5.1 4.7 1.4 6.8L12 17.2l-6.1 3.4 1.4-6.8-5.1-4.7 6.9-0.8z"/>'),
  /** Scroll hint chevrons for the training bar. */
  chevLeft: svg(`<path ${STROKE} stroke-width="3.4" d="M15 5l-7 7 7 7"/>`),
  chevRight: svg(`<path ${STROKE} stroke-width="3.4" d="M9 5l7 7-7 7"/>`),
} as const;

export type IconName = keyof typeof ICONS;
