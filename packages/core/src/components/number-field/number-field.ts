/*
 * Portions adapted from React Spectrum (useNumberField.ts, useSpinButton.ts,
 * useFormattedTextField.ts, useNumberFieldState.ts):
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
 * NumberField, from the approved spec (`./spec.md`): Field composed on a
 * native `<input type="text">`, Button composed twice for the steppers, and
 * `@internationalized/number` to parse and format. Each edit is checked
 * before the browser applies it; the text is committed on blur, on Enter and
 * after a paste that replaces it, and stepped by the arrow and page keys,
 * Home and End, the buttons held down and the wheel. Modelled on React
 * Aria's `useNumberField`
 * (`references/react-spectrum/packages/react-aria/src/numberfield/`).
 */

import { NumberFormatter, NumberParser } from '@internationalized/number';

import {
  announce,
  clearAnnouncer,
  createFocus,
  createHover,
  isAndroid,
  isComposing,
  isIOS,
  isIPhone,
  mergeHandlers,
  partEffect,
  partElement,
} from '../../dom';
import type { DomPartProps, PressEvent } from '../../dom';
import type { PartProps } from '../../runtime';
import { bindable, defineComponent, event, prop } from '../../runtime';
import { button } from '../button/button';
import { field } from '../field/field';
import { linkTooltip, tooltipLink } from '../tooltip/link';
import { addDecimal, clamp, roundToStepPrecision, snapToStep } from './number';

const flag = (isOn: boolean): string | undefined => (isOn ? '' : undefined);

/** Ids joined for an `aria-*` reference; `undefined` when there are none. */
const references = (...ids: (string | undefined)[]): string | undefined =>
  ids.filter(Boolean).join(' ') || undefined;

/** Elements inside the wrapper that keep their own press. */
const CONTROLS =
  'a[href], button, input, select, textarea, label, [contenteditable], [tabindex]';

/** A held button steps after this long, then every `REPEAT` ms. */
const HOLD_DELAY = 400;
const TOUCH_HOLD_DELAY = 600;
const REPEAT = 60;

/** VoiceOver reads a hyphen-minus next to a currency sign as nothing. */
const MINUS = '−';

type Platform = 'iphone' | 'android' | 'ios' | 'other';
type Direction = 1 | -1;

/** A number prop; `NaN` (an attribute that isn't a number) is unset. */
const numberOr = (value: number | undefined): number | undefined =>
  value === undefined || Number.isNaN(value) ? undefined : value;

/** Format options as a key, so a new object with the same options is equal. */
const optionsKey = (options: Intl.NumberFormatOptions): string =>
  JSON.stringify(
    Object.entries(options)
      .filter(([, value]) => value !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : 1)),
  );

/** A BCP 47 tag `Intl` takes, or `undefined`. */
function canonicalLocale(tag: string | undefined): string | undefined {
  if (!tag) return undefined;
  try {
    return Intl.getCanonicalLocales(tag)[0];
  } catch {
    return undefined;
  }
}

/**
 * The text an edit would leave (React Aria's `useFormattedTextField`):
 * `undefined` for an edit that is always allowed, `null` for one whose result
 * can't be known.
 */
function nextText(
  input: HTMLInputElement,
  event: InputEvent,
): string | null | undefined {
  const { value } = input;
  const start = input.selectionStart ?? value.length;
  const end = input.selectionEnd ?? value.length;
  switch (event.inputType) {
    case 'historyUndo':
    case 'historyRedo':
    case 'insertLineBreak':
      return undefined;
    case 'deleteContent':
    case 'deleteByCut':
    case 'deleteByDrag':
      return value.slice(0, start) + value.slice(end);
    case 'deleteContentForward':
      return start === end
        ? value.slice(0, start) + value.slice(end + 1)
        : value.slice(0, start) + value.slice(end);
    case 'deleteContentBackward':
      return start === end
        ? value.slice(0, Math.max(start - 1, 0)) + value.slice(start)
        : value.slice(0, start) + value.slice(end);
    case 'deleteSoftLineBackward':
    case 'deleteHardLineBackward':
      return value.slice(start);
    default:
      return event.data === null
        ? null
        : value.slice(0, start) + event.data + value.slice(end);
  }
}

