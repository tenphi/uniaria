/**
 * Field, from the approved spec (`./spec.md`): gives any control its label,
 * description and error message, wires them together with ids and ARIA, and
 * announces a new error. Sous inputs compose it with
 * `ctx.use(field, props, { parts: { control: 'input' } })`. It shows
 * validation state; it doesn't validate.
 */

import {
  announce,
  isDevelopment,
  partEffect,
  partElement,
  warn,
} from '../../dom';
import { defineComponent, prop } from '../../runtime';

type FieldPart = 'root' | 'label' | 'control' | 'description' | 'error';

const PARTS: readonly FieldPart[] = [
  'root',
  'label',
  'control',
  'description',
  'error',
];

const flag = (isOn: boolean): string | undefined => (isOn ? '' : undefined);

/** Ids joined for an `aria-*` reference; `undefined` when there are none. */
const references = (...ids: (string | undefined)[]): string | undefined =>
  ids.filter(Boolean).join(' ') || undefined;

/** The error's text as a screen reader reads it. */
const textOf = (element: HTMLElement): string =>
  (element.textContent ?? '').replace(/\s+/g, ' ').trim();

export const field = defineComponent({
  name: 'field',
  parts: ['root', 'label', 'control', 'description', 'error'],
  props: {
    isInvalid: prop(false),
    isRequired: prop(false),
    isDisabled: prop(false),
    // The element adopts the control's id on upgrade.
    controlId: prop<string | undefined>(undefined, {
      attribute: false,
      adopt: { part: 'control', attribute: 'id' },
    }),
    // The element reads the label's tag instead of taking an attribute.
    labelElementType: prop('label', {
      attribute: false,
      adopt: { part: 'label', tag: true },
    }),
    labelledBy: prop<string | undefined>(undefined, { type: 'string' }),
    describedBy: prop<string | undefined>(undefined, { type: 'string' }),
  },
  setup(ctx) {
    const { props } = ctx;
    const isErrorShown = () => props.isInvalid() && !props.isDisabled();

    // Only parts with an element are referenced, so no reference points at
    // nothing. React attaches elements before `start()`, so the effect reads
    // them then; the watch follows parts added or removed later.
    const present = () =>
      PARTS.filter((part) => ctx.element(part) !== null).join(' ');
    const rendered = ctx.state('');
    ctx.effect(() => rendered.set(present()));
    ctx.watch(present, (value) => rendered.set(value));
    const isRendered = (part: FieldPart) =>
      rendered.get().split(' ').includes(part);

    // A new error is announced as Cube UI Kit's `role="alert"` would read
    // it, through the live announcer. An error already shown on start is not.
    let spoken = '';
    const speak = (element: HTMLElement) => {
      spoken = textOf(element);
      announce(spoken, { document: element.ownerDocument });
    };
    ctx.watch(isErrorShown, (isShown) => {
      const error = partElement(ctx, 'error');
      if (isShown && error) speak(error);
    });
    // While shown, new text is announced too: the consumer owns it.
    partEffect(
      ctx,
      'error',
      (error) => {
        spoken = textOf(error);
        const view = error.ownerDocument.defaultView;
        if (!view) return;
        const observer = new view.MutationObserver(() => {
          if (textOf(error) !== spoken) speak(error);
        });
        observer.observe(error, {
          childList: true,
          characterData: true,
          subtree: true,
        });
        return () => observer.disconnect();
      },
      isErrorShown,
    );

    if (isDevelopment()) {
      // A label or message with no control links to nothing; the likely
      // cause is a field wrapped around a Sous input, which has its own.
      ctx.effect(() => {
        const check = () => {
          const parts = ['label', 'description', 'error'] as const;
          if (
            partElement(ctx, 'control') ||
            !parts.some((part) => partElement(ctx, part))
          ) {
            return;
          }
          warn(
            'field: a label or message is rendered without a control part, so ' +
              'nothing links to it. A Sous input renders its own label and ' +
              'messages: put them inside it instead of wrapping it in a field.',
          );
        };
        // Custom elements get their parts while the document parses.
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

    return { isRendered, isErrorShown };
  },
  expose({ props, api }) {
    return {
      isInvalid: props.isInvalid(),
      isRequired: props.isRequired(),
      isDisabled: props.isDisabled(),
      isErrorShown: api.isErrorShown(),
    };
  },
  connect({ props, ids, api }) {
    const isInvalid = props.isInvalid();
    const isRequired = props.isRequired();
    const isDisabled = props.isDisabled();
    const isErrorShown = api.isErrorShown();
    const controlId = props.controlId() ?? ids.control;
    const state = {
      'data-invalid': flag(isInvalid),
      'data-required': flag(isRequired),
      'data-disabled': flag(isDisabled),
    };
    const has = api.isRendered;
    return {
      root: { attrs: state },
      label: {
        attrs: {
          id: ids.label,
          // Native labelling: clicks focus the control, and it is named
          // before JavaScript runs.
          for: props.labelElementType() === 'label' ? controlId : undefined,
          ...state,
        },
      },
      control: {
        attrs: {
          id: controlId,
          'aria-labelledby': references(
            has('label') ? ids.label : undefined,
            props.labelledBy(),
          ),
          'aria-describedby': references(
            has('description') ? ids.description : undefined,
            // Screen readers read a hidden element a reference points at.
            isErrorShown && has('error') ? ids.error : undefined,
            props.describedBy(),
          ),
          // Removed, never "false", which reads "not invalid".
          'aria-invalid': isInvalid ? 'true' : undefined,
          // Not the native `required`, which starts the browser's validation.
          'aria-required': isRequired ? 'true' : undefined,
          ...state,
        },
      },
      description: { attrs: { id: ids.description, ...state } },
      error: {
        attrs: { id: ids.error, hidden: flag(!isErrorShown), ...state },
      },
    };
  },
});
