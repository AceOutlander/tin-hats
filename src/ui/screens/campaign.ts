/**
 * Campaign screen: the chosen campaign's situation map (src/data/campaignMap.ts) with its mission pins, the route and,
 * where the campaign has them, the front line of the selected mission's date; the selected mission's card, and the way
 * into the briefing, the Armoury, the Quartermaster and Settings.
 */
import { CAMPAIGN_MAP_VIEW, frontOn, projection, type CampaignMapDef, type MapProjection } from '../../data/campaignMap';
import { STALINGRAD_MAP } from '../../data/campaignMapStalingrad';
import { boxPan, clampPan, layoutPins, type PinBox } from './mapLayout';
import type { MissionCard } from '../contracts';
import { add, button, clear, el, setStencil, stencil } from '../shell/dom';
import { glyph } from '../shell/icons';
import type { ScreenFactory } from '../shell/types';
import { paintCampaignMap, type MapPin, type PinState } from './mapPaint';

function pinState(m: MissionCard): PinState {
  if (!m.unlocked) return 'locked';
  return m.cleared.normal || m.cleared.hard || m.cleared.insane ? 'cleared' : 'open';
}

/** The mission the player most likely wants next: the first open one, else the last unlocked. */
export function defaultMissionId(missions: readonly MissionCard[]): number {
  let lastUnlocked = missions.length > 0 ? missions[0].id : 0;
  for (const m of missions) {
    if (!m.unlocked) continue;
    if (pinState(m) === 'open') return m.id;
    lastUnlocked = m.id;
  }
  return lastUnlocked;
}

