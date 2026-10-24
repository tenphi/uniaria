/**
 * Combobox, from the approved spec (`./spec.md`), built on the composition
 * spec's Autocomplete (`../composition.md`): Popover and Autocomplete in
 * popup mode composed. Autocomplete is the input with its label, the
 * filtering, the keys, the highlight, the button and the list; Popover holds
 * the list over the page, non-modal, and leaves focus in the input on open
 * (Resolved questions 1 and 10). Combobox adds the value: the text a value
 * shows, how the typed text settles into a value (Selection), Escape
 * reverting it, the hidden input and the form reset.
 *
 * Its state is the open flag, the text and the value: bindables and cells,
 * with no statechart (Resolved questions 15).
 */

import type { ListCollection } from '../../collections';
import {
  isComposing,
  isDevelopment,
  mergeHandlers,
  partEffect,
  partElement,
  warn,
} from '../../dom';
import type { DomHandlers, DomPartProps, PositionArea } from '../../dom';
import type { PartProps } from '../../runtime';
import { bindable, defineBehavior, event, prop } from '../../runtime';
import { autocomplete } from '../autocomplete/autocomplete';
import type {
  AutocompleteFilter,
  AutocompletePopupTrigger,
} from '../autocomplete/autocomplete';
import { renderedKeysChange, virtualProps } from '../listbox/virtual-list';
import { popover } from '../popover/popover';
import { optionTooltipLink } from '../tooltip/link';

/** What opens the list besides the button and the arrows (Props). */
export type ComboboxPopoverTrigger = AutocompletePopupTrigger;

/**
 * Whether an option's text matches the typed text, trimmed. `item` is the
 * item as `items` holds it (composition spec, Autocomplete).
 */
export type ComboboxFilter = AutocompleteFilter;

const flag = (isOn: boolean): string | undefined => (isOn ? '' : undefined);

const isSameKeys = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((key, index) => key === b[index]);

const defaultOptionCount = (count: number): string =>
  count === 1 ? '1 option available' : `${count} options available`;

