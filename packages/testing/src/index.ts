/**
 * `@uniaria/testing` — development-only tools. This entry is safe to
 * import anywhere, including the `node` test project: conformance templates,
 * the `mount` contract adapters implement, and `defineConformance` for
 * writing suites. Running suites, real input and spoken output live in
 * `@uniaria/testing/browser`; the Playwright commands they need live in
 * `@uniaria/testing/commands`. To drive a definition without a
 * framework or a DOM, use `createInstance` from `@uniaria/core`.
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
  ScreenReaderInput,
  ScreenReaderName,
  TouchInput,
} from './conformance/scenario';
export {
  VIRTUALIZER,
  h,
  isNested,
  isRows,
  nested,
  partName,
  partSelector,
  renderTemplate,
  rows,
  templateParts,
} from './conformance/template';
export type {
  RenderTemplateOptions,
  RenderedRows,
  TemplateAttrs,
  TemplateComponent,
  TemplateElement,
  TemplateNode,
  TemplateRows,
} from './conformance/template';
