import { describe, expect, it } from 'vitest';
import { CallInFold, callInRows } from '../../src/ui/hud/callins';

describe('the call-ins fold', () => {
  it('starts folded and the toggle opens and folds it', () => {
    const f = new CallInFold();
    expect(f.open).toBe(false);
    expect(f.toggle()).toBe(true);
    expect(f.open).toBe(true);
    expect(f.toggle()).toBe(false);
    expect(f.open).toBe(false);
  });

  it('stays open while a call-in is aimed and folds when the call goes out', () => {
    const f = new CallInFold();
    f.toggle();
    expect(f.track(null, false)).toBe(false);
    expect(f.track('artillery', false)).toBe(false);
    expect(f.track('artillery', false)).toBe(false);
    expect(f.open).toBe(true);
    // The tap on the battlefield ends the aim: the call is out.
    expect(f.track(null, false)).toBe(true);
    expect(f.open).toBe(false);
    expect(f.track(null, false)).toBe(false);
  });

  it('stays open when the player cancels the aim, and folds after the next call', () => {
    const f = new CallInFold();
    f.toggle();
    f.track('smoke', false);
    f.noteCancel();
    expect(f.track(null, false)).toBe(false);
    expect(f.open).toBe(true);
    // The cancel is used up: the next aim that ends folds as usual.
    f.track('airStrike', false);
    expect(f.track(null, false)).toBe(true);
    expect(f.open).toBe(false);
  });

  it('stays open when the aim switches straight to another call-in', () => {
    const f = new CallInFold();
    f.toggle();
    f.track('smoke', false);
    expect(f.track('artillery', false)).toBe(false);
    expect(f.open).toBe(true);
    expect(f.track(null, false)).toBe(true);
  });

  it('stays open when a pause breaks off the aim', () => {
    const f = new CallInFold();
    f.toggle();
    f.track('bomber', false);
    expect(f.track(null, true)).toBe(false);
    expect(f.open).toBe(true);
  });

  it('reports nothing when the column was already folded by hand while aiming', () => {
    const f = new CallInFold();
    f.toggle();
    f.track('recon', false);
    f.toggle();
    expect(f.track(null, false)).toBe(false);
    expect(f.open).toBe(false);
  });

  it('reset folds it and forgets the aim', () => {
    const f = new CallInFold();
    f.toggle();
    f.track('fighter', false);
    f.reset();
    expect(f.open).toBe(false);
    f.toggle();
    expect(f.track(null, false)).toBe(false);
    expect(f.open).toBe(true);
  });
});

describe('callInRows', () => {
  it('keeps every button in one column when they fit', () => {
    expect(callInRows(6, 45, 4, 6 * 45 + 5 * 4)).toBe(6);
    expect(callInRows(3, 45, 4, 400)).toBe(3);
  });

  it('balances the columns when they do not fit', () => {
    // 4 fit in 200 px: six buttons go 3 + 3, not 4 + 2.
    expect(callInRows(6, 45, 4, 200)).toBe(3);
    expect(callInRows(5, 45, 4, 200)).toBe(3);
    // Only 2 fit: three columns of two.
    expect(callInRows(6, 45, 4, 100)).toBe(2);
  });

  it('never goes below one row', () => {
    expect(callInRows(6, 45, 4, 10)).toBe(1);
    expect(callInRows(0, 45, 4, 300)).toBe(1);
    expect(callInRows(4, 0, 4, 300)).toBe(4);
  });
});
