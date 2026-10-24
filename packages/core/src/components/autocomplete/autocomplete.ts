/**
 * Autocomplete, from the composition spec (`../composition.md`): Field,
 * TextInput and Listbox composed. Typing filters the options; the keys move
 * a highlight through them while focus stays in the input
 * (`aria-activedescendant`); Enter or a press chooses one, reported as
 * `action`, and changes nothing else. It is the part of Combobox that isn't
 * about a value or showing the popup, moved here so both share it.
 *
 * Inline, the default, the list is always shown and the filter is on from
 * the start. In popup mode (`hasPopup`), for definitions such as Combobox, it
 * asks to open and close the list and owns the button; its composer shows
 * the list in a popup and decides what settling the text does.
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
import type { DomHandlers, DomPartProps } from '../../dom';
import type { PartProps } from '../../runtime';
import { bindable, defineBehavior, event, itemId, prop } from '../../runtime';
import { NO_ITEM_PARTS, button } from '../button/button';
import { field } from '../field/field';
import { listbox, optionTooltipSource } from '../listbox/listbox';
import { renderedKeysChange, virtualProps } from '../listbox/virtual-list';
import { textInput } from '../text-input/text-input';
import { linkOptionTooltip, optionTooltipLink } from '../tooltip/link';

/** What opens the list in popup mode besides the button and the arrows. */
export type AutocompletePopupTrigger = 'input' | 'focus' | 'manual';

/**
 * Whether an option matches the typed text, trimmed. `item` is the item as
 * `items` holds it, so a filter can match more than the text.
 */
export type AutocompleteFilter = (
  textValue: string,
  inputValue: string,
  item: never,
) => boolean;

/** How the list opened, which decides what is highlighted (Focus). */
type Opening =
  'typing' | 'focus' | 'alt' | 'first' | 'last' | 'button' | 'virtual';

/**
 * Whether the filter applies (Filtering): `auto` until the user types or
 * something stops it, which is on inline and off in popup mode.
 */
type Filtering = 'auto' | 'on' | 'off';

/** The wait before `aria-activedescendant` follows typing (React Aria's). */
const ACTIVE_DESCENDANT_DELAY = 500;

/** Elements in the list or the popup that keep their own press. */
const CONTROLS =
  'input, textarea, select, button, a[href], [tabindex], [contenteditable]';

const flag = (isOn: boolean): string | undefined => (isOn ? '' : undefined);

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

/** Typing that adds text, which `shouldHighlightFirstMatch` follows. */
const isInsertion = (inputType: string) =>
  inputType === 'insertText' ||
  inputType === 'insertCompositionText' ||
  inputType === 'insertFromComposition';

