import { button } from '@tenphi/sous/button';
import { field } from '@tenphi/sous/field';
import { textField } from '@tenphi/sous/text-field';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { useComponent, useComponentState } from './use-component';

function Docs({ isDisabled = false }: { readonly isDisabled?: boolean }) {
  const ui = useComponent(button, { href: '/docs', isDisabled });
  const isUnavailable = useComponentState(ui, (state) => state.isDisabled);
  return (
    <a {...ui.parts.root} title={isUnavailable ? 'Unavailable' : undefined}>
      Docs
    </a>
  );
}

describe('server rendering without a DOM', () => {
  it('renders the attributes Sous owns and no handlers', () => {
    const html = renderToString(<Docs />);
    expect(html).toBe(
      '<a href="/docs" tabindex="0" data-scope="button" data-part="root">Docs</a>',
    );
  });

  it('renders state read through a selector', () => {
    const html = renderToString(<Docs isDisabled />);
    expect(html).toContain('role="link"');
    expect(html).toContain('aria-disabled="true"');
    expect(html).toContain('title="Unavailable"');
    expect(html).not.toContain('href');
  });
});

function Email() {
  const ui = useComponent(field, { isInvalid: true, controlId: 'email' });
  return (
    <div {...ui.parts.root}>
      <label {...ui.parts.label}>Email</label>
      <input {...ui.parts.control} />
      <p {...ui.parts.error}>Enter a valid email</p>
    </div>
  );
}

describe('Field on the server', () => {
  it('renders ids and the label for, and links the rest on hydration', () => {
    const html = renderToString(<Email />);
    expect(html).toContain('for="email"');
    expect(html).toContain('id="email"');
    expect(html).toContain('aria-invalid="true"');
    // Only rendered parts are referenced, which is known after commit.
    expect(html).not.toContain('aria-labelledby');
    expect(html).not.toContain('aria-describedby');
  });
});

function Name() {
  const ui = useComponent(textField, { defaultValue: 'Jane', inputId: 'name' });
  return (
    <div {...ui.parts.root}>
      <label {...ui.parts.label}>Name</label>
      <input {...ui.parts.input} />
    </div>
  );
}

describe('TextField on the server', () => {
  it('renders the starting value and the label for', () => {
    const html = renderToString(<Name />);
    expect(html).toContain('value="Jane"');
    expect(html).toContain('for="name"');
    expect(html).toContain('id="name"');
  });
});
