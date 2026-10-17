import { describe, expect, it } from 'vitest';

import { addDecimal, clamp, snapToStep } from './number';

describe('number', () => {
  it('clamps to the bounds that are set', () => {
    expect(clamp(12, 0, 10)).toBe(10);
    expect(clamp(-3, 0)).toBe(0);
    expect(clamp(-3)).toBe(-3);
  });

  it('snaps to the step counted from the minimum', () => {
    expect(snapToStep(7, 2, undefined, 3)).toBe(8);
    expect(snapToStep(6, 2, undefined, 3)).toBe(5);
    expect(snapToStep(7, undefined, undefined, 5)).toBe(5);
    expect(snapToStep(0.7, undefined, undefined, 0.25)).toBe(0.75);
  });

  it('rounds halfway away from the origin', () => {
    expect(snapToStep(2.5, undefined, undefined, 5)).toBe(5);
    expect(snapToStep(-2.5, undefined, undefined, 5)).toBe(-5);
  });

  it('keeps within the minimum and the last step below the maximum', () => {
    expect(snapToStep(1, 2, 21, 3)).toBe(2);
    expect(snapToStep(21, 2, 21, 3)).toBe(20);
    expect(snapToStep(99, undefined, 21, 5)).toBe(20);
  });

  it('adds in decimal', () => {
    expect(addDecimal(0.1, 0.2)).toBe(0.3);
    expect(addDecimal(1.15, -0.05)).toBe(1.1);
    expect(addDecimal(3, 4)).toBe(7);
  });
});
