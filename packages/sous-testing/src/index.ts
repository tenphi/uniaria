/**
 * `@tenphi/sous-testing` — development-only tools. This entry is safe to
 * import anywhere, including the `node` test project: conformance templates,
 * the `mount` contract adapters implement, and `defineConformance` for
 * writing suites. Running suites, real input and spoken output live in
 * `@tenphi/sous-testing/browser`; the Playwright commands they need live in
 * `@tenphi/sous-testing/commands`. To drive a definition without a
 * framework or a DOM, use `createInstance` from `@tenphi/sous`.
 */

export type {
  AdapterMount,
  ConformanceAdapter,
  MountOptions,
  MountRequest,
  Mounted,
  RecordedEvent,
} from './conformance/contract';
export { defineConformance } from './conformance/scenario';
export type {
  ConformanceBuilder,
  ConformanceSuite,
  InputNeed,
  KeyboardInput,
  MouseButton,
  PointerInput,
  Scenario,
  ScenarioContext,
  ScenarioGroup,
  ScenarioOptions,
  ScenarioRun,
  TouchInput,
} from './conformance/scenario';
export { h, renderTemplate, templateParts } from './conformance/template';
export type {
  TemplateAttrs,
  TemplateElement,
  TemplateNode,
} from './conformance/template';
