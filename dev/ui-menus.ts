/**
 * Preview page for the menu screens and UI shell (dev server only).
 *
 *   dev/ui-menus.html?screen=title|campaign|briefing|quartermaster|result|settings|battle
 *     &mission=4        mission shown in the briefing and selected on the map
 *     &result=lost      defeat instead of victory on the result screen
 *     &progress=4       how many missions the mock save has cleared (0..10)
 *     &icons=0          run without a paintUnitIcon (tests the fallback)
 *     &hud=1            let the UI load the real HUD module if it exists
 *     &bg=0             plain black behind the UI instead of the fake battlefield
 *
 * Sets window.__ready = true once the first screen is up, and exposes
 * window.__ui (the UiHandle) and window.__mock (the mock app state).
 */
import type { Difficulty, Side, SupportKind, UnitKind } from '../src/data/schema';
import type { AppApi, CampaignView, MissionCard, ResultView, ScreenId, SettingsView, UpgradeView } from '../src/ui/contracts';
import { createUi } from '../src/ui/index';

const params = new URLSearchParams(window.location.search);

interface MockMission {
  id: number;
  title: string;
  location: string;
  date: string;
  theatre: MissionCard['theatre'];
  lon: number;
  lat: number;
  briefing: string[];
  objective: string;
  newUnit: UnitKind | null;
  newSupport: SupportKind | null;
}

const UNIT_NAMES: Record<UnitKind, string> = {
  sapper: 'Sapper',
  rifle: 'Rifleman',
  lmg: 'Bren Gunner',
  assault: 'Assault Trooper',
  mortar: 'Mortar Team',
  sniper: 'Sniper',
  medic: 'Medic',
  at: 'PIAT Team',
  tank: 'Churchill',
  heavyTank: 'Heavy Churchill',
};

const UNIT_BLURBS: Record<UnitKind, string> = {
  sapper: 'Hauls supply crates from the dump to the HQ. Does not fight.',
  rifle: 'Cheap, steady and accurate at medium range. The backbone of the line.',
  lmg: 'Long bursts that shred infantry in the open. Slow on the move.',
  assault: 'Fast, short-ranged, and carries grenades. Clears trenches and hurts pillboxes.',
  mortar: 'Lobs explosive shells over the line. Cracks trenches and pillboxes; helpless up close.',
  sniper: 'Very long range, slow shots, fragile. Picks off gunners, mortars and medics.',
  medic: 'Patches up nearby infantry. Unarmed.',
  at: 'Kills tanks and damages pillboxes. Poor against infantry.',
  tank: 'Shrugs off bullets. High-explosive gun plus machine gun. Costly.',
  heavyTank: 'A lumbering fortress on tracks.',
};

const SUPPORT_NAMES: Record<SupportKind, string> = {
  artillery: 'Artillery Barrage',
  smoke: 'Smoke Screen',
  airStrike: 'Typhoon Air Strike',
};

const SUPPORT_BLURBS: Record<SupportKind, string> = {
  artillery: 'A battery drops a salvo of shells around the spot you mark. Slow to arrive, hard to survive.',
  smoke: 'A cloud that blocks rifle and machine-gun fire for a few seconds. Cross open ground under it.',
  airStrike: 'A fighter-bomber rockets a strip of the front. Wrecks armour and anything bunched up.',
};

