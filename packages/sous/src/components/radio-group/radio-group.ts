/**
 * RadioGroup, from the approved spec (`./spec.md`): Field composed on a
 * `role="radiogroup"` root, the value its radios read and change through
 * `ctx.owner()` (decision 11), the `name` they share, and the arrow keys,
 * which Sous handles so every browser wraps and Safari reaches the group by
 * Tab. The radios stay Radio instances (`../radio/radio.ts`).
 */

import { createFocusWithin, partEffect, partElement } from '../../dom';
import type { DomPartProps } from '../../dom';
import type { PartProps } from '../../runtime';
import { bindable, defineComponent, event, prop } from '../../runtime';
import { field } from '../field/field';

const flag = (isOn: boolean): string | undefined => (isOn ? '' : undefined);

type Orientation = 'horizontal' | 'vertical';

const NEXT: Readonly<Record<string, number>> = {
  ArrowDown: 1,
  ArrowRight: 1,
  ArrowUp: -1,
  ArrowLeft: -1,
};

export const radioGroup = defineComponent({
  name: 'radio-group',
  parts: ['root', 'label', 'description', 'error'],
  props: {
    value: bindable<string | null>(null, { attribute: false }),
    // Written to every radio, so they form one native group.
    name: prop<string | undefined>(undefined, { type: 'string' }),
    isDisabled: prop(false),
    isReadOnly: prop(false, { attribute: 'readonly' }),
    isRequired: prop(false),
    isInvalid: prop(false),
    orientation: prop<Orientation | undefined>(undefined, { type: 'string' }),
    // A group can't be labelled natively. The element reads the label's tag.
    labelElementType: prop('span', {
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
    const labelling = ctx.use(
      field,
      () => ({
        isInvalid: props.isInvalid(),
        isRequired: props.isRequired(),
        isDisabled: props.isDisabled(),
        labelElementType: props.labelElementType(),
        labelledBy: props.labelledBy(),
        describedBy: props.describedBy(),
      }),
      { parts: { control: 'root' } },
    );
    const focusWithin = createFocusWithin(ctx, {
      part: 'root',
      isDisabled: props.isDisabled,
    });
    ctx.watch(focusWithin.isFocusWithin, (isFocusWithin) => {
      ctx.emit('focusChange', isFocusWithin);
    });

    const name = () => props.name() ?? ctx.ids.root;

    // Until the first change, an uncontrolled group with no default takes
    // the value of the radio that was checked when it linked: the element's
    // markup `checked`, or a click before upgrade.
    const adopted = ctx.state<string | null>(null);
    let isPristine = true;
    const value = (): string | null => {
      const current = props.value.get();
      return isPristine && !props.value.isControlled() && current === null
        ? adopted.get()
        : current;
    };
    const setValue = (next: string | null) => {
      isPristine = false;
      props.value.set(next);
    };

    // Bumped to write the value to every radio again: each reads the group,
    // so a change here re-runs their `connect()`.
    const resync = ctx.state(0);
    const writeAgain = () => resync.set(resync.get() + 1);

    // A controlled change the consumer hasn't accepted once the event's work
    // is done goes back, as in Checkbox: the browser has already checked
    // the new radio and unchecked the old one.
    let isRefusing = false;
    const settle = () => {
      if (!isRefusing) return;
      isRefusing = false;
      writeAgain();
    };
    const settleAfterChange = (input: HTMLInputElement) => {
      const view = input.ownerDocument.defaultView;
      isRefusing = true;
      if (!view) return settle();
      view.addEventListener('change', settle, { once: true });
      // A listener that stops `change` keeps it from the window.
      view.setTimeout(() => {
        view.removeEventListener('change', settle);
        settle();
      });
    };

    /** A radio's `input`: the browser checked it. */
    const select = (item: string, input: HTMLInputElement) => {
      if (props.value.isControlled()) settleAfterChange(input);
      if (value() !== item) setValue(item);
    };

    // The values of the radios linked now, so the group stays reachable by
    // Tab when its value matches none of them.
    const items = ctx.state<readonly string[]>([]);
    const register = (item: string) => {
      items.set([...items.get(), item]);
      return () => {
        const next = [...items.get()];
        next.splice(next.indexOf(item), 1);
        items.set(next);
      };
    };
    /** Tab enters at the selected radio, or at any when none is. */
    const isTabStop = (item: string) => {
      const current = value();
      return (
        current === item || current === null || !items.get().includes(current)
      );
    };

    const adopt = (item: string) => {
      if (
        !isPristine ||
        props.value.isControlled() ||
        props.value.get() !== null ||
        adopted.get() !== null
      ) {
        return;
      }
      adopted.set(item);
      initial = item;
    };

    // Form reset goes back to the value the group mounted with.
    let initial: string | null | undefined;
    ctx.effect(() => {
      initial ??= value();
    });
    partEffect(ctx, 'root', (element) => {
      const form = element.closest('form');
      if (!form) return;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const onReset = (resetEvent: Event) => {
        if (resetEvent.defaultPrevented || initial === undefined) return;
        if (value() !== initial) {
          ctx.batch(() => {
            isRefusing = false;
            setValue(initial!);
          });
        }
        // The native reset runs after this event and checks the radios from
        // their attributes, so the value is written again after it.
        clearTimeout(timer);
        timer = setTimeout(writeAgain);
      };
      form.addEventListener('reset', onReset);
      return () => {
        form.removeEventListener('reset', onReset);
        clearTimeout(timer);
      };
    });

    /** The group's radios in DOM order inside the root. */
    const radios = (root: Element) =>
      Array.from(
        root.querySelectorAll<HTMLInputElement>('input[type="radio"]'),
      ).filter((radio) => radio.name === name());

    // Tab leaves the group from an unselected radio (read-only, or a
    // focusable disabled one). Chromium would stop on the selected radio
    // ahead, so it gives up its tab stop for this one key, as in UI Kit.
    const leaveOnTab = (from: HTMLInputElement, root: Element) => {
      const selected = radios(root).find((radio) => radio.checked);
      if (!selected || selected === from || selected.tabIndex < 0) return;
      const { tabIndex } = selected;
      selected.tabIndex = -1;
      setTimeout(() => {
        if (selected.checked) selected.tabIndex = tabIndex;
      });
    };

    const onKeyDown = (keyEvent: KeyboardEvent) => {
      const from = keyEvent.target as HTMLInputElement;
      const root = partElement(ctx, 'root');
      if (!root || from.localName !== 'input' || from.type !== 'radio') return;
      if (from.name !== name()) return;
      if (keyEvent.altKey || keyEvent.ctrlKey || keyEvent.metaKey) return;
      if (keyEvent.key === 'Tab') return leaveOnTab(from, root);
      let step = NEXT[keyEvent.key];
      if (step === undefined) return;
      keyEvent.preventDefault();
      // Right to left, the horizontal arrows swap, as in React Aria.
      const isHorizontalKey =
        keyEvent.key === 'ArrowLeft' || keyEvent.key === 'ArrowRight';
      const view = root.ownerDocument.defaultView;
      if (
        isHorizontalKey &&
        props.orientation() === 'horizontal' &&
        view?.getComputedStyle(root).direction === 'rtl'
      ) {
        step = -step;
      }
      const enabled = radios(root).filter((radio) => !radio.disabled);
      const index = enabled.indexOf(from);
      if (index < 0 || enabled.length < 2) return;
      const next = enabled.at((index + step) % enabled.length)!;
      next.focus();
      // A native click: `input` and `change` fire, and read-only or a
      // focusable disabled radio cancels it as it would a pointer's.
      next.click();
    };

    return {
      field: labelling,
      isFocusWithin: focusWithin.isFocusWithin,
      isFocusVisible: focusWithin.isFocusVisible,
      value,
      name,
      isSelected: (item: string) => value() === item,
      select,
      adopt,
      register,
      isTabStop,
      /** The group's error, while shown, for each radio's description. */
      errorId: (): string | undefined =>
        labelling.api.isErrorShown() && labelling.api.isRendered('error')
          ? ctx.ids.error
          : undefined,
      handlers: { keydown: onKeyDown },
    };
  },
  expose({ props, api }) {
    return {
      value: api.value(),
      isDisabled: props.isDisabled(),
      isReadOnly: props.isReadOnly(),
      isRequired: props.isRequired(),
      isInvalid: props.isInvalid(),
      isErrorShown: api.field.state().isErrorShown,
      isFocusWithin: api.isFocusWithin(),
      isFocusVisible: api.isFocusVisible(),
    };
  },
  connect({ props, api }) {
    const { root, control, ...parts } = api.field.connect();
    const isReadOnly = props.isReadOnly();
    const orientation = props.orientation();
    // Every part, so the box around the group and its label can be styled.
    const state = {
      'data-readonly': flag(isReadOnly),
      'data-focus-within': flag(api.isFocusWithin()),
      'data-focus-visible': flag(api.isFocusVisible()),
      'data-orientation': orientation,
    };
    const withState = (part: PartProps): PartProps => ({
      ...part,
      attrs: { ...part.attrs, ...state },
    });
    const rootPart: DomPartProps = {
      attrs: {
        ...root.attrs,
        ...control.attrs,
        ...state,
        role: 'radiogroup',
        'aria-disabled': props.isDisabled() ? 'true' : undefined,
        'aria-readonly': isReadOnly ? 'true' : undefined,
        'aria-orientation': orientation,
      },
      on: api.handlers,
    };
    return {
      root: rootPart,
      label: withState(parts.label),
      description: withState(parts.description),
      error: withState(parts.error),
    };
  },
});
