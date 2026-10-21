# UniAria

Framework-agnostic headless UI behavior. Each component's state, keyboard
handling, focus management and ARIA are written once in plain TypeScript, then
bound to React, to Vue or to light-DOM custom elements by thin generic
adapters.
Styling stays with your design system: every part carries a marker
(`data-uni` on the root, `data-element` on the others) and state attributes.

> **Status:** pre-release, 0.x on npm. The API can change in any 0.x version.

Documentation: [uniaria.tenphi.me](https://uniaria.tenphi.me).

| Package             | Purpose                                                       |
| ------------------- | ------------------------------------------------------------- |
| `@uniaria/core`     | Runtime, interactions, collections and component definitions  |
| `@uniaria/react`    | React adapter: `useComponent(definition, props)`              |
| `@uniaria/vue`      | Vue adapter: `useComponent(definition, props)`                |
| `@uniaria/elements` | Custom-elements adapter: `defineElement(definition, options)` |
| `@uniaria/testing`  | Test instances, conformance runner, screen-reader helpers     |
| `@uniaria/styles`   | Optional default styles: prebuilt CSS and Tasty style objects |

The first release covers Button, ToggleButton, Field, TextField (inputs and
textareas), Checkbox, CheckboxGroup, Switch, RadioGroup, Dialog, Popover,
Tooltip, NumberField, Listbox, Select and Combobox, at React Aria-level
accessibility.

UniAria is part of the same family as [Tasty](https://tasty.style) and
[Glaze](https://github.com/tenphi/glaze). The name says what it is: one
implementation of accessible behavior for every framework.

## Development

```bash
pnpm install
pnpm test:setup   # Playwright browsers
pnpm test
```

See [AGENTS.md](AGENTS.md) for the architecture rules, the component workflow
and every command.

## License

[MIT](LICENSE)
