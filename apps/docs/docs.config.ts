import { defineDocsConfig } from '@tenphi/cookbook/config';

export default defineDocsConfig({
  root: '../..',
  site: {
    title: 'UniAria',
    description:
      'Accessible component behavior written once, for React, custom elements and any framework.',
    repository: 'https://github.com/tenphi/uniaria',
  },
  editLink: { baseUrl: 'https://github.com/tenphi/uniaria/edit/main/' },
  content: {
    sources: [{ glob: 'docs/**/*.{md,mdx}', base: 'docs' }],
  },
  navigation: {
    tabs: [
      {
        label: 'Guide',
        link: '/',
        items: [
          '/',
          {
            label: 'Start',
            items: ['/guide/introduction', '/guide/getting-started'],
          },
          {
            label: 'Use',
            items: [
              '/guide/styling',
              '/guide/default-styles',
              '/guide/theming',
              '/guide/state',
              '/guide/composition',
              '/guide/forms',
              '/guide/overlays',
              '/guide/collections',
            ],
          },
          {
            label: 'Ship',
            items: [
              '/guide/server-rendering',
              '/guide/accessibility',
              '/guide/browser-support',
            ],
          },
          { label: 'Extend', items: ['/guide/custom-components'] },
        ],
      },
      {
        label: 'Components',
        link: '/components',
        items: [
          '/components',
          {
            label: 'Buttons',
            items: ['/components/button', '/components/toggle-button'],
          },
          {
            label: 'Forms',
            items: [
              '/components/field',
              '/components/text-field',
              '/components/number-field',
              '/components/checkbox',
              '/components/checkbox-group',
              '/components/switch',
              '/components/radio-group',
            ],
          },
          {
            label: 'Overlays',
            items: [
              '/components/dialog',
              '/components/popover',
              '/components/tooltip',
            ],
          },
          {
            label: 'Collections',
            items: [
              '/components/listbox',
              '/components/select',
              '/components/combobox',
            ],
          },
        ],
      },
      {
        label: 'API',
        link: '/api',
        items: [
          '/api',
          {
            label: '@uniaria/core',
            items: ['/api/core', '/api/dom', '/api/collections'],
          },
          {
            label: 'Adapters',
            items: ['/api/react', '/api/elements'],
          },
          { label: 'Tools', items: ['/api/testing'] },
        ],
      },
      {
        label: 'Contributing',
        link: '/contributing',
        items: [
          '/contributing',
          '/contributing/architecture',
          '/contributing/component-workflow',
          '/contributing/testing',
          '/contributing/documentation',
        ],
      },
    ],
  },
  theme: { brand: { from: 'okhsl(200 75% 45%)' } },
});