export const numberField = defineComponent({
  name: 'number-field',
  parts: [
    'root',
    'wrapper',
    'label',
    'input',
    'increment',
    'decrement',
    'hiddenInput',
    'description',
    'error',
  ],
  links: [tooltipLink],
  props: {
    // `null` when empty. The element adopts the input's text as the default;
    // it arrives as a string, which `committed()` parses for the locale.
    value: bindable<number | null>(null, {
      type: 'number',
      adopt: { part: 'input', property: 'value' },
    }),
    minValue: prop<number | undefined>(undefined, { type: 'number' }),
    maxValue: prop<number | undefined>(undefined, { type: 'number' }),
    step: prop<number | undefined>(undefined, { type: 'number' }),
    pageStep: prop<number | undefined>(undefined, { type: 'number' }),
    formatOptions: prop<Intl.NumberFormatOptions>({}, { attribute: false }),
    locale: prop<string | undefined>(undefined, { type: 'string' }),
    isWheelDisabled: prop(false),
    isDisabled: prop(false),
    isReadOnly: prop(false, { attribute: 'readonly' }),
    isRequired: prop(false),
    isInvalid: prop(false),
    // The buttons' whole names; without them "Increase" and "Decrease"
    // followed by the field's label (Resolved questions 2).
    incrementLabel: prop<string | undefined>(undefined, { type: 'string' }),
    decrementLabel: prop<string | undefined>(undefined, { type: 'string' }),
    // Without it, "Number field" in English and none in other languages, so
    // a screen reader says its own role word there.
    roleDescription: prop<string | undefined>(undefined, { type: 'string' }),
    // The element adopts the input's id on upgrade.
    inputId: prop<string | undefined>(undefined, {
      attribute: false,
      adopt: { part: 'input', attribute: 'id' },
    }),
    // The element reads the label's tag instead of taking an attribute.
    labelElementType: prop('label', {
      attribute: false,
      adopt: { part: 'label', tag: true },
    }),
    labelledBy: prop<string | undefined>(undefined, { type: 'string' }),
    describedBy: prop<string | undefined>(undefined, { type: 'string' }),
  },
  events: {
    focusChange: event<boolean>(),
  },
  setup(ctx) {
    const { props } = ctx;
    const min = () => numberOr(props.minValue());
    const max = () => numberOr(props.maxValue());
    const step = () => {
      const value = numberOr(props.step());
      return value !== undefined && value > 0 ? value : undefined;
    };

    // The input's language and the phone it is on, once it is attached. The
    // server formats for `en-US` and writes the keyboard Android would get.
    const inherited = ctx.state('en-US');
    const platform = ctx.state<Platform | undefined>(undefined);
    partEffect(ctx, 'input', (input) => {
      const view = input.ownerDocument.defaultView;
      inherited.set(
        canonicalLocale(input.closest('[lang]')?.getAttribute('lang') ?? '') ??
          canonicalLocale(view?.navigator.language) ??
          'en-US',
      );
      if (!view) return;
      platform.set(
        isIPhone(view)
          ? 'iphone'
          : isAndroid(view)
            ? 'android'
            : isIOS(view)
              ? 'ios'
              : 'other',
      );
    });
    const locale = () => canonicalLocale(props.locale()) ?? inherited.get();

    // Digits typed in another numbering system stay in it (React Aria).
    const typedSystem = ctx.state<string | undefined>(undefined);
    const options = ctx.memo(
      () => [optionsKey(props.formatOptions())] as const,
      (key): Intl.NumberFormatOptions =>
        Object.fromEntries(JSON.parse(key) as [string, unknown][]),
    );
    // A copy each: the parser writes into the options it is given.
    const parser = ctx.memo(
      () => [locale(), options()] as const,
      (tag, formatOptions) => new NumberParser(tag, { ...formatOptions }),
    );
    const formatter = ctx.memo(
      () => [locale(), options(), typedSystem.get()] as const,
      (tag, formatOptions, numberingSystem) =>
        new NumberFormatter(
          tag,
          numberingSystem
            ? { ...formatOptions, numberingSystem }
            : formatOptions,
        ),
    );
    const resolved = ctx.memo(
      () => [formatter()] as const,
      (current) => current.resolvedOptions(),
    );
    const format = (value: number | null) =>
      value === null ? '' : formatter().format(value);
    const isPartial = (text: string) =>
      parser().isValidPartialNumber(text, min(), max());

    // The committed value. Adopted markup text is parsed here, so it
    // follows the locale the input turns out to have.
    const committed = ctx.memo(
      () => [props.value.get() as unknown, parser()] as const,
      (raw, current) => {
        const value =
          typeof raw === 'string'
            ? raw.trim()
              ? current.parse(raw)
              : NaN
            : raw;
        return typeof value === 'number' && !Number.isNaN(value) ? value : null;
      },
    );
    // The text typed since the last commit; without one the input shows the
    // committed value. A new value, locale or format shows it again.
    const draft = ctx.state<string | undefined>(undefined);
    const text = () => draft.get() ?? format(committed());
    ctx.watch(committed, () => draft.set(undefined));
    ctx.watch(options, () => draft.set(undefined));
    ctx.watch(locale, () => {
      ctx.batch(() => {
        draft.set(undefined);
        typedSystem.set(undefined);
      });
    });
    const typed = ctx.memo(
      () => [text(), parser()] as const,
      (current, currentParser) =>
        current.trim() ? currentParser.parse(current) : NaN,
    );

    // A step is `step`, else 1, or 1% for percentages; a page 10 steps.
    const stepSize = () =>
      step() ?? (resolved().style === 'percent' ? 0.01 : 1);
    const pageSize = () => {
      const page = numberOr(props.pageStep());
      return page !== undefined && page > 0
        ? page
        : roundToStepPrecision(stepSize() * 10, stepSize());
    };
    const snap = (value: number) => {
      const size = step();
      return size === undefined
        ? clamp(value, min(), max())
        : snapToStep(value, min(), max(), size);
    };

    /** Whether a step from the typed text would change it (React Aria). */
    const canStep = (direction: Direction) => {
      if (props.isDisabled() || props.isReadOnly()) return false;
      const value = typed();
      const bound = direction > 0 ? max() : min();
      if (Number.isNaN(value) || bound === undefined) return true;
      const snapped = snapToStep(value, min(), max(), stepSize());
      if (direction > 0 ? snapped > value : snapped < value) return true;
      const next = addDecimal(value, direction * stepSize());
      return direction > 0 ? next <= bound : next >= bound;
    };

    /** Where a step goes from the typed text (React Aria's `safeNextStep`). */
    const target = (direction: Direction, size: number) => {
      const value = typed();
      const unit = stepSize();
      if (Number.isNaN(value)) {
        const start = (direction > 0 ? min() : max()) ?? 0;
        return snapToStep(start, min(), max(), unit);
      }
      // Off the step, the next step that way comes first.
      const snapped = snapToStep(value, min(), max(), unit);
      if (
        size === unit &&
        (direction > 0 ? snapped > value : snapped < value)
      ) {
        return snapped;
      }
      return snapToStep(
        addDecimal(value, direction * size),
        min(),
        max(),
        unit,
      );
    };

    const say = (message: string) => {
      const document = partElement(ctx, 'input')?.ownerDocument;
      if (!document) return;
      clearAnnouncer('assertive', document);
      announce(message.replace('-', MINUS), { document });
    };

    /**
     * Shows `value` and reports it, for a commit or a step, and announces
     * the new text when it isn't what was typed.
     */
    const settle = (value: number | null, before: string) => {
      const after = format(value);
      ctx.batch(() => {
        draft.set(undefined);
        if (!Object.is(value, committed())) props.value.set(value);
      });
      if (after !== before) say(after);
    };

    /** Commits typed or pasted text (spec → Value, Commit). */
    const commit = (input: string) => {
      if (!input.trim()) return settle(null, input);
      const value = parser().parse(input);
      if (Number.isNaN(value)) return settle(committed(), input);
      // Rounded to the precision the format shows, so the value is what
      // the field displays.
      settle(parser().parse(format(snap(value))), input);
    };
    // Untouched text is never judged: a consumer's value stays as given.
    const commitDraft = () => {
      const current = draft.get();
      if (current !== undefined) commit(current);
    };

    const stepBy = (direction: Direction, size: number) => {
      if (!canStep(direction)) return false;
      settle(target(direction, size), text());
      return true;
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || isComposing(event)) return;
      if (props.isDisabled() || props.isReadOnly()) return;
      // Enter commits and still submits the form.
      if (event.key === 'Enter') return commitDraft();
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
        return;
      }
      switch (event.key) {
        case 'ArrowUp':
          stepBy(1, stepSize());
          break;
        case 'ArrowDown':
          stepBy(-1, stepSize());
          break;
        case 'PageUp':
          stepBy(1, pageSize());
          break;
        case 'PageDown':
          stepBy(-1, pageSize());
          break;
        case 'Home': {
          // Without that bound the caret moves, as in any text box.
          const low = min();
          if (low === undefined) return;
          settle(low, text());
          break;
        }
        case 'End': {
          const high = max();
          if (high === undefined) return;
          settle(snapToStep(high, min(), max(), stepSize()), text());
          break;
        }
        default:
          return;
      }
      event.preventDefault();
    };

    // Writing the value mid-composition breaks the IME, so it waits. An
    // invalid composition is undone at its end: Chromium doesn't let one be
    // cancelled (crbug 1022204).
    const isComposingText = ctx.state(false);
    let beforeComposition:
      { value: string; start: number | null; end: number | null } | undefined;
    const type = (value: string) => {
      ctx.batch(() => {
        draft.set(value);
        if (value.trim()) {
          typedSystem.set(parser().getNumberingSystem(value));
        }
      });
    };
    const onInput = (event: Event) => {
      const { value } = event.target as HTMLInputElement;
      // Anything else is put back by the next write of the text.
      if (isPartial(value)) type(value);
    };
    const onCompositionStart = (event: CompositionEvent) => {
      const input = event.target as HTMLInputElement;
      beforeComposition = {
        value: input.value,
        start: input.selectionStart,
        end: input.selectionEnd,
      };
      isComposingText.set(true);
    };
    const onCompositionEnd = (event: CompositionEvent) => {
      const input = event.target as HTMLInputElement;
      isComposingText.set(false);
      if (isPartial(input.value)) return type(input.value);
      if (!beforeComposition) return;
      const { value, start, end } = beforeComposition;
      input.value = value;
      input.setSelectionRange(start, end);
      type(value);
    };

    // A paste over all the text is committed at once, so pasting
    // `$1,234.50` works though its partial steps wouldn't (React Aria).
    const onPaste = (event: ClipboardEvent) => {
      if (event.defaultPrevented) return;
      if (props.isDisabled() || props.isReadOnly()) return;
      const input = event.target as HTMLInputElement;
      const selected = (input.selectionEnd ?? 0) - (input.selectionStart ?? 0);
      if (selected !== input.value.length) return;
      event.preventDefault();
      const pasted = event.clipboardData?.getData('text/plain').trim() ?? '';
      if (pasted) typedSystem.set(parser().getNumberingSystem(pasted));
      commit(pasted);
    };

    // Each edit is checked before the browser applies it.
    partEffect(ctx, 'input', (element) => {
      const input = element as HTMLInputElement;
      const onBeforeInput = (event: InputEvent) => {
        const next = nextText(input, event);
        if (next === undefined) return;
        if (next === null || !isPartial(next)) event.preventDefault();
      };
      input.addEventListener('beforeinput', onBeforeInput);
      return () => input.removeEventListener('beforeinput', onBeforeInput);
    });

    const isFocusWithin = (input: HTMLElement) => {
      const active = input.ownerDocument.activeElement;
      return (
        active !== null &&
        (active === input ||
          active === partElement(ctx, 'increment') ||
          active === partElement(ctx, 'decrement'))
      );
    };

    // The wheel steps while focus is in the field and the pointer over the
    // input; up increments, as Chromium's number input. React's wheel
    // handlers are passive, so the listener is native.
    partEffect(ctx, 'input', (input) => {
      const onWheel = (event: WheelEvent) => {
        if (props.isWheelDisabled() || props.isDisabled()) return;
        if (props.isReadOnly() || !isFocusWithin(input)) return;
        // A pinch zoom, or a mostly horizontal scroll.
        if (event.ctrlKey) return;
        if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
        event.preventDefault();
        stepBy(event.deltaY < 0 ? 1 : -1, stepSize());
      };
      input.addEventListener('wheel', onWheel, { passive: false });
      return () => input.removeEventListener('wheel', onWheel);
    });

    // Press and hold (React Aria's `useSpinButton`): a step at once, then
    // after 400 ms one every 60 ms. A touch steps nothing at once, repeats
    // after 600 ms, and steps once on release if it never repeated.
    let timer: ReturnType<typeof setTimeout> | undefined;
    let isHeld = false;
    let didRepeat = false;
    const release = () => {
      clearTimeout(timer);
      timer = undefined;
      isHeld = false;
    };
    const repeat = (direction: Direction, delay: number) => {
      timer = setTimeout(() => {
        if (!stepBy(direction, stepSize())) return release();
        didRepeat = true;
        repeat(direction, REPEAT);
      }, delay);
    };
    ctx.effect(() => release);

    // The input keeps focus, so a phone's keyboard stays open. Otherwise a
    // mouse press focuses the input, and a touch or screen-reader press the
    // button, so no keyboard opens and the reading position stays.
    const focusOnPress = (event: PressEvent) => {
      const input = partElement(ctx, 'input');
      if (!input || input.ownerDocument.activeElement === input) return;
      if (event.pointerType === 'mouse') input.focus();
      else (event.target as HTMLElement).focus();
    };
    const stepper = (direction: Direction, part: 'increment' | 'decrement') =>
      ctx.use(
        button,
        () => ({
          isDisabled: !canStep(direction),
          isFocusableWhenDisabled: true,
          shouldExcludeFromTabOrder: true,
          shouldPreventFocusOnPress: true,
          onPressStart: (event: PressEvent) => {
            focusOnPress(event);
            release();
            isHeld = true;
            didRepeat = false;
            if (event.pointerType === 'touch') {
              return repeat(direction, TOUCH_HOLD_DELAY);
            }
            if (stepBy(direction, stepSize())) repeat(direction, HOLD_DELAY);
          },
          onPressEnd: release,
          onPress: (event: PressEvent) => {
            if (event.pointerType === 'touch' && !didRepeat) {
              stepBy(direction, stepSize());
            }
          },
        }),
        { parts: { root: part } },
      );
    const increment = stepper(1, 'increment');
    const decrement = stepper(-1, 'decrement');
    // A long touch opens no context menu over a held button.
    const onStepperContextMenu = (event: MouseEvent) => {
      if (isHeld) event.preventDefault();
    };

    // Hover, focus and typing on the input (Tooltip spec, Resolved
    // questions 2): a key closes the tooltip.
    const tooltip = linkTooltip(ctx, { hover: 'input', focus: 'input' });
    const labelling = ctx.use(
      field,
      () => ({
        isInvalid: props.isInvalid(),
        isRequired: props.isRequired(),
        isDisabled: props.isDisabled(),
        controlId: props.inputId(),
        labelElementType: props.labelElementType(),
        labelledBy:
          [props.labelledBy(), tooltip.labelledBy()]
            .filter(Boolean)
            .join(' ') || undefined,
        describedBy:
          [props.describedBy(), tooltip.describedBy()]
            .filter(Boolean)
            .join(' ') || undefined,
      }),
      { parts: { control: 'input' } },
    );
    const hover = createHover(ctx, {
      part: 'input',
      isDisabled: props.isDisabled,
    });
    const focus = createFocus(ctx, 'input');
    ctx.watch(focus.isFocused, (isFocused) => {
      ctx.emit('focusChange', isFocused);
    });

    // Form reset goes back to the value the field mounted with, its
    // defaultValue when uncontrolled, as TextField's does.
    let initial: number | null | undefined;
    const resync = ctx.state(0);
    partEffect(ctx, 'input', (element) => {
      if (initial === undefined) initial = committed();
      const form = (element as HTMLInputElement).form;
      if (!form) return;
      let resyncTimer: ReturnType<typeof setTimeout> | undefined;
      const onReset = (event: Event) => {
        if (event.defaultPrevented) return;
        ctx.batch(() => {
          draft.set(undefined);
          if (!Object.is(initial, committed())) props.value.set(initial!);
        });
        // The native reset runs after this event and puts back the value
        // attribute, so the text is written again after it.
        clearTimeout(resyncTimer);
        resyncTimer = setTimeout(() => resync.set(resync.get() + 1));
      };
      form.addEventListener('reset', onReset);
      return () => {
        form.removeEventListener('reset', onReset);
        clearTimeout(resyncTimer);
      };
    });

    // The wrapper draws the box around the input and the buttons, so a
    // press on it outside any control focuses the input.
    const focusInput = (event: MouseEvent) => {
      const input = partElement(ctx, 'input');
      const wrapper = partElement(ctx, 'wrapper');
      if (!input || !wrapper || event.button !== 0 || props.isDisabled()) {
        return;
      }
      const control = (event.target as Element).closest(CONTROLS);
      if (control && wrapper.contains(control)) return;
      event.preventDefault();
      input.focus();
    };

    /** The phone keyboard with what can be typed (spec → Keyboard). */
    const inputMode = () => {
      const low = min();
      const hasNegative = low === undefined || low < 0;
      const hasDecimals = (resolved().maximumFractionDigits ?? 0) > 0;
      switch (platform.get()) {
        case 'iphone':
          // An iPhone's number keyboards have no minus sign.
          return hasNegative ? 'text' : hasDecimals ? 'decimal' : 'numeric';
        case 'android':
        case undefined:
          // Android's numeric keyboard has a minus sign; decimal has none.
          return !hasNegative && hasDecimals ? 'decimal' : 'numeric';
        default:
          return 'numeric';
      }
    };

    return {
      field: labelling,
      increment,
      decrement,
      committed,
      text,
      canStep,
      inputMode,
      isEnglish: () => locale().split('-')[0] === 'en',
      platform: () => platform.get(),
      isHovered: hover.isHovered,
      isFocused: focus.isFocused,
      isFocusVisible: focus.isFocusVisible,
      isComposing: () => isComposingText.get(),
      focusInput,
      onStepperContextMenu,
      handlers: mergeHandlers(hover.handlers, focus.handlers, {
        keydown: onKeyDown,
        input: onInput,
        paste: onPaste,
        focusout: commitDraft,
        compositionstart: onCompositionStart,
        compositionend: onCompositionEnd,
      }),
    };
  },
  expose({ props, api }) {
    return {
      value: api.committed(),
      canIncrement: api.canStep(1),
      canDecrement: api.canStep(-1),
      isFocused: api.isFocused(),
      isFocusVisible: api.isFocusVisible(),
      isHovered: api.isHovered(),
      isDisabled: props.isDisabled(),
      isReadOnly: props.isReadOnly(),
      isRequired: props.isRequired(),
      isInvalid: props.isInvalid(),
      isErrorShown: api.field.state().isErrorShown,
    };
  },
  connect({ props, ids, api }) {
    const { control, ...parts } = api.field.connect();
    const isDisabled = props.isDisabled();
    const isReadOnly = props.isReadOnly();
    // Every field part, so the box, the label and the messages can be styled.
    const state = {
      'data-hovered': flag(api.isHovered()),
      'data-focused': flag(api.isFocused()),
      'data-focus-visible': flag(api.isFocusVisible()),
      'data-readonly': flag(isReadOnly),
    };
    const withState = (part: PartProps): PartProps => ({
      ...part,
      attrs: { ...part.attrs, ...state },
    });
    const platform = api.platform();
    const isApple = platform === 'iphone' || platform === 'ios';
    const roleDescription =
      props.roleDescription() ?? (api.isEnglish() ? 'Number field' : undefined);
    const input: DomPartProps = {
      attrs: {
        ...control.attrs,
        ...state,
        type: 'text',
        inputmode: api.inputMode(),
        autocomplete: 'off',
        autocorrect: 'off',
        spellcheck: 'false',
        // Left off on iOS, so VoiceOver reads the required state.
        'aria-roledescription': isApple ? undefined : roleDescription,
        disabled: flag(isDisabled),
        readonly: flag(isReadOnly),
      },
      on: api.handlers,
      properties: { value: api.isComposing() ? undefined : api.text() },
    };

    // A name the consumer passes is the whole name, so a translation can put
    // the label anywhere ("Menge erhöhen"). The English default is followed
    // by the field's label, by reference (Resolved questions 2).
    const labelledBy = references(
      api.field.api.isRendered('label') ? parts.label.attrs.id : undefined,
      props.labelledBy(),
    );
    const stepper = (
      composed: typeof api.increment,
      id: string,
      label: string | undefined,
      fallback: string,
    ): DomPartProps => {
      const root = composed.connect().root as DomPartProps;
      return {
        ...root,
        attrs: {
          ...root.attrs,
          id,
          'aria-label': label ?? fallback,
          'aria-labelledby':
            label === undefined && labelledBy
              ? `${id} ${labelledBy}`
              : undefined,
          'aria-controls': control.attrs.id,
        },
        on: mergeHandlers(root.on ?? {}, {
          contextmenu: api.onStepperContextMenu,
        }),
      };
    };
    const value = api.committed();

    return {
      root: withState(parts.root),
      // The box around the input and the buttons, with Field's state
      // attributes as on the root.
      wrapper: {
        attrs: { ...parts.root.attrs, ...state },
        on: { mousedown: api.focusInput },
      } satisfies DomPartProps,
      label: withState(parts.label),
      input,
      increment: stepper(
        api.increment,
        ids.increment,
        props.incrementLabel(),
        'Increase',
      ),
      decrement: stepper(
        api.decrement,
        ids.decrement,
        props.decrementLabel(),
        'Decrease',
      ),
      hiddenInput: {
        attrs: { type: 'hidden', disabled: flag(isDisabled) },
        properties: { value: value === null ? '' : String(value) },
      },
      description: withState(parts.description),
      error: withState(parts.error),
    };
  },
});
