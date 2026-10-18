/**
 * Listbox, from the approved spec (`./spec.md`): Field composed on a
 * `role="listbox"` list whose options are item parts (Item parts), one per
 * item of `items`. Focus roves between the options (Resolved questions 4);
 * selection is a list of keys in both modes (Resolved questions 5), changed
 * by presses, Enter and Space, and in multiple mode by ranges from an anchor
 * (Resolved questions 9). Arrows, Home, End, the page keys and typeahead
 * move focus only.
 *
 * In virtual focus (`shouldUseVirtualFocus`, Combobox's), DOM focus stays
 * in the composing component's input: the highlighted option is state the
 * component moves through the api, and nothing in the list takes focus.
 *
 * Item props are cached per key, so every change an option shows is
 * reported with `ctx.invalidateItems()`: the watches below name the keys
 * whose focus, tab stop, hover, press or selection changed.
 *
 * With a `virtualizer` (`./virtualization.md`) only `renderedKeys` are
 * rendered: the options in and near the view, and the pins (the focused
 * option, the tab stop, the highlighted and pressed options, and the
 * target of a move), which `./virtual-list.ts` lays out. A move to an
 * option outside the view pins it, scrolls to its position, and focuses it
 * once its element attaches.
 */

import {
  createListCollection,
  createTypeahead,
  findByText,
} from '../../collections';
import type { ListCollection } from '../../collections';
import {
  createFocusWithin,
  createItemPress,
  isComposing,
  isDevelopment,
  isMac,
  modalityTrackerFor,
  mergeHandlers,
  partEffect,
  partElement,
  warn,
} from '../../dom';
import type { DomPartProps } from '../../dom';
import type { PartProps } from '../../runtime';
import { bindable, defineComponent, event, itemId, prop } from '../../runtime';
import { field } from '../field/field';
import {
  createVirtualList,
  renderedKeysChange,
  virtualProps,
} from './virtual-list';

const flag = (isOn: boolean): string | undefined => (isOn ? '' : undefined);

type Orientation = 'vertical' | 'horizontal';
type SelectionMode = 'single' | 'multiple';

/** The item shape the accessors read by default. */
interface DefaultItem {
  readonly key?: string;
  readonly textValue?: string;
  readonly isDisabled?: boolean;
  readonly items?: readonly unknown[];
}

const defaultGetKey = (item: never): string =>
  String((item as DefaultItem).key);
const defaultGetTextValue = (item: never): string =>
  (item as DefaultItem).textValue ?? '';
const defaultIsItemDisabled = (item: never): boolean =>
  (item as DefaultItem).isDisabled === true;
const defaultGetChildren = (item: never): readonly unknown[] | undefined =>
  (item as DefaultItem).items;

/** Keys present in one list and not the other. */
function difference(
  a: readonly string[],
  b: readonly string[],
): readonly string[] {
  const inA = new Set(a);
  const inB = new Set(b);
  return [
    ...a.filter((key) => !inB.has(key)),
    ...b.filter((key) => !inA.has(key)),
  ];
}

/** The nearest box that scrolls `element` along the list's axis. */
function scrollerOf(
  element: HTMLElement,
  isVertical: boolean,
): HTMLElement | null {
  const view = element.ownerDocument.defaultView;
  for (
    let node = element.parentElement;
    node && view;
    node = node.parentElement
  ) {
    const style = view.getComputedStyle(node);
    const overflow = isVertical ? style.overflowY : style.overflowX;
    const scrolls = isVertical
      ? node.scrollHeight > node.clientHeight
      : node.scrollWidth > node.clientWidth;
    if (scrolls && /auto|scroll|overlay/.test(overflow)) return node;
  }
  const page = element.ownerDocument.scrollingElement as HTMLElement | null;
  if (!page) return null;
  const scrolls = isVertical
    ? page.scrollHeight > page.clientHeight
    : page.scrollWidth > page.clientWidth;
  return scrolls ? page : null;
}

