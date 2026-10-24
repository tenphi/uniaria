/**
 * TextInput, from the composition spec (`../composition.md`): a native
 * `<input>` or `<textarea>` with TextField's value handling, moved here so
 * every text control shares it. The value is uncontrolled, or controlled and
 * buffered as Cube UI Kit's is; it is never written mid-composition, goes
 * back to its default on a form reset, and is written again after the
 * native reset. Hover and focus come with it. It has no labelling: the
 * behavior around it (TextField, NumberField, Autocomplete, a consumer's)
 * names it, and maps its `root` part onto its own input.
 */

import { createFocus, createHover, mergeHandlers, partEffect } from '../../dom';
import type { DomPartProps } from '../../dom';
import { bindable, defineBehavior, event, prop } from '../../runtime';

const flag = (isOn: boolean): string | undefined => (isOn ? '' : undefined);

export const textInput = defineBehavior({
  name: 'text-input',
  parts: ['root'],
  props: {
    value: bindable(''),
    isDisabled: prop(false),
    isReadOnly: prop(false, { attribute: 'readonly' }),
  },
  events: {
    focusChange: event<boolean>(),
  },
  setup(ctx) {
    const { props } = ctx;
    const hover = createHover(ctx, {
      part: 'root',
      isDisabled: props.isDisabled,
    });
    const focus = createFocus(ctx, 'root');

    // Cube UI Kit's buffered value: while a controlled consumer hasn't
    // answered, the input keeps the typed text (the draft). The values
    // reported and not yet echoed back are pending, oldest first. Composed,
    // the consumer is the composer, which answers at once unless its own
    // consumer controls the value.
    const draft = ctx.state<string | undefined>(undefined);
    let pending: string[] = [];
    /** The text on screen: the draft, else the value. */
    const text = () => draft.get() ?? props.value.get();
    const drop = () => {
      pending = [];
      draft.set(undefined);
    };

    // An echo of a reported value keeps the draft until the latest one
    // arrives; any other value (a transform, a value from outside) wins.
    ctx.watch(
      () => props.value.get(),
      (value) => {
        const index = pending.indexOf(value);
        if (index === -1) return drop();
        pending = pending.slice(index + 1);
        if (pending.length === 0) draft.set(undefined);
      },
    );

    // A value the consumer never accepted goes back on blur.
    ctx.watch(focus.isFocused, (isFocused) => {
      if (!isFocused) drop();
      ctx.emit('focusChange', isFocused);
    });

    // Writing the value mid-composition breaks the IME, so it waits.
    const isComposing = ctx.state(false);

    // Bumped to write the value again where the element may differ: after
    // the native reset, and after a composer refuses an edit.
    const resync = ctx.state(0);
    const writeAgain = () => resync.set(resync.get() + 1);

    const onInput = (event: Event) => {
      const typed = (event.target as HTMLInputElement).value;
      if (props.value.isControlled()) {
        pending.push(typed);
        draft.set(typed);
      }
      props.value.set(typed);
    };

    // Form reset goes back to the default, as a native field does: an
    // uncontrolled input follows defaultValue again, even one set after
    // mount; a controlled one asks for it, or without one for the value it
    // mounted with, as React Aria's does. Composed and controlled, the
    // composer resets it, and `reset()` does nothing (composition spec, Who
    // resets a form value).
    let initial: string | undefined;
    partEffect(ctx, 'root', (element) => {
      initial ??= props.value.get();
      const form = (element as HTMLInputElement).form;
      if (!form) return;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const onReset = (resetEvent: Event) => {
        if (resetEvent.defaultPrevented) return;
        ctx.batch(() => {
          drop();
          props.value.reset({ fallback: initial });
        });
        // The native reset runs after this event and puts back the value
        // attribute, so the value is written again after it.
        clearTimeout(timer);
        timer = setTimeout(writeAgain);
      };
      form.addEventListener('reset', onReset);
      return () => {
        form.removeEventListener('reset', onReset);
        clearTimeout(timer);
      };
    });

    return {
      text,
      /**
       * Drops the draft and writes the value back at once: for a composer
       * that refuses an edit (NumberField) or settles the text (Combobox).
       */
      revert: () => {
        ctx.batch(() => {
          drop();
          writeAgain();
        });
      },
      isHovered: hover.isHovered,
      isFocused: focus.isFocused,
      isFocusVisible: focus.isFocusVisible,
      isComposing: () => isComposing.get(),
      handlers: mergeHandlers(hover.handlers, focus.handlers, {
        input: onInput,
        compositionstart: () => isComposing.set(true),
        compositionend: () => isComposing.set(false),
      }),
    };
  },
  expose({ props, api }) {
    return {
      value: props.value.get(),
      isFocused: api.isFocused(),
      isFocusVisible: api.isFocusVisible(),
      isHovered: api.isHovered(),
      isDisabled: props.isDisabled(),
      isReadOnly: props.isReadOnly(),
    };
  },
  connect({ props, api }) {
    const isDisabled = props.isDisabled();
    const isReadOnly = props.isReadOnly();
    const root: DomPartProps = {
      attrs: {
        'data-hovered': flag(api.isHovered()),
        'data-focused': flag(api.isFocused()),
        'data-focus-visible': flag(api.isFocusVisible()),
        'data-readonly': flag(isReadOnly),
        'data-disabled': flag(isDisabled),
        disabled: flag(isDisabled),
        readonly: flag(isReadOnly),
      },
      on: api.handlers,
      properties: { value: api.isComposing() ? undefined : api.text() },
    };
    return { root };
  },
});
