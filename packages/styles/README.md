# @uniaria/styles

Optional default styles for UniAria's components: a neutral look for all 17,
accessible in a light, a dark and a high-contrast scheme and in forced colors,
which you can keep, retheme or replace part by part. UniAria itself has no
look, and works without this package.

> **Pre-release.** The API can change in any 0.x version.

## Install

```sh
pnpm add @uniaria/styles
```

## Use

It comes three ways, from one source written as
[Tasty](https://tasty.style) style objects:

- **Prebuilt CSS**, for any project:

  ```css
  @import '@uniaria/styles/css';
  ```

  Or the tokens and only the components you use
  (`@uniaria/styles/css/tokens.css`, `@uniaria/styles/css/checkbox.css`).

- **Customized CSS**, built in Node with your palette, tokens and overrides:
  `buildCss()` from `@uniaria/styles/build`, with `createPalette()` from
  `@uniaria/styles/palette`.
- **Tasty style objects**, for a project that styles with Tasty already: the
  `uniaria()` plugin from `@uniaria/styles/tasty`, and each component's
  styles from its subpath (`@uniaria/styles/checkbox`).

[`@tenphi/tasty`](https://www.npmjs.com/package/@tenphi/tasty) and
[`@tenphi/glaze`](https://www.npmjs.com/package/@tenphi/glaze) are optional
peer dependencies: add them only for the outputs that need them.

## Documentation

[Default styles](https://uniaria.tenphi.me/guide/default-styles/) and
[Theming](https://uniaria.tenphi.me/guide/theming/), on [uniaria.tenphi.me](https://uniaria.tenphi.me).

## License

[MIT](https://github.com/tenphi/uniaria/blob/main/LICENSE)
