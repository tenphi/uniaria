import { describe, expect, it } from 'vitest';

import { h, nested, templateParts } from './template';

describe('h', () => {
  it('separates the part name from consumer attributes', () => {
    expect(h('button', { part: 'root', class: 'primary' }, 'Save')).toEqual({
      tag: 'button',
      part: 'root',
      attrs: { class: 'primary' },
      children: ['Save'],
    });
  });

  it('builds plain elements without a part', () => {
    expect(h('form', null, h('input'))).toEqual({
      tag: 'form',
      attrs: {},
      children: [{ tag: 'input', attrs: {}, children: [] }],
    });
  });
});

describe('templateParts', () => {
  it('lists part elements in document order, at any depth', () => {
    const template = [
      h('form', null, h('button', { part: 'root' }, 'Save')),
      h('div', { part: 'panel' }, h('span', { part: 'label' })),
    ];
    expect(templateParts(template).map((node) => node.part)).toEqual([
      'root',
      'panel',
      'label',
    ]);
  });
});

describe('nested', () => {
  it('builds a nested component whose parts are its own', () => {
    const option = nested(
      'checkbox',
      { value: 'email' },
      h('input', { part: 'input' }),
    );
    expect(option).toEqual({
      component: 'checkbox',
      props: { value: 'email' },
      children: [{ tag: 'input', part: 'input', attrs: {}, children: [] }],
    });
    const group = h('div', { part: 'root' }, option);
    expect(templateParts([group]).map((node) => node.part)).toEqual(['root']);
  });
});
