/**
 * The DOM-free runtime: store, props schema (`prop`, `bindable`, `event`),
 * `defineBehavior` and the instance every adapter drives. Compiled without
 * the DOM lib (`tsconfig.core.json`).
 */

export { createStore } from './store';
export type { Store } from './store';
export {
  bindable,
  callbackName,
  capitalize,
  domEventName,
  event,
  kebabCase,
  prop,
} from './schema';
export type {
  AnyPropSpec,
  BindableOptions,
  BindableSpec,
  EventSpec,
  EventsSchema,
  ItemsAdoption,
  PropAdoption,
  PropInfo,
  PropOptions,
  PropSpec,
  PropType,
  PropsSchema,
  ResolvedSchema,
} from './schema';
export {
  answers,
  defineBehavior,
  isOwnerDefinition,
  itemId,
  partElement,
  partMarker,
} from './define';
export type {
  ActionsOf,
  AnyDefinition,
  ApiOf,
  Bindable,
  BindableKeyOf,
  Cell,
  BehaviorConfig,
  ComposeOptions,
  Composed,
  ConnectedParts,
  Definition,
  Env,
  InputProps,
  ItemPartOf,
  LinkKey,
  Linkable,
  Linked,
  Owned,
  OwnerLink,
  PartHandler,
  PartOf,
  PartProps,
  PropReaders,
  PropsOf,
  ResetOptions,
  SetupContext,
  StateOf,
  ViewContext,
} from './define';
export { createInstance } from './instance';
export type { Instance, InstanceOptions } from './instance';
