# @uniaria/elements

Light-DOM custom elements for UniAria. Each element wraps your markup and binds
a component definition from
[`@uniaria/core`](https://www.npmjs.com/package/@uniaria/core) to it, with no
shadow root: your elements stay yours, styled by your CSS. For plain HTML,
server templates and any framework that renders HTML.

> **Pre-release.** The API can change in any 0.x version.

## Install

```sh
pnpm add @uniaria/core @uniaria/elements
```

## Use

Import a component's entry once to define its element, `<uni-` plus the
component's name. Mark the root part with `data-uni` and every other part with
`data-element`:

```html
<uni-switch>
  <label data-uni="switch">
    <input data-element="Input" name="wifi" checked />
    <span data-element="Indicator"></span>
    <span data-element="Label">Wi-Fi</span>
  </label>
</uni-switch>

<script type="module">
  import '@uniaria/elements/switch';
</script>
```

Props are attributes in kebab case (`disabled`, `default-open`) and properties
by their own names; events are lowercase DOM events (`selectedchange`). To
register a component under another prefix, pass its definition to
`defineElement(definition, { prefix })`.

## Documentation

[Getting started](https://github.com/tenphi/uniaria/blob/main/docs/guide/getting-started.mdx)
and every component's page are in the repository's
[`docs`](https://github.com/tenphi/uniaria/tree/main/docs) folder.

## License

[MIT](https://github.com/tenphi/uniaria/blob/main/LICENSE)
