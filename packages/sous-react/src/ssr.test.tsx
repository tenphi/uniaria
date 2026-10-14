import { button } from '@tenphi/sous/button';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { useComponent, useComponentState } from './use-component';

function Docs({ disabled = false }: { readonly disabled?: boolean }) {
  const ui = useComponent(button, { href: '/docs', disabled });
  const isDisabled = useComponentState(ui, (state) => state.isDisabled);
  return (
    <a {...ui.parts.root} title={isDisabled ? 'Unavailable' : undefined}>
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
    const html = renderToString(<Docs disabled />);
    expect(html).toContain('role="link"');
    expect(html).toContain('aria-disabled="true"');
    expect(html).toContain('title="Unavailable"');
    expect(html).not.toContain('href');
  });
});
