/**
 * Switch, from the approved spec (`./spec.md`): Checkbox's core on a native
 * `<input type="checkbox" role="switch">`, without the indeterminate state
 * or a group. Exported as `toggleSwitch`, since `switch` is a reserved word.
 */

import { bindable, defineBehavior, event, prop } from '../../runtime';
import { connectToggle, createToggle, toggleState } from '../checkbox/toggle';
import { tooltipLink } from '../tooltip/link';

export const toggleSwitch = defineBehavior({
  name: 'switch',
  parts: [
    'root',
    'wrapper',
    'input',
    'indicator',
    'label',
    'description',
    'error',
  ],
  links: [tooltipLink],
  props: {
    // The element adopts the input's checked state: the markup's `checked`,
    // or a click before upgrade.
    isSelected: bindable(false, {
      adopt: { part: 'input', property: 'checked' },
    }),
    isDisabled: prop(false),
    // As Radio's: `aria-disabled` instead of `disabled`, so a tooltip can
    // explain it (Tooltip spec, Resolved questions 12).
    isFocusableWhenDisabled: prop(false),
    isReadOnly: prop(false, { attribute: 'readonly' }),
    isRequired: prop(false),
    isInvalid: prop(false),
    // Field's `controlId`: the input's id where it has none of its own.
    inputId: prop<string | undefined>(undefined, {
      attribute: false,
      idOf: 'input',
    }),
    // The element reads the label's tag instead of taking an attribute.
    labelElementType: prop('label', {
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
    return createToggle(ctx);
  },
  expose({ api }) {
    return toggleState(api);
  },
  connect({ api }) {
    return connectToggle(api, { input: { role: 'switch' } });
  },
});
