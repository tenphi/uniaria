# Sous

Framework-agnostic headless UI behavior. Each component's state, keyboard
handling, focus management and ARIA are written once in plain TypeScript, then
bound to React or to light-DOM custom elements by thin generic adapters.
Styling stays with your design system: every part exposes `data-scope`,
`data-part` and state attributes.

> **Status:** pre-alpha. Nothing is published yet.

| Package                 | Purpose                                                       |
| ----------------------- | ------------------------------------------------------------- |
| `@tenphi/sous`          | Runtime, interactions, collections and component definitions  |
| `@tenphi/sous-react`    | React adapter: `useComponent(definition, props)`              |
| `@tenphi/sous-elements` | Custom-elements adapter: `defineElement(definition, options)` |
| `@tenphi/sous-testing`  | Test instances, conformance runner, screen-reader helpers     |

The first release covers Button, ToggleButton, Field, TextField (inputs and
textareas), Checkbox, CheckboxGroup, Switch, RadioGroup, Dialog, Popover,
Tooltip, NumberField, Listbox, Select and ComboBox, at React Aria-level
accessibility.

Sous is part of the same family as [Tasty](https://tasty.style) and
[Glaze](https://github.com/tenphi/glaze): a sous-chef does the prep nobody sees
so the head chef can plate.

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
