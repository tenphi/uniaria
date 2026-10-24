// @ts-check
// Bundle sizes of the published entry points, measured from `dist` (run
// `pnpm size`, which builds first). Each JavaScript check bundles and
// minifies an import the way an app would, with rolldown, which also sets
// `process.env.NODE_ENV` to production, leaves the framework out, and reports
// the result brotlied. There are no limits yet: the numbers are tracked, not
// enforced.

/** Each component's `@uniaria/core` subpath and the definition it exports. */
const COMPONENTS = {
  button: 'button',
  'toggle-button': 'toggleButton',
  field: 'field',
  'text-field': 'textField',
  'number-field': 'numberField',
  checkbox: 'checkbox',
  'checkbox-group': 'checkboxGroup',
  switch: 'toggleSwitch',
  radio: 'radio',
  'radio-group': 'radioGroup',
  dialog: 'dialog',
  popover: 'popover',
  tooltip: 'tooltip',
  listbox: 'listbox',
  select: 'select',
  combobox: 'combobox',
};

/**
 * Every definition an adapter renders: the components, and the controls
 * that have no element or styles of their own (composition spec).
 */
const DEFINITIONS = { ...COMPONENTS, 'text-input': 'textInput' };

const ADAPTERS = {
  react: { ignore: ['react', 'react-dom'] },
  vue: { ignore: ['vue'] },
};

/** @param {string} subpath */
const core = (subpath) => `packages/core/dist/${subpath}/index.js`;

/** @typedef {import('size-limit').Check} Check */

/** @type {Check[]} */
const adapters = Object.entries(ADAPTERS).flatMap(([name, { ignore }]) => {
  const adapter = `packages/${name}/dist/index.js`;
  /** @type {Check[]} */
  const checks = [
    {
      name: `@uniaria/${name}`,
      path: adapter,
      import: { [adapter]: '{ useBehavior, useBehaviorState }' },
      ignore,
    },
  ];
  for (const [subpath, definition] of Object.entries(DEFINITIONS)) {
    checks.push({
      name: `@uniaria/${name} + ${subpath}`,
      path: [adapter, core(subpath)],
      import: {
        [adapter]: '{ useBehavior }',
        [core(subpath)]: `{ ${definition} }`,
      },
      ignore,
    });
  }
  checks.push({
    name: `@uniaria/${name} + every component`,
    path: [adapter, ...Object.keys(DEFINITIONS).map(core)],
    import: {
      [adapter]: '{ useBehavior }',
      ...Object.fromEntries(
        Object.entries(DEFINITIONS).map(([subpath, definition]) => [
          core(subpath),
          `{ ${definition} }`,
        ]),
      ),
    },
    ignore,
  });
  return checks;
});

/** @param {string} subpath */
const element = (subpath) => `packages/elements/dist/${subpath}.js`;

/** @param {string} subpath The registering entry's export, `UniToggleButton`. */
const elementClass = (subpath) =>
  `Uni${subpath.replace(/(?:^|-)(\w)/g, (_, letter) => letter.toUpperCase())}`;

/** @type {Check[]} */
const elements = [
  {
    name: '@uniaria/elements',
    path: 'packages/elements/dist/index.js',
    import: { 'packages/elements/dist/index.js': '{ defineElement }' },
  },
  ...Object.keys(COMPONENTS).map((subpath) => ({
    name: `@uniaria/elements/${subpath}`,
    path: element(subpath),
    import: { [element(subpath)]: `{ ${elementClass(subpath)} }` },
  })),
  {
    // One entry importing them all, so it bundles as one file, as above.
    name: '@uniaria/elements, every component',
    path: Object.keys(COMPONENTS).map(element),
    import: Object.fromEntries(
      Object.keys(COMPONENTS).map((subpath) => [
        element(subpath),
        `{ ${elementClass(subpath)} }`,
      ]),
    ),
  },
];

/**
 * The prebuilt CSS as shipped (not minified), brotlied.
 * @type {Check[]}
 */
const styles = [
  ...['index', 'layered', 'tokens', 'positioning'],
  ...Object.keys(COMPONENTS),
].map((file) => ({
  name: `@uniaria/styles/css/${file}.css`,
  path: `packages/styles/dist/css/${file}.css`,
  rolldown: false,
}));

export default [...adapters, ...elements, ...styles];