const MISSIONS: MockMission[] = [
  {
    id: 1,
    title: 'Counter-stroke at Arras',
    location: 'Arras, France',
    date: '21 May 1940',
    theatre: 'france',
    lon: 2.78,
    lat: 50.29,
    briefing: [
      'Enemy columns are driving for the Channel and our flank is in the air. Brigade wants a blow struck south of the town before nightfall.',
      'Your sappers will keep the supply dump moving. Train riflemen at the HQ, hold until you have the numbers, then go forward.',
      'Three orders are all you need: Fall Back, Hold, Advance. Use them.',
    ],
    objective: 'Destroy the enemy headquarters.',
    newUnit: null,
    newSupport: null,
  },
  {
    id: 2,
    title: 'Dunkirk Perimeter',
    location: 'Dunkirk, France',
    date: '29 May 1940',
    theatre: 'france',
    lon: 2.38,
    lat: 51.04,
    briefing: [
      'The army is coming off the beaches behind you. Every hour this canal line holds, another thousand men get home.',
      'They will come in waves. Dig in, keep the Bren guns fed and do not go looking for a fight.',
    ],
    objective: 'Hold the line for four minutes.',
    newUnit: 'lmg',
    newSupport: null,
  },
  {
    id: 3,
    title: 'Operation Crusader',
    location: 'Sidi Rezegh, Libya',
    date: '21 November 1941',
    theatre: 'desert',
    lon: 24.0,
    lat: 31.85,
    briefing: [
      'Tobruk has been shut in since April. Eighth Army is going to open the door, and the ridge at Sidi Rezegh is the hinge.',
      'The enemy is dug into a trench across the track. Riflemen will not shift him; send men who can get close with grenades.',
    ],
    objective: 'Take the trench and destroy the enemy headquarters.',
    newUnit: 'assault',
    newSupport: null,
  },
  {
    id: 4,
    title: 'El Alamein',
    location: 'El Alamein, Egypt',
    date: '23 October 1942',
    theatre: 'desert',
    lon: 28.95,
    lat: 30.83,
    briefing: [
      'Two belts of wire and mines, two trench lines, concrete machine-gun posts behind them. The enemy has had four months to build it.',
      'You have the guns to answer. Mortars will keep heads down in the trenches while the infantry closes, and the Royal Artillery is on call for anything that will not move.',
      'Break in, then break through. There is no way round.',
    ],
    objective: 'Break both trench lines and destroy the enemy headquarters.',
    newUnit: 'mortar',
    newSupport: 'artillery',
  },
  {
    id: 5,
    title: 'Primosole Bridge',
    location: 'Catania plain, Sicily',
    date: '14 July 1943',
    theatre: 'sicily',
    lon: 15.07,
    lat: 37.4,
    briefing: [
      'The bridge over the Simeto is the road to Catania. The paratroops took it last night and were pushed off it this morning.',
      'Take it back before dark. After nightfall the enemy will blow it and the whole advance stops.',
    ],
    objective: 'Destroy the enemy headquarters before nightfall.',
    newUnit: 'sniper',
    newSupport: null,
  },
  {
    id: 6,
    title: 'Monte Cassino',
    location: 'Cassino, Italy',
    date: '18 May 1944',
    theatre: 'italy',
    lon: 13.81,
    lat: 41.49,
    briefing: [
      'Three fortified lines climb the hill to the monastery. Three attacks have already failed on them.',
      'You will lose men on that slope. Bring medics forward to keep the line standing, and use smoke to cross the open ground between the terraces.',
    ],
    objective: 'Carry all three lines and destroy the enemy headquarters.',
    newUnit: 'medic',
    newSupport: 'smoke',
  },
  {
    id: 7,
    title: 'Sword Beach',
    location: 'Normandy, France',
    date: '6 June 1944',
    theatre: 'normandy',
    lon: -0.29,
    lat: 49.3,
    briefing: [
      'You are ashore with what the landing craft could carry. Build up fast: the beach behind you is all the room you have.',
      'Panzers are reported moving up from Caen. PIAT teams must be in the line before they arrive.',
    ],
    objective: 'Push inland and destroy the enemy headquarters.',
    newUnit: 'at',
    newSupport: null,
  },
  {
    id: 8,
    title: 'Hill 112',
    location: 'Normandy, France',
    date: '10 July 1944',
    theatre: 'france',
    lon: -0.46,
    lat: 49.12,
    briefing: [
      'Whoever holds Hill 112 holds Normandy, or so both sides believe. It is open cornfield all the way up and the enemy has armour on the crest.',
      'The Churchills are yours at last. Keep infantry with them or the anti-tank teams will pick them off.',
    ],
    objective: 'Take the hill and destroy the enemy headquarters.',
    newUnit: 'tank',
    newSupport: null,
  },
  {
    id: 9,
    title: 'Arnhem Bridge',
    location: 'Arnhem, Netherlands',
    date: '18 September 1944',
    theatre: 'holland',
    lon: 5.9,
    lat: 51.98,
    briefing: [
      'You hold the north end of the bridge with one battalion. The relief column is sixty miles away and late.',
      'No sappers, no tanks. Supplies come by parachute when the RAF can find you. Make every round count.',
    ],
    objective: 'Hold the bridge for six minutes.',
    newUnit: null,
    newSupport: null,
  },
  {
    id: 10,
    title: 'The Siegfried Line',
    location: 'Reichswald, Germany',
    date: '8 February 1945',
    theatre: 'germany',
    lon: 6.05,
    lat: 51.75,
    briefing: [
      'Four trench lines through flooded forest, and the last of the heavy armour waiting behind them.',
      'The Typhoons are on the cab rank overhead. Call them down on anything with tracks.',
    ],
    objective: 'Break the line and destroy the enemy headquarters.',
    newUnit: null,
    newSupport: 'airStrike',
  },
];

