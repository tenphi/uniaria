/*
 * Portions adapted from React Spectrum (react-stately utils/number.ts and
 * numberfield/useNumberFieldState.ts):
 * Copyright 2020 Adobe. All rights reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not
 * use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR REPRESENTATIONS OF ANY KIND, either express or implied. See
 * the License for the specific language governing permissions and limitations
 * under the License.
 */

/**
 * NumberField's arithmetic (`./spec.md`, Value): clamping, snapping to a step
 * counted from the minimum, and adding in decimal, as React Aria's.
 */

export function clamp(value: number, min = -Infinity, max = Infinity): number {
  return Math.min(Math.max(value, min), max);
}

/** Rounds `value` to the decimals `step` has, dropping float error. */
export function roundToStepPrecision(value: number, step: number): number {
  let precision = 0;
  const text = step.toString();
  // `1e-7` has 8 decimals.
  const exponent = text.toLowerCase().indexOf('e-');
  if (exponent > 0) {
    precision = Math.abs(Math.floor(Math.log10(Math.abs(step)))) + exponent;
  } else {
    const point = text.indexOf('.');
    if (point >= 0) precision = text.length - point;
  }
  if (precision === 0) return value;
  const pow = 10 ** precision;
  return Math.round(value * pow) / pow;
}

/**
 * The step nearest `value`, counted from `min` (or 0), halfway rounding away
 * from it; never below `min` nor above the last step at or below `max` (a
 * maximum of 21 with steps of 3 from 2 gives 20).
 */
export function snapToStep(
  value: number,
  min: number | undefined,
  max: number | undefined,
  step: number,
): number {
  const remainder = (value - (min ?? 0)) % step;
  let snapped = roundToStepPrecision(
    Math.abs(remainder) * 2 >= step
      ? value + Math.sign(remainder) * (step - Math.abs(remainder))
      : value - remainder,
    step,
  );
  if (min !== undefined) {
    if (snapped < min) {
      snapped = min;
    } else if (max !== undefined && snapped > max) {
      snapped =
        min + Math.floor(roundToStepPrecision((max - min) / step, step)) * step;
    }
  } else if (max !== undefined && snapped > max) {
    snapped = Math.floor(roundToStepPrecision(max / step, step)) * step;
  }
  return roundToStepPrecision(snapped, step);
}

const decimals = (value: number): number =>
  value.toString().split('.')[1]?.length ?? 0;

/** `a + b` in decimal, so 0.1 + 0.2 is 0.3. */
export function addDecimal(a: number, b: number): number {
  if (Number.isInteger(a) && Number.isInteger(b)) return a + b;
  const pow = 10 ** Math.max(decimals(a), decimals(b));
  return (Math.round(a * pow) + Math.round(b * pow)) / pow;
}
