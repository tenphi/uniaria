/**
 * Combobox, from the approved spec (`./spec.md`): Field, Listbox and Popover
 * composed. Field names and describes the input; Listbox is the list, in its
 * virtual focus mode, with the options and their selection; Popover holds the
 * list over the page, non-modal, and leaves focus in the input on open
 * (Resolved questions 1 and 10). Combobox adds the input: filtering, the keys
 * and presses that open the list, the highlighted option
 * (`aria-activedescendant`), and how the typed text settles into a value
 * (Selection).
 *
 * Its state is the open flag, the text, the value, the highlight and whether
 * the filter applies: bindables and cells, with no statechart (Resolved
 * questions 15). Listbox gets the matching items only, so its keys skip the
 * options the filter leaves out, and those get `hidden` here.
 */

import { createListCollection } from '../../collections';
import type { ListCollection } from '../../collections';
import {
  announce,
  clearAnnouncer,
  createFocusWithin,
  isComposing,
  isDevelopment,
  mergeHandlers,
  partEffect,
  partElement,
  warn,
} from '../../dom';
import type { DomHandlers, DomPartProps, PositionArea } from '../../dom';
import type { PartProps } from '../../runtime';
import { bindable, defineComponent, event, itemId, prop } from '../../runtime';
import { button } from '../button/button';
import { field } from '../field/field';
import { listbox } from '../listbox/listbox';
import { renderedKeysChange, virtualProps } from '../listbox/virtual-list';
import { popover } from '../popover/popover';

/** What opens the list besides the button and the arrows (Props). */
export type ComboboxPopoverTrigger = 'input' | 'focus' | 'manual';

/** Whether an option's text matches the typed text, trimmed. */
export type ComboboxFilter = (textValue: string, inputValue: string) => boolean;

/** How the list opened, which decides what is highlighted (Focus). */
type Opening =
  'typing' | 'focus' | 'alt' | 'first' | 'last' | 'button' | 'virtual';

const flag = (isOn: boolean): string | undefined => (isOn ? '' : undefined);

const isSameKeys = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((key, index) => key === b[index]);

/** Listbox's default accessors, for the whole collection. */
interface DefaultItem {
  readonly key?: string;
  readonly textValue?: string;
  readonly isDisabled?: boolean;
  readonly items?: readonly unknown[];
}

const defaultGetKey = (item: unknown): string =>
  String((item as DefaultItem).key);
const defaultGetTextValue = (item: unknown): string =>
  (item as DefaultItem).textValue ?? '';
const defaultIsItemDisabled = (item: unknown): boolean =>
  (item as DefaultItem).isDisabled === true;
const defaultGetChildren = (item: unknown): readonly unknown[] | undefined =>
  (item as DefaultItem).items;

const defaultOptionCount = (count: number): string =>
  count === 1 ? '1 option available' : `${count} options available`;

function canonicalLocale(tag: string | undefined): string | undefined {
  if (!tag) return undefined;
  try {
    return Intl.getCanonicalLocales(tag)[0];
  } catch {
    return undefined;
  }
}

/**
 * The text contains `query`, compared by `collator` (React Aria's
 * `useFilter().contains`): every slice as long as the query is compared, so
 * case and accents are ignored as the collator does.
 */
function contains(text: string, query: string, collator: Intl.Collator) {
  if (query === '') return true;
  const source = text.normalize('NFC');
  const sought = query.normalize('NFC');
  for (let at = 0; at + sought.length <= source.length; at++) {
    if (collator.compare(source.slice(at, at + sought.length), sought) === 0) {
      return true;
    }
  }
  return false;
}

