/**
 * A definition outside UniAria composing Field with public API only: the
 * custom components guide's rating (`docs/guide/custom-components.md`, A
 * field of your own), labelled by Field and bound to a Form by its name
 * through `setValue` and Field's state.
 */

import { defineBehavior, prop } from '@uniaria/core';
import { mergeHandlers } from '@uniaria/core/dom';
import type { DomPartProps } from '@uniaria/core/dom';
import { field } from '@uniaria/core/field';
import { form, formLink } from '@uniaria/core/form';
import { keyboard, pointer, releaseInput } from '@uniaria/testing/browser';
import { StrictMode } from 'react';
import type { ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';

import { OwnerProvider } from './owner';
import { useBehavior } from './use-behavior';

// The guide's code, as written there.
const MAX = 5;

const rating = defineBehavior({
  name: 'rating',
  parts: ['root', 'label', 'stars', 'description', 'error', 'errorText'],
  links: [formLink],
  props: {
    name: prop<string | undefined>(undefined, { type: 'string' }),
    isRequired: prop(false),
  },
  setup(ctx) {
    const { props } = ctx;
    const labelling = ctx.use(
      field,
      () => ({
        name: props.name(),
        isRequired: props.isRequired(),
        labelElementType: 'span',
      }),
      { parts: { control: 'stars' }, links: [formLink] },
    );
    const stars = () => {
      const value = labelling.state().value;
      return typeof value === 'number' ? value : 0;
    };
    const onKeyDown = (event: KeyboardEvent) => {
      const next = {
        ArrowUp: Math.min(stars() + 1, MAX),
        ArrowDown: Math.max(stars() - 1, 1),
        Home: 1,
        End: MAX,
      }[event.key];
      if (next === undefined) return;
      event.preventDefault();
      labelling.actions.setValue(next);
    };
    return { labelling, stars, onKeyDown };
  },
  expose: ({ api }) => api.labelling.state(),
  connect: ({ api }) => {
    const { control, ...parts } = api.labelling.connect();
    const own = control as DomPartProps;
    const count = api.stars();
    return {
      ...parts,
      stars: {
        ...own,
        attrs: {
          ...own.attrs,
          role: 'spinbutton',
          tabindex: '0',
          'aria-valuemin': '1',
          'aria-valuemax': String(MAX),
          'aria-valuenow': count ? String(count) : undefined,
          'aria-valuetext': count ? `${count} of ${MAX} stars` : 'No rating',
        },
        style: { '--stars': String(count) },
        on: mergeHandlers(own.on ?? {}, { keydown: api.onKeyDown }),
      },
    };
  },
});

function Rating(props: { name?: string; isRequired?: boolean }) {
  const ui = useBehavior(rating, props);
  return (
    <div {...ui.parts.root}>
      <span {...ui.parts.label}>Your rating</span>
      <div {...ui.parts.stars} />
      <p {...ui.parts.error}>
        <span {...ui.parts.errorText} />
      </p>
    </div>
  );
}

let root: Root | undefined;

function render(node: ReactNode): HTMLElement {
  const container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  flushSync(() => root!.render(<StrictMode>{node}</StrictMode>));
  return container;
}

afterEach(async () => {
  await releaseInput();
  root?.unmount();
  root = undefined;
  document.body.replaceChildren();
});

const q = (container: HTMLElement, selector: string) =>
  container.querySelector<HTMLElement>(selector)!;

describe('a definition composing Field', () => {
  it('outside a form: labelled, and the keys set the value', async () => {
    const container = render(<Rating />);
    const stars = q(container, '[data-element="Stars"]');
    const label = q(container, '[data-element="Label"]');
    expect(stars.getAttribute('aria-labelledby')).toBe(label.id);
    expect(label.hasAttribute('for')).toBe(false);
    expect(stars.getAttribute('aria-valuetext')).toBe('No rating');
    stars.focus();
    await keyboard.press('ArrowUp');
    await keyboard.press('ArrowUp');
    await expect.poll(() => stars.getAttribute('aria-valuenow')).toBe('2');
    await keyboard.press('End');
    await expect.poll(() => stars.getAttribute('aria-valuenow')).toBe('5');
    expect(stars.style.getPropertyValue('--stars')).toBe('5');
  });

  it('in a form: required, bound by name, submitted', async () => {
    const submitted: unknown[] = [];
    function Survey() {
      const survey = useBehavior(form, {
        handleSubmit: (values) => {
          submitted.push(values);
        },
      });
      return (
        <OwnerProvider owner={survey}>
          <form {...survey.parts.root} noValidate>
            <Rating name="score" isRequired />
            <button type="submit">Send</button>
          </form>
        </OwnerProvider>
      );
    }
    const container = render(<Survey />);
    const stars = q(container, '[data-element="Stars"]');
    const error = q(container, '[data-element="Error"]');
    expect(stars.getAttribute('aria-required')).toBe('true');
    expect(error.hidden).toBe(true);
    await pointer.click(q(container, 'button'));
    await expect.poll(() => error.hidden).toBe(false);
    expect(stars.getAttribute('aria-invalid')).toBe('true');
    expect(q(container, '[data-element="ErrorText"]').textContent).not.toBe('');
    expect(submitted).toEqual([]);
    stars.focus();
    await keyboard.press('ArrowUp');
    await keyboard.press('ArrowUp');
    await keyboard.press('ArrowUp');
    await expect.poll(() => stars.getAttribute('aria-valuenow')).toBe('3');
    await pointer.click(q(container, 'button'));
    await expect.poll(() => submitted).toEqual([{ score: 3 }]);
    expect(error.hidden).toBe(true);
  });
});
