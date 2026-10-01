import type { EventBuffer, SimEvent, SimEventType } from './types';

function blankEvent(): SimEvent {
  return {
    type: 'announce',
    side: -1,
    source: 'none',
    unit: -1,
    unitId: -1,
    kind: null,
    weapon: null,
    x: 0,
    row: -1,
    x2: 0,
    row2: -1,
    target: 'none',
    targetIndex: -1,
    value: 0,
    hit: false,
    dir: 0,
    cause: null,
    order: null,
    support: null,
    text: null,
  };
}

/**
 * The pooled event buffer. emit() hands out a record reset to defaults; the
 * caller fills in the fields its event type documents. The pool only grows
 * (and allocates) if one step emits more events than any step before it.
 */
export class EventQueue implements EventBuffer {
  readonly items: SimEvent[] = [];
  count = 0;

  constructor(capacity: number) {
    for (let i = 0; i < capacity; i++) this.items.push(blankEvent());
  }

  clear(): void {
    this.count = 0;
  }

  emit(type: SimEventType): SimEvent {
    if (this.count === this.items.length) this.items.push(blankEvent());
    const e = this.items[this.count++];
    e.type = type;
    e.side = -1;
    e.source = 'none';
    e.unit = -1;
    e.unitId = -1;
    e.kind = null;
    e.weapon = null;
    e.x = 0;
    e.row = -1;
    e.x2 = 0;
    e.row2 = -1;
    e.target = 'none';
    e.targetIndex = -1;
    e.value = 0;
    e.hit = false;
    e.dir = 0;
    e.cause = null;
    e.order = null;
    e.support = null;
    e.text = null;
    return e;
  }
}
