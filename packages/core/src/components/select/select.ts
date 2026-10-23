/**
 * Select, from the approved spec (`./spec.md`): Field, Listbox and Popover
 * composed. Field names and describes the trigger; Listbox is the list, its
 * options, selection, keys and typeahead; Popover holds the list in the top
 * layer, places it, dismisses it and runs the closing phase. Select adds the
 * trigger: a `role="combobox"` button whose text is the value, the keys and
 * presses that open the list or change the value while it is closed, and
 * where focus goes. Popover's dialog role, tabindex and name are dropped: the
 * list inside is the popup (Resolved questions 7).
 *
 * Two parts hold content UniAria writes (root AGENTS.md's element-owned
 * parts): the value part's text and the hidden `<select>`'s options.
 *
 * From the items spec: the trigger's `triggerFrame` and `triggerExtras`
 * inside the root, the frame the popup's anchor; option extras; a tooltip
 * for the trigger through `tooltip`, whose text is the value, and one for
 * every option through `optionTooltip`, which Select drives.
 */

import { createTypeahead, findByText } from '../../collections';
import {
  createFocusWithin,
  focusableWalker,
  isComposing,
  isDevelopment,
  mergeHandlers,
  modalityTrackerFor,
  partEffect,
  partElement,
  restoreFocus,
  warn,
} from '../../dom';
import type { DomHandlers, DomPartProps, PositionArea } from '../../dom';
import type { PartProps } from '../../runtime';
import { bindable, defineBehavior, event, prop } from '../../runtime';
import { NO_ITEM_PARTS, button } from '../button/button';
import { field } from '../field/field';
import { listbox, optionTooltipSource } from '../listbox/listbox';
import { renderedKeysChange, virtualProps } from '../listbox/virtual-list';
import { popover } from '../popover/popover';
import {
  linkOptionTooltip,
  linkTooltip,
  optionTooltipLink,
  relationAttributes,
  tooltipLink,
} from '../tooltip/link';

type SelectionMode = 'single' | 'multiple';

const flag = (isOn: boolean): string | undefined => (isOn ? '' : undefined);

/**
 * How far a press that opened the list must move before its release
 * chooses an option (Resolved questions 6, Radix's rule).
 */
const DRAG_DISTANCE = 10;

/**
 * Hides the `<select>` from sight but not from the browser: Safari won't
 * autofill one that is `display: none` (React Aria, Radix). Without its
 * native appearance, WebKit keeps it to the 1px box.
 */
const VISUALLY_HIDDEN: Readonly<Record<string, string>> = {
  appearance: 'none',
  position: 'absolute',
  width: '1px',
  height: '1px',
  margin: '-1px',
  padding: '0',
  border: '0',
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  'clip-path': 'inset(50%)',
  'white-space': 'nowrap',
};

const isSameKeys = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((key, index) => key === b[index]);