export const autocomplete = defineBehavior({
  name: 'autocomplete',
  parts: [
    'root',
    'label',
    'input',
    'button',
    'popup',
    'scroller',
    'list',
    'empty',
    'description',
    'error',
    'errorText',
  ],
  itemParts: [
    'option',
    'optionLabel',
    'optionDescription',
    'optionExtras',
    'group',
    'groupLabel',
  ],
  // One tooltip for every option (items spec); the input scrolls its text,
  // so it takes no tooltip of its own.
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
    selectionMode: prop<'single' | 'multiple'>('single'),
    // The element reads the input's text, as TextField's does.
    inputValue: bindable('', {
      attribute: false,
      event: 'inputChange',
      adopt: { part: 'input', property: 'value' },
    }),
    shouldHighlightFirstMatch: prop(false, {
      attribute: 'highlight-first-match',
    }),
    // Popup mode, for definitions that show the list in a popup.
    hasPopup: prop(false, { attribute: false }),
    isOpen: bindable(false, { attribute: false }),
    popupTrigger: prop<AutocompletePopupTrigger>('input', {
      attribute: false,
    }),
    // `undefined` is the built-in "contains"; `false` filters nothing (a
    // `null` prop reads as unset).
    filter: prop<AutocompleteFilter | false | undefined>(undefined, {
      attribute: false,
    }),
    isDisabled: prop(false),
    isReadOnly: prop(false, { attribute: 'readonly' }),
    isRequired: prop(false),
    // Unset, a field in a form shows the form's state.
    isInvalid: prop<boolean | undefined>(undefined, { type: 'boolean' }),
    shouldFocusWrap: prop(false),
    locale: prop<string | undefined>(undefined, { type: 'string' }),
    buttonLabel: prop('Show suggestions', { attribute: false }),
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
  // The only members of setup()'s result consumers may call (Actions).
  actions: ['open', 'close', 'showAll'],
  events: {
    action: event<string>(),
    focusChange: event<boolean>(),
    renderedKeysChange,
  },
  setup(ctx) {
    const { props } = ctx;
    const value = props.value;
    const inputValue = props.inputValue;
    const isPopup = () => props.hasPopup();
    /** The list shows: always inline, while open in popup mode. */
    const isShown = () => !isPopup() || props.isOpen.get();
    const inputElement = () =>
      partElement(ctx, 'input') as HTMLInputElement | null;

    const labelling = ctx.use(
      field,
      () => ({
        isInvalid: props.isInvalid(),
        isRequired: props.isRequired(),
        isDisabled: props.isDisabled(),
        isReadOnly: props.isReadOnly(),
        controlId: props.inputId(),
        labelElementType: props.labelElementType(),
        labelledBy: props.labelledBy(),
        describedBy: props.describedBy(),
      }),
      { parts: { control: 'input' } },
    );
    // Its own, or the form's of the field that binds it (Combobox).
    const isDisabled = labelling.api.isDisabled;
    const isReadOnly = labelling.api.isReadOnly;

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

    // Every option, matching or not.
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

    const filtering = ctx.state<Filtering>('auto');
    const isFiltering = () => {
      const now = filtering.get();
      return now === 'auto' ? !isPopup() : now === 'on';
    };

    /** The filter for typed text, or `null` when nothing is filtered. */
    const matcher = ():
      ((textValue: string, query: string, item: unknown) => boolean) | null => {
      const custom = props.filter();
      if (custom === false) return null;
      if (custom) {
        return custom as (
          textValue: string,
          query: string,
          item: unknown,
        ) => boolean;
      }
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
        if (match(option.textValue, query, option.item)) keys.add(option.key);
      }
      return keys;
    };

    // The text, IME and the draft on the input. Typing reports through the
    // value; what typing does besides is `onInput` below.
    const editing = ctx.use(
      textInput,
      () => ({
        value: inputValue.get(),
        onValueChange: (typed: string) => inputValue.set(typed),
        isDisabled: isDisabled(),
        isReadOnly: isReadOnly(),
      }),
      { parts: { root: 'input' } },
    );
    /** The text on screen. */
    // A controlled `null` is the empty text, as in TextField.
    const text = (): string => editing.api.text() ?? '';

    const visible = ctx.memo(
      () =>
        [
          isFiltering(),
          text(),
          collection(),
          props.filter(),
          collator(),
        ] as const,
      // The others are read again inside.
      (
        isOn,
        typed,
        _options,
        _filter,
        _collator,
      ): ReadonlySet<string> | null => (isOn ? matchesFor(typed) : null),
    );
    const isMatch = (key: string) => visible()?.has(key) ?? true;

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

    // Autocomplete is the input, the button, the popup and the list, which
    // the root holds when it is rendered; it is optional.
    const focusWithin = createFocusWithin(ctx, {
      part: ['root', 'input', 'button', 'popup', 'list'],
      isDisabled,
    });

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
        selectionMode: props.selectionMode(),
        isDisabled: isDisabled(),
        isReadOnly: isReadOnly(),
        shouldFocusWrap: props.shouldFocusWrap(),
        // Inline, hover highlights on the pointer's moves instead (below).
        shouldFocusOnHover: isPopup(),
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
        onAction: (key: string) => ctx.emit('action', key),
      }),
      // Autocomplete's Field labels the input and the list.
      { parts: { root: null, label: null, description: null, error: null } },
    );
    // Driven by the visible highlight; typing in the input closes it.
    linkOptionTooltip(
      ctx,
      optionTooltipSource(ctx, list.api, {
        isVirtual: () => true,
        keyParts: ['input', 'list'],
      }),
    );

    // `aria-activedescendant` waits after typing highlights a match, so a
    // screen reader still reads the typed character.
    const isDescendantHeld = ctx.state(false);
    let descendantTimer: ReturnType<typeof setTimeout> | undefined;
    const releaseDescendant = () => {
      clearTimeout(descendantTimer);
      descendantTimer = undefined;
      isDescendantHeld.set(false);
    };
    ctx.effect(() => releaseDescendant);

    /**
     * Whether typing holds the highlight, and the option it highlighted:
     * none while nothing matches yet.
     */
    let isTypingHeld = false;
    let typedKey: string | null = null;

    /** Highlights an option, or none, by keyboard or not. */
    const highlight = (key: string | null, isKeyboard: boolean) => {
      isTypingHeld = false;
      typedKey = null;
      releaseDescendant();
      list.api.highlight(key, isKeyboard);
    };

    /**
     * The first shown option, in list order, that is selected and enabled,
     * else the first enabled one (The highlight while typing).
     */
    const firstMatch = (): string | null => {
      const options = list.api.collection();
      const selected = new Set(value.get());
      for (const option of options.options) {
        if (selected.has(option.key) && options.isEnabled(option.key)) {
          return option.key;
        }
      }
      return options.first();
    };
    /** Highlights the first match, holding the active descendant on typing. */
    const highlightFirstMatch = (isTyping: boolean) => {
      isTypingHeld = true;
      const key = firstMatch();
      if (key === null) return;
      if (key !== list.api.focusedKey()) {
        list.api.highlight(key, false);
        list.api.reveal(key);
      }
      typedKey = key;
      if (!isTyping) return;
      isDescendantHeld.set(true);
      clearTimeout(descendantTimer);
      descendantTimer = setTimeout(() => {
        descendantTimer = undefined;
        isDescendantHeld.set(false);
      }, ACTIVE_DESCENDANT_DELAY);
    };
    // Hover moving the highlight (Listbox's own in popup mode) ends
    // typing's hold on it and the active descendant's wait; Listbox
    // clearing an option that left doesn't.
    ctx.watch(
      () => list.api.focusedKey(),
      (key) => {
        if (key === null || key === typedKey) return;
        isTypingHeld = false;
        typedKey = null;
        releaseDescendant();
      },
    );
    // Options arriving after a keystroke (a server-side filter) get the
    // first match too, while typing holds the highlight, though the
    // keystroke matched nothing.
    ctx.watch(
      () => list.api.collection(),
      () => {
        if (!isTypingHeld || !props.shouldHighlightFirstMatch()) return;
        if (isShown()) highlightFirstMatch(false);
      },
    );

    let opening: Opening = 'typing';
    const open = (how: Opening) => {
      if (!isPopup() || isDisabled() || props.isOpen.get()) return;
      // Opened again after typing that matches nothing, the list shows
      // every option (Filtering).
      if (how !== 'typing' && isFiltering() && visible()?.size === 0) {
        filtering.set('off');
      }
      opening = how;
      props.isOpen.set(true);
    };
    const close = () => {
      if (isPopup() && props.isOpen.get()) props.isOpen.set(false);
    };

    // Watchers run in the order they're composed: a composer that composes
    // its popup first has it shown before an option scrolls into view.
    ctx.watch(
      () => props.isOpen.get(),
      (isNowOpen) => {
        if (!isPopup()) return;
        const how = opening;
        opening = 'typing';
        if (!isNowOpen) {
          highlight(null, false);
          return;
        }
        const options = list.api.collection();
        const key = value.get()[0];
        const selected =
          key !== undefined && options.isEnabled(key) ? key : null;
        switch (how) {
          case 'first':
          case 'virtual':
            highlight(selected ?? options.first(), true);
            return;
          case 'last':
            highlight(selected ?? options.last(), true);
            return;
          case 'button':
            if (selected === null) return;
            highlight(selected, false);
            // Scrolled into view without highlighting it by keyboard.
            list.api.reveal(selected);
            return;
        }
      },
    );

    // The option count, politely (Live announcements): in popup mode when
    // the list opens and when it changes while open; inline whenever it
    // changes while focus is in Autocomplete, never on focus or mount.
    ctx.watch(
      () => {
        const count = list.api.collection().options.length;
        if (isPopup()) return props.isOpen.get() ? count : -1;
        return focusWithin.isFocusWithin() ? count : -1;
      },
      (count, previous) => {
        const document = inputElement()?.ownerDocument;
        if (count < 0 || !document) return;
        if (!isPopup() && previous < 0) return;
        clearAnnouncer('polite', document);
        announce(props.optionCountAnnouncement()(count), {
          politeness: 'polite',
          document,
        });
      },
    );

    // Typing, after TextInput took the text (Filtering, Keyboard): every
    // `input` filters and clears the highlight, even when the text is the
    // value already; in popup mode it opens the list on non-blank text.
    const onInput = (inputEvent: Event) => {
      const typed = text();
      filtering.set('on');
      highlight(null, false);
      if (isPopup()) {
        const matches = matchesFor(typed);
        const isEmpty = matches !== null && matches.size === 0;
        // With no empty part, nothing matching closes the list (Filtering).
        const canShow = !isEmpty || list.api.hasEmpty();
        if (props.isOpen.get()) {
          if (!canShow) close();
        } else if (
          props.popupTrigger() !== 'manual' &&
          typed.trim() !== '' &&
          canShow
        ) {
          open('typing');
        }
      }
      if (
        props.shouldHighlightFirstMatch() &&
        isShown() &&
        isInsertion((inputEvent as InputEvent).inputType ?? '')
      ) {
        highlightFirstMatch(true);
      }
    };

    /** Drops typed text a controlled value hasn't caught up with. */
    const revertText = () => editing.api.revert();

    const onInputKeyDown = (keyEvent: KeyboardEvent) => {
      if (keyEvent.defaultPrevented || isComposing(keyEvent)) return;
      if (isDisabled() || keyEvent.ctrlKey || keyEvent.metaKey) return;
      const isNowShown = isShown();
      const options = list.api.collection();
      const current = isNowShown ? list.api.focusedKey() : null;
      switch (keyEvent.key) {
        case 'ArrowDown':
        case 'ArrowUp': {
          const isDown = keyEvent.key === 'ArrowDown';
          if (keyEvent.altKey) {
            // The APG's: Alt+ArrowDown opens, Alt+ArrowUp closes. Inline,
            // nothing opens or closes, and the caret moves.
            if (!isPopup() || isDown === isNowShown) return;
            keyEvent.preventDefault();
            if (isDown) open('alt');
            else close();
            return;
          }
          if (keyEvent.shiftKey) return;
          keyEvent.preventDefault();
          if (!isNowShown) {
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
          if (target !== null) highlight(target, true);
          return;
        }
        case 'PageDown':
        case 'PageUp':
          if (current === null || keyEvent.altKey || keyEvent.shiftKey) return;
          keyEvent.preventDefault();
          highlight(
            list.api.pageFrom(current, keyEvent.key === 'PageDown' ? 1 : -1),
            true,
          );
          return;
        case 'Home':
        case 'End':
        case 'ArrowLeft':
        case 'ArrowRight':
          // The caret moves, and the highlight goes (APG, React Aria).
          if (current !== null) highlight(null, false);
          return;
        case 'Enter':
          if (keyEvent.altKey) return;
          if (current !== null) {
            keyEvent.preventDefault();
            if (!keyEvent.repeat) list.api.activate(current);
          }
          // With nothing highlighted, the composer's, or a form submits.
          return;
        case 'Escape':
          if (keyEvent.shiftKey || keyEvent.altKey) return;
          if (isPopup()) {
            // Closed, the composer's (Combobox reverts the text).
            if (!isNowShown) return;
            keyEvent.preventDefault();
            close();
            return;
          }
          // Inline: the text clears, then Escape is the page's, so a dialog
          // around it closes.
          if (text() === '' || isReadOnly()) return;
          keyEvent.preventDefault();
          revertText();
          inputValue.set('');
          highlight(null, false);
          return;
      }
    };

    /** Focuses the input without scrolling, unless it has focus. */
    let isFocusingFromPress = false;
    const focusInput = () => {
      const input = inputElement();
      if (!input || input.ownerDocument.activeElement === input) return;
      isFocusingFromPress = true;
      try {
        input.focus({ preventScroll: true });
      } finally {
        isFocusingFromPress = false;
      }
    };

    const onInputFocus = () => {
      if (!isPopup() || isFocusingFromPress) return;
      if (props.popupTrigger() === 'focus') open('focus');
    };

    // The button never takes focus. A mouse or pen toggles on press start,
    // below; touch and screen readers on release (Pointer and touch).
    const toggle = (how: Opening) => {
      focusInput();
      if (props.isOpen.get()) close();
      else open(how);
    };
    const trigger = ctx.use(
      button,
      () => ({
        isDisabled: isDisabled(),
        shouldPreventFocusOnPress: true,
        shouldExcludeFromTabOrder: true,
        onPress: (pressEvent: { pointerType: string }) => {
          if (pressEvent.pointerType === 'touch') toggle('button');
          else if (pressEvent.pointerType === 'virtual') toggle('virtual');
        },
      }),
      { parts: { root: 'button', ...NO_ITEM_PARTS } },
    );
    const onButtonPointerDown = (pointerEvent: PointerEvent) => {
      if (pointerEvent.button !== 0 || pointerEvent.pointerType === 'touch') {
        return;
      }
      if (isDisabled()) return;
      toggle('button');
    };

    /**
     * Inline, hover highlights an option only while focus is in, and only
     * as the pointer moves: Chromium sends an option the boundary events of
     * a pointer resting over it whenever the page changes, so a resting
     * pointer would leave an option for Enter to choose after tabbing in
     * (Focus). A highlight the keys moved stays, as in Listbox.
     */
    const onPointerMove = (pointerEvent: PointerEvent) => {
      if (isPopup() || pointerEvent.pointerType === 'touch') return;
      if (!focusWithin.isFocusWithin() || list.api.isHighlightVisible()) return;
      const key = list.api.hoveredKey();
      if (key !== null && key !== list.api.focusedKey()) highlight(key, false);
    };

    /**
     * A press in the popup, or inline in the list, the scroller or the
     * empty part, outside a control of its own, keeps focus where it is:
     * those parts count as no control, though the list and the scroller
     * carry a `tabindex`. Inline, a mouse or pen press then moves focus to
     * the input; a touch doesn't, so no virtual keyboard opens (Focus).
     */
    let pressType = 'mouse';
    const onPointerDown = (pointerEvent: PointerEvent) => {
      pressType = pointerEvent.pointerType;
    };
    // A press reaches each of these parts on its path; the innermost acts.
    const handled = new WeakSet<Event>();
    const onMouseDown = (mouseEvent: MouseEvent) => {
      if (handled.has(mouseEvent) || mouseEvent.button !== 0) return;
      handled.add(mouseEvent);
      const target = mouseEvent.target as Element | null;
      if (!target) return;
      // The parts themselves: React and custom elements listen from the
      // root, so `currentTarget` isn't one, and a focusable element around
      // them (a dialog) is no control of theirs.
      const parts = ['list', 'scroller', isPopup() ? 'popup' : 'empty'].map(
        (name) => partElement(ctx, name),
      );
      const control = target.closest<HTMLElement>(CONTROLS);
      if (
        control &&
        !parts.includes(control) &&
        parts.some((part) => part?.contains(control))
      ) {
        return;
      }
      mouseEvent.preventDefault();
      if (!isPopup() && pressType !== 'touch' && !isDisabled()) {
        focusInput();
      }
    };

    // Focus leaving: reported first, so a composer that settles on it acts
    // before the list closes; then in popup mode the list closes, before
    // the press that moved it acts, and inline the highlight clears. The
    // window losing focus leaves the input focused, and changes nothing
    // (Focus).
    ctx.watch(focusWithin.isFocusWithin, (isFocusWithin) => {
      ctx.emit('focusChange', isFocusWithin);
      if (isFocusWithin) return;
      const input = inputElement();
      if (input && input.ownerDocument.activeElement === input) return;
      if (isPopup()) close();
      else highlight(null, false);
    });

    // Form reset: the text goes back to its default, or controlled without
    // one to the text it mounted with, as TextInput's, and the filter to
    // where it starts, while the selection stays, as Listbox's (Who resets
    // a form value). Composed with its text given, the composer resets it.
    let initial: string | undefined;
    partEffect(ctx, 'input', (element) => {
      initial ??= inputValue.get();
      const form = (element as HTMLInputElement).form;
      if (!form) return;
      const onReset = (resetEvent: Event) => {
        if (resetEvent.defaultPrevented) return;
        ctx.batch(() => {
          filtering.set('auto');
          inputValue.reset({ fallback: initial });
        });
      };
      form.addEventListener('reset', onReset);
      return () => form.removeEventListener('reset', onReset);
    });

    if (isDevelopment()) {
      // Inline, the input and the list need a name (Live announcements); a
      // composer of popup mode names its own, and needs a popup part.
      ctx.effect(() => {
        const check = () => {
          if (isPopup()) {
            if (!partElement(ctx, 'popup')) {
              warn(
                'autocomplete: popup mode has no popup part. Map the ' +
                  'element that holds the list to it.',
              );
            }
            return;
          }
          const input = inputElement();
          const listElement = partElement(ctx, 'list');
          const isNamed = (element: Element) =>
            element.hasAttribute('aria-label') ||
            !!element.getAttribute('aria-labelledby');
          if (input && !isNamed(input)) {
            warn(
              'autocomplete: the input has no name. Render a label part, or ' +
                'give it labelledBy or an aria-label.',
            );
          } else if (listElement && !isNamed(listElement)) {
            warn(
              'autocomplete: the list has no name. Render a label part, or ' +
                'give Autocomplete labelledBy.',
            );
          }
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
      editing,
      list,
      trigger,
      text,
      revertText,
      collection,
      collator,
      isFiltering,
      matchesFor,
      isMatch,
      isShown,
      isFiltered: () => visible() !== null,
      isDescendantHeld: () => isDescendantHeld.get(),
      section: (key: string) => collection().section(key),
      isFocusWithin: focusWithin.isFocusWithin,
      isFocusVisible: focusWithin.isFocusVisible,
      inputHandlers: {
        input: onInput,
        keydown: onInputKeyDown,
        focus: onInputFocus,
      } satisfies DomHandlers,
      pressHandlers: {
        pointerdown: onPointerDown,
        pointermove: onPointerMove,
        mousedown: onMouseDown,
      } satisfies DomHandlers,
      onButtonPointerDown,
      // As a press on the button opens it (Actions).
      open: () => open('button'),
      close,
      showAll: () => filtering.set('off'),
    };
  },
  expose({ props, api }) {
    const list = api.list.state();
    const isShown = api.isShown();
    return {
      value: props.value.get(),
      inputValue: api.text(),
      isOpen: isShown,
      focusedKey: isShown ? list.focusedKey : null,
      isEmpty: list.isEmpty,
      isDisabled: api.field.api.isDisabled(),
      isReadOnly: api.field.api.isReadOnly(),
      isRequired: props.isRequired(),
      isInvalid: api.field.api.isInvalid(),
      isErrorShown: api.field.api.isErrorShown(),
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
    const editing = api.editing.connect().root as DomPartProps;
    const buttonRoot = api.trigger.connect().root as DomPartProps;
    const isPopup = props.hasPopup();
    const isShown = api.isShown();
    const isDisabled = api.field.api.isDisabled();
    const state = {
      'data-open': flag(isShown),
      'data-disabled': flag(isDisabled),
      'data-readonly': flag(api.field.api.isReadOnly()),
      'data-required': flag(props.isRequired()),
      'data-invalid': flag(api.field.api.isInvalid()),
      'data-validating': flag(api.field.api.status() === 'validating'),
      'data-empty': flag(api.list.state().isEmpty),
      'data-focus-within': flag(api.isFocusWithin()),
      'data-focus-visible': flag(api.isFocusVisible()),
    };
    const withState = (part: PartProps): DomPartProps => {
      const own = part as DomPartProps;
      return { ...own, attrs: { ...own.attrs, ...state } };
    };
    /** Inline, the list, the scroller and the empty part take presses. */
    const pressable = (part: DomPartProps): DomPartProps =>
      isPopup
        ? part
        : { ...part, on: mergeHandlers(part.on ?? {}, api.pressHandlers) };
    const control = fieldParts.control;
    const listRoot = listParts.list as DomPartProps;
    const listId = listRoot.attrs.id;
    const highlighted = isShown ? api.list.api.focusedKey() : null;
    const input: DomPartProps = {
      ...editing,
      attrs: {
        ...editing.attrs,
        // Autocomplete's state attributes, not TextInput's.
        'data-hovered': undefined,
        'data-focused': undefined,
        ...control.attrs,
        role: 'combobox',
        'aria-autocomplete': 'list',
        'aria-expanded': String(isShown),
        'aria-controls': listId,
        // Only once the option's element exists: an id that resolves to
        // nothing is non-conforming, and Chromium drops the relation
        // (virtualization spec, ARIA). It waits after typing highlights a
        // match (The highlight while typing).
        'aria-activedescendant':
          highlighted === null ||
          api.isDescendantHeld() ||
          !api.list.api.isRendered('option', highlighted)
            ? undefined
            : itemId(api.list.api.base(), 'option', highlighted),
        autocomplete: 'off',
        autocorrect: 'off',
        spellcheck: 'false',
        ...state,
      },
      on: mergeHandlers(editing.on ?? {}, api.inputHandlers),
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
        'aria-expanded': String(isShown),
        'aria-controls': listId,
        ...state,
      },
      on: mergeHandlers(buttonHandlers, {
        pointerdown: api.onButtonPointerDown,
      }),
    };
    // Inline, the list and the scroller are no tab stop: a scrolling
    // element with no focusable child is one in Firefox and Chromium.
    const tabStop = isPopup ? {} : { tabindex: '-1' };
    const scrollerRoot = listParts.scroller as DomPartProps;
    return {
      root: withState(fieldParts.root),
      label: withState(fieldParts.label),
      input,
      button: buttonPart,
      popup: {
        attrs: state,
        ...(isPopup ? { on: api.pressHandlers } : {}),
      } satisfies DomPartProps,
      scroller: pressable({
        ...scrollerRoot,
        attrs: { ...scrollerRoot.attrs, ...tabStop },
      }),
      list: pressable({
        ...listRoot,
        attrs: {
          ...listRoot.attrs,
          'aria-labelledby': control.attrs['aria-labelledby'],
          ...tabStop,
          ...state,
        },
      }),
      empty: pressable(withState(listParts.empty)),
      description: withState(fieldParts.description),
      error: withState(fieldParts.error),
      errorText: withState(fieldParts.errorText),
    };
  },
  connectItem({ api }, part, key) {
    const item = api.list.connectItem(part, key) as DomPartProps;
    const isHidden =
      part === 'group'
        ? api.isFiltered() &&
          !(api.section(key)?.keys.some((each) => api.isMatch(each)) ?? true)
        : part === 'option' && !api.isMatch(key);
    const result: DomPartProps = {
      ...item,
      attrs: { ...item.attrs, hidden: flag(isHidden) },
    };
    return result as PartProps;
  },
});
