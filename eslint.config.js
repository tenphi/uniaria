// @ts-check
import eslint from '@eslint/js';
import tasty from '@tenphi/eslint-plugin-tasty';
import prettier from 'eslint-config-prettier';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/** Framework and adapter imports that never belong in `@uniaria/core`. */
const FRAMEWORKS = {
  group: [
    'react',
    'react/*',
    'react-dom',
    'react-dom/*',
    'preact',
    'preact/*',
    'vue',
    'solid-js',
    'solid-js/*',
    'svelte',
    'svelte/*',
    'lit',
    'lit/*',
    '@uniaria/react',
    '@uniaria/elements',
    '@uniaria/testing',
  ],
  message:
    '@uniaria/core is framework-free. Framework code belongs in an adapter package.',
};

/** `@uniaria/styles` tests and their helpers, which mount components. */
const STYLES_TESTS = [
  'packages/styles/src/**/*.test.{ts,tsx}',
  'packages/styles/src/testing/**',
];

export default defineConfig(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      'coverage/**',
      'specs/**',
      'references/**',
      'apps/docs/.astro/**',
      'apps/docs/public/demo/**',
      '.claude/worktrees/**',
    ],
  },
  eslint.configs.recommended,
  tseslint.configs.recommended,
  tseslint.configs.stylistic,
  prettier,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/consistent-type-imports': 'error',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  {
    files: ['**/*.test.ts', '**/*.test.tsx'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
  {
    files: [
      'scripts/**/*.mjs',
      '*.config.{js,ts}',
      'packages/*/bench/**/*.ts',
      'apps/*/scripts/**/*.mjs',
      'apps/*/*.config.ts',
    ],
    languageOptions: { globals: globals.node },
    rules: { 'no-console': 'off' },
  },
  // The documentation site's live demos run in the browser.
  {
    files: ['docs/**/*.js'],
    languageOptions: { globals: globals.browser },
  },
  // Tasty styles, checked against the tokens, states and presets the nearest
  // `tasty.config.ts` lists (the documentation site's comes from its theme).
  {
    ...tasty.configs.strict,
    files: ['apps/docs/**/*.{ts,tsx}'],
  },
  {
    ...tasty.configs.strict,
    files: ['packages/styles/src/**/*.ts'],
    ignores: STYLES_TESTS,
  },

  // Architecture boundaries (AGENTS.md → Architecture rules). Each block encodes
  // a design decision; change them only with the owner's approval. Later blocks
  // override earlier ones for the files they match, so each repeats FRAMEWORKS.
  {
    files: ['packages/core/src/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [FRAMEWORKS] }],
    },
  },
  {
    files: [
      'packages/core/src/runtime/**/*.ts',
      'packages/core/src/collections/**/*.ts',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            FRAMEWORKS,
            {
              group: [
                '**/dom',
                '**/dom/**',
                '**/components',
                '**/components/**',
              ],
              message:
                'runtime/ and collections/ sit below dom/ and components/ and stay DOM-free.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['packages/core/src/dom/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            FRAMEWORKS,
            {
              group: ['**/components', '**/components/**'],
              message: 'dom/ sits below components/ and must not import them.',
            },
          ],
        },
      ],
    },
  },
  // @uniaria/styles targets the part markers and state attributes alone, and
  // takes only types from Tasty's entries that load React (styles spec:
  // Changes outside the package).
  {
    files: ['packages/styles/src/**/*.ts'],
    ignores: STYLES_TESTS,
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [...FRAMEWORKS.group, '@uniaria/core', '@uniaria/core/*'],
              message:
                '@uniaria/styles reads no framework or component code; its tests may.',
            },
          ],
        },
      ],
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          paths: [
            '@tenphi/tasty',
            '@tenphi/tasty/core',
            '@tenphi/tasty/static',
            '@tenphi/tasty/ssr',
          ].map((name) => ({
            name,
            allowTypeImports: true,
            message:
              'Only types from Tasty entries that load React; the build uses @tenphi/tasty/zero.',
          })),
        },
      ],
    },
  },
  {
    files: ['packages/core/src/components/**/*.ts'],
    ignores: ['**/*.test.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector:
            'CallExpression[callee.property.name=/^stop(Immediate)?Propagation$/]',
          message:
            'Coordinate overlays through the layer stack, not event propagation (design decision 4).',
        },
      ],
    },
  },
);
