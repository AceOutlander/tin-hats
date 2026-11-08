import { readFileSync } from 'node:fs';
const p = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const fn = process.argv[3];
const src = readFileSync(process.argv[4], 'utf8').split('\n');
const lines = new Map(); let tot = 0;
for (const n of p.nodes) if (n.callFrame.functionName === fn) for (const t of n.positionTicks ?? []) { lines.set(t.line, (lines.get(t.line) ?? 0) + t.ticks); tot += t.ticks; }
console.log(`${fn}: ${tot} ticks`);
[...lines].sort((a,b)=>b[1]-a[1]).slice(0, 15).forEach(([l,t]) => console.log(`${(100*t/tot).toFixed(1).padStart(5)}%  L${l}: ${src[l-1].trim().slice(0,110)}`));