interface MockUpgrade {
  id: string;
  name: string;
  description: string;
  unit: UnitKind | null;
  levelText: string[];
}

const UPGRADES: MockUpgrade[] = [
  { id: 'sapperDrill', name: 'Sapper Drill', description: 'Sappers move faster and carry more per trip.', unit: null, levelText: ['+10% speed', '+20% speed, +2 carry', '+30% speed, +4 carry'] },
  { id: 'hqIncome', name: 'Supply Priority', description: 'More supplies trickle in to the HQ.', unit: null, levelText: ['+10% income', '+20% income', '+30% income'] },
  { id: 'hqHealth', name: 'Reinforced Bunker', description: 'Thicker concrete on the HQ.', unit: null, levelText: ['+15% health', '+30% health', '+45% health'] },
  { id: 'hqGun', name: 'HQ Vickers Gun', description: 'The bunker machine gun hits harder and faster.', unit: null, levelText: ['+15% damage', '+30% damage', '+30% damage, +20% rate'] },
  { id: 'rifleHealth', name: 'Rifle Webbing', description: 'Riflemen survive longer under fire.', unit: 'rifle', levelText: ['+10% health', '+20% health', '+30% health'] },
  { id: 'rifleDamage', name: 'Marksmanship', description: 'Riflemen hit harder.', unit: 'rifle', levelText: ['+10% damage', '+20% damage', '+30% damage'] },
  { id: 'lmgHealth', name: 'Bren Pit Drill', description: 'Bren gunners survive longer.', unit: 'lmg', levelText: ['+10% health', '+20% health', '+30% health'] },
  { id: 'lmgDamage', name: 'Bren Barrels', description: 'Bren bursts do more damage.', unit: 'lmg', levelText: ['+10% damage', '+20% damage', '+30% damage'] },
  { id: 'assaultHealth', name: 'Battle Jerkins', description: 'Assault troopers survive longer.', unit: 'assault', levelText: ['+10% health', '+20% health', '+30% health'] },
  { id: 'assaultDamage', name: 'Mills Bombs', description: 'Sten and grenade damage goes up.', unit: 'assault', levelText: ['+10% damage', '+20% damage', '+30% damage'] },
  { id: 'mortarDamage', name: 'Heavy Bombs', description: 'Mortar shells do more damage.', unit: 'mortar', levelText: ['+10% damage', '+20% damage', '+30% damage'] },
  { id: 'tankHealth', name: 'Appliqué Armour', description: 'Churchills take more punishment.', unit: 'tank', levelText: ['+10% health', '+20% health', '+30% health'] },
];

const DIFFICULTIES: { id: Difficulty; name: string }[] = [
  { id: 'normal', name: 'Normal' },
  { id: 'hard', name: 'Hard' },
  { id: 'insane', name: 'Insane' },
];

const POINTS_PER_CLEAR = 2;
const MAX_LEVEL = 3;

const startProgress = Math.max(0, Math.min(MISSIONS.length, Number(params.get('progress') ?? 4)));

const mock = {
  clearedCount: startProgress,
  levels: {} as Record<string, number>,
  settings: { muted: false, difficulty: 'normal', hints: true } as SettingsView,
  sounds: [] as string[],
  replayed: 0,
  started: null as { id: number; difficulty: Difficulty } | null,
};

