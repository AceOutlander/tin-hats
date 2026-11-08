// Summarise a .cpuprofile: self and inclusive time by function (file:line).
import { readFileSync } from 'node:fs';
const p = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const byId = new Map(p.nodes.map((n) => [n.id, n]));
const self = new Map();
const dts = p.timeDeltas; let total = 0;
const sampleCount = new Map();
for (let i = 0; i < p.samples.length; i++) { sampleCount.set(p.samples[i], (sampleCount.get(p.samples[i]) ?? 0) + (dts[i] ?? 0)); total += dts[i] ?? 0; }
const parent = new Map(); for (const n of p.nodes) for (const c of n.children ?? []) parent.set(c, n.id);
const key = (n) => { const cf = n.callFrame; const f = cf.url.split(/[\/]/).slice(-2).join('/'); return `${cf.functionName || '(anon)'} ${f}:${cf.lineNumber + 1}`; };
const incl = new Map();
for (const [id, t] of sampleCount) {
  const n = byId.get(id); const k = key(n); self.set(k, (self.get(k) ?? 0) + t);
  const seen = new Set(); let cur = id;
  while (cur !== undefined) { const kk = key(byId.get(cur)); if (!seen.has(kk)) { seen.add(kk); incl.set(kk, (incl.get(kk) ?? 0) + t); } cur = parent.get(cur); }
}
const filt = process.argv[3] ?? '';
const show = (m, title) => { console.log(`\n${title} (total ${(total/1000).toFixed(0)} ms)`); [...m].filter(([k]) => k.includes(filt)).sort((a,b)=>b[1]-a[1]).slice(0, 25).forEach(([k,t]) => console.log(`${(100*t/total).toFixed(1).padStart(5)}%  ${(t/1000).toFixed(0).padStart(6)} ms  ${k}`)); };
show(self, 'SELF'); show(incl, 'INCLUSIVE');