export const combobox = defineComponent({
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
    'group',
    'groupLabel',
  ],
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
    // Field's `controlId`. The element adopts the input's id.
    inputId: prop<string | undefined>(undefined, {
      attribute: false,
      adopt: { part: 'input', attribute: 'id' },
    }),
    // Listbox's. The element adopts the list's id.
    listId: prop<string | undefined>(undefined, {
      attribute: false,
      adopt: { part: 'list', attribute: 'id' },
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

    const labelling = ctx.use(
      field,
      () => ({
        isInvalid: props.isInvalid(),
        isRequired: props.isRequired(),
        isDisabled: props.isDisabled(),
        controlId: props.inputId(),
        labelElementType: props.labelElementType(),
        labelledBy: props.labelledBy(),
        describedBy: props.describedBy(),
      }),
      { parts: { control: 'input' } },
    );

    // The filter's language: the prop, else the input's, else the
    // browser's, as NumberField's.
    const inherited = ctx.state<string | undefined>(undefined);
    partEffect(ctx, 'input', (input) => {
      inherited.set(
        canonicalLocale(input.closest('[lang]')?.getAttribute('lang') ?? '') ??
          canonicalLocale(input.ownerDocument.defaultView?.navigator.language),
      );
    });
    const collator = ctx.memo(
      () => [canonicalLocale(props.locale()) ?? inherited.get()] as const,
      (locale) =>
        new Intl.Collator(locale, { usage: 'search', sensitivity: 'base' }),
    );

    const getKey = () =>
      (props.getKey() ?? defaultGetKey) as (item: unknown) => string;
    const getChildren = () =>
      (props.getChildren() ?? defaultGetChildren) as (
        item: unknown,
      ) => readonly unknown[] | undefined;

    // Every option, matching or not: the text a value shows and the
    // options the text settles on.
    const collection = ctx.memo(
      () => [props.items(), props.disabledKeys()] as const,
      (items, disabledKeys): ListCollection<unknown> =>
        createListCollection<unknown>(
          items,
          {
            getKey: getKey(),
            getTextValue: (props.getTextValue() ?? defaultGetTextValue) as (
              item: unknown,
            ) => string,
            isDisabled: (props.isItemDisabled() ?? defaultIsItemDisabled) as (
              item: unknown,
            ) => boolean,
            getChildren: getChildren(),
          },
          disabledKeys,
        ),
    );

    /** The text a value shows: its option's, or a custom value's. */
    const textOf = (keys: readonly string[]): string => {
      const key = keys[0];
      if (key === undefined) return '';
      const option = collection().get(key);
      if (option) return option.textValue;
      return props.allowsCustomValue() ? key : '';
    };
    const settledText = () => textOf(value.get());

    // TextField's buffer: while a controlled consumer hasn't answered, the
    // input keeps the typed text (the draft). Reported texts not yet echoed
    // back are pending, oldest first.
    const draft = ctx.state<string | undefined>(undefined);
    let pending: string[] = [];
    // Unset, the text is the value's, fixed once started, so that a value
    // changing later writes its text in as a change.
    const seed = ctx.state<string | undefined>(undefined);
    ctx.effect(() => {
      if (props.inputValue.get() === undefined) seed.set(settledText());
    });
    const text = () =>
      draft.get() ?? props.inputValue.get() ?? seed.get() ?? settledText();
    const dropDraft = () => {
      pending = [];
      draft.set(undefined);
    };
    ctx.watch(
      () => props.inputValue.get(),
      (next) => {
        const index = next === undefined ? -1 : pending.indexOf(next);
        if (index === -1) return dropDraft();
        pending = pending.slice(index + 1);
        if (pending.length === 0) draft.set(undefined);
      },
    );
    const setText = (next: string) => {
      if (next !== text()) props.inputValue.set(next);
    };

    /** The user typed since the text last settled (Filtering). */
    const isFiltering = ctx.state(false);

    // A value from elsewhere (the consumer, items arriving) writes its text
    // in, unless the user is typing.
    ctx.watch(settledText, (next) => {
      if (!isFiltering.get()) setText(next);
    });

    /** The filter for typed text, or `null` when nothing is filtered. */
    const matcher = (): ComboboxFilter | null => {
      const custom = props.filter();
      if (custom === false) return null;
      if (custom) return custom;
      const compare = collator();
      return (textValue, query) => contains(textValue, query, compare);
    };
    /** The keys matching `typed`, or `null` for every option. */
    const matchesFor = (typed: string): ReadonlySet<string> | null => {
      const match = matcher();
      const query = typed.trim();
      if (!match || query === '') return null;
      const keys = new Set<string>();
      for (const option of collection().options) {
        if (match(option.textValue, query)) keys.add(option.key);
      }
      return keys;
    };
    const visible = ctx.memo(
      () =>
        [
          isFiltering.get(),
          text(),
          collection(),
          props.filter(),
          collator(),
        ] as const,
      // The others are read again inside.
      (
        filtering,
        typed,
        _options,
        _filter,
        _collator,
      ): ReadonlySet<string> | null => (filtering ? matchesFor(typed) : null),
    );
    const isShown = (key: string) => visible()?.has(key) ?? true;

    // Listbox shows the matching items: a group keeps its matching options,
    // and goes when it has none.
    const shownItems = ctx.memo(
      () => [props.items(), visible()] as const,
      (items, keys): readonly unknown[] => {
        if (keys === null) return items;
        const keyOf = getKey();
        const childrenOf = getChildren();
        return items.filter((item) => {
          const children = childrenOf(item);
          if (!children) return keys.has(keyOf(item));
          return children.some((child) => keys.has(keyOf(child)));
        });
      },
    );
    const shownChildren = (item: unknown) => {
      const children = getChildren()(item);
      const keys = visible();
      if (!children || keys === null) return children;
      const keyOf = getKey();
      return children.filter((child) => keys.has(keyOf(child)));
    };
    // Each option shows whether it is filtered out.
    ctx.watch(visible, () => ctx.invalidateItems());

    const list = ctx.use(
      listbox,
      () => ({
        items: shownItems(),
        getKey: props.getKey(),
        getTextValue: props.getTextValue(),
        isItemDisabled: props.isItemDisabled(),
        getChildren: shownChildren,
        disabledKeys: props.disabledKeys(),
        value: value.get(),
        onValueChange: (next: readonly string[]) => value.set(next),
        isDisabled: props.isDisabled(),
        isReadOnly: props.isReadOnly(),
        shouldFocusWrap: props.shouldFocusWrap(),
        shouldFocusOnHover: true,
        shouldUseVirtualFocus: true,
        listId: props.listId(),
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
      }),
      { parts: { root: null, label: null, description: null, error: null } },
    );

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
          title: null,
          description: null,
          close: null,
        },
      },
    );

    let opening: Opening = 'typing';
    const open = (how: Opening) => {
      if (props.isDisabled() || isOpen.get()) return;
      // Opened again after typing that matches nothing, the list shows
      // every option (Filtering).
      if (how !== 'typing' && isFiltering.get() && visible()?.size === 0) {
        isFiltering.set(false);
      }
      opening = how;
      isOpen.set(true);
    };
    const close = () => {
      if (isOpen.get()) isOpen.set(false);
    };

    // After Popover's, so the popover is shown before an option scrolls
    // into view.
    ctx.watch(
      () => isOpen.get(),
      (isNowOpen) => {
        const how = opening;
        opening = 'typing';
        if (!isNowOpen) {
          list.api.highlight(null, false);
          return;
        }
        const options = list.api.collection();
        const key = value.get()[0];
        const selected =
          key !== undefined && options.isEnabled(key) ? key : null;
        switch (how) {
          case 'first':
          case 'virtual':
            list.api.highlight(selected ?? options.first(), true);
            return;
          case 'last':
            list.api.highlight(selected ?? options.last(), true);
            return;
          case 'button':
            if (selected === null) return;
            list.api.highlight(selected, false);
            // Scrolled into view without highlighting it by keyboard.
            list.api.reveal(selected);
            return;
        }
      },
    );

    // The option count, when the list opens and when it changes while open
    // (Live announcements).
    ctx.watch(
      () => (isOpen.get() ? list.api.collection().options.length : -1),
      (count) => {
        const document = inputElement()?.ownerDocument;
        if (count < 0 || !document) return;
        clearAnnouncer('polite', document);
        announce(props.optionCountAnnouncement()(count), {
          politeness: 'polite',
          document,
        });
      },
    );

    /** An option chosen by a press or Enter (Selection). */
    const onChosen = (key: string) => {
      dropDraft();
      isFiltering.set(false);
      setText(collection().get(key)?.textValue ?? settledText());
      close();
    };

    /** The typed text back to the value's. */
    const revert = () => {
      dropDraft();
      isFiltering.set(false);
      setText(settledText());
    };

    /**
     * Enter with nothing highlighted, and focus leaving: the text selects
     * the option it names, becomes a custom value, clears the value, or
     * reverts (Selection, Resolved questions 3).
     */
    const settle = () => {
      dropDraft();
      const typed = text();
      const wasFiltering = isFiltering.get();
      if (!wasFiltering && typed === settledText()) return;
      if (props.isReadOnly() || props.isDisabled()) return revert();
      const query = typed.trim();
      let next: readonly string[] | null = null;
      if (query === '') {
        next = [];
      } else {
        const options = collection();
        const enabled = options.options.filter((option) => !option.isDisabled);
        const compare = collator();
        const isExact = (option: { textValue: string }) =>
          compare.compare(option.textValue, query) === 0;
        // The selected option first, when two share the text.
        const current = enabled.find((option) => option.key === value.get()[0]);
        const exact =
          current && isExact(current) ? current : enabled.find(isExact);
        const match = matcher();
        const found =
          !exact && wasFiltering && match
            ? enabled.filter((option) => match(option.textValue, query))
            : [];
        if (exact) next = [exact.key];
        else if (found.length === 1) next = [found[0]!.key];
        else if (props.allowsCustomValue()) next = [query];
      }
      isFiltering.set(false);
      if (next === null) return setText(settledText());
      if (!isSameKeys(next, value.get())) value.set(next);
      setText(textOf(next));
    };

    // Typing (Keyboard): edits the text, filters, clears the highlight, and
    // opens the list on non-blank text.
    const isComposingText = ctx.state(false);
    const onInput = () => {
      const input = inputElement();
      if (!input) return;
      const typed = input.value;
      if (props.inputValue.isControlled()) {
        pending.push(typed);
        draft.set(typed);
      }
      isFiltering.set(true);
      props.inputValue.set(typed);
      list.api.highlight(null, false);
      const matches = matchesFor(typed);
      const isEmpty = matches !== null && matches.size === 0;
      // With no empty part, nothing matching closes the list (Filtering).
      const canShow = !isEmpty || list.api.hasEmpty();
      if (isOpen.get()) {
        if (!canShow) close();
      } else if (
        props.popoverTrigger() !== 'manual' &&
        typed.trim() !== '' &&
        canShow
      ) {
        open('typing');
      }
    };

    const onInputKeyDown = (keyEvent: KeyboardEvent) => {
      if (keyEvent.defaultPrevented || isComposing(keyEvent)) return;
      if (props.isDisabled() || keyEvent.ctrlKey || keyEvent.metaKey) return;
      const isNowOpen = isOpen.get();
      const options = list.api.collection();
      const current = isNowOpen ? list.api.focusedKey() : null;
      switch (keyEvent.key) {
        case 'ArrowDown':
        case 'ArrowUp': {
          const isDown = keyEvent.key === 'ArrowDown';
          if (keyEvent.altKey) {
            // The APG's: Alt+ArrowDown opens, Alt+ArrowUp closes.
            if (isDown === isNowOpen) return;
            keyEvent.preventDefault();
            if (isDown) open('alt');
            else close();
            return;
          }
          if (keyEvent.shiftKey) return;
          keyEvent.preventDefault();
          if (!isNowOpen) {
            open(isDown ? 'first' : 'last');
            return;
          }
          const wrap = props.shouldFocusWrap();
          const target =
            current === null
              ? isDown
                ? options.first()
                : options.last()
              : isDown
                ? options.next(current, wrap)
                : options.previous(current, wrap);
          if (target !== null) list.api.highlight(target, true);
          return;
        }
        case 'PageDown':
        case 'PageUp':
          if (current === null || keyEvent.altKey || keyEvent.shiftKey) return;
          keyEvent.preventDefault();
          list.api.highlight(
            list.api.pageFrom(current, keyEvent.key === 'PageDown' ? 1 : -1),
            true,
          );
          return;
        case 'Home':
        case 'End':
        case 'ArrowLeft':
        case 'ArrowRight':
          // The caret moves, and the highlight goes (APG, React Aria).
          if (current !== null) list.api.highlight(null, false);
          return;
        case 'Enter':
          if (keyEvent.altKey) return;
          if (current !== null) {
            keyEvent.preventDefault();
            if (!keyEvent.repeat) list.api.activate(current);
            return;
          }
          // Not prevented, so a form submits with the settled value.
          settle();
          close();
          return;
        case 'Escape':
          if (keyEvent.shiftKey || keyEvent.altKey) return;
          if (isNowOpen) {
            keyEvent.preventDefault();
            close();
            return;
          }
          // Otherwise left alone, so a dialog around it closes.
          if (text() === settledText()) return;
          keyEvent.preventDefault();
          revert();
          return;
      }
    };

    /** Focuses the input without scrolling, unless it has focus. */
    let isFocusingFromButton = false;
    const focusInput = () => {
      const input = inputElement();
      if (!input || input.ownerDocument.activeElement === input) return;
      isFocusingFromButton = true;
      try {
        input.focus({ preventScroll: true });
      } finally {
        isFocusingFromButton = false;
      }
    };

    const onInputFocus = () => {
      if (props.popoverTrigger() !== 'focus' || isFocusingFromButton) return;
      open('focus');
    };

    // The button never takes focus. A mouse or pen toggles on press start,
    // below; touch and screen readers on release (Pointer and touch).
    const toggle = (how: Opening) => {
      focusInput();
      if (isOpen.get()) close();
      else open(how);
    };
    const trigger = ctx.use(
      button,
      () => ({
        isDisabled: props.isDisabled(),
        shouldPreventFocusOnPress: true,
        shouldExcludeFromTabOrder: true,
        onPress: (pressEvent: { pointerType: string }) => {
          if (pressEvent.pointerType === 'touch') toggle('button');
          else if (pressEvent.pointerType === 'virtual') toggle('virtual');
        },
      }),
      { parts: { root: 'button' } },
    );
    const onButtonPointerDown = (pointerEvent: PointerEvent) => {
      if (pointerEvent.button !== 0 || pointerEvent.pointerType === 'touch') {
        return;
      }
      if (props.isDisabled()) return;
      toggle('button');
    };

    /**
     * Presses in the popup, outside a control of its own, keep focus in the
     * input.
     */
    const onPopoverMouseDown = (mouseEvent: MouseEvent) => {
      const popup = partElement(ctx, 'popover');
      const target = mouseEvent.target as Element | null;
      if (!popup || !target || mouseEvent.button !== 0) return;
      const control = target.closest(
        'input, textarea, select, button, a[href], [tabindex], [contenteditable]',
      );
      if (control && control !== popup && popup.contains(control)) return;
      mouseEvent.preventDefault();
    };

    // Focus leaving the combo box settles the text and closes the list,
    // before the press that moved it acts. The window losing focus leaves
    // the input focused, and settles nothing (Focus).
    const focusWithin = createFocusWithin(ctx, {
      part: 'root',
      isDisabled: props.isDisabled,
    });
    ctx.watch(focusWithin.isFocusWithin, (isFocusWithin) => {
      ctx.emit('focusChange', isFocusWithin);
      if (isFocusWithin) return;
      const input = inputElement();
      if (input && input.ownerDocument.activeElement === input) return;
      settle();
      close();
    });

    // Form reset goes back to the value the combo box mounted with, and its
    // text, as NumberField's.
    let initial: readonly string[] | undefined;
    const resync = ctx.state(0);
    partEffect(ctx, 'input', (element) => {
      initial ??= value.get();
      const form = (element as HTMLInputElement).form;
      if (!form) return;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const onReset = (resetEvent: Event) => {
        if (resetEvent.defaultPrevented || initial === undefined) return;
        const restored = initial;
        ctx.batch(() => {
          dropDraft();
          isFiltering.set(false);
          close();
          if (!isSameKeys(restored, value.get())) value.set(restored);
          setText(textOf(restored));
        });
        // The native reset runs after this event and puts back the value
        // attribute, so the text is written again after it.
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
      field: labelling,
      list,
      layer,
      trigger,
      text,
      isShown,
      isFiltered: () => visible() !== null,
      section: (key: string) => collection().section(key),
      isComposing: () => isComposingText.get(),
      resync: () => resync.get(),
      isFocusWithin: focusWithin.isFocusWithin,
      isFocusVisible: focusWithin.isFocusVisible,
      inputHandlers: {
        input: onInput,
        keydown: onInputKeyDown,
        focus: onInputFocus,
        compositionstart: () => isComposingText.set(true),
        compositionend: () => isComposingText.set(false),
      } satisfies DomHandlers,
      onButtonPointerDown,
      onPopoverMouseDown,
    };
  },
  expose({ props, api }) {
    const list = api.list.state();
    return {
      value: props.value.get(),
      inputValue: api.text(),
      isOpen: props.isOpen.get(),
      focusedKey: props.isOpen.get() ? list.focusedKey : null,
      isEmpty: list.isEmpty,
      isDisabled: props.isDisabled(),
      isReadOnly: props.isReadOnly(),
      isRequired: props.isRequired(),
      isInvalid: props.isInvalid(),
      isErrorShown: api.field.state().isErrorShown,
      isFocusWithin: api.isFocusWithin(),
      isFocusVisible: api.isFocusVisible(),
      isVirtualized: list.isVirtualized,
      renderedKeys: list.renderedKeys,
      renderedSections: list.renderedSections,
    };
  },
  connect({ props, ids, api }) {
    const fieldParts = api.field.connect();
    const listParts = api.list.connect();
    const layerParts = api.layer.connect();
    const buttonRoot = api.trigger.connect().root as DomPartProps;
    const isOpen = props.isOpen.get();
    const isDisabled = props.isDisabled();
    const isReadOnly = props.isReadOnly();
    const isEmpty = api.list.state().isEmpty;
    const state = {
      'data-open': flag(isOpen),
      'data-entering': flag(api.layer.api.isEntering()),
      'data-exiting': flag(api.layer.api.isExiting()),
      'data-disabled': flag(isDisabled),
      'data-readonly': flag(isReadOnly),
      'data-required': flag(props.isRequired()),
      'data-invalid': flag(props.isInvalid()),
      'data-empty': flag(isEmpty),
      'data-focus-within': flag(api.isFocusWithin()),
      'data-focus-visible': flag(api.isFocusVisible()),
    };
    const withState = (part: PartProps): PartProps => ({
      ...part,
      attrs: { ...part.attrs, ...state },
    });
    const control = fieldParts.control;
    const listRoot = listParts.list as DomPartProps;
    const listId = listRoot.attrs.id;
    const highlighted = isOpen ? api.list.api.focusedKey() : null;
    // Read so a form reset writes the text again.
    api.resync();
    const input: DomPartProps = {
      attrs: {
        ...control.attrs,
        role: 'combobox',
        'aria-autocomplete': 'list',
        'aria-expanded': String(isOpen),
        'aria-controls': listId,
        // Only once the option's element exists: an id that resolves to
        // nothing is non-conforming, and Chromium drops the relation
        // (virtualization spec, ARIA).
        'aria-activedescendant':
          highlighted === null ||
          !api.list.api.isRendered('option', highlighted)
            ? undefined
            : itemId(api.list.api.base(), 'option', highlighted),
        autocomplete: 'off',
        autocorrect: 'off',
        spellcheck: 'false',
        required: flag(props.isRequired()),
        readonly: flag(isReadOnly),
        disabled: flag(isDisabled),
        ...state,
      },
      on: api.inputHandlers,
      // Writing the value mid-composition breaks the IME, so it waits.
      properties: { value: api.isComposing() ? undefined : api.text() },
    };
    // Button's pointer and hover handling; it never has focus for keys.
    const {
      keydown: _keydown,
      keyup: _keyup,
      ...buttonHandlers
    } = buttonRoot.on ?? ({} as DomHandlers);
    const buttonPart: DomPartProps = {
      attrs: {
        ...buttonRoot.attrs,
        id: ids.button,
        'aria-label': props.buttonLabel(),
        // "Show suggestions Fruit", as NumberField's buttons.
        'aria-labelledby': [ids.button, control.attrs['aria-labelledby']]
          .filter(Boolean)
          .join(' '),
        'aria-haspopup': 'listbox',
        'aria-expanded': String(isOpen),
        'aria-controls': listId,
        ...state,
      },
      on: mergeHandlers(buttonHandlers, {
        pointerdown: api.onButtonPointerDown,
      }),
    };
    const popoverRoot = layerParts.root as DomPartProps;
    const value = props.value.get()[0];
    return {
      root: withState(fieldParts.root),
      label: withState(fieldParts.label),
      anchor: withState(layerParts.anchor),
      input,
      button: buttonPart,
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
        on: { mousedown: api.onPopoverMouseDown },
      },
      arrow: withState(layerParts.arrow),
      scroller: listParts.scroller,
      list: {
        ...listRoot,
        attrs: {
          ...listRoot.attrs,
          'aria-labelledby': control.attrs['aria-labelledby'],
          ...state,
        },
      },
      empty: withState(listParts.empty),
      description: withState(fieldParts.description),
      error: withState(fieldParts.error),
      hiddenInput: {
        attrs: { type: 'hidden', disabled: flag(isDisabled) },
        properties: { value: value ?? '' },
      },
    };
  },
  connectItem({ api }, part, key) {
    const item = api.list.connectItem(part, key) as DomPartProps;
    const isHidden =
      part === 'group'
        ? api.isFiltered() &&
          !(api.section(key)?.keys.some((each) => api.isShown(each)) ?? true)
        : part === 'option' && !api.isShown(key);
    const result: DomPartProps = {
      ...item,
      attrs: { ...item.attrs, hidden: flag(isHidden) },
    };
    return result as PartProps;
  },
});