export const select = defineBehavior({
  name: 'select',
  parts: [
    'root',
    'label',
    'triggerFrame',
    'trigger',
    'triggerExtras',
    'value',
    'anchor',
    'popover',
    'arrow',
    'scroller',
    'list',
    'empty',
    'close',
    'description',
    'error',
    'hiddenSelect',
  ],
  itemParts: [
    'option',
    'optionLabel',
    'optionDescription',
    'optionExtras',
    'group',
    'groupLabel',
  ],
  links: [tooltipLink, optionTooltipLink],
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
    selectionMode: prop<SelectionMode>('single'),
    isOpen: bindable(false),
    placeholder: prop<string | undefined>(undefined, { type: 'string' }),
    isDisabled: prop(false),
    isReadOnly: prop(false, { attribute: 'readonly' }),
    isRequired: prop(false),
    isInvalid: prop(false),
    shouldFocusWrap: prop(false),
    positionArea: prop<PositionArea>('block-end span-inline-end'),
    positionTryFallbacks: prop('flip-block, flip-inline'),
    // Field's `controlId`: the trigger's id where it has none of its own.
    triggerId: prop<string | undefined>(undefined, {
      attribute: false,
      idOf: 'trigger',
    }),
    // Listbox's: the list's id where it has none of its own.
    listId: prop<string | undefined>(undefined, {
      attribute: false,
      idOf: 'list',
    }),
    // The element reads the label's tag.
    labelElementType: prop('span', {
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
    const isMultiple = () => props.selectionMode() === 'multiple';
    const triggerElement = () => partElement(ctx, 'trigger');

    const labelling = ctx.use(
      field,
      () => ({
        isInvalid: props.isInvalid(),
        isRequired: props.isRequired(),
        isDisabled: props.isDisabled(),
        controlId: props.triggerId(),
        labelElementType: props.labelElementType(),
        labelledBy: props.labelledBy(),
        describedBy: props.describedBy(),
      }),
      { parts: { control: 'trigger' } },
    );

    // Field's label, description and error are the trigger's, so the list
    // has none of its own, and isn't required or invalid itself.
    const list = ctx.use(
      listbox,
      () => ({
        items: props.items(),
        getKey: props.getKey(),
        getTextValue: props.getTextValue(),
        isItemDisabled: props.isItemDisabled(),
        getChildren: props.getChildren(),
        disabledKeys: props.disabledKeys(),
        value: value.get(),
        onValueChange: (next: readonly string[]) => setValue(next),
        selectionMode: props.selectionMode(),
        isDisabled: props.isDisabled(),
        isReadOnly: props.isReadOnly(),
        shouldFocusWrap: props.shouldFocusWrap(),
        shouldFocusOnHover: true,
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
        // Choosing an option closes the list in single mode (Selection).
        onAction: () => {
          if (!isMultiple()) close();
        },
      }),
      { parts: { root: null, label: null, description: null, error: null } },
    );
    const collection = () => list.api.collection();

    /** Where focus goes when the list opens: from the opening key. */
    let openEdge: 'first' | 'last' = 'first';
    /** The selected option, else the first or last enabled one. */
    const openKey = (edge: 'first' | 'last'): string | null => {
      const options = collection();
      const keys = new Set(value.get());
      const selected = options.options.find(
        (option) => !option.isDisabled && keys.has(option.key),
      );
      if (selected) return selected.key;
      return edge === 'last' ? options.last() : options.first();
    };

    const open = (edge: 'first' | 'last') => {
      if (props.isDisabled()) return;
      openEdge = edge;
      isOpen.set(true);
      // A consumer that keeps it closed leaves nothing for a later open.
      if (!isOpen.get()) openEdge = 'first';
    };
    const close = () => isOpen.set(false);

    // Before Popover's, so they run first in a flush: the list's tab stop is
    // set before Popover focuses the list on open, and focus is back on the
    // trigger before Popover hides the list on close.
    ctx.watch(
      () => isOpen.get(),
      (isNowOpen) => {
        if (isNowOpen) {
          list.api.setTabStop(openKey(openEdge));
          openEdge = 'first';
          return;
        }
        // As the closing phase starts, not after it (Focus; CUB-4839).
        const popup = partElement(ctx, 'popover');
        const trigger = triggerElement();
        const active = popup?.ownerDocument.activeElement;
        if (popup && trigger && active && popup.contains(active)) {
          restoreFocus(trigger);
        }
      },
    );

    const layer = ctx.use(
      popover,
      () => ({
        isOpen: isOpen.get(),
        onOpenChange: (next: boolean) => isOpen.set(next),
        isDisabled: props.isDisabled(),
        positionArea: props.positionArea(),
        positionTryFallbacks: props.positionTryFallbacks(),
      }),
      {
        parts: {
          root: 'popover',
          title: null,
          description: null,
          triggerLabel: null,
          triggerDescription: null,
        },
      },
    );

    // On the trigger or in the popup, which the root holds when it is
    // rendered; it is optional.
    const focusWithin = createFocusWithin(ctx, {
      part: ['root', 'trigger', 'popover'],
      isDisabled: props.isDisabled,
    });
    ctx.watch(focusWithin.isFocusWithin, (isFocusWithin) => {
      ctx.emit('focusChange', isFocusWithin);
    });

    /** Focuses the trigger without scrolling, unless it has focus. */
    const focusTrigger = () => {
      const trigger = triggerElement();
      if (trigger && trigger.ownerDocument.activeElement !== trigger) {
        trigger.focus({ preventScroll: true });
      }
    };

    // Touch and screen readers open on release, on the click (Pointer and
    // touch); a mouse or pen opens on press start, below.
    const trigger = ctx.use(
      button,
      () => ({
        isDisabled: props.isDisabled(),
        shouldPreventFocusOnPress: true,
        onPress: (pressEvent: { pointerType: string }) => {
          if (
            pressEvent.pointerType !== 'touch' &&
            pressEvent.pointerType !== 'virtual'
          ) {
            return;
          }
          focusTrigger();
          if (isOpen.get()) close();
          else open('first');
        },
      }),
      {
        parts: {
          ...NO_ITEM_PARTS,
          root: 'trigger',
          frame: 'triggerFrame',
          extras: 'triggerExtras',
        },
      },
    );
    // Its text is the value (items spec, Select's trigger tooltip).
    const tooltip = linkTooltip(ctx, {
      hover: 'trigger',
      focus: 'trigger',
      text: ['value'],
    });
    linkOptionTooltip(
      ctx,
      optionTooltipSource(ctx, list.api, {
        isVirtual: () => false,
        keyParts: ['list'],
      }),
    );

    // The value text (Selection): each selected key's text, in the order of
    // `value`; keys with no item add nothing.
    const selectedTexts = ctx.memo(
      () => [collection(), value.get()] as const,
      (options, keys): readonly string[] =>
        keys.flatMap((key) => {
          const option = options.get(key);
          return option ? [option.textValue] : [];
        }),
    );
    const valueText = () => selectedTexts().join(', ');
    const isPlaceholder = () => selectedTexts().length === 0;

    // The closed trigger (Keyboard): typing and ArrowLeft and ArrowRight
    // select without opening, in single mode.
    const typeahead = createTypeahead();
    const choose = (key: string | null) => {
      if (key === null || props.isReadOnly()) return;
      if (!isSameKeys([key], value.get())) setValue([key]);
    };
    const step = (direction: 1 | -1) => {
      const options = collection();
      const current = value.get()[0];
      if (current === undefined || !options.get(current)) {
        choose(options.first());
        return;
      }
      choose(direction > 0 ? options.next(current) : options.previous(current));
    };

    const onTriggerKeyDown = (keyEvent: KeyboardEvent) => {
      if (keyEvent.defaultPrevented || isComposing(keyEvent)) return;
      if (props.isDisabled() || isOpen.get()) return;
      if (keyEvent.ctrlKey || keyEvent.metaKey) return;
      const isSingle = !isMultiple();
      // Space while a query is in progress joins it instead (Keyboard).
      const isOpening =
        keyEvent.key === 'Enter' ||
        (keyEvent.key === ' ' &&
          !(isSingle && typeahead.isSearching(keyEvent.timeStamp)));
      if (isOpening) {
        if (keyEvent.altKey) return;
        keyEvent.preventDefault();
        if (!keyEvent.repeat) open('first');
        return;
      }
      switch (keyEvent.key) {
        case 'ArrowDown':
        case 'ArrowUp':
          if (keyEvent.shiftKey) return;
          keyEvent.preventDefault();
          if (!keyEvent.repeat) {
            open(keyEvent.key === 'ArrowUp' ? 'last' : 'first');
          }
          return;
        case 'ArrowLeft':
        case 'ArrowRight':
          if (!isSingle || props.isReadOnly()) return;
          if (keyEvent.shiftKey || keyEvent.altKey) return;
          keyEvent.preventDefault();
          step(keyEvent.key === 'ArrowRight' ? 1 : -1);
          return;
      }
      if (!isSingle || props.isReadOnly()) return;
      const current = value.get()[0] ?? null;
      const result = typeahead.handleKey(keyEvent, (query) => {
        const options = collection();
        return findByText(query, {
          keys: options.keys,
          getTextValue: (key) => options.get(key)?.textValue ?? '',
          isDisabled: (key) => !options.isEnabled(key),
          fromKey: current,
        });
      });
      if (!result.isHandled) return;
      keyEvent.preventDefault();
      choose(result.key);
    };

    // Press, drag and release (Pointer and touch): where the mouse or pen
    // press that opened the list went down, until it is released.
    let drag: { pointerId: number; x: number; y: number } | null = null;
    let endDrag: (() => void) | undefined;

    const onTriggerPointerDown = (pointerEvent: PointerEvent) => {
      if (pointerEvent.button !== 0 || pointerEvent.pointerType === 'touch') {
        return;
      }
      const element = triggerElement();
      if (!element || props.isDisabled()) return;
      // Before opening, which moves focus into the list; the press itself
      // doesn't focus the trigger, or its mousedown would take focus back.
      focusTrigger();
      if (isOpen.get()) {
        close();
        return;
      }
      endDrag?.();
      drag = {
        pointerId: pointerEvent.pointerId,
        x: pointerEvent.clientX,
        y: pointerEvent.clientY,
      };
      // After the options' own handlers, which run before the document's.
      const document = element.ownerDocument;
      const onEnd = (endEvent: PointerEvent) => {
        if (endEvent.pointerId === drag?.pointerId) endDrag?.();
      };
      document.addEventListener('pointerup', onEnd);
      document.addEventListener('pointercancel', onEnd);
      endDrag = () => {
        drag = null;
        endDrag = undefined;
        document.removeEventListener('pointerup', onEnd);
        document.removeEventListener('pointercancel', onEnd);
      };
      open('first');
    };
    ctx.effect(() => () => endDrag?.());

    const onOptionPointerUp = (key: string, pointerEvent: PointerEvent) => {
      const from = drag;
      if (!from || pointerEvent.pointerId !== from.pointerId) return;
      endDrag?.();
      const distance = Math.hypot(
        pointerEvent.clientX - from.x,
        pointerEvent.clientY - from.y,
      );
      if (distance >= DRAG_DISTANCE) list.api.activate(key);
    };

    /**
     * Tab closes the list and moves on from the trigger, past the popup
     * (Keyboard, Resolved questions 5).
     */
    const onPopoverKeyDown = (keyEvent: KeyboardEvent) => {
      if (keyEvent.key !== 'Tab' || keyEvent.defaultPrevented) return;
      if (keyEvent.altKey || keyEvent.ctrlKey || keyEvent.metaKey) return;
      const element = triggerElement();
      const popup = partElement(ctx, 'popover');
      if (!element || !popup || !isOpen.get()) return;
      keyEvent.preventDefault();
      close();
      const walker = focusableWalker(element.ownerDocument.body, {
        isTabbable: true,
        accept: (candidate) => !popup.contains(candidate),
      });
      walker.currentNode = element;
      const next = (
        keyEvent.shiftKey ? walker.previousNode() : walker.nextNode()
      ) as HTMLElement | null;
      (next ?? element).focus();
    };

    /** A press on the label focuses the trigger as the keyboard would. */
    const onLabelClick = () => {
      const element = triggerElement();
      if (!element || props.isDisabled()) return;
      modalityTrackerFor(element)?.set('keyboard');
      element.focus();
    };

    // The hidden <select> (Resolved questions 11): its options, the
    // selection, autofill, form reset and validation.
    let initial: readonly string[] | undefined;
    /** The collection's options the hidden <select> was last written from. */
    let written: readonly unknown[] | undefined;
    /** The placeholder and one option per item, unless they're there. */
    const writeOptions = (
      element: HTMLSelectElement,
      options: ReturnType<typeof collection>['options'],
    ) => {
      // Comparing 10,000 options on each value change costs more than the
      // change itself, so an unchanged collection is checked by count only.
      if (options === written && element.options.length === options.length + 1)
        return;
      written = options;
      const wanted: [string, string][] = [
        ['', ''],
        ...options.map((option): [string, string] => [
          option.key,
          option.textValue,
        ]),
      ];
      const current = Array.from(element.options);
      const isSame =
        current.length === wanted.length &&
        current.every(
          (option, index) =>
            option.value === wanted[index]![0] &&
            option.text === wanted[index]![1],
        );
      if (isSame) return;
      const document = element.ownerDocument;
      const toOption = ([key, text]: [string, string]) => {
        const option = document.createElement('option');
        option.value = key;
        option.textContent = text;
        return option;
      };
      // The placeholder stays a child of the <select>, which `required`
      // needs; the items go in one <optgroup>, filled before it is inserted:
      // WebKit lays out a rendered <select> again for each <option> inserted
      // as its child, 8 s for 10,000 (Listbox virtualization spec, Resolved
      // questions 9).
      const group = document.createElement('optgroup');
      group.append(...wanted.slice(1).map(toOption));
      element.replaceChildren(toOption(wanted[0]!), group);
    };
    const syncHiddenSelect = (
      element: HTMLSelectElement,
      selected: readonly string[] = value.get(),
    ) => {
      const { options } = collection();
      const isMany = isMultiple();
      if (element.multiple !== isMany) element.multiple = isMany;
      writeOptions(element, options);
      // The attribute too, which a form reset goes back to.
      const keys = new Set(selected);
      for (const option of element.options) {
        const isSelected = option.value !== '' && keys.has(option.value);
        if (option.defaultSelected !== isSelected) {
          option.defaultSelected = isSelected;
        }
        if (option.selected !== isSelected) option.selected = isSelected;
      }
    };
    const hiddenSelect = () =>
      partElement(ctx, 'hiddenSelect') as HTMLSelectElement | null;
    /**
     * Sets the value with the hidden select already holding it, as a native
     * select does before its `change`: a `valueChange` listener's FormData
     * has the new value. A controlled value the consumer didn't take goes
     * back.
     */
    const setValue = (next: readonly string[]) => {
      const element = hiddenSelect();
      if (element) syncHiddenSelect(element, next);
      value.set(next);
      if (element && value.isControlled()) syncHiddenSelect(element);
    };
    const hiddenSnapshot = ctx.memo(
      () => [collection(), value.get(), props.selectionMode()] as const,
      (options, keys, mode) => ({ options, keys, mode }),
    );
    ctx.watch(hiddenSnapshot, () => {
      const element = hiddenSelect();
      if (element) syncHiddenSelect(element);
    });
    partEffect(ctx, 'hiddenSelect', (part) => {
      const element = part as HTMLSelectElement;
      initial ??= value.get();
      syncHiddenSelect(element);
      const style = element.style;
      for (const [name, setting] of Object.entries(VISUALLY_HIDDEN)) {
        style.setProperty(name, setting);
      }
      // Browser autofill.
      const onChange = () =>
        ctx.batch(() => {
          const keys = Array.from(
            element.selectedOptions,
            (option) => option.value,
          ).filter(Boolean);
          const next = isMultiple() ? keys : keys.slice(0, 1);
          if (!isSameKeys(next, value.get())) setValue(next);
          syncHiddenSelect(element);
        });
      // Validation and autofill may focus it: the trigger takes focus.
      const onFocus = () => triggerElement()?.focus();
      // Form reset goes back to the default, as NumberField's does:
      // defaultValue when uncontrolled, even one set after mount, and for a
      // controlled select without one, the value it mounted with, reported
      // as `setValue()` does.
      const form = element.form;
      const onReset = (resetEvent: Event) => {
        if (resetEvent.defaultPrevented || initial === undefined) return;
        ctx.batch(() => {
          value.reset({
            fallback: initial,
            isEqual: isSameKeys,
            beforeReport: (next) => syncHiddenSelect(element, next),
          });
          if (value.isControlled()) syncHiddenSelect(element);
        });
      };
      element.addEventListener('change', onChange);
      element.addEventListener('input', onChange);
      element.addEventListener('invalid', onFocus);
      element.addEventListener('focus', onFocus);
      form?.addEventListener('reset', onReset);
      return () => {
        element.removeEventListener('change', onChange);
        element.removeEventListener('input', onChange);
        element.removeEventListener('invalid', onFocus);
        element.removeEventListener('focus', onFocus);
        form?.removeEventListener('reset', onReset);
        for (const name of Object.keys(VISUALLY_HIDDEN)) {
          style.removeProperty(name);
        }
      };
    });

    if (isDevelopment()) {
      // A select needs a name (Props).
      ctx.effect(() => {
        const check = () => {
          const element = triggerElement();
          if (
            !element ||
            element.hasAttribute('aria-label') ||
            element.getAttribute('aria-labelledby')
          ) {
            return;
          }
          warn(
            'select: the select has no name. Render a label part, or give it ' +
              'labelledBy or an aria-label on the trigger.',
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
      tooltip,
      valueText,
      isPlaceholder,
      isFocusWithin: focusWithin.isFocusWithin,
      isFocusVisible: focusWithin.isFocusVisible,
      onTriggerKeyDown,
      onTriggerPointerDown,
      onOptionPointerUp,
      onPopoverKeyDown,
      onLabelClick,
      // As Enter on the trigger opens it (spec, Actions).
      open: () => open('first'),
      close,
    };
  },
  expose({ props, api }) {
    const list = api.list.state();
    return {
      value: props.value.get(),
      valueText: api.valueText(),
      isPlaceholder: api.isPlaceholder(),
      selectionMode: props.selectionMode(),
      isOpen: props.isOpen.get(),
      focusedKey: list.focusedKey,
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
  connect({ props, api }) {
    const fieldParts = api.field.connect();
    const listParts = api.list.connect();
    const layerParts = api.layer.connect();
    const buttonParts = api.trigger.connect();
    const buttonRoot = buttonParts.root as DomPartProps;
    const isOpen = props.isOpen.get();
    const isMultiple = props.selectionMode() === 'multiple';
    const isDisabled = props.isDisabled();
    const state = {
      'data-open': flag(isOpen),
      'data-entering': flag(api.layer.api.isEntering()),
      'data-exiting': flag(api.layer.api.isExiting()),
      'data-disabled': flag(isDisabled),
      'data-readonly': flag(props.isReadOnly()),
      'data-required': flag(props.isRequired()),
      'data-invalid': flag(props.isInvalid()),
      'data-multiple': flag(isMultiple),
      'data-placeholder': flag(api.isPlaceholder()),
      'data-focus-within': flag(api.isFocusWithin()),
      'data-focus-visible': flag(api.isFocusVisible()),
    };
    const withState = (part: PartProps): PartProps => ({
      ...part,
      attrs: { ...part.attrs, ...state },
    });
    const control = fieldParts.control;
    const listRoot = listParts.list as DomPartProps;
    // Button's pointer, hover and focus handling. Its keys are left out:
    // the trigger opens on keydown, and Enter and Space never press it.
    const {
      keydown: _keydown,
      keyup: _keyup,
      ...buttonHandlers
    } = buttonRoot.on ?? ({} as DomHandlers);
    const trigger: DomPartProps = {
      attrs: {
        ...buttonRoot.attrs,
        ...control.attrs,
        // After Field's references (items spec, Select's trigger tooltip).
        ...relationAttributes(api.tooltip, {
          labelledBy: control.attrs['aria-labelledby'],
          describedBy: control.attrs['aria-describedby'],
        }),
        role: 'combobox',
        'aria-haspopup': 'listbox',
        'aria-expanded': String(isOpen),
        'aria-controls': listRoot.attrs.id,
        'aria-readonly': props.isReadOnly() ? 'true' : undefined,
        ...state,
      },
      on: mergeHandlers(
        buttonHandlers,
        {
          pointerdown: api.onTriggerPointerDown,
          keydown: api.onTriggerKeyDown,
        },
        // Escape on the trigger while the list is open, as Popover's.
        { keydown: api.layer.api.onTriggerKeyDown },
      ),
    };
    const popoverRoot = layerParts.root as DomPartProps;
    const placeholder = props.placeholder() ?? '';
    return {
      root: withState(fieldParts.root),
      label: {
        attrs: { ...fieldParts.label.attrs, for: undefined, ...state },
        on: { click: api.onLabelClick },
      },
      triggerFrame: withState(buttonParts.frame),
      trigger,
      triggerExtras: withState(buttonParts.extras),
      value: {
        attrs: state,
        properties: {
          textContent: api.isPlaceholder() ? placeholder : api.valueText(),
        },
      },
      anchor: withState(layerParts.anchor),
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
        on: { keydown: api.onPopoverKeyDown },
      },
      arrow: withState(layerParts.arrow),
      scroller: listParts.scroller,
      list: {
        ...listRoot,
        attrs: {
          ...listRoot.attrs,
          'aria-labelledby': control.attrs['aria-labelledby'],
          // Popover focuses it on open, and Listbox hands focus on to the
          // option Select made its tab stop (Focus).
          'data-autofocus': '',
          ...state,
        },
      },
      empty: withState(listParts.empty),
      close: withState(layerParts.close),
      description: withState(fieldParts.description),
      error: withState(fieldParts.error),
      hiddenSelect: {
        attrs: {
          'aria-hidden': 'true',
          tabindex: '-1',
          // `multiple` is set with the options: React resets a <select>'s
          // selection when its `multiple` prop changes.
          required: flag(props.isRequired()),
          disabled: flag(isDisabled),
        },
      },
    };
  },
  connectItem({ api }, part, key) {
    const item = api.list.connectItem(part, key) as DomPartProps;
    if (part !== 'option') return item as PartProps;
    const result: DomPartProps = {
      ...item,
      on: mergeHandlers(item.on ?? {}, {
        pointerup: (pointerEvent) =>
          api.onOptionPointerUp(key, pointerEvent as PointerEvent),
      }),
    };
    return result as PartProps;
  },
});
