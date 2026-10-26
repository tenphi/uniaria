/**
 * A consumer whose tsconfig turns on `exactOptionalPropertyTypes`, which this
 * repository's doesn't. `exact-optional.test.ts` compiles it with the option
 * on; nothing imports it.
 */

import { dialog } from '@uniaria/core/dialog';
import { form } from '@uniaria/core/form';
import { popover } from '@uniaria/core/popover';
import { radio } from '@uniaria/core/radio';
import { radioGroup } from '@uniaria/core/radio-group';
import { tooltip } from '@uniaria/core/tooltip';

import { useBehavior } from './use-behavior';

export function useBehaviors() {
  // Neither an owner nor links.
  const hint = useBehavior(tooltip, {});
  useBehavior(form, {});
  // Links and no owner.
  useBehavior(popover, { defaultOpen: true, tooltip: hint });
  useBehavior(dialog, { tooltip: null });
  // An owner and links.
  const group = useBehavior(radioGroup, {});
  useBehavior(radio, { value: 'a', owner: group.instance, tooltip: hint });
  // @ts-expect-error A component without an owner takes no `owner` prop.
  useBehavior(popover, { owner: group.instance });
}