function freshLevels(): void {
  mock.levels = {};
  if (mock.clearedCount >= 2) {
    mock.levels.sapperDrill = 2;
    mock.levels.rifleDamage = 1;
  }
}
freshLevels();

function pointsSpent(): number {
  let sum = 0;
  for (const up of UPGRADES) sum += mock.levels[up.id] ?? 0;
  return sum;
}

function campaign(): CampaignView {
  const earned = mock.clearedCount * POINTS_PER_CLEAR;
  const spent = pointsSpent();
  const available = earned - spent;
  const missions: MissionCard[] = MISSIONS.map((m, i) => ({
    id: m.id,
    title: m.title,
    location: m.location,
    date: m.date,
    theatre: m.theatre,
    mapPos: { lon: m.lon, lat: m.lat },
    briefing: m.briefing,
    objective: m.objective,
    unlocked: i <= mock.clearedCount,
    cleared: { normal: i < mock.clearedCount, hard: i < mock.clearedCount - 2, insane: i < mock.clearedCount - 3 },
    newUnit: m.newUnit ? { kind: m.newUnit, name: UNIT_NAMES[m.newUnit], blurb: UNIT_BLURBS[m.newUnit] } : null,
    newSupport: m.newSupport ? { kind: m.newSupport, name: SUPPORT_NAMES[m.newSupport], blurb: SUPPORT_BLURBS[m.newSupport] } : null,
  }));
  const upgrades: UpgradeView[] = UPGRADES.map((up) => {
    const level = mock.levels[up.id] ?? 0;
    return {
      id: up.id,
      name: up.name,
      description: up.description,
      unit: up.unit,
      level,
      maxLevel: MAX_LEVEL,
      cost: 1,
      levelText: up.levelText,
      canBuy: level < MAX_LEVEL && available >= 1,
      canRefund: level > 0,
    };
  });
  return {
    missions,
    pointsEarned: earned,
    pointsSpent: spent,
    pointsAvailable: available,
    upgrades,
    settings: { ...mock.settings },
    difficulties: DIFFICULTIES,
  };
}

function mockResult(won: boolean, missionId: number, difficulty: Difficulty): ResultView {
  const mission = MISSIONS.find((m) => m.id === missionId) ?? MISSIONS[0];
  return {
    won,
    missionId: mission.id,
    title: mission.title,
    reason: won ? 'Enemy headquarters destroyed.' : 'Your headquarters was overrun.',
    difficulty,
    timeSec: won ? 412 : 268,
    unitsTrained: won ? 37 : 21,
    unitsLost: won ? 19 : 21,
    enemiesKilled: won ? 44 : 13,
    suppliesGathered: won ? 2380 : 1145,
    pointsAwarded: won ? POINTS_PER_CLEAR : 0,
    nextMissionId: won && mission.id < MISSIONS.length ? mission.id + 1 : null,
  };
}

