import { allFigureSprites } from '../src/art/figure';
import { listFxSprites } from '../src/art/fx';
import { propSpecs } from '../src/art/props';
import { structureSpecs } from '../src/art/structures';
import { vehicleSpecs } from '../src/art/vehicles';
import { renderSprites } from '../src/render/sprites';
import { packSprites } from '../src/render/atlas';
const groups: Record<string, any[]> = { render: renderSprites(), figure: allFigureSprites(), fx: listFxSprites(), vehicle: vehicleSpecs(), structure: structureSpecs(), prop: propSpecs() };
let all: any[] = [];
for (const [k, v] of Object.entries(groups)) { const px = v.reduce((s, x) => s + Math.ceil(x.w*2+4)*Math.ceil(x.h*2+4), 0); console.log(k, v.length, 'specs', (px/1e6).toFixed(1), 'Mpx'); all = all.concat(v); }
const pages = packSprites(all, 2, 2, 4096);
console.log('pages', pages.length, pages.map(p => `${p.w}x${p.h} cells=${p.cells.length}`).join(' | '));
// which page each group lands on
const where: Record<string, Set<number>> = {};
pages.forEach((p, i) => p.cells.forEach(c => { const g = c.spec.key.split('/')[0]; (where[g] ??= new Set()).add(i); }));
for (const [g, s] of Object.entries(where)) console.log('  prefix', g, 'on pages', [...s].join(','));