export const combobox = defineBehavior({
  name: 'combobox',
  parts: [
    'root',
    'label',
    'anchor',
    'input',
    'button',
    'popover',
    'arrow',
    'scroller',
    'list',
    'empty',
    'description',
    'error',
    'hiddenInput',
  ],
  itemParts: [
    'option',
    'optionLabel',
    'optionDescription',
    'optionExtras',
    'group',
    'groupLabel',
  ],
  // One tooltip for every option (items spec), which Autocomplete drives.
  links: [optionTooltipLink],
  props: {
    // Listbox's. The element reads them from its option and group parts
    // while the consumer sets none.
    items: prop<readonly unknown[]>([], {
      attribute: false,
      adopt: { items: { item: 'option', section: 'group' } },
    }),
    getKey: prop<((item: never) => string) | undefined>(undefined, {
      attribute: false,
    }),
    getTextValue: prop<((item: never) => string) | undefined>(undefined, {
      attribute: false,
    }),
    isItemDisabled: prop<((item: never) => boolean) | undefined>(undefined, {
      attribute: false,
    }),
    getChildren: prop<
      ((item: never) => readonly unknown[] | undefined) | undefined
    >(undefined, { attribute: false }),
    disabledKeys: prop<readonly string[]>([], { type: 'json' }),
    value: bindable<readonly string[]>([], { attribute: false }),
    // Unset, the text is the value's (`defaultInputValue` seeds it).
    inputValue: bindable(undefined as string | undefined, {
      attribute: false,
      event: 'inputChange',
    }),
    isOpen: bindable(false),
    popoverTrigger: prop<ComboboxPopoverTrigger>('input'),
    // `undefined` is the built-in "contains"; `false` filters nothing (a
    // `null` prop reads as unset).
    filter: prop<ComboboxFilter | false | undefined>(undefined, {
      attribute: false,
    }),
    allowsCustomValue: prop(false),
    isDisabled: prop(false),
    isReadOnly: prop(false, { attribute: 'readonly' }),
    isRequired: prop(false),
    isInvalid: prop(false),
    shouldFocusWrap: prop(false),
    positionArea: prop<PositionArea>('block-end span-inline-end'),
    positionTryFallbacks: prop('flip-block, flip-inline'),
    locale: prop<string | undefined>(undefined, { type: 'string' }),
    buttonLabel: prop('Show suggestions'),
    optionCountAnnouncement: prop<(count: number) => string>(
      defaultOptionCount,
      { attribute: false },
    ),
    // Field's `controlId`: the input's id where it has none of its own.
    inputId: prop<string | undefined>(undefined, {
      attribute: false,
      idOf: 'input',
    }),
    // Listbox's: the list's id where it has none of its own.
    listId: prop<string | undefined>(undefined, {
      attribute: false,
      idOf: 'list',
    }),
    // The element reads the label's tag.
    labelElementType: prop('label', {
      attribute: false,
      adopt: { part: 'label', tag: true },
    }),
    labelledBy: prop<string | undefined>(undefined, { type: 'string' }),
    describedBy: prop<string | undefined>(undefined, { type: 'string' }),
    // Listbox's virtualization, forwarded to the list.
    ...virtualProps,
  },
  // The only members of setup()'s result consumers may call (spec,
  // Actions).
  actions: ['open', 'close'],
  events: {
    focusChange: event<boolean>(),
    renderedKeysChange,
  },
  setup(ctx) {
    const { props } = ctx;
    const value = props.value;
    const isOpen = props.isOpen;
    const inputElement = () =>
      partElement(ctx, 'input') as HTMLInputElement | null;

    // Before Autocomplete, so the popover is shown before an option scrolls
    // into view: watchers run in the order they're composed.
    const layer = ctx.use(
      popover,
      () => ({
        isOpen: isOpen.get(),
        onOpenChange: (next: boolean) => isOpen.set(next),
        isNonModal: true,
        shouldFocusOnOpen: false,
        shouldRestoreFocus: false,
        isDisabled: props.isDisabled(),
        // The input is Popover's trigger; a press on the button toggles the
        // list through the button.
        shouldCloseOnInteractOutside: (target: Element) =>
          !partElement(ctx, 'button')?.contains(target),
        positionArea: props.positionArea(),
        positionTryFallbacks: props.positionTryFallbacks(),
      }),
      {
        parts: {
          trigger: 'input',
          root: 'popover',
          // Combobox has a description of its own; the rest it lacks.
          title: null,
          description: null,
          close: null,
          triggerLabel: null,
          triggerDescription: null,
          triggerFrame: null,
          triggerExtras: null,
        },
      },
    );

    // Every option, matching or not, once Autocomplete is composed below.
    // What reads it while Autocomplete sets up gets no option's text.
    const composed: { options?: () => ListCollection<unknown> } = {};

    /** The text a value shows: its option's, or a custom value's. */
    const textOf = (keys: readonly string[]): string => {
      const key = keys[0];
      if (key === undefined || !composed.options) return '';
      const option = composed.options().get(key);
      if (option) return option.textValue;
      return props.allowsCustomValue() ? key : '';
    };
    const settledText = () => textOf(value.get());

    // Unset, the text is the value's, fixed once started, so that a value
    // changing later writes its text in as a change.
    const seed = ctx.state<string | undefined>(undefined);
    ctx.effect(() => {
      if (props.inputValue.get() === undefined) seed.set(settledText());
    });
    /** The text without the draft: the consumer's, else the seed, else the value's. */
    const committedText = () =>
      props.inputValue.get() ?? seed.get() ?? settledText();

    const search = ctx.use(
      autocomplete,
      () => ({
        items: props.items(),
        getKey: props.getKey(),
        getTextValue: props.getTextValue(),
        isItemDisabled: props.isItemDisabled(),
        getChildren: props.getChildren(),
        disabledKeys: props.disabledKeys(),
        value: value.get(),
        onValueChange: (next: readonly string[]) => setValue(next),
        // A getter: the value's text reads Autocomplete's options, and they
        // read these props.
        get inputValue() {
          return committedText();
        },
        onInputChange: (next: string) => props.inputValue.set(next),
        hasPopup: true,
        isOpen: isOpen.get(),
        onOpenChange: (next: boolean) => isOpen.set(next),
        popupTrigger: props.popoverTrigger(),
        filter: props.filter(),
        isDisabled: props.isDisabled(),
        isReadOnly: props.isReadOnly(),
        isRequired: props.isRequired(),
        isInvalid: props.isInvalid(),
        shouldFocusWrap: props.shouldFocusWrap(),
        locale: props.locale(),
        buttonLabel: props.buttonLabel(),
        optionCountAnnouncement: props.optionCountAnnouncement(),
        inputId: props.inputId(),
        listId: props.listId(),
        labelElementType: props.labelElementType(),
        labelledBy: props.labelledBy(),
        describedBy: props.describedBy(),
        virtualizer: props.virtualizer(),
        itemSize: props.itemSize(),
        shouldMeasureItems: props.shouldMeasureItems(),
        overscan: props.overscan(),
        initialItemCount: props.initialItemCount(),
        onRenderedKeysChange: (detail: {
          keys: readonly string[];
          sections: readonly string[];
        }) => ctx.emit('renderedKeysChange', detail),
        onAction: (key: string) => onChosen(key),
        onFocusChange: (isFocusWithin: boolean) => onFocusChange(isFocusWithin),
      }),
      { parts: { popup: 'popover' }, links: [optionTooltipLink] },
    );
    composed.options = search.api.collection;

    /** The text on screen, the draft included. */
    const text = () => search.api.text();
    const setText = (next: string) => {
      if (next !== text()) props.inputValue.set(next);
    };

    // A value from elsewhere (the consumer, items arriving) writes its text
    // in, unless the user is typing.
    ctx.watch(settledText, (next) => {
      if (!search.api.isFiltering()) setText(next);
    });

    const close = () => {
      if (isOpen.get()) isOpen.set(false);
    };

    /** An option chosen by a press or Enter (Selection). */
    const onChosen = (key: string) => {
      search.api.revertText();
      search.actions.showAll();
      setText(search.api.collection().get(key)?.textValue ?? settledText());
      close();
    };

    /** The typed text back to the value's. */
    const revert = () => {
      search.api.revertText();
      search.actions.showAll();
      setText(settledText());
    };

    /**
     * Enter with nothing highlighted, and focus leaving: the text selects
     * the option it names, becomes a custom value, clears the value, or
     * reverts (Selection, Resolved questions 3).
     */
    const settle = () => {
      search.api.revertText();
      const typed = text();
      const wasFiltering = search.api.isFiltering();
      if (!wasFiltering && typed === settledText()) return;
      if (props.isReadOnly() || props.isDisabled()) return revert();
      const query = typed.trim();
      let next: readonly string[] | null = null;
      if (query === '') {
        next = [];
      } else {
        const all = search.api.collection();
        const enabled = all.options.filter((option) => !option.isDisabled);
        const compare = search.api.collator();
        const isExact = (option: { textValue: string }) =>
          compare.compare(option.textValue, query) === 0;
        // The selected option first, when two share the text.
        const current = enabled.find((option) => option.key === value.get()[0]);
        const exact =
          current && isExact(current) ? current : enabled.find(isExact);
        const matches =
          !exact && wasFiltering ? search.api.matchesFor(query) : null;
        const found = matches
          ? enabled.filter((option) => matches.has(option.key))
          : [];
        if (exact) next = [exact.key];
        else if (found.length === 1) next = [found[0]!.key];
        else if (props.allowsCustomValue()) next = [query];
      }
      search.actions.showAll();
      if (next === null) return setText(settledText());
      if (!isSameKeys(next, value.get())) setValue(next);
      setText(textOf(next));
    };

    // The keys Autocomplete leaves to its composer (composition spec,
    // Keyboard), after its own, skipping what it skips.
    const onInputKeyDown = (keyEvent: KeyboardEvent) => {
      if (keyEvent.defaultPrevented || isComposing(keyEvent)) return;
      if (props.isDisabled() || keyEvent.ctrlKey || keyEvent.metaKey) return;
      if (keyEvent.altKey) return;
      switch (keyEvent.key) {
        case 'Enter':
          // Nothing highlighted. Not prevented, so a form submits with the
          // settled value.
          settle();
          close();
          return;
        case 'Escape':
          // Open, Autocomplete closed the list. Closed, typed text goes
          // back; otherwise Escape is left alone, so a dialog around it
          // closes.
          if (keyEvent.shiftKey || isOpen.get()) return;
          if (text() === settledText()) return;
          keyEvent.preventDefault();
          revert();
          return;
      }
    };

    // Focus leaving the combo box settles the text, before the list closes
    // and the press that moved it acts. The window losing focus leaves the
    // input focused, and settles nothing (Focus).
    const onFocusChange = (isFocusWithin: boolean) => {
      ctx.emit('focusChange', isFocusWithin);
      if (isFocusWithin) return;
      const input = inputElement();
      if (input && input.ownerDocument.activeElement === input) return;
      settle();
    };

    // Form reset goes back to the default and its text, as NumberField's
    // does: defaultValue when uncontrolled, even one set after mount, and
    // for a controlled combo box without one, the value it mounted with.
    let initial: readonly string[] | undefined;
    const resync = ctx.state(0);
    /**
     * Writes a value about to be reported to the hidden input, as a native
     * field holds it before its `change`: a `valueChange` listener's
     * FormData has the new value.
     */
    const writeHidden = (next: readonly string[]) => {
      const hidden = partElement(ctx, 'hiddenInput') as HTMLInputElement | null;
      if (hidden) hidden.value = next[0] ?? '';
    };
    /** A controlled value the consumer didn't take goes back on this flush. */
    const putBack = () => {
      if (partElement(ctx, 'hiddenInput') && value.isControlled()) {
        resync.set(resync.get() + 1);
      }
    };
    /** Sets the value with the hidden input already holding it. */
    const setValue = (next: readonly string[]) => {
      writeHidden(next);
      value.set(next);
      putBack();
    };
    partEffect(ctx, 'input', (element) => {
      initial ??= value.get();
      const form = (element as HTMLInputElement).form;
      if (!form) return;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const onReset = (resetEvent: Event) => {
        if (resetEvent.defaultPrevented || initial === undefined) return;
        ctx.batch(() => {
          search.api.revertText();
          search.actions.showAll();
          close();
          const restored = value.reset({
            fallback: initial,
            isEqual: isSameKeys,
            beforeReport: writeHidden,
          });
          putBack();
          setText(textOf(restored));
        });
        // The native reset runs after this event and puts back the hidden
        // input's value attribute, so its value is written again after it.
        clearTimeout(timer);
        timer = setTimeout(() => resync.set(resync.get() + 1));
      };
      form.addEventListener('reset', onReset);
      return () => {
        form.removeEventListener('reset', onReset);
        clearTimeout(timer);
      };
    });

    if (isDevelopment()) {
      // A combo box needs a name (Props).
      ctx.effect(() => {
        const check = () => {
          const element = inputElement();
          if (
            !element ||
            element.hasAttribute('aria-label') ||
            element.getAttribute('aria-labelledby')
          ) {
            return;
          }
          warn(
            'combobox: the input has no name. Render a label part, or give ' +
              'it labelledBy or an aria-label.',
          );
        };
        const doc = (ctx.env.document ?? globalThis.document) as
          Document | undefined;
        if (doc?.readyState === 'loading') {
          doc.addEventListener('DOMContentLoaded', check, { once: true });
          return () => doc.removeEventListener('DOMContentLoaded', check);
        }
        const timer = setTimeout(check);
        return () => clearTimeout(timer);
      });
    }

    return {
      search,
      layer,
      resync: () => resync.get(),
      inputHandlers: { keydown: onInputKeyDown } satisfies DomHandlers,
      // As a press on the button opens it (spec, Actions).
      open: () => search.actions.open(),
      close: () => search.actions.close(),
    };
  },
  expose({ api }) {
    return api.search.state();
  },
  connect({ props, api }) {
    const parts = api.search.connect();
    const layerParts = api.layer.connect();
    const searchState = api.search.state();
    const isDisabled = props.isDisabled();
    const state = {
      'data-open': flag(props.isOpen.get()),
      'data-entering': flag(api.layer.api.isEntering()),
      'data-exiting': flag(api.layer.api.isExiting()),
      'data-disabled': flag(isDisabled),
      'data-readonly': flag(props.isReadOnly()),
      'data-required': flag(props.isRequired()),
      'data-invalid': flag(props.isInvalid()),
      'data-empty': flag(searchState.isEmpty),
      'data-focus-within': flag(searchState.isFocusWithin),
      'data-focus-visible': flag(searchState.isFocusVisible),
    };
    const withState = (part: PartProps): DomPartProps => {
      const own = part as DomPartProps;
      return { ...own, attrs: { ...own.attrs, ...state } };
    };
    // Read so a form reset writes the hidden input again.
    api.resync();
    const input = parts.input as DomPartProps;
    const popoverRoot = layerParts.root as DomPartProps;
    const popup = parts.popup as DomPartProps;
    const value = props.value.get()[0];
    return {
      root: withState(parts.root),
      label: withState(parts.label),
      anchor: withState(layerParts.anchor),
      input: {
        ...input,
        attrs: {
          ...input.attrs,
          // Autocomplete's text is no form value; Combobox's is.
          required: flag(props.isRequired()),
          ...state,
        },
        on: mergeHandlers(input.on ?? {}, api.inputHandlers),
      },
      button: withState(parts.button),
      popover: {
        ...popoverRoot,
        attrs: {
          ...popoverRoot.attrs,
          role: undefined,
          tabindex: undefined,
          'aria-labelledby': undefined,
          'aria-describedby': undefined,
          ...state,
        },
        on: popup.on,
      },
      arrow: withState(layerParts.arrow),
      scroller: parts.scroller,
      list: withState(parts.list),
      empty: withState(parts.empty),
      description: withState(parts.description),
      error: withState(parts.error),
      hiddenInput: {
        attrs: { type: 'hidden', disabled: flag(isDisabled) },
        properties: { value: value ?? '' },
      },
    };
  },
  connectItem({ api }, part, key) {
    return api.search.connectItem(part, key);
  },
});
