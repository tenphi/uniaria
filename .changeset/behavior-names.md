---
'@uniaria/core': minor
'@uniaria/react': minor
'@uniaria/vue': minor
---

The functions that define and run a component's behavior are named for it:
`defineComponent` is now `defineBehavior`, `useComponent` is `useBehavior`
and `useComponentState` is `useBehaviorState`, in React and in Vue. Their
types follow: `ComponentHandle` is `BehaviorHandle`, `ComponentConfig` is
`BehaviorConfig`, and Vue's `ComponentProps` is `BehaviorProps`. A definition
renders nothing, so the old names read like a framework component, and in Vue
`defineComponent` clashed with Vue's own. Rename the imports; nothing else
changes.
