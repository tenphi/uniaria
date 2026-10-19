import { expect, it } from 'vitest';

import { createInstance } from '../../runtime';
import { radioGroup } from './radio-group';

// A group can't be labelled natively; the element reads a `label` tag too.
it('writes no `for` on its label, even on a `label` element', () => {
  const group = createInstance(radioGroup, {
    props: { labelElementType: 'label' },
  });
  const { label } = group.connect();
  expect(label.attrs.id).toBe(group.ids.label);
  expect(label.attrs.for).toBeUndefined();
});
