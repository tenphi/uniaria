/**
 * Neutral part props → React props (design decision 4): DOM attribute names
 * become React prop names, empty boolean attributes become `true`, and DOM
 * event names become React handler props.
 */

/** DOM attribute → React prop, where they differ. */
const ATTRIBUTES: Readonly<Record<string, string>> = {
  class: 'className',
  for: 'htmlFor',
  tabindex: 'tabIndex',
  readonly: 'readOnly',
  autofocus: 'autoFocus',
  autocomplete: 'autoComplete',
  contenteditable: 'contentEditable',
  enterkeyhint: 'enterKeyHint',
  inputmode: 'inputMode',
  maxlength: 'maxLength',
  minlength: 'minLength',
  spellcheck: 'spellCheck',
  colspan: 'colSpan',
  rowspan: 'rowSpan',
  formaction: 'formAction',
  formenctype: 'formEncType',
  formmethod: 'formMethod',
  formnovalidate: 'formNoValidate',
  formtarget: 'formTarget',
  novalidate: 'noValidate',
};

/** React props that take a boolean, so `''` must become `true`. */
const BOOLEANS = new Set([
  'disabled',
  'hidden',
  'checked',
  'selected',
  'required',
  'readOnly',
  'multiple',
  'open',
  'inert',
  'autoFocus',
  'noValidate',
  'formNoValidate',
]);

/** React's DOM event props; the map key is the DOM event name. */
const EVENTS = new Map(
  [
    'onAnimationEnd',
    'onAnimationIteration',
    'onAnimationStart',
    'onAuxClick',
    'onBeforeInput',
    'onBeforeToggle',
    'onChange',
    'onClick',
    'onCompositionEnd',
    'onCompositionStart',
    'onCompositionUpdate',
    'onContextMenu',
    'onCopy',
    'onCut',
    'onDrag',
    'onDragEnd',
    'onDragEnter',
    'onDragExit',
    'onDragLeave',
    'onDragOver',
    'onDragStart',
    'onDrop',
    'onError',
    'onGotPointerCapture',
    'onInvalid',
    'onKeyDown',
    'onKeyUp',
    'onLoad',
    'onLostPointerCapture',
    'onMouseDown',
    'onMouseEnter',
    'onMouseLeave',
    'onMouseMove',
    'onMouseOut',
    'onMouseOver',
    'onMouseUp',
    'onPaste',
    'onPointerCancel',
    'onPointerDown',
    'onPointerEnter',
    'onPointerLeave',
    'onPointerMove',
    'onPointerOut',
    'onPointerOver',
    'onPointerUp',
    'onReset',
    'onScroll',
    'onScrollEnd',
    'onSelect',
    'onSubmit',
    'onToggle',
    'onTouchCancel',
    'onTouchEnd',
    'onTouchMove',
    'onTouchStart',
    'onTransitionEnd',
    'onWheel',
  ].map((name) => [name.slice(2).toLowerCase(), name]),
);
// Focus entering or leaving a subtree: React's onFocus and onBlur bubble and
// are backed by focusin and focusout. The input event is React's onInput:
// its onChange fires on click for a checkbox, before a cancelled click is
// undone, and skips changes its value tracker missed.
EVENTS.set('focusin', 'onFocus');
EVENTS.set('focusout', 'onBlur');
EVENTS.set('input', 'onInput');
EVENTS.set('dblclick', 'onDoubleClick');

/** The React prop for a DOM attribute. */
export function reactPropName(attribute: string): string {
  return ATTRIBUTES[attribute] ?? attribute;
}

/** The React value for an attribute value: `''` on a boolean prop is `true`. */
export function reactPropValue(name: string, value: string): string | boolean {
  return value === '' && BOOLEANS.has(name) ? true : value;
}

/** The React handler prop for a DOM event name. */
export function reactEventName(type: string): string {
  return (
    EVENTS.get(type) ?? `on${type.charAt(0).toUpperCase()}${type.slice(1)}`
  );
}
