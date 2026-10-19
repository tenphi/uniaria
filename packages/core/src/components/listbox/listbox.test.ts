import { expect, it } from 'vitest';

import { createInstance } from '../../runtime';
import { listbox } from './listbox';

// A listbox can't be labelled natively; the element reads a `label` tag too.
it('writes no `for` on its label, even on a `label` element', () => {
  const list = createInstance(listbox, {
    props: { labelElementType: 'label' },
  });
  const { label } = list.connect();
  expect(label.attrs.id).toBe(list.ids.label);
  expect(label.attrs.for).toBeUndefined();
});
