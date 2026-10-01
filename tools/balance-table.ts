/**
 * The balance report, written to docs/BALANCE.md:
 *   - equal-cost matchup tables for every ordered pair of combat unit kinds, in the open and attacking
 *     a trench, and one line per unit kind with what it beats and what beats it;
 *   - the campaign: every mission played by the reasonable-player bot against the AI on Normal, Hard
 *     and Insane, and by the idle commander on Normal (win rate, median winning time);
 *   - the AI against itself on the mirrored proving ground.
 *
 *   x.cmd npx tsx tools/balance-table.ts [--seeds N] [--out docs/BALANCE.md] [--print] [--quick]
 *
 * Matchups (see src/sim/matchup.ts): rows attack, columns defend. A cell reads "A 4/4 63%": the
 * attacker won 4 of 4 duels and kept 63% of its value on average in its wins; "D ..." is the same for
 * the defender; "= ..." is a tie. --seeds sets the matchup seeds; the campaign and mirror use
 * CAMPAIGN_RUNS (src/data/balance.ts). --quick skips the campaign and the mirror.
 */
import { writeFileSync } from 'node:fs';
import { CAMPAIGN_RUNS, MATCHUP } from '../src/data/balance';
import { DIFFICULTIES, DIFFICULTY_LIST } from '../src/data/difficulty';
import { MISSIONS } from '../src/data/missions';
import { UNITS } from '../src/data/units';
import type { UnitKind } from '../src/data/schema';
import { runMatchup, runMirror, runSeries, type MatchupGround, type MatchupResult, type MissionSeries } from '../src/sim';

interface Options {
  seeds: number;
  out: string;
  print: boolean;
  quick: boolean;
}

function parseArgs(argv: string[]): Options {
  const opts: Options = { seeds: MATCHUP.seeds, out: 'docs/BALANCE.md', print: false, quick: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--print') opts.print = true;
    else if (arg === '--quick') opts.quick = true;
    else if (arg === '--seeds') opts.seeds = Number(argv[++i]);
    else if (arg === '--out') opts.out = argv[++i] ?? opts.out;
    else {
      console.error(`Unknown option ${arg}`);
      process.exit(1);
    }
  }
  if (!Number.isFinite(opts.seeds) || opts.seeds < 1) {
    console.error('--seeds must be at least 1');
    process.exit(1);
  }
  return opts;
}

function pct(x: number): string {
  return `${Math.round(x * 100)}%`;
}

function cell(r: MatchupResult): string {
  const n = r.winsA + r.winsB + r.draws;
  if (r.verdict > 0) return `A ${r.winsA}/${n} ${pct(r.margin)}`;
  if (r.verdict < 0) return `D ${r.winsB}/${n} ${pct(r.margin)}`;
  return `= ${r.winsA}-${r.winsB}`;
}

function table(kinds: readonly UnitKind[], results: Map<string, MatchupResult>, ground: MatchupGround): string[] {
  const lines = [`| attacks \\ defends | ${kinds.join(' | ')} |`, `| --- | ${kinds.map(() => '---').join(' | ')} |`];
  for (const a of kinds) {
    const row = kinds.map((b) => cell(results.get(`${ground}:${a}:${b}`) as MatchupResult));
    lines.push(`| **${a}** | ${row.join(' | ')} |`);
  }
  return lines;
}

function list(kinds: string[]): string {
  return kinds.join(', ') || 'nothing';
}

/** One line per unit kind: what it beats and what beats it, in the open and around a trench. */
function perUnit(kinds: readonly UnitKind[], results: Map<string, MatchupResult>): string[] {
  const get = (ground: MatchupGround, a: UnitKind, b: UnitKind): MatchupResult => results.get(`${ground}:${a}:${b}`) as MatchupResult;
  const lines: string[] = [];
  for (const k of kinds) {
    const beats: string[] = [];
    const beatenBy: string[] = [];
    const breaks: string[] = [];
    const brokenBy: string[] = [];
    const holds: string[] = [];
    const fallsTo: string[] = [];
    for (const o of kinds) {
      if (o === k) continue;
      // In the open over both orderings (as side 0 and as side 1).
      const mine = get('open', k, o).winsA + get('open', o, k).winsB;
      const theirs = get('open', k, o).winsB + get('open', o, k).winsA;
      if (mine > theirs) beats.push(o);
      else if (theirs > mine) beatenBy.push(o);
      const attack = get('trench', k, o).verdict;
      if (attack > 0) breaks.push(o);
      else if (attack < 0) brokenBy.push(o);
      const hold = get('trench', o, k).verdict;
      if (hold < 0) holds.push(o);
      else if (hold > 0) fallsTo.push(o);
    }
    const won = beats.length + breaks.length + holds.length;
    const lost = beatenBy.length + brokenBy.length + fallsTo.length;
    lines.push(
      `- **${k}** (${UNITS[k].cost} supplies; wins ${won}, loses ${lost} of its matchups against other kinds). ` +
        `In the open it beats: ${list(beats)}; it is beaten by: ${list(beatenBy)}. ` +
        `Attacking a trench it breaks: ${list(breaks)}; it fails against: ${list(brokenBy)}. ` +
        `Dug in it holds against: ${list(holds)}; it falls to: ${list(fallsTo)}.`,
    );
  }
  return lines;
}

function seriesCell(r: MissionSeries): string {
  const time = r.wins > 0 ? ` in ${r.medianWinMinutes.toFixed(1)} min` : '';
  const undecided = r.undecided > 0 ? `, ${r.undecided} undecided` : '';
  return `${pct(r.winRate)}${time}${undecided}`;
}

