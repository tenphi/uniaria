/**
 * The native constraints a field's control carries, checked without the
 * live control (Form spec, Validation → What a field checks). The binder may
 * not have written the form's value to the control yet, and calling
 * `checkValidity()` there would fire `invalid` at it; so the value goes on
 * a detached control with the same constraints, as React Aria's NumberField
 * checks its range (`references/react-spectrum/packages/react-aria/src/numberfield/useNumberField.ts`).
 * A browser reports `minlength` and `maxlength` only after a user's edit,
 * so lengths are counted here, in UTF-16 code units as HTML counts them.
 */

import type { Issue, MessageKey } from './messages';

/** The kind of control whose empty, required message a field uses. */
export type ControlKind = 'text' | 'checkbox' | 'select' | 'radio';

/** The constraints a detached copy takes from the control. */
const CONSTRAINTS = ['type', 'pattern', 'min', 'max', 'step'] as const;

/** Failures a detached control can report, in the order checked. */
const DETACHED: readonly MessageKey[] = [
  'typeMismatch',
  'patternMismatch',
  'rangeUnderflow',
  'rangeOverflow',
  'stepMismatch',
];

const required = new WeakMap<Document, Map<ControlKind, string>>();

/**
 * The browser's message for an empty, required control of `kind`, read once
 * per document: a lone radio has no group and reports nothing, so it is
 * asked inside a detached form.
 */
export function requiredMessage(doc: Document, kind: ControlKind): string {
  let byKind = required.get(doc);
  if (!byKind) required.set(doc, (byKind = new Map()));
  const known = byKind.get(kind);
  if (known !== undefined) return known;
  let control: HTMLInputElement | HTMLSelectElement;
  if (kind === 'select') {
    const select = doc.createElement('select');
    select.append(doc.createElement('option'));
    control = select;
  } else {
    const input = doc.createElement('input');
    input.type = kind;
    if (kind === 'radio') {
      input.name = 'uni-required';
      doc.createElement('form').append(input);
    }
    control = input;
  }
  control.required = true;
  const message = control.validationMessage;
  byKind.set(kind, message);
  return message;
}

/** Whether `element` is a native text control: an input or a textarea. */
export function isTextControl(
  element: unknown,
): element is HTMLInputElement | HTMLTextAreaElement {
  if (!element || typeof element !== 'object') return false;
  const { localName } = element as Element;
  if (localName === 'textarea') return true;
  if (localName !== 'input') return false;
  const { type } = element as HTMLInputElement;
  return type !== 'checkbox' && type !== 'radio' && type !== 'hidden';
}

/** A length attribute as a number, or `undefined` when unset or invalid. */
function lengthOf(control: Element, attribute: string): number | undefined {
  const raw = control.getAttribute(attribute);
  if (raw === null || !/^\d+$/.test(raw.trim())) return undefined;
  return Number(raw);
}

/**
 * The first native constraint `value` fails on `control`, a text input or
 * a textarea: bad input the browser can't read (only the live control
 * knows), then the constraints written on it, then its lengths. `null` when
 * it passes, or the control is barred from validation.
 */
export function checkControl(
  control: HTMLInputElement | HTMLTextAreaElement,
  value: string,
): Issue | null {
  if (!control.willValidate) return null;
  if ('validity' in control && control.validity.badInput) {
    return { key: 'badInput', message: control.validationMessage };
  }
  if (control.localName === 'input' && value !== '') {
    const copy = control.ownerDocument.createElement('input');
    for (const name of CONSTRAINTS) {
      const attribute = control.getAttribute(name);
      if (attribute !== null) copy.setAttribute(name, attribute);
    }
    copy.value = value;
    const { validity } = copy;
    for (const key of DETACHED) {
      if (!validity[key]) continue;
      const bound = (name: string) => {
        const raw = control.getAttribute(name);
        return raw === null || Number.isNaN(Number(raw))
          ? undefined
          : Number(raw);
      };
      return {
        key,
        message: copy.validationMessage,
        ...(key === 'rangeUnderflow' && bound('min') !== undefined
          ? { min: bound('min') }
          : {}),
        ...(key === 'rangeOverflow' && bound('max') !== undefined
          ? { max: bound('max') }
          : {}),
        ...(key === 'stepMismatch' && bound('step') !== undefined
          ? { step: bound('step') }
          : {}),
      };
    }
  }
  if (value !== '') {
    const min = lengthOf(control, 'minlength');
    const max = lengthOf(control, 'maxlength');
    if (min !== undefined && value.length < min) {
      return { key: 'tooShort', message: '', min };
    }
    if (max !== undefined && value.length > max) {
      return { key: 'tooLong', message: '', max };
    }
  }
  return null;
}

/** A number's range and step, as NumberField checks its own. */
export interface NumberRange {
  readonly min?: number | undefined;
  readonly max?: number | undefined;
  readonly step?: number | undefined;
}

/**
 * The first of `range` that `value` fails, with the browser's message from
 * a detached `type="number"` input, or `null`.
 */
export function checkNumber(
  doc: Document,
  value: number,
  { min, max, step }: NumberRange,
): Issue | null {
  const copy = doc.createElement('input');
  copy.type = 'number';
  if (min !== undefined) copy.min = String(min);
  if (max !== undefined) copy.max = String(max);
  // A step from the minimum, as NumberField steps; none means any.
  copy.step = step === undefined ? 'any' : String(step);
  copy.value = String(value);
  const { validity } = copy;
  if (validity.rangeUnderflow) {
    return { key: 'rangeUnderflow', message: copy.validationMessage, min };
  }
  if (validity.rangeOverflow) {
    return { key: 'rangeOverflow', message: copy.validationMessage, max };
  }
  if (validity.stepMismatch) {
    return { key: 'stepMismatch', message: copy.validationMessage, step };
  }
  return null;
}