/** A stand-in for the art track's icon painter: a little tin-hatted stick man, or a box on tracks. */
function paintUnitIcon(canvas: HTMLCanvasElement, kind: UnitKind, side: Side): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const s = canvas.width / 48;
  ctx.setTransform(s, 0, 0, s, 0, 0);
  ctx.clearRect(0, 0, 48, 48);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#14150f';
  ctx.fillStyle = '#14150f';
  const tint = side === 0 ? '#8c7b4a' : '#5d6964';
  if (kind === 'tank' || kind === 'heavyTank') {
    ctx.fillRect(7, 26, 34, 10);
    ctx.fillRect(16, 18, 16, 9);
    ctx.fillRect(30, 20, 14, 3);
    ctx.fillStyle = tint;
    ctx.fillRect(9, 28, 30, 3);
    ctx.fillStyle = '#14150f';
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.arc(11 + i * 6.5, 38, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    return;
  }
  ctx.lineWidth = 3.4;
  ctx.beginPath();
  ctx.moveTo(24, 17);
  ctx.lineTo(23, 30);
  ctx.lineTo(18, 43);
  ctx.moveTo(23, 30);
  ctx.lineTo(29, 43);
  ctx.moveTo(24, 20);
  ctx.lineTo(33, 25);
  ctx.moveTo(24, 20);
  ctx.lineTo(16, 27);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(24, 12, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = tint;
  ctx.beginPath();
  ctx.ellipse(24, 9.5, 9, 2.6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(24, 9, 5.4, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = '#14150f';
  ctx.lineWidth = 2.2;
  if (kind === 'medic') {
    ctx.fillStyle = '#9c2b1f';
    ctx.fillRect(31, 28, 9, 3);
    ctx.fillRect(34, 25, 3, 9);
  } else if (kind === 'mortar') {
    ctx.beginPath();
    ctx.moveTo(33, 40);
    ctx.lineTo(42, 22);
    ctx.stroke();
  } else if (kind !== 'sapper') {
    ctx.beginPath();
    ctx.moveTo(14, 28);
    ctx.lineTo(40, 22);
    ctx.stroke();
  } else {
    ctx.fillStyle = '#5f5331';
    ctx.fillRect(29, 22, 11, 8);
  }
}

const game = document.getElementById('game');
const root = document.getElementById('ui');
if (!game || !root) throw new Error('ui-menus: #game or #ui is missing');
if (params.get('bg') !== '0') game.classList.add('fake-battle');
const note = document.createElement('div');
note.className = 'note';
game.append(note);

const app: AppApi = {
  campaign,
  startMission(id, difficulty) {
    mock.started = { id, difficulty };
    note.textContent = `battle: mission ${id} on ${difficulty} (HUD only). Press V for victory, D for defeat.`;
    ui.show('battle');
  },
  buyUpgrade(id) {
    const level = mock.levels[id] ?? 0;
    if (level < MAX_LEVEL && mock.clearedCount * POINTS_PER_CLEAR - pointsSpent() >= 1) mock.levels[id] = level + 1;
  },
  refundUpgrade(id) {
    const level = mock.levels[id] ?? 0;
    if (level > 0) mock.levels[id] = level - 1;
  },
  refundAll() {
    mock.levels = {};
  },
  setSetting(key, value) {
    mock.settings = { ...mock.settings, [key]: value };
  },
  resetSave() {
    mock.clearedCount = 0;
    mock.levels = {};
    mock.settings = { muted: false, difficulty: 'normal', hints: true };
  },
  replayHints() {
    mock.replayed++;
  },
  dispatch() {
    // No battle behind this page.
  },
  uiSound(name) {
    mock.sounds.push(name);
  },
};

const ui = createUi(root, app, {
  paintUnitIcon: params.get('icons') === '0' ? undefined : paintUnitIcon,
  createHud: params.get('hud') === '1' ? undefined : null,
  onScreen: (screen) => {
    document.title = `Tin Hats UI: ${screen}`;
    if (screen !== 'battle') note.textContent = '';
  },
});

window.addEventListener('keydown', (ev) => {
  if (ui.current() !== 'battle' || !mock.started) return;
  const key = ev.key.toLowerCase();
  if (key !== 'v' && key !== 'd') return;
  const won = key === 'v';
  if (won) mock.clearedCount = Math.max(mock.clearedCount, mock.started.id);
  ui.show('result', { result: mockResult(won, mock.started.id, mock.started.difficulty) });
});

const SCREEN_IDS: ScreenId[] = ['title', 'campaign', 'briefing', 'quartermaster', 'battle', 'result', 'settings'];
const wanted = params.get('screen') ?? 'title';
const screen: ScreenId = SCREEN_IDS.find((id) => id === wanted) ?? 'title';
const missionParam = Number(params.get('mission') ?? 0);
const missionId = missionParam >= 1 && missionParam <= MISSIONS.length ? missionParam : undefined;

if (screen === 'result') {
  const won = params.get('result') !== 'lost';
  ui.show('result', { result: mockResult(won, missionId ?? Math.max(1, mock.clearedCount), mock.settings.difficulty) });
} else if (screen === 'battle') {
  app.startMission(missionId ?? 1, mock.settings.difficulty);
} else {
  ui.show(screen, missionId === undefined ? undefined : { missionId });
}

const hooks = window as unknown as { __ready: boolean; __ui: typeof ui; __mock: typeof mock };
hooks.__ui = ui;
hooks.__mock = mock;
hooks.__ready = true;
