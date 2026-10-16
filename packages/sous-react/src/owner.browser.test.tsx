import type { Instance } from '@tenphi/sous';
import { checkbox } from '@tenphi/sous/checkbox';
import { checkboxGroup } from '@tenphi/sous/checkbox-group';
import { pointer, releaseInput } from '@tenphi/sous-testing/browser';
import { StrictMode } from 'react';
import type { ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';

import { OwnerProvider } from './owner';
import { useComponent } from './use-component';

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

function Option(props: {
  readonly value: string;
  readonly owner?: Instance<typeof checkboxGroup>;
}) {
  const ui = useComponent(checkbox, {
    value: props.value,
    owner: props.owner,
    labelElementType: 'span',
  });
  return (
    <label {...ui.parts.root}>
      <input {...ui.parts.input} />
      <span {...ui.parts.label}>{props.value}</span>
    </label>
  );
}

function Group(props: {
  readonly defaultValue: readonly string[];
  readonly hasProvider?: boolean;
  readonly onValueChange?: (value: readonly string[]) => void;
  readonly children: ReactNode;
}) {
  const ui = useComponent(checkboxGroup, {
    defaultValue: props.defaultValue,
    onValueChange: props.onValueChange,
  });
  return (
    <div {...ui.parts.root}>
      <span {...ui.parts.label}>Notify</span>
      {props.hasProvider === false ? (
        props.children
      ) : (
        <OwnerProvider owner={ui}>{props.children}</OwnerProvider>
      )}
    </div>
  );
}

const inputs = (container: HTMLElement) =>
  Array.from(container.querySelectorAll('input'));

describe('owners in React', () => {
  it('links through OwnerProvider from the first render, server HTML included', () => {
    const tree = (
      <Group defaultValue={['sms']}>
        <Option value="email" />
        <Option value="sms" />
      </Group>
    );
    const html = renderToString(tree);
    expect(html.match(/checked=""/g)).toHaveLength(1);
    expect(html).toMatch(/<input[^>]*checked=""[^>]*value="sms"/);

    const container = render(tree);
    expect(inputs(container).map((input) => input.checked)).toEqual([
      false,
      true,
    ]);
    expect(container.querySelector('[role="group"]')).not.toBeNull();
  });

  it('changes the group value from a checkbox, without re-rendering for it', async () => {
    const seen: (readonly string[])[] = [];
    const container = render(
      <Group defaultValue={['sms']} onValueChange={(value) => seen.push(value)}>
        <Option value="email" />
        <Option value="sms" />
      </Group>,
    );
    const [email, sms] = inputs(container);
    await pointer.click(email!);
    await pointer.click(sms!);
    expect(seen).toEqual([['sms', 'email'], ['email']]);
    expect(inputs(container).map((input) => input.checked)).toEqual([
      true,
      false,
    ]);
  });

  it('links through the owner prop without a provider', () => {
    let group: Instance<typeof checkboxGroup> | undefined;
    function Apart() {
      const ui = useComponent(checkboxGroup, { defaultValue: ['email'] });
      group = ui.instance;
      return <div {...ui.parts.root} />;
    }
    render(<Apart />);
    const container = render(<Option value="email" owner={group} />);
    expect(inputs(container)[0]!.checked).toBe(true);
  });

  it('links through the DOM when there is no provider', () => {
    const container = render(
      <Group defaultValue={['sms']} hasProvider={false}>
        <Option value="email" />
        <Option value="sms" />
      </Group>,
    );
    expect(inputs(container).map((input) => input.checked)).toEqual([
      false,
      true,
    ]);
  });
});
