/**
 * Headless battle runner.
 *
 *   x.cmd npx tsx tools/sim-cli.ts --mission 1 --p0 bot --p1 ai --seeds 20 --difficulty normal
 *
 * Options
 *   --mission N      mission id (default 1)
 *   --p0, --p1 K     commander of side 0 / side 1: human | ai | bot | idle (default bot / ai)
 *   --seeds N        number of battles (default 20)
 *   --seed N         first seed (default 1); battles use seed, seed+1, ...
 *   --difficulty D   normal | hard | insane (default normal)
 *   --max S          give up after S seconds of battle time (default 1800)
 *   --mirror         give side 1 the same start as side 0 (fair AI-vs-AI test)
 *   --verbose        print one line per battle
 *
 * Prints the win rate, average duration, per-side stats and the average step time in microseconds.
 */
import { CONFIG } from '../src/data/config';
import { DIFFICULTIES } from '../src/data/difficulty';
import { getMission } from '../src/data/missions';
import type { Difficulty, MissionDef } from '../src/data/schema';
import { createBattle, summarize, type BattleResult, type CommanderKind } from '../src/sim';

interface Options {
  mission: number;
  p0: CommanderKind;
  p1: CommanderKind;
  seeds: number;
  seed: number;
  difficulty: Difficulty;
  max: number;
  mirror: boolean;
  verbose: boolean;
}

const COMMANDERS: readonly CommanderKind[] = ['human', 'ai', 'bot', 'idle'];

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function parseArgs(argv: string[]): Options {
  const opts: Options = {
    mission: 1,
    p0: 'bot',
    p1: 'ai',
    seeds: 20,
    seed: 1,
    difficulty: 'normal',
    max: 1800,
    mirror: false,
    verbose: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--mirror') {
      opts.mirror = true;
      continue;
    }
    if (arg === '--verbose') {
      opts.verbose = true;
      continue;
    }
    const value = argv[++i];
    if (value === undefined) fail(`Missing value for ${arg}`);
    switch (arg) {
      case '--mission':
        opts.mission = Number(value);
        break;
      case '--p0':
      case '--p1': {
        const kind = COMMANDERS.find((c) => c === value);
        if (!kind) fail(`Unknown commander "${value}" (use ${COMMANDERS.join(', ')})`);
        if (arg === '--p0') opts.p0 = kind;
        else opts.p1 = kind;
        break;
      }
      case '--seeds':
        opts.seeds = Number(value);
        break;
      case '--seed':
        opts.seed = Number(value);
        break;
      case '--difficulty':
        if (!(value in DIFFICULTIES)) fail(`Unknown difficulty "${value}"`);
        opts.difficulty = value as Difficulty;
        break;
      case '--max':
        opts.max = Number(value);
        break;
      default:
        fail(`Unknown option ${arg}`);
    }
  }
  if (!Number.isFinite(opts.seeds) || opts.seeds < 1) fail('--seeds must be at least 1');
  if (!Number.isFinite(opts.seed)) fail('--seed must be a number');
  if (!Number.isFinite(opts.max) || opts.max <= 0) fail('--max must be positive');
  return opts;
}

function mirrored(mission: MissionDef): MissionDef {
  return { ...mission, start: [mission.start[0], { ...mission.start[0], faction: mission.start[1].faction }] };
}

function fmt(n: number, digits = 1): string {
  return n.toFixed(digits);
}

function main(): void {
  const opts = parseArgs(process.argv.slice(2));
  const found = getMission(opts.mission);
  if (!found) fail(`Mission ${opts.mission} does not exist`);
  const mission = opts.mirror ? mirrored(found) : found;
  const maxTicks = Math.ceil(opts.max * CONFIG.tickRate);

  const results: BattleResult[] = [];
  let totalTicks = 0;
  let totalMs = 0;
  let peakUnits = 0;

  for (let n = 0; n < opts.seeds; n++) {
    const seed = opts.seed + n;
    const battle = createBattle({
      mission,
      difficulty: opts.difficulty,
      seed,
      upgrades: {},
      commanders: [opts.p0, opts.p1],
    });
    const t0 = performance.now();
    while (!battle.state.over && battle.state.tick < maxTicks) {
      battle.step();
      if (battle.state.unitCount > peakUnits) peakUnits = battle.state.unitCount;
    }
    totalMs += performance.now() - t0;
    totalTicks += battle.state.tick;
    const r = summarize(battle);
    results.push(r);
    if (opts.verbose) {
      const who = r.timedOut ? 'timeout' : r.winner < 0 ? 'draw' : `side ${r.winner}`;
      console.log(
        `seed ${seed}: ${who} at ${fmt(r.seconds)}s (${r.endReason})  ` +
          `hq ${fmt(r.hqHp[0] * 100, 0)}% / ${fmt(r.hqHp[1] * 100, 0)}%  ` +
          `trained ${r.stats[0].trained}/${r.stats[1].trained}  lost ${r.stats[0].lost}/${r.stats[1].lost}`,
      );
    }
  }

  const count = results.length;
  const wins = [0, 0];
  let undecided = 0;
  let seconds = 0;
  let minSeconds = Infinity;
  let maxSeconds = 0;
  for (const r of results) {
    if (r.winner === 0 || r.winner === 1) wins[r.winner]++;
    else undecided++;
    seconds += r.seconds;
    if (r.seconds < minSeconds) minSeconds = r.seconds;
    if (r.seconds > maxSeconds) maxSeconds = r.seconds;
  }

  console.log(
    `Mission ${mission.id} "${mission.title}"${opts.mirror ? ' (mirrored)' : ''}, ${opts.difficulty}, ` +
      `${opts.p0} vs ${opts.p1}, ${count} battles from seed ${opts.seed}`,
  );
  console.log(
    `Win rate: side 0 ${fmt((wins[0] / count) * 100)}%  side 1 ${fmt((wins[1] / count) * 100)}%  ` +
      `undecided ${fmt((undecided / count) * 100)}%`,
  );
  console.log(
    `Duration: avg ${fmt(seconds / count)}s (${fmt(seconds / count / 60, 2)} min), ` +
      `min ${fmt(minSeconds)}s, max ${fmt(maxSeconds)}s`,
  );
  for (let si = 0; si < 2; si++) {
    let trained = 0;
    let lost = 0;
    let kills = 0;
    let gathered = 0;
    let hq = 0;
    for (const r of results) {
      trained += r.stats[si].trained;
      lost += r.stats[si].lost;
      kills += r.stats[si].kills;
      gathered += r.stats[si].suppliesGathered;
      hq += r.hqHp[si];
    }
    console.log(
      `Side ${si} (${si === 0 ? opts.p0 : opts.p1}): avg trained ${fmt(trained / count)}, lost ${fmt(lost / count)}, ` +
        `kills ${fmt(kills / count)}, supplies gathered ${fmt(gathered / count, 0)}, HQ left ${fmt((hq / count) * 100, 0)}%`,
    );
  }
  console.log(
    `Step time: avg ${fmt((totalMs * 1000) / Math.max(1, totalTicks), 2)} microseconds over ${totalTicks} ticks ` +
      `(peak ${peakUnits} unit slots in use)`,
  );
}

main();