function campaign(print: boolean): string[] {
  const seeds = CAMPAIGN_RUNS.seeds;
  const header = DIFFICULTY_LIST.map((d) => `bot, ${DIFFICULTIES[d].name}`);
  const lines = [
    `| mission | expected | ${header.join(' | ')} | idle, Normal |`,
    `| --- | --- | ${header.map(() => '---').join(' | ')} | --- |`,
  ];
  for (const m of MISSIONS) {
    const bot = DIFFICULTY_LIST.map((d) => runSeries(m, d, 'bot', seeds));
    const idle = runSeries(m, 'normal', 'idle', seeds);
    const idleCell = `lost ${idle.losses}/${seeds}`;
    const row = `| ${m.id} ${m.title} | ${m.expectedMinutes[0]} to ${m.expectedMinutes[1]} min | ${bot.map(seriesCell).join(' | ')} | ${idleCell} |`;
    lines.push(row);
    if (print) console.log(row);
  }
  return lines;
}

function main(): void {
  const opts = parseArgs(process.argv.slice(2));
  const kinds = MATCHUP.kinds;
  const results = new Map<string, MatchupResult>();
  const t0 = performance.now();
  for (const ground of ['open', 'trench'] as const) {
    for (const a of kinds) {
      for (const b of kinds) {
        results.set(`${ground}:${a}:${b}`, runMatchup(a, b, ground, opts.seeds));
      }
    }
    if (opts.print) {
      // Compact grid: A/D/= then the winner's mean value left in its wins.
      console.log(`${ground}: ${kinds.map((k) => k.slice(0, 6).padStart(7)).join('')}`);
      for (const a of kinds) {
        const row = kinds.map((b) => {
          const r = results.get(`${ground}:${a}:${b}`) as MatchupResult;
          const tag = r.verdict > 0 ? 'A' : r.verdict < 0 ? 'D' : '=';
          return `${tag}${r.verdict === 0 ? '' : String(Math.round(r.margin * 100))}`.padStart(7);
        });
        console.log(`${a.slice(0, 6).padEnd(8)}${row.join('')}`);
      }
    }
  }

  const doc = [
    '# Balance',
    '',
    'Generated by `tools/balance-table.ts` (do not edit by hand). The balance tests in `tests/balance` assert what',
    'these tables show: the counters (`matchups.test.ts`), the campaign on Normal (`missions.test.ts`), the',
    'difficulty gradient (`difficulty.test.ts`) and the mirror (`mirror.test.ts`).',
    '',
    '## Equal-cost matchups',
    '',
    `Each side spends ${MATCHUP.budgetMin} to ${MATCHUP.budgetMax} supplies on one unit kind, counts chosen so both sides cost`,
    `(nearly) the same; ${opts.seeds} seeds per cell; a duel still running after ${MATCHUP.maxSeconds} s is undecided.`,
    'Rows attack, columns defend. "A 4/4 63%" = the attacker won 4 of 4 and kept 63% of its value in its wins;',
    '"D" = the defender won; "=" = tied.',
    '',
    '### (a) In the open, both advancing',
    '',
    ...table(kinds, results, 'open'),
    '',
    '### (b) Attacking the column kind dug into a trench',
    '',
    `One trench at x ${MATCHUP.trenchX}, ${MATCHUP.trenchWidth} wu wide, one slot per defender that can use it`,
    '(mortars and tanks stand behind it; an army of only mortars or tanks holds the same line in the open).',
    'The defender holds; the attacker advances.',
    '',
    ...table(kinds, results, 'trench'),
    '',
    '### Per unit',
    '',
    'In the open over both orderings (as side 0 and as side 1); around a trench as the attacker and as the',
    'defender. Matchups against its own kind are left out of the counts.',
    '',
    ...perUnit(kinds, results),
    '',
  ];
  const matchupSeconds = (performance.now() - t0) / 1000;

  if (!opts.quick) {
    const t1 = performance.now();
    doc.push(
      '## Campaign missions',
      '',
      `Each mission played over seeds 1 to ${CAMPAIGN_RUNS.seeds} with no upgrades: the reasonable-player bot against the AI on`,
      'each difficulty (win rate, median length of the wins), and the idle commander on Normal. A battle still',
      `running after ${CAMPAIGN_RUNS.capMinutes} minutes is undecided. Difficulty changes only the AI's income, aggression, think`,
      'interval, wave strength and army size.',
      '',
      ...campaign(opts.print),
      '',
    );
    const mirror = runMirror(CAMPAIGN_RUNS.mirrorSeeds);
    const line =
      `The AI against itself on the mirrored proving ground over seeds 1 to ${mirror.seeds}: side 0 won ${mirror.wins[0]}, ` +
      `side 1 won ${mirror.wins[1]}, ${mirror.undecided} undecided (side 0's share of the decided battles ${(mirror.share * 100).toFixed(1)}%); ` +
      `battles last ${mirror.meanMinutes.toFixed(1)} minutes on average.`;
    if (opts.print) console.log(line);
    doc.push('## Mirror', '', line, '');
    console.log(`Campaign and mirror: ${((performance.now() - t1) / 1000).toFixed(1)} s`);
  }

  writeFileSync(opts.out, doc.join('\n'));
  console.log(`Wrote ${opts.out} (${kinds.length * kinds.length * 2} pairings, ${opts.seeds} seeds each, ${matchupSeconds.toFixed(1)} s)`);
}

main();