export const listbox = defineComponent({
  name: 'listbox',
  parts: ['root', 'label', 'scroller', 'list', 'description', 'error', 'empty'],
  itemParts: [
    'option',
    'optionLabel',
    'optionDescription',
    'group',
    'groupLabel',
  ],
  props: {
    // The element reads them from its option and group parts while the
    // consumer sets none (Resolved questions 3).
    items: prop<readonly unknown[]>([], {
      attribute: false,
      adopt: { items: { item: 'option', section: 'group' } },
    }),
    getKey: prop<(item: never) => string>(defaultGetKey, {
      attribute: false,
    }),
    getTextValue: prop<(item: never) => string>(defaultGetTextValue, {
      attribute: false,
    }),
    isItemDisabled: prop<(item: never) => boolean>(defaultIsItemDisabled, {
      attribute: false,
    }),
    getChildren: prop<(item: never) => readonly unknown[] | undefined>(
      defaultGetChildren,
      { attribute: false },
    ),
    disabledKeys: prop<readonly string[]>([], { type: 'json' }),
    value: bindable<readonly string[]>([], { attribute: false }),
    selectionMode: prop<SelectionMode>('single'),
    isDisabled: prop(false),
    isReadOnly: prop(false, { attribute: 'readonly' }),
    isRequired: prop(false),
    isInvalid: prop(false),
    orientation: prop<Orientation>('vertical'),
    shouldFocusWrap: prop(false),
    shouldFocusOnHover: prop(false),
    // Set by a component that keeps focus in its own input (Combobox).
    shouldUseVirtualFocus: prop(false, { attribute: false }),
    // Field's `controlId`. The element adopts the list's id.
    listId: prop<string | undefined>(undefined, {
      attribute: false,
      adopt: { part: 'list', attribute: 'id' },
    }),
    // A listbox can't be labelled natively. The element reads the label's tag.
    labelElementType: prop('span', {
      attribute: false,
      adopt: { part: 'label', tag: true },
    }),
    labelledBy: prop<string | undefined>(undefined, { type: 'string' }),
    describedBy: prop<string | undefined>(undefined, { type: 'string' }),
    // Virtualization (`./virtualization.md`, Props).
    ...virtualProps,
  },
  events: {
    action: event<string>(),
    focusChange: event<boolean>(),
    renderedKeysChange,
  },
  setup(ctx) {
    const { props } = ctx;
    const labelling = ctx.use(
      field,
      () => ({
        isInvalid: props.isInvalid(),
        isRequired: props.isRequired(),
        isDisabled: props.isDisabled(),
        controlId: props.listId(),
        labelElementType: props.labelElementType(),
        labelledBy: props.labelledBy(),
        describedBy: props.describedBy(),
      }),
      { parts: { control: 'list' } },
    );
    const focusWithin = createFocusWithin(ctx, {
      part: 'list',
      isDisabled: props.isDisabled,
    });
    ctx.watch(focusWithin.isFocusWithin, (isFocusWithin) => {
      ctx.emit('focusChange', isFocusWithin);
    });

    // Built once per items; the accessors are read with them.
    const collection = ctx.memo(
      () => [props.items(), props.disabledKeys()] as const,
      (items, disabledKeys): ListCollection<unknown> => {
        const list = createListCollection<unknown>(
          items,
          {
            getKey: props.getKey() as (item: unknown) => string,
            getTextValue: props.getTextValue() as (item: unknown) => string,
            isDisabled: props.isItemDisabled() as (item: unknown) => boolean,
            getChildren: props.getChildren() as (
              item: unknown,
            ) => readonly unknown[] | undefined,
          },
          disabledKeys,
        );
        if (isDevelopment()) {
          if (list.duplicates.length > 0) {
            warn(
              `listbox: keys ${list.duplicates.map((key) => `"${key}"`).join(', ')} ` +
                'appear more than once; only the first of each is an option.',
            );
          }
          const silent = list.options.filter((option) => !option.textValue);
          if (silent.length > 0) {
            warn(
              `listbox: options ${silent.map(({ key }) => `"${key}"`).join(', ')} ` +
                'have no textValue, so typeahead never finds them.',
            );
          }
        }
        return list;
      },
    );
    const value = () => props.value.get();
    const selected = ctx.memo(
      () => [value()] as const,
      (keys) => new Set(keys),
    );
    const isMultiple = () => props.selectionMode() === 'multiple';
    const isVertical = () => props.orientation() !== 'horizontal';
    const isVirtual = () => props.shouldUseVirtualFocus();
    const isEnabled = (key: string) =>
      !props.isDisabled() && collection().isEnabled(key);

    /** The option with DOM focus. */
    const focusedKey = ctx.state<string | null>(null);
    /** The option focused last, where Tab comes back to. */
    const lastFocused = ctx.state<string | null>(null);
    const hoveredKey = ctx.state<string | null>(null);
    // Virtual focus: the highlighted option, and whether the keyboard moved
    // it there (its focus-visible).
    const highlightedKey = ctx.state<string | null>(null);
    const isHighlightVisible = ctx.state(false);
    // Range selection (Selection): where ranges start, and where the last
    // one ended, so the next range from the same anchor replaces it.
    let anchor: string | null = null;
    let rangeEnd: string | null = null;
    /** The option focused before a pointer press moved focus. */
    let focusBeforePress: string | null = null;
    /**
     * Virtualized: the option a move went to before it was rendered, pinned
     * until its element attaches and takes focus (Focus).
     */
    const target = ctx.state<string | null>(null);

    // Tab enters at the option focused last, else the first selected, else
    // the first enabled one (the APG); none when nothing can take focus.
    const tabStop = ctx.memo(
      () =>
        [
          collection(),
          lastFocused.get(),
          selected(),
          props.isDisabled(),
        ] as const,
      (list, last, keys, isDisabled): string | null => {
        if (isDisabled) return null;
        if (last !== null && list.isEnabled(last)) return last;
        if (keys.size > 0) {
          const first = list.options.find(
            (option) => !option.isDisabled && keys.has(option.key),
          );
          if (first) return first.key;
        }
        return list.first();
      },
    );

    const base = () => props.listId() ?? ctx.ids.list;
    const optionElement = (key: string) =>
      ctx.itemElement('option', key) as HTMLElement | null;

    const virtual = createVirtualList(ctx, {
      collection,
      virtualizer: props.virtualizer,
      itemSize: props.itemSize,
      shouldMeasureItems: props.shouldMeasureItems,
      overscan: props.overscan,
      initialItemCount: props.initialItemCount,
      isVertical,
      pins: () => [
        focusedKey.get(),
        tabStop(),
        highlightedKey.get(),
        press.pressedKey(),
        target.get(),
      ],
    });
    ctx.watch(virtual.renderedKeys, (keys) => {
      ctx.emit('renderedKeysChange', {
        keys,
        sections: virtual.renderedSections(),
      });
    });

    /** Scrolls an option into view: by its position while virtualized. */
    const reveal = (key: string) => {
      if (virtual.isOn()) virtual.scrollTo(key);
      else {
        optionElement(key)?.scrollIntoView({
          block: 'nearest',
          inline: 'nearest',
        });
      }
    };

    // Each change an option shows names its keys (see the module notes).
    const invalidate = (...keys: (string | null)[]) => {
      ctx.invalidateItems(keys.filter((key): key is string => key !== null));
    };
    const follow = (read: () => string | null) =>
      ctx.watch(read, (key, previous) => invalidate(key, previous));
    follow(tabStop);
    follow(focusedKey.get);
    follow(hoveredKey.get);
    follow(highlightedKey.get);
    ctx.watch(isHighlightVisible.get, () => invalidate(highlightedKey.get()));
    ctx.watch(focusWithin.isFocusVisible, () => invalidate(focusedKey.get()));
    ctx.watch(value, (next, previous) => {
      ctx.invalidateItems(difference(next, previous));
    });
    ctx.watch(props.isDisabled, (isDisabled) => {
      if (isDisabled) hoveredKey.set(null);
    });

    const setValue = (next: readonly string[]) => {
      if (
        next.length === value().length &&
        next.every((key, index) => key === value()[index])
      ) {
        return;
      }
      props.value.set(next);
    };

    /** A press, Enter or Space on an option (Selection). */
    const activate = (key: string) => {
      if (!isEnabled(key) || props.isReadOnly()) return;
      const current = value();
      if (!isMultiple()) {
        setValue([key]);
        anchor = rangeEnd = key;
      } else if (selected().has(key)) {
        // Toggling off leaves the anchor, as in React Aria.
        setValue(current.filter((each) => each !== key));
      } else {
        setValue([...current, key]);
        anchor = rangeEnd = key;
      }
      ctx.emit('action', key);
    };

    /**
     * Selects from the anchor to `target`, replacing the range last made
     * from the same anchor. With no anchor yet, `from` (the option focused
     * before) is the anchor.
     */
    const extendTo = (target: string, from: string | null) => {
      if (!isMultiple() || props.isReadOnly() || props.isDisabled()) return;
      const list = collection();
      const start = anchor ?? from ?? target;
      if (anchor === null) rangeEnd = null;
      const previous = new Set(
        rangeEnd === null ? [] : list.range(start, rangeEnd),
      );
      const next = value().filter((key) => !previous.has(key));
      const kept = new Set(next);
      for (const key of list.range(start, target)) {
        if (!kept.has(key)) next.push(key);
      }
      anchor = start;
      rangeEnd = target;
      setValue(next);
    };

    const selectAll = () => {
      if (props.isReadOnly() || props.isDisabled()) return;
      const current = value();
      const has = new Set(current);
      setValue([
        ...current,
        ...collection()
          .enabledKeys()
          .filter((key) => !has.has(key)),
      ]);
    };

    /**
     * Moves focus after a key, scrolling the option into view (Focus).
     * Virtualized, an option not rendered yet is pinned and takes focus
     * when its element attaches.
     */
    const moveTo = (key: string | null) => {
      if (key === null) return;
      const element = optionElement(key);
      if (virtual.isOn()) target.set(element ? null : key);
      if (!element && !virtual.isOn()) return;
      element?.focus({ preventScroll: true });
      reveal(key);
    };

    ctx.itemEffect('option', (key, element) => {
      if (key === target.get()) {
        target.set(null);
        if (focusWithin.isFocusWithin()) {
          (element as HTMLElement).focus({ preventScroll: true });
        }
      }
      // A row that unmounts under a resting pointer gets no pointerleave.
      return () => {
        if (hoveredKey.get() === key) hoveredKey.set(null);
      };
    });

    /**
     * Virtual focus: highlights `key`, or nothing. Moved by the keyboard, the
     * option is scrolled into view, as browsers don't do it for
     * `aria-activedescendant`.
     */
    const highlight = (key: string | null, isKeyboard: boolean) => {
      const target = key !== null && isEnabled(key) ? key : null;
      highlightedKey.set(target);
      isHighlightVisible.set(target !== null && isKeyboard);
      if (target === null || !isKeyboard) return;
      reveal(target);
    };

    /**
     * Page Up and Page Down: the farthest option within one visible height of
     * the list's scroll container from the focused one, as React Aria
     * measures; without one, the first or last option. Virtualized, from
     * the rows' positions, so it works off screen.
     */
    const pageFrom = (key: string, step: 1 | -1): string | null => {
      const paged = virtual.pageFrom(key, step);
      if (paged !== undefined) return paged;
      const list = collection();
      const element = optionElement(key);
      const isAlong = isVertical();
      const scroller = element ? scrollerOf(element, isAlong) : null;
      if (!element || !scroller) return step > 0 ? list.last() : list.first();
      const page = isAlong ? scroller.clientHeight : scroller.clientWidth;
      const from = element.getBoundingClientRect();
      let target: string | null = null;
      for (
        let at = step > 0 ? list.next(key) : list.previous(key);
        at !== null;
        at = step > 0 ? list.next(at) : list.previous(at)
      ) {
        const rect = optionElement(at)?.getBoundingClientRect();
        if (!rect) continue;
        const distance =
          step > 0
            ? isAlong
              ? rect.bottom - from.bottom
              : rect.right - from.right
            : isAlong
              ? from.top - rect.top
              : from.left - rect.left;
        if (target !== null && distance > page) break;
        target = at;
      }
      return target ?? key;
    };

    const typeahead = createTypeahead();
    const search = (query: string, fromKey: string) => {
      const list = collection();
      return findByText(query, {
        keys: list.keys,
        getTextValue: (key) => list.get(key)?.textValue ?? '',
        isDisabled: (key) => !list.isEnabled(key),
        fromKey,
      });
    };

    /** Keys on a focused option (Keyboard). */
    const onOptionKeyDown = (key: string, keyEvent: KeyboardEvent) => {
      if (keyEvent.defaultPrevented || isComposing(keyEvent)) return;
      if (props.isDisabled()) return;
      const list = collection();
      const view = keyEvent.view ?? globalThis.window;
      const isAppleKey = view ? isMac(view) : false;
      const isMod = isAppleKey ? keyEvent.metaKey : keyEvent.ctrlKey;
      const isRange = keyEvent.shiftKey && isMultiple();
      const isPlain =
        !keyEvent.altKey && !keyEvent.ctrlKey && !keyEvent.metaKey;
      const wrap = props.shouldFocusWrap();

      let forward = isVertical() ? 'ArrowDown' : 'ArrowRight';
      let backward = isVertical() ? 'ArrowUp' : 'ArrowLeft';
      if (!isVertical()) {
        // Right to left, the horizontal arrows swap, as in RadioGroup.
        const element = partElement(ctx, 'list');
        const listView = element?.ownerDocument.defaultView;
        if (
          element &&
          listView?.getComputedStyle(element).direction === 'rtl'
        ) {
          [forward, backward] = [backward, forward];
        }
      }

      const go = (target: string | null) => {
        keyEvent.preventDefault();
        if (target === null) return;
        if (isRange) extendTo(target, key);
        moveTo(target);
      };

      switch (keyEvent.key) {
        case forward:
          if (isPlain) go(list.next(key, wrap));
          return;
        case backward:
          if (isPlain) go(list.previous(key, wrap));
          return;
        case 'Home':
        case 'End': {
          if (keyEvent.altKey) return;
          const target = keyEvent.key === 'Home' ? list.first() : list.last();
          keyEvent.preventDefault();
          if (target === null) return;
          // Only Ctrl+Shift (Cmd+Shift) extends; Shift alone moves.
          if (isRange && isMod) extendTo(target, key);
          moveTo(target);
          return;
        }
        case 'PageDown':
        case 'PageUp':
          if (isPlain) go(pageFrom(key, keyEvent.key === 'PageDown' ? 1 : -1));
          return;
        case 'Enter':
          if (!isPlain) return;
          keyEvent.preventDefault();
          if (!keyEvent.repeat) activate(key);
          return;
        case ' ':
          if (typeahead.isSearching(keyEvent.timeStamp)) break;
          if (!isPlain) return;
          keyEvent.preventDefault();
          if (keyEvent.repeat) return;
          if (isRange) {
            extendTo(key, key);
            if (!props.isReadOnly()) ctx.emit('action', key);
          } else activate(key);
          return;
        case 'a':
        case 'A':
          if (isMod && !keyEvent.altKey && !keyEvent.shiftKey && isMultiple()) {
            keyEvent.preventDefault();
            selectAll();
            return;
          }
          break;
      }
      const result = typeahead.handleKey(keyEvent, (query) =>
        search(query, key),
      );
      if (!result.isHandled) return;
      keyEvent.preventDefault();
      if (result.key !== null && result.key !== key) moveTo(result.key);
    };

    /** Keys while the list itself has focus: no option could take it. */
    const onListKeyDown = (keyEvent: KeyboardEvent) => {
      const list = partElement(ctx, 'list');
      if (keyEvent.target !== list || keyEvent.defaultPrevented) return;
      if (keyEvent.altKey || keyEvent.ctrlKey || keyEvent.metaKey) return;
      const options = collection();
      const isEnd = ['End', 'ArrowUp', 'ArrowLeft'].includes(keyEvent.key);
      const isStart = ['Home', 'ArrowDown', 'ArrowRight'].includes(
        keyEvent.key,
      );
      if (!isEnd && !isStart) return;
      keyEvent.preventDefault();
      moveTo(isEnd ? options.last() : options.first());
    };

    /**
     * Focus on the list itself, from a click or a script while an option is
     * the tab stop, goes on to that option.
     */
    const onListFocusIn = (focusEvent: FocusEvent) => {
      if (focusEvent.target !== partElement(ctx, 'list')) return;
      if (props.isDisabled()) return;
      moveTo(tabStop());
    };

    const press = createItemPress(ctx, {
      element: optionElement,
      isDisabled: (key) => !isEnabled(key),
      shouldPreventFocusOnPress: isVirtual,
      onPress(key, pressEvent) {
        if (pressEvent.shiftKey && isMultiple()) {
          extendTo(key, focusBeforePress);
          if (!props.isReadOnly()) ctx.emit('action', key);
          return;
        }
        activate(key);
      },
    });
    follow(press.pressedKey);

    const optionHandlers = (key: string) =>
      mergeHandlers(
        {
          pointerdown() {
            focusBeforePress = lastFocused.get();
          },
          mousedown(mouseEvent) {
            // A disabled option keeps focus where it was rather than
            // dropping it to the body, and Shift+click selects no text.
            if (!isEnabled(key) || (mouseEvent.shiftKey && isMultiple())) {
              mouseEvent.preventDefault();
            }
          },
          focusin(focusEvent) {
            if (focusEvent.target !== optionElement(key)) return;
            focusedKey.set(key);
            lastFocused.set(key);
          },
          focusout(focusEvent) {
            if (focusEvent.target !== optionElement(key)) return;
            if (focusedKey.get() === key) focusedKey.set(null);
          },
          keydown: (keyEvent) => onOptionKeyDown(key, keyEvent),
          pointerenter(pointerEvent) {
            if (pointerEvent.pointerType === 'touch' || !isEnabled(key)) return;
            const element = optionElement(key);
            if (!element) return;
            if (
              pointerEvent.pointerType === 'mouse' &&
              modalityTrackerFor(element)?.isEmulatingMouse()
            ) {
              return;
            }
            hoveredKey.set(key);
            // A highlight the keys moved stays until a press, as keyboard
            // focus does below (React Aria).
            if (isVirtual()) {
              if (props.shouldFocusOnHover() && !isHighlightVisible.get()) {
                highlight(key, false);
              }
              return;
            }
            // Hover focus stays inside the list, and leaves keyboard focus
            // where it is.
            if (
              props.shouldFocusOnHover() &&
              focusWithin.isFocusWithin() &&
              !focusWithin.isFocusVisible() &&
              element.ownerDocument.activeElement !== element
            ) {
              element.focus({ preventScroll: true });
            }
          },
          pointerleave() {
            if (hoveredKey.get() === key) hoveredKey.set(null);
          },
        },
        press.handlers(key),
      );

    // The focused option went away (its item removed or disabled): focus
    // moves to the next option of the old order still enabled, else the
    // previous, else the list. After the flush, so the list has its tab stop.
    ctx.watch(collection, (next, previous) => {
      const highlighted = highlightedKey.get();
      if (highlighted !== null && !next.isEnabled(highlighted)) {
        highlight(null, false);
      }
      const key = focusedKey.get();
      if (key === null || next.isEnabled(key)) return;
      const option = previous.get(key);
      if (!option) return;
      const isLeft = (each: { key: string }) =>
        each.key !== key && next.isEnabled(each.key);
      const target =
        previous.options.slice(option.index + 1).find(isLeft) ??
        previous.options.slice(0, option.index).reverse().find(isLeft);
      focusedKey.set(null);
      queueMicrotask(() => {
        if (target && virtual.isOn()) {
          moveTo(target.key);
          return;
        }
        const element =
          (target ? optionElement(target.key) : null) ??
          partElement(ctx, 'list');
        element?.focus({ preventScroll: true });
      });
    });

    // The empty part describes the list while it is empty, once rendered.
    const hasEmpty = ctx.state(false);
    partEffect(ctx, 'empty', () => {
      hasEmpty.set(true);
      return () => hasEmpty.set(false);
    });

    if (isDevelopment()) {
      // A listbox needs a name (Props).
      ctx.effect(() => {
        const check = () => {
          const list = partElement(ctx, 'list');
          if (
            !list ||
            list.hasAttribute('aria-label') ||
            list.getAttribute('aria-labelledby')
          ) {
            return;
          }
          warn(
            'listbox: the list has no name. Render a label part, or give it ' +
              'labelledBy or an aria-label.',
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
      virtual,
      collection,
      selected,
      tabStop,
      base,
      focusedKey: () => (isVirtual() ? highlightedKey.get() : focusedKey.get()),
      isHighlightVisible: () => isHighlightVisible.get(),
      hoveredKey: () => hoveredKey.get(),
      pressedKey: press.pressedKey,
      isFocusWithin: focusWithin.isFocusWithin,
      isFocusVisible: focusWithin.isFocusVisible,
      hasEmpty: () => hasEmpty.get(),
      /** Where focus goes when the list next takes it (Select's open). */
      setTabStop: (key: string | null) => lastFocused.set(key),
      /** Chooses an option as a press would (Select's press and release). */
      activate,
      /** Virtual focus: the option the composing component highlights. */
      highlight,
      /** The option a page key moves to from `key` (Combobox's). */
      pageFrom,
      /** Scrolls an option into view without moving focus (Combobox's open). */
      reveal,
      optionHandlers,
      listHandlers: { keydown: onListKeyDown, focusin: onListFocusIn },
      isRendered: (part: string, key: string) =>
        ctx.itemElement(part, key) !== null,
    };
  },
  expose({ props, api }) {
    return {
      value: props.value.get(),
      selectionMode: props.selectionMode(),
      focusedKey: props.shouldUseVirtualFocus()
        ? api.focusedKey()
        : api.tabStop(),
      isEmpty: api.collection().options.length === 0,
      isDisabled: props.isDisabled(),
      isReadOnly: props.isReadOnly(),
      isRequired: props.isRequired(),
      isInvalid: props.isInvalid(),
      isErrorShown: api.field.state().isErrorShown,
      isFocusWithin: api.isFocusWithin(),
      isFocusVisible: api.isFocusVisible(),
      isVirtualized: api.virtual.isOn(),
      renderedKeys: api.virtual.renderedKeys(),
      renderedSections: api.virtual.renderedSections(),
    };
  },
  connect({ props, ids, api }) {
    const { root, label, control, description, error } = api.field.connect();
    const isEmpty = api.collection().options.length === 0;
    const isDisabled = props.isDisabled();
    const isMultiple = props.selectionMode() === 'multiple';
    const state = {
      'data-readonly': flag(props.isReadOnly()),
      'data-multiple': flag(isMultiple),
      'data-orientation': props.orientation(),
      'data-empty': flag(isEmpty),
      'data-focus-within': flag(api.isFocusWithin()),
      'data-focus-visible': flag(api.isFocusVisible()),
    };
    const withState = (part: PartProps): PartProps => ({
      ...part,
      attrs: { ...part.attrs, ...state },
    });
    const isEmptyShown = isEmpty && api.hasEmpty();
    const describedBy =
      [control.attrs['aria-describedby'], isEmptyShown ? ids.empty : undefined]
        .filter(Boolean)
        .join(' ') || undefined;
    const isVirtualized = api.virtual.isOn();
    const list: DomPartProps = {
      attrs: {
        ...control.attrs,
        ...state,
        'data-virtualized': flag(isVirtualized),
        role: 'listbox',
        'aria-describedby': describedBy,
        'aria-orientation': props.orientation(),
        'aria-multiselectable': isMultiple ? 'true' : undefined,
        'aria-disabled': isDisabled ? 'true' : undefined,
        'aria-readonly': props.isReadOnly() ? 'true' : undefined,
        // The tab stop while no option can take focus (Focus). Otherwise
        // -1, or Firefox makes a list that scrolls a second tab stop. None
        // in virtual focus: focus stays in the input.
        tabindex: props.shouldUseVirtualFocus()
          ? undefined
          : !isDisabled && api.tabStop() === null
            ? '0'
            : '-1',
      },
      on: api.listHandlers,
      style: api.virtual.listStyle(),
    };
    const rootProps = withState(root);
    return {
      root: {
        ...rootProps,
        attrs: { ...rootProps.attrs, 'data-virtualized': flag(isVirtualized) },
      },
      label: withState(label),
      // The box that scrolls, around the list (Anatomy): no tab stop of its
      // own, and no scroll anchoring on top of the engine's.
      scroller: {
        attrs: {
          tabindex: isVirtualized ? '-1' : undefined,
          'data-virtualized': flag(isVirtualized),
        },
        style: api.virtual.scrollerStyle(),
      },
      list,
      description: withState(description),
      error: withState(error),
      // Not one of Field's parts: it takes their state from the root.
      empty: {
        attrs: {
          id: ids.empty,
          hidden: flag(!isEmpty),
          ...state,
          'data-disabled': root.attrs['data-disabled'],
          'data-required': root.attrs['data-required'],
          'data-invalid': root.attrs['data-invalid'],
        },
      },
    };
  },
  connectItem({ props, api }, part, key) {
    const base = api.base();
    const isListDisabled = props.isDisabled();
    const common = {
      'data-disabled': flag(isListDisabled),
      'data-readonly': flag(props.isReadOnly()),
    };
    switch (part) {
      case 'optionLabel':
      case 'optionDescription':
      case 'groupLabel':
        return {
          attrs: {
            id: itemId(base, part, key),
            role: part === 'groupLabel' ? 'presentation' : undefined,
            ...common,
          },
        };
      case 'group':
        return {
          attrs: {
            role: 'group',
            'aria-labelledby': api.isRendered('groupLabel', key)
              ? itemId(base, 'groupLabel', key)
              : undefined,
            ...common,
          },
          style: api.virtual.groupStyle(key),
        };
    }
    const option = api.collection().get(key);
    const isDisabled = isListDisabled || !option || option.isDisabled;
    const isSelected = api.selected().has(key);
    const isVirtual = props.shouldUseVirtualFocus();
    const isFocused = api.focusedKey() === key;
    const isFocusVisible = isVirtual
      ? api.isHighlightVisible()
      : api.isFocusVisible();
    const attrs = {
      role: 'option',
      id: itemId(base, 'option', key),
      tabindex:
        isDisabled || isVirtual
          ? undefined
          : api.tabStop() === key
            ? '0'
            : '-1',
      'aria-selected': String(isSelected),
      'aria-disabled': isDisabled ? 'true' : undefined,
      // Virtualized, where it sits in the whole list (ARIA).
      'aria-posinset': api.virtual.position(key)?.toString(),
      'aria-setsize': api.virtual.setSize()?.toString(),
      'aria-labelledby': api.isRendered('optionLabel', key)
        ? itemId(base, 'optionLabel', key)
        : undefined,
      'aria-describedby': api.isRendered('optionDescription', key)
        ? itemId(base, 'optionDescription', key)
        : undefined,
      'data-selected': flag(isSelected),
      'data-focused': flag(isFocused),
      'data-focus-visible': flag(isFocused && isFocusVisible),
      'data-hovered': flag(!isDisabled && api.hoveredKey() === key),
      'data-pressed': flag(api.pressedKey() === key),
      ...common,
      'data-disabled': flag(isDisabled),
    };
    const result: DomPartProps = {
      attrs,
      on: api.optionHandlers(key),
      style: api.virtual.optionStyle(key),
    };
    return result as PartProps;
  },
});
