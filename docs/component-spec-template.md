# <Component> spec

Status: draft <!-- draft | approved by @tenphi on YYYY-MM-DD -->

## Summary

One paragraph: what the component is for and the native element underneath, if
any.

- **WAI-ARIA pattern:** <link to the Authoring Practices pattern>
- **Builds on:** <definitions it composes with `ctx.use()`, interaction
  primitives from `dom/`>
- **Owner:** <the instance it registers with (`ctx.owner()`) and its
  explicit-link attribute, e.g. `group`> or none
- **Custom element:** <yes | static options only | native adapter only> — why

## Anatomy

| Part    | Element  | Attributes Sous owns                           | Notes |
| ------- | -------- | ---------------------------------------------- | ----- |
| root    | `div`    | `data-scope`, `data-part`, `data-disabled`     |       |
| trigger | `button` | `aria-expanded`, `aria-controls`, `data-state` |       |

Mark element-owned parts (content the custom element writes) explicitly.

## Props

Boolean props read as predicates: `is…` for states (`isOpen`,
`isDisabled`), `should…`, `has…` or `allows…` for behavior
(`shouldPreventFocusOnPress`). A bindable `isOpen` is seeded by `defaultOpen`
and reports `openChange` (DOM `openchange`, React `onOpenChange`).

| Prop       | Type      | Default | Bindable | Change event | Notes |
| ---------- | --------- | ------- | -------- | ------------ | ----- |
| isOpen     | `boolean` | `false` | yes      | `openChange` |       |
| isDisabled | `boolean` | `false` | no       | —            |       |

## Public state

What `expose()` returns. Selectors (`useComponentState`) read it, so it is
public API: adding a field is a feature, changing one is a breaking change.

| Field      | Type      | Meaning |
| ---------- | --------- | ------- |
| isOpen     | `boolean` |         |
| isDisabled | `boolean` |         |

## Keyboard

| Key    | Where   | Behavior |
| ------ | ------- | -------- |
| Enter  | trigger |          |
| Space  | trigger |          |
| Escape |         |          |

## ARIA and state attributes per state

| State  | Part    | Attributes |
| ------ | ------- | ---------- |
| closed | trigger |            |
| open   | trigger |            |

## Focus

Where focus goes on open, close, selection and dismissal; what restores it.

## Pointer and touch

Press behavior, press-and-hold, outside interaction, hover.

## Expected spoken output

What the virtual screen reader should announce for the main flows (these
become conformance checks).

## Deviations from the WAI-ARIA pattern

None, or each deviation with its reason.

## Open questions

Questions for the owner. A spec with open questions is not approved.
