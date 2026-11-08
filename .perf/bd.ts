import { getBackdrop } from '../src/art/backdrops';
import { VIEW, VIEW_TOP_WU } from '../src/data/view';
const top = VIEW_TOP_WU, bot = VIEW.viewBottomWu;
for (const th of ['france','normandy','desert'] as const) {
  const defs = getBackdrop(th as any, 'day' as any, 1);
  let sum = 0;
  const rows = defs.map(d => { const y0 = Math.max(top, d.y), y1 = Math.min(bot, d.y + d.h); const cov = Math.max(0, y1 - y0) / VIEW.viewHeightWu; sum += cov; return `${d.slot}:${d.w}x${d.h}@y${d.y} tile=${d.tile} scale=${d.scale} cover=${cov.toFixed(2)}`; });
  console.log(th, 'screen-heights of backdrop overdraw =', sum.toFixed(2)); for (const r of rows) console.log('  ', r);
}
