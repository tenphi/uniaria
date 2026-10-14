/**
 * Small event checks shared by interactions.
 */

/**
 * An IME composition is in progress, so the key belongs to the IME. Safari
 * dispatches the keydown that commits a composition after `compositionend`,
 * with `isComposing` false (WebKit 165004); its `keyCode` is 229 there, as
 * in every engine during composition.
 */
export function isComposing(event: KeyboardEvent): boolean {
  return event.isComposing || event.keyCode === 229;
}