export const campaignScreen: ScreenFactory = (ctx) => {
  const root = el('section', 'th-screen th-campaign');
  root.dataset.screen = 'campaign';

  // --- Map ---------------------------------------------------------------
  const map = el('div', 'th-map');
  map.dataset.interactive = '';
  const world = el('div', 'th-map-world');
  const canvas = el('canvas', 'th-map-canvas');
  canvas.setAttribute('aria-hidden', 'true');
  world.append(canvas);

  const head = el('div', 'th-map-head');
  /** Back goes to the campaign select when there is a choice of campaigns, else to the title. */
  const backTo = (): 'campaigns' | 'title' => ((ctx.view().campaigns?.length ?? 0) > 1 ? 'campaigns' : 'title');
  const back = button({
    testid: 'back',
    className: 'th-btn-icon',
    aria: backTo() === 'campaigns' ? 'Back to the campaigns' : 'Back to title',
    content: [glyph('back')],
    onTap: () => {
      ctx.app.uiSound('click');
      ctx.go(backTo());
    },
  });
  const mapTitle = stencil('h1', 'CAMPAIGN', 'th-map-title');
  add(head, back, mapTitle);
  add(map, world, head);

  // --- Side panel --------------------------------------------------------
  const side = el('aside', 'th-side');
  const card = el('div', 'th-paper th-card');
  const cardTop = el('div', 'th-card-top');
  const cardNo = el('span', 'th-type th-card-no');
  const cardStamp = el('span', 'th-stamp');
  add(cardTop, cardNo, cardStamp);
  const cardTitle = stencil('h2', '', 'th-card-title');
  const cardPlace = el('p', 'th-type th-card-place');
  const cardDate = el('p', 'th-type th-card-date');
  const cardPips = el('div', 'th-card-pips');
  const start = button({
    testid: 'mission-start',
    label: 'Start',
    className: 'th-btn-primary th-card-start',
    onTap: () => {
      const m = selected();
      if (!m || !m.unlocked) {
        ctx.app.uiSound('deny');
        return;
      }
      ctx.app.uiSound('click');
      ctx.go('briefing', { missionId: m.id });
    },
  });
  start.dataset.primary = '';
  const cardObjective = el('p', 'th-type th-card-obj');
  add(card, cardTop, cardTitle, cardPlace, cardDate, cardPips, cardObjective, start);

  const foot = el('div', 'th-side-foot');
  const qmPoints = el('span', 'th-points-num');
  qmPoints.dataset.testid = 'points-available';
  const qmSub = el('span', 'th-btn-sub');
  add(qmSub, glyph('chevron', 'th-icon th-icon-small'), qmPoints, el('span', undefined, ' points'));
  const quartermaster = button({
    testid: 'quartermaster',
    className: 'th-btn-stack th-side-qm',
    content: [el('span', 'th-btn-label', 'Quartermaster'), qmSub],
    onTap: () => {
      ctx.app.uiSound('click');
      ctx.go('quartermaster');
    },
  });
  const settings = button({
    testid: 'settings',
    className: 'th-btn-icon',
    aria: 'Settings',
    content: [glyph('cog')],
    onTap: () => {
      ctx.app.uiSound('click');
      ctx.session.settingsFrom = 'campaign';
      ctx.go('settings');
    },
  });
  const armouryMedals = el('span', 'th-points-num');
  armouryMedals.dataset.testid = 'medals-available';
  const armourySub = el('span', 'th-btn-sub');
  add(armourySub, glyph('medal', 'th-icon th-icon-small'), armouryMedals, el('span', undefined, ' medals'));
  const armoury = button({
    testid: 'armoury',
    className: 'th-btn-stack th-side-qm',
    content: [el('span', 'th-btn-label', 'Shop'), armourySub],
    onTap: () => {
      ctx.app.uiSound('click');
      ctx.go('armoury');
    },
  });
  add(foot, armoury, quartermaster, settings);
  add(side, card, foot);
  add(root, map, side);

  // --- State -------------------------------------------------------------
  let missions: MissionCard[] = [];
  let mapDef: CampaignMapDef = STALINGRAD_MAP;
  let proj: MapProjection = projection(mapDef.bounds);
  /** The date of the front line painted last (the selected mission's), so a new selection repaints only when it changes. */
  let paintedFront: string | null = null;
  const pinEls = new Map<number, HTMLButtonElement>();
  let pins: MapPin[] = [];
  let mapW = 0;
  let mapH = 0;
  let panX = 0;
  let panY = 0;
  let laidOut = false;
  /** True when the whole campaign fits on screen at once, so selecting a pin never needs to move the map. */
  let fitsAll = false;
  let pinBox: PinBox = { minX: 0, maxX: 0, minY: 0, maxY: 0 };

  function selected(): MissionCard | undefined {
    return missions.find((m) => m.id === ctx.session.missionId);
  }

  function applyPan(animate: boolean): void {
    panX = clampPan(panX, mapW, map.clientWidth);
    panY = clampPan(panY, mapH, map.clientHeight);
    world.classList.toggle('is-gliding', animate);
    world.style.transform = `translate3d(${Math.round(panX)}px, ${Math.round(panY)}px, 0)`;
  }

  function centreOn(id: number, animate: boolean): void {
    const pin = pins.find((p) => p.id === id);
    if (!pin) return;
    panX = map.clientWidth / 2 - pin.x;
    panY = map.clientHeight / 2 - pin.y;
    applyPan(animate);
  }

  /** The resting view: every pin when they all fit, otherwise the selected mission. */
  function settle(animate: boolean): void {
    if (fitsAll) {
      const pan = boxPan(pinBox, map.clientWidth, map.clientHeight);
      panX = pan.x;
      panY = pan.y;
      applyPan(animate);
    } else {
      centreOn(ctx.session.missionId, animate);
    }
  }

  function buildPins(): void {
    for (const node of pinEls.values()) node.remove();
    pinEls.clear();
    for (const m of missions) {
      const pinButton = button({
        testid: `mission-pin-${m.id}`,
        className: 'th-pin',
        bare: true,
        onTap: () => {
          ctx.app.uiSound('click');
          select(m.id, true);
        },
      });
      pinButton.addEventListener('focus', () => {
        if (ctx.keyboard() && !fitsAll) centreOn(m.id, true);
      });
      const disc = el('span', 'th-pin-disc');
      const pips = el('span', 'th-pin-pips');
      add(pinButton, disc, pips);
      pinEls.set(m.id, pinButton);
      world.append(pinButton);
    }
  }

  function updatePins(): void {
    const difficulties = ctx.view().difficulties;
    const nextId = defaultMissionId(missions);
    for (const m of missions) {
      const node = pinEls.get(m.id);
      if (!node) continue;
      const state = pinState(m);
      node.dataset.state = state;
      node.classList.toggle('is-selected', m.id === ctx.session.missionId);
      node.classList.toggle('is-next', state === 'open' && m.id === nextId);
      node.setAttribute('aria-pressed', m.id === ctx.session.missionId ? 'true' : 'false');
      node.setAttribute('aria-label', `Mission ${m.id}: ${m.title}, ${state === 'locked' ? 'locked' : state === 'cleared' ? 'cleared' : 'ready'}`);
      const disc = node.children[0] as HTMLElement;
      const pips = node.children[1] as HTMLElement;
      clear(disc);
      if (state === 'locked') disc.append(glyph('lock', 'th-icon th-pin-lock'));
      else disc.textContent = String(m.id);
      clear(pips);
      if (state !== 'locked') {
        for (const d of difficulties) {
          const pip = el('i', 'th-pip');
          if (m.cleared[d.id]) pip.classList.add('is-on');
          pips.append(pip);
        }
      }
    }
  }

  function layout(): void {
    const viewW = map.clientWidth;
    const viewH = map.clientHeight;
    if (viewW === 0 || viewH === 0) return;
    const lay = layoutPins(
      missions.map((m) => m.mapPos.lon),
      missions.map((m) => m.mapPos.lat),
      viewW,
      viewH,
      proj,
    );
    mapW = lay.size.w;
    mapH = lay.size.h;
    fitsAll = lay.fits;
    pinBox = lay.box;
    world.style.width = `${mapW}px`;
    world.style.height = `${mapH}px`;

    pins = missions.map((m, i) => ({
      id: m.id,
      x: lay.xs[i],
      y: lay.ys[i],
      ax: proj.x(m.mapPos.lon) * mapW,
      ay: proj.y(m.mapPos.lat) * mapH,
      state: pinState(m),
    }));
    for (const pin of pins) {
      const node = pinEls.get(pin.id);
      if (node) {
        node.style.left = `${Math.round(pin.x)}px`;
        node.style.top = `${Math.round(pin.y)}px`;
      }
    }
    paint();
    laidOut = true;
  }

  function renderCard(): void {
    const view = ctx.view();
    const m = selected();
    qmPoints.textContent = String(view.pointsAvailable);
    quartermaster.classList.toggle('has-points', view.pointsAvailable > 0);
    armouryMedals.textContent = String(view.medals ?? view.pointsAvailable);
    armoury.classList.toggle('has-points', (view.armoury ?? []).some((a) => a.canBuy));
    if (!m) return;
    const state = pinState(m);
    card.dataset.state = state;
    cardNo.textContent = `No. ${m.id}/${missions.length}`;
    cardStamp.textContent = state === 'locked' ? 'Locked' : state === 'cleared' ? 'Cleared' : 'Orders in';
    cardStamp.dataset.state = state;
    setStencil(cardTitle, m.title);
    cardPlace.textContent = m.location;
    cardDate.textContent = m.date;
    cardObjective.textContent = m.unlocked ? m.objective : 'Clear the previous mission to receive these orders.';
    clear(cardPips);
    for (const d of view.difficulties) {
      const item = el('span', 'th-card-pip');
      const pip = el('i', 'th-pip');
      const done = m.cleared[d.id];
      if (done) pip.classList.add('is-on');
      item.title = done ? `${d.name}: cleared` : `${d.name}: not cleared`;
      add(item, pip, el('span', undefined, d.name));
      cardPips.append(item);
    }
    start.disabled = !m.unlocked;
    const label = start.querySelector('.th-btn-label');
    if (label) label.textContent = m.unlocked ? (state === 'cleared' ? 'Replay' : 'Start') : 'Locked';
  }

  /** The front a mission shows: its own date's line (null for a map without fronts). */
  function frontKey(): string | null {
    return frontOn(mapDef, selected()?.dateIso)?.date ?? null;
  }

  function paint(): void {
    paintedFront = frontKey();
    paintCampaignMap(canvas, mapW, mapH, pins, mapDef, selected()?.dateIso);
    map.dataset.front = paintedFront ?? '';
  }

  function select(id: number, animate: boolean): void {
    ctx.session.missionId = id;
    updatePins();
    renderCard();
    // The front line moves with the selected mission's date.
    if (laidOut && frontKey() !== paintedFront) paint();
    if (laidOut && !fitsAll) centreOn(id, animate);
  }

  function load(): void {
    const view = ctx.view();
    const sameSet = missions.length === view.missions.length && missions.every((m, i) => m.id === view.missions[i].id);
    missions = view.missions;
    if (view.map && view.map !== mapDef) {
      mapDef = view.map;
      proj = projection(mapDef.bounds);
    }
    setStencil(mapTitle, (view.campaignTitle ?? 'Campaign').toUpperCase());
    map.dataset.campaign = view.campaignId ?? '';
    if (!missions.some((m) => m.id === ctx.session.missionId)) {
      // The map opens on the mission last played, if it is still open, else on the next one to do.
      const last = missions.find((m) => m.id === view.lastMission);
      ctx.session.missionId = last && last.unlocked ? last.id : defaultMissionId(missions);
    }
    if (!sameSet) buildPins();
    updatePins();
    renderCard();
  }

  // --- Panning -----------------------------------------------------------
  let dragId = -1;
  let dragging = false;
  let startX = 0;
  let startY = 0;
  let startPanX = 0;
  let startPanY = 0;
  let suppressClick = false;

  map.addEventListener('pointerdown', (ev) => {
    if (dragId !== -1 || (ev.pointerType === 'mouse' && ev.button !== 0)) return;
    if (ev.target instanceof Element && ev.target.closest('.th-map-head')) return;
    dragId = ev.pointerId;
    dragging = false;
    startX = ev.clientX;
    startY = ev.clientY;
    startPanX = panX;
    startPanY = panY;
  });
  map.addEventListener('pointermove', (ev) => {
    if (ev.pointerId !== dragId) return;
    const dx = ev.clientX - startX;
    const dy = ev.clientY - startY;
    if (!dragging) {
      if (Math.hypot(dx, dy) < CAMPAIGN_MAP_VIEW.dragThresholdPx) return;
      dragging = true;
      map.classList.add('is-dragging');
      try {
        map.setPointerCapture(ev.pointerId);
      } catch {
        // The pointer may already be gone; panning still works without capture.
      }
    }
    panX = startPanX + dx;
    panY = startPanY + dy;
    applyPan(false);
  });
  const endDrag = (ev: PointerEvent): void => {
    if (ev.pointerId !== dragId) return;
    dragId = -1;
    if (dragging) {
      dragging = false;
      suppressClick = true;
      map.classList.remove('is-dragging');
      window.setTimeout(() => {
        suppressClick = false;
      }, 0);
    }
  };
  map.addEventListener('pointerup', endDrag);
  map.addEventListener('pointercancel', endDrag);
  // A pan that started on a pin must not also select it.
  map.addEventListener(
    'click',
    (ev) => {
      if (suppressClick) {
        ev.stopPropagation();
        ev.preventDefault();
      }
    },
    true,
  );
  map.addEventListener(
    'wheel',
    (ev) => {
      if (ev.ctrlKey || ev.metaKey) return;
      panX -= ev.deltaX;
      panY -= ev.deltaY;
      applyPan(false);
      ev.preventDefault();
    },
    { passive: false },
  );

  load();

  return {
    el: root,
    mounted() {
      layout();
      settle(false);
    },
    refresh() {
      load();
      layout();
      applyPan(false);
    },
    resize() {
      layout();
      settle(false);
    },
    back() {
      ctx.go(backTo());
    },
    key(ev) {
      const dir = ev.key === 'ArrowRight' || ev.key === 'ArrowDown' ? 1 : ev.key === 'ArrowLeft' || ev.key === 'ArrowUp' ? -1 : 0;
      if (dir === 0 || missions.length === 0) return false;
      const index = missions.findIndex((m) => m.id === ctx.session.missionId);
      const next = missions[Math.min(missions.length - 1, Math.max(0, index + dir))];
      if (next.id !== ctx.session.missionId) {
        ctx.app.uiSound('click');
        select(next.id, true);
      }
      return true;
    },
  };
};
