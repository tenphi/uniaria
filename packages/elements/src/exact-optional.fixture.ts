/**
 * A consumer whose tsconfig turns on `exactOptionalPropertyTypes`, which this
 * repository's doesn't. `exact-optional.test.ts` compiles it with the option
 * on; nothing imports it.
 */

import { dialog } from '@uniaria/core/dialog';
import { form } from '@uniaria/core/form';
import { popover } from '@uniaria/core/popover';
import { radio } from '@uniaria/core/radio';
import { tooltip } from '@uniaria/core/tooltip';

import { defineElement } from './define-element';

export function defineElements() {
  // Links and no owner.
  defineElement(popover, { prefix: 'cb' });
  defineElement(dialog, { prefix: 'cb' });
  // An owner and links.
  defineElement(radio, { prefix: 'cb' });
  // Neither.
  defineElement(tooltip, { prefix: 'cb' });
  defineElement(form, { prefix: 'cb' });
}
