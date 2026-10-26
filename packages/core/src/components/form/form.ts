/**
 * Form, from the approved spec (`./spec.md`): the behavior of a `<form>`,
 * after Cube UI Kit's modern form
 * (`references/cube-ui-kit/src/components/form/Form/modern/`). It holds the
 * values of the fields bound to it by name, checks them, shows each field's
 * errors through the field's Field, submits and resets.
 *
 * - **Values** live here, nested along names that are keys or paths
 *   (`./values.ts`); they exist before their fields mount and stay after.
 *   A field finds the form through `formLink` (`./link.ts`) and follows only
 *   its own name's view, so a keystroke re-runs that field and the form.
 * - **Checks**: bad input, required, the native constraints on the field's
 *   control (`./constraints.ts`), then `validate`, on each field's trigger,
 *   after its delay, async with an abort signal; a result that can no longer
 *   count is dropped.
 * - **Submit** checks every active field, then calls `handleSubmit`, or
 *   without one posts natively from a new task; a failed submit focuses the
 *   first invalid field in the next frame.
 * - **Reset** waits for the `reset` event's dispatch to end, then puts every
 *   value back to its default and clears what the fields showed.
 */

import {
  announce,
  isDevelopment,
  isFocusable,
  modalityTrackerFor,
  partEffect,
  partElement,
  warn,
} from '../../dom';
import type { DomPartProps } from '../../dom';
import { defineBehavior, event, prop } from '../../runtime';
import { checkControl, isTextControl, requiredMessage } from './constraints';
import { formLink } from './link';
import type {
  CheckCause,
  FieldRegistration,
  FieldState,
  FieldStatus,
  FieldView,
  FormLinkApi,
  FormSettings,
  Trigger,
} from './link';
import { messageFor } from './messages';
import type { Issue, Messages } from './messages';
import {
  hasPath,
  isEmpty,
  isRelated,
  isShallowEqual,
  keyOf,
  pathOf,
  readPath,
  toPath,
  writePath,
} from './values';
import type { Name, Path, Values } from './values';

const flag = (isOn: boolean): string | undefined => (isOn ? '' : undefined);

const EMPTY: Values = Object.freeze({});
const NO_ERRORS: readonly unknown[] = Object.freeze([]);

/** What a submit resolves to. */
export type SubmitStatus =
  'submitted' | 'invalid' | 'failed' | 'stale' | 'ignored';

/** Errors by key, for each field that failed. */
export type FieldErrors = Readonly<Record<string, readonly unknown[]>>;

export interface SubmitResult {
  readonly status: SubmitStatus;
  /** With `'invalid'`. */
  readonly errors?: FieldErrors;
  /** With `'failed'`: what `handleSubmit` threw. */
  readonly error?: unknown;
}

/** Which values a submit sends: the active names', or every one held. */
export type SubmitValues = 'active' | 'all';

export interface SubmitOptions {
  /** The button that submits, as a native submit has one. */
  readonly submitter?: HTMLElement | null;
  /** Which values to send; the form's `submitValues` by default. */
  readonly include?: SubmitValues;
  /** Whether a failed submit focuses the first invalid field. Default `true`. */
  readonly shouldFocus?: boolean;
}

/** What `handleSubmit` gets beside the values. */
export interface SubmitContext {
  /** Aborts when the submit stops counting: a reset, `cancelSubmit()`. */
  readonly signal: AbortSignal;
  readonly submitter: HTMLElement | null;
  readonly include: SubmitValues;
  /** The `<form>`'s data with the submitter's, for controls not bound. */
  readonly formData: FormData | undefined;
}

export type HandleSubmit = (values: Values, context: SubmitContext) => unknown;

/** What `submitFailed` reports. */
export type SubmitFailure =
  | { readonly status: 'invalid'; readonly errors: FieldErrors }
  | { readonly status: 'failed'; readonly error: unknown };

/** What `valuesChange` reports. */
export interface ValuesChange {
  readonly values: Values;
  /** The keys of the names that changed. */
  readonly names: readonly string[];
  readonly source: 'user' | 'program';
  readonly kind: 'set' | 'reset' | 'defaults';
}

export interface ValidateResult {
  /** Every name checked passed; `false` with none to check, as UI Kit's. */
  readonly isValid: boolean;
  /** A value changed meanwhile, so the result no longer counts. */
  readonly isStale: boolean;
  readonly errors: FieldErrors;
}

export interface SetValueOptions {
  /**
   * `'auto'` (the default) checks what a user's change would; `'always'`
   * checks the field; `'never'` checks nothing and keeps its errors.
   */
  readonly validation?: 'auto' | 'always' | 'never';
  /** Who made the change. `'program'` by default. */
  readonly source?: 'user' | 'program';
  /** Marks the name touched. Default `false`. */
  readonly shouldTouch?: boolean;
  /** Reports `valuesChange`. By default only for `source: 'user'`. */
  readonly shouldNotify?: boolean;
}

export interface SetDefaultValuesOptions {
  /**
   * Which values the new defaults replace: those no one changed
   * (`'untouched'`, the default), also those still equal to the old default
   * (`'clean'`), or every one (`'all'`).
   */
  readonly replaceValues?: 'untouched' | 'clean' | 'all';
  /** Reports `valuesChange` when values change. Default `false`. */
  readonly shouldNotify?: boolean;
}

export interface FormResetOptions {
  /** New defaults, for starting a new record. */
  readonly values?: Values;
}

/** A registration, and when it registered: the newest owns the checks. */
interface Registration {
  readonly field: FieldRegistration;
  readonly order: number;
}

/** What the form knows of one name. */
interface FieldRecord {
  readonly key: string;
  readonly path: Path;
  readonly registrations: Registration[];
  isTouched: boolean;
  errors: readonly unknown[];
  status: FieldStatus;
  cause: CheckCause | undefined;
  /** Checked since the last reset, so a `dependsOn` change checks it again. */
  hasChecked: boolean;
  running: RunningCheck | undefined;
}

interface CheckOutcome {
  readonly key: string;
  readonly errors: readonly unknown[];
  readonly isStale: boolean;
}

interface RunningCheck {
  readonly controller: AbortController;
  timer: ReturnType<typeof setTimeout> | undefined;
  readonly settle: (outcome: CheckOutcome) => void;
}

interface Submission {
  readonly controller: AbortController;
  readonly finish: (result: SubmitResult) => void;
}

/** A native post on its way: the second `submit` event goes through. */
interface Passing {
  readonly include: SubmitValues;
  hasArrived: boolean;
}

const isPromiseLike = (value: unknown): value is PromiseLike<unknown> =>
  !!value &&
  (typeof value === 'object' || typeof value === 'function') &&
  typeof (value as { then?: unknown }).then === 'function';

/** A check's result as errors: none for `null`, `undefined`, `''`, `true`. */
function errorsOf(result: unknown): readonly unknown[] {
  if (result === null || result === undefined || result === '') {
    return NO_ERRORS;
  }
  if (result === true) return NO_ERRORS;
  if (Array.isArray(result)) {
    const errors = (result as unknown[]).filter(
      (error) =>
        error !== null && error !== undefined && error !== '' && error !== true,
    );
    return errors.length > 0 ? errors : NO_ERRORS;
  }
  return [result];
}

/**
 * The native constraint `value` fails in `field`: its own check, else its
 * control's, when that is a text control (other controls have none).
 */
function checkNative(field: FieldRegistration, value: unknown): Issue | null {
  if (field.check) return field.check(value);
  const control = field.control();
  if (!isTextControl(control)) return null;
  return checkControl(
    control,
    value === null || value === undefined ? '' : String(value),
  );
}

/** A thrown error as one: its message, else the value thrown. */
const thrown = (error: unknown): unknown =>
  error instanceof Error ? error.message : error;

/**
 * `a` before `b` (negative) in the composed tree: shadow roots in their
 * host's place, as Tab and a screen reader meet them.
 */
function compareComposed(a: Node, b: Node): number {
  const chain = (node: Node): Node[] => {
    const list: Node[] = [];
    for (let at: Node | undefined = node; at;) {
      list.unshift(at);
      at = (at.getRootNode() as Partial<ShadowRoot>).host;
    }
    return list;
  };
  const left = chain(a);
  const right = chain(b);
  for (let index = 0; ; index++) {
    const x = left[index];
    const y = right[index];
    if (!x || !y) return x ? 1 : y ? -1 : 0;
    if (x === y) continue;
    return x.compareDocumentPosition(y) & Node.DOCUMENT_POSITION_FOLLOWING
      ? -1
      : 1;
  }
}

/** The form's controls, read from the prototype: a control named `elements` shadows the property. */
function controlsOf(element: HTMLFormElement): Element[] {
  const getter = Object.getOwnPropertyDescriptor(
    HTMLFormElement.prototype,
    'elements',
  )?.get;
  return getter
    ? Array.from(getter.call(element) as HTMLFormControlsCollection)
    : [];
}

/** Whether `element` submits `form`, as `requestSubmit()` takes it. */
function isSubmitterOf(element: HTMLElement, form: HTMLFormElement): boolean {
  const control = element as HTMLButtonElement | HTMLInputElement;
  if (control.form !== form) return false;
  if (element.localName === 'button') return control.type === 'submit';
  return (
    element.localName === 'input' &&
    (control.type === 'submit' || control.type === 'image')
  );
}

/** Adds `value` under `key` to native form data, as a control would post it. */
function appendValue(data: FormData, key: string, value: unknown): void {
  if (value === null || value === undefined || value === false) return;
  if (value === true) return data.append(key, 'on');
  if (typeof value === 'string' || typeof value === 'number') {
    return data.append(key, String(value));
  }
  if (Array.isArray(value)) {
    for (const item of value as unknown[]) appendValue(data, key, item);
    return;
  }
  if (isDevelopment()) {
    warn(
      `form: the value of "${key}" can't be posted natively, since it is ` +
        'neither a string, a number, a boolean nor a list of them. Render a ' +
        'control for it, or submit with handleSubmit.',
    );
  }
}

export const form = defineBehavior({
  name: 'form',
  parts: ['root', 'error'],
  provides: [formLink],
  props: {
    defaultValues: prop<Values>(EMPTY, { attribute: false }),
    handleSubmit: prop<HandleSubmit | undefined>(undefined, {
      attribute: false,
    }),
    submitValues: prop<SubmitValues>('active'),
    validationTrigger: prop<Trigger | undefined>(undefined, {
      type: 'string',
    }),
    validationDelay: prop(0),
    validationMessages: prop<Messages | undefined>(undefined, {
      attribute: false,
    }),
    isDisabled: prop(false),
    isReadOnly: prop(false, { attribute: 'readonly' }),
  },
  events: {
    submitted: event<{ readonly values: Values }>(),
    submitFailed: event<SubmitFailure>(),
    valuesChange: event<ValuesChange>(),
  },
  actions: [
    'submit',
    'cancelSubmit',
    'reset',
    'validate',
    'focusInvalid',
    'setValue',
    'setValues',
    'setDefaultValues',
    'touch',
    'setFieldErrors',
    'clearFieldErrors',
    'setSubmitError',
    'clearSubmitError',
    'batch',
  ],
  setup(ctx) {
    const { props } = ctx;
    const rootForm = () => partElement(ctx, 'root') as HTMLFormElement | null;
    const documentOf = (): Document | undefined =>
      rootForm()?.ownerDocument ??
      (ctx.env.document as Document | undefined) ??
      globalThis.document;

    // The defaults: the consumer's (`defaultValues`, or what
    // `setDefaultValues()` gave), with each name's first explicit field
    // default where the consumer's has none (spec, Defaults).
    let source: Values = props.defaultValues() ?? EMPTY;
    const fieldDefaults = new Map<string, unknown>();
    const withFieldDefaults = (base: Values): Values => {
      let result = base;
      for (const [key, value] of fieldDefaults) {
        const path = pathOf(key);
        if (!hasPath(base, path)) result = writePath(result, path, value);
      }
      return result;
    };
    const defaults = ctx.state<Values>(source);
    const values = ctx.state<Values>(source);
    /** Names written since the last reset or replacement: they keep their value. */
    const changed = new Set<string>();

    const records = new Map<string, FieldRecord>();
    // Bumped on every change to a record, so what is derived from them is
    // derived again.
    const recordsVersion = ctx.state(0);
    const bump = () => recordsVersion.set(recordsVersion.get() + 1);
    // Bumped on reset, so every field writes its control again: the native
    // reset put back the attributes a framework rendered once.
    const epoch = ctx.state(0);
    let order = 0;

    const ensure = (path: Path): FieldRecord => {
      const key = keyOf(path);
      let record = records.get(key);
      if (!record) {
        record = {
          key,
          path,
          registrations: [],
          isTouched: false,
          errors: NO_ERRORS,
          status: 'unvalidated',
          cause: undefined,
          hasChecked: false,
          running: undefined,
        };
        records.set(key, record);
      }
      return record;
    };
    const ownerOf = (record: FieldRecord) => record.registrations.at(-1);
    const isActive = (record: FieldRecord) => record.registrations.length > 0;
    const isEqualFor = (record: FieldRecord | undefined) =>
      (record && ownerOf(record)?.field.options().isEqual) ?? isShallowEqual;
    const triggerOf = (registration: Registration): Trigger => {
      const options = registration.field.options();
      return (
        options.trigger ?? props.validationTrigger() ?? options.defaultTrigger
      );
    };
    /** Whether a field is checked: enabled and not read-only, nor its form. */
    const isCheckable = (registration: Registration) => {
      const options = registration.field.options();
      return (
        !options.isDisabled &&
        !options.isReadOnly &&
        !props.isDisabled() &&
        !props.isReadOnly()
      );
    };

    // Public state per name, each object kept while its content is the same.
    const stateCache = new Map<string, FieldState>();
    const fields = ctx.memo(
      () => [values.get(), defaults.get(), recordsVersion.get()] as const,
      (current, defaultValues, _version) => {
        const result: Record<string, FieldState> = {};
        for (const record of records.values()) {
          const value = readPath(current, record.path);
          const defaultValue = readPath(defaultValues, record.path);
          const next: FieldState = {
            value,
            defaultValue,
            errors: record.errors,
            status: record.status,
            isTouched: record.isTouched,
            isDirty: !isEqualFor(record)(value, defaultValue),
            isActive: isActive(record),
          };
          const previous = stateCache.get(record.key);
          const isSame =
            previous !== undefined &&
            (Object.keys(next) as (keyof FieldState)[]).every((name) =>
              Object.is(previous[name], next[name]),
            );
          const state = isSame ? previous : next;
          stateCache.set(record.key, state);
          result[record.key] = state;
        }
        for (const key of stateCache.keys()) {
          if (!records.has(key)) stateCache.delete(key);
        }
        return Object.freeze(result);
      },
    );

    const activeValues = ctx.memo(
      () => [values.get(), recordsVersion.get()] as const,
      (current, _version) => {
        let result = EMPTY;
        for (const record of records.values()) {
          if (!isActive(record) || !hasPath(current, record.path)) continue;
          result = writePath(
            result,
            record.path,
            readPath(current, record.path),
          );
        }
        return result;
      },
    );

    const settings = ctx.memo(
      () =>
        [
          props.isDisabled(),
          props.isReadOnly(),
          rootForm(),
          ctx.ids.root,
        ] as const,
      (isDisabled, isReadOnly, element, id): FormSettings => ({
        isDisabled,
        isReadOnly,
        element,
        id,
      }),
    );

    const views = new Map<string, FieldView>();
    const view = (key: string): FieldView => {
      const state = fields()[key];
      const value = readPath(values.get(), pathOf(key));
      const current = settings();
      const cause = records.get(key)?.cause;
      const at = epoch.get();
      const cached = views.get(key);
      if (
        cached &&
        cached.state === state &&
        Object.is(cached.value, value) &&
        cached.settings === current &&
        cached.cause === cause &&
        cached.epoch === at
      ) {
        return cached;
      }
      const next: FieldView = {
        state,
        value,
        settings: current,
        cause,
        epoch: at,
      };
      views.set(key, next);
      return next;
    };

    // `valuesChange`, once per batch of changes, after both the field's and
    // the form's stores flushed, so a listener's FormData has the value.
    let pendingChange:
      | {
          names: Set<string>;
          source: ValuesChange['source'];
          kind: ValuesChange['kind'];
        }
      | undefined;
    const reportChange = (
      names: Iterable<string>,
      changeSource: ValuesChange['source'],
      kind: ValuesChange['kind'],
    ) => {
      if (pendingChange) {
        for (const name of names) pendingChange.names.add(name);
        if (kind !== 'set') pendingChange.kind = kind;
        if (changeSource === 'user') pendingChange.source = 'user';
        return;
      }
      pendingChange = { names: new Set(names), source: changeSource, kind };
      queueMicrotask(() => {
        const change = pendingChange;
        pendingChange = undefined;
        if (!change || change.names.size === 0) return;
        ctx.emit('valuesChange', {
          values: values.get(),
          names: [...change.names],
          source: change.source,
          kind: change.kind,
        });
      });
    };

    // Checks (spec, Validation).
    const abortCheck = (record: FieldRecord) => {
      const running = record.running;
      if (!running) return;
      record.running = undefined;
      clearTimeout(running.timer);
      running.controller.abort();
      running.settle({ key: record.key, errors: record.errors, isStale: true });
      if (record.status === 'validating') {
        record.status = record.errors.length > 0 ? 'invalid' : 'unvalidated';
      }
      bump();
    };

    /** The errors `registration` finds in its value now, or their promise. */
    const evaluate = (
      record: FieldRecord,
      registration: Registration,
      signal: AbortSignal,
    ): readonly unknown[] | Promise<readonly unknown[]> => {
      const { field } = registration;
      const options = field.options();
      const value = readPath(values.get(), record.path);
      const context = { name: record.key, value };
      const messages = [options.messages, props.validationMessages()];
      const issue = checkNative(field, value);
      if (issue?.key === 'badInput') {
        return [messageFor(issue, context, ...messages)];
      }
      if (options.isRequired && isEmpty(value)) {
        const doc = documentOf();
        const browser = doc ? requiredMessage(doc, options.kind) : '';
        return [
          messageFor(
            { key: 'valueMissing', message: browser },
            context,
            ...messages,
          ),
        ];
      }
      if (issue) return [messageFor(issue, context, ...messages)];
      if (!options.validate) return NO_ERRORS;
      const result = options.validate(value, {
        name: record.key,
        values: values.get(),
        signal,
      });
      return isPromiseLike(result)
        ? Promise.resolve(result).then(errorsOf)
        : errorsOf(result);
    };

    /**
     * Checks the field under `record` and resolves with what it found: after
     * its delay unless `isImmediate`. A newer check, a change of value, a
     * reset or the field leaving makes it stale, and its result is dropped.
     */
    const check = (
      record: FieldRecord,
      cause: CheckCause,
      isImmediate = false,
    ): Promise<CheckOutcome> => {
      abortCheck(record);
      const registration = ownerOf(record);
      if (!registration) {
        return Promise.resolve({
          key: record.key,
          errors: record.errors,
          isStale: false,
        });
      }
      // A disabled or read-only field isn't checked and holds no errors
      // from checks (spec, Resolved questions 9).
      if (!isCheckable(registration)) {
        if (record.cause !== 'server' && record.errors.length > 0) {
          record.errors = NO_ERRORS;
          record.status = 'unvalidated';
          record.cause = cause;
          bump();
        }
        return Promise.resolve({
          key: record.key,
          errors: NO_ERRORS,
          isStale: false,
        });
      }
      const controller = new AbortController();
      let settle!: (outcome: CheckOutcome) => void;
      const done = new Promise<CheckOutcome>((resolve) => {
        settle = resolve;
      });
      const running: RunningCheck = { controller, timer: undefined, settle };
      record.running = running;
      const finish = (errors: readonly unknown[]) => {
        if (record.running !== running) return;
        ctx.batch(() => {
          record.running = undefined;
          record.hasChecked = true;
          record.errors = errors;
          record.status = errors.length > 0 ? 'invalid' : 'valid';
          record.cause = cause;
          bump();
        });
        settle({ key: record.key, errors, isStale: false });
      };
      const start = () => {
        if (record.running !== running) return;
        running.timer = undefined;
        let result: readonly unknown[] | Promise<readonly unknown[]>;
        try {
          result = evaluate(record, registration, controller.signal);
        } catch (error) {
          result = [thrown(error)];
        }
        if (Array.isArray(result)) return finish(result);
        record.status = 'validating';
        bump();
        (result as Promise<readonly unknown[]>).then(finish, (error) =>
          finish([thrown(error)]),
        );
      };
      const delay = isImmediate
        ? 0
        : (registration.field.options().delay ?? props.validationDelay());
      if (delay > 0) {
        record.status = 'validating';
        bump();
        running.timer = setTimeout(start, delay);
      } else start();
      return done;
    };

    /** Checks the names that depend on `path` and have been checked. */
    const checkDependents = (path: Path) => {
      for (const record of records.values()) {
        const registration = ownerOf(record);
        if (!registration || (!record.hasChecked && !record.running)) continue;
        const { dependsOn } = registration.field.options();
        if (dependsOn.some((name) => isRelated(toPath(name), path))) {
          void check(record, 'dependency');
        }
      }
    };

    interface WriteOptions {
      readonly cause: CheckCause;
      readonly validation: 'auto' | 'always' | 'never';
      readonly shouldTouch: boolean;
      readonly report?: ValuesChange['source'] | undefined;
    }

    /** Writes a value and checks what the change asks (spec, When checks run). */
    const write = (path: Path, value: unknown, options: WriteOptions) => {
      ctx.batch(() => {
        const previous = values.get();
        const next = writePath(previous, path, value);
        if (next === previous && hasPath(previous, path)) return;
        const key = keyOf(path);
        values.set(next);
        changed.add(key);
        // A related name's check read the old value.
        for (const other of records.values()) {
          if (other.key !== key && isRelated(other.path, path)) {
            abortCheck(other);
          }
        }
        const record = records.get(key);
        if (record) {
          if (options.shouldTouch) record.isTouched = true;
          const registration = ownerOf(record);
          if (options.validation === 'never') abortCheck(record);
          else if (
            options.validation === 'always' ||
            (registration &&
              (triggerOf(registration) === 'change' ||
                record.errors.length > 0))
          ) {
            void check(record, options.cause);
          } else {
            // A change that doesn't check clears what the last check found.
            abortCheck(record);
            if (record.status !== 'unvalidated') {
              record.errors = NO_ERRORS;
              record.status = 'unvalidated';
              record.cause = options.cause;
            }
          }
          bump();
        }
        if (options.validation !== 'never') checkDependents(path);
        if (options.report) reportChange([key], options.report, 'set');
      });
    };

    // Defaults (spec, Defaults).
    /** Clears what a record showed: for a value reset or replaced. */
    const clearRecord = (record: FieldRecord) => {
      abortCheck(record);
      record.isTouched = false;
      record.errors = NO_ERRORS;
      record.status = 'unvalidated';
      record.cause = 'reset';
      record.hasChecked = false;
    };

    const replaceDefaults = (
      next: Values,
      mode: 'untouched' | 'clean' | 'all',
      shouldNotify: boolean,
    ) => {
      ctx.batch(() => {
        const before = values.get();
        const oldDefaults = defaults.get();
        source = next;
        const effective = withFieldDefaults(next);
        defaults.set(effective);
        let result = effective;
        if (mode !== 'all') {
          for (const key of [...changed]) {
            const path = pathOf(key);
            const value = readPath(before, path);
            if (
              mode === 'clean' &&
              isEqualFor(records.get(key))(value, readPath(oldDefaults, path))
            ) {
              changed.delete(key);
              continue;
            }
            result = hasPath(before, path)
              ? writePath(result, path, value)
              : writePath(result, path, undefined, true);
          }
        } else {
          changed.clear();
        }
        values.set(result);
        // Names whose value the defaults replaced lose touched, errors and
        // status.
        const names: string[] = [];
        for (const record of records.values()) {
          if (
            Object.is(
              readPath(before, record.path),
              readPath(result, record.path),
            )
          ) {
            continue;
          }
          names.push(record.key);
          clearRecord(record);
        }
        bump();
        if (shouldNotify && names.length > 0) {
          reportChange(names, 'program', 'defaults');
        }
      });
    };

    // A `defaultValues` set after setup: names no one changed follow it.
    const followDefaults = () => {
      const next = props.defaultValues() ?? EMPTY;
      if (next !== source) replaceDefaults(next, 'untouched', false);
    };
    ctx.effect(followDefaults);
    ctx.watch(() => props.defaultValues(), followDefaults);

    // Registering (spec, Registering).
    const register = (field: FieldRegistration): (() => void) => {
      const registration: Registration = { field, order: ++order };
      const record = ensure(field.path);
      const options = field.options();
      ctx.batch(() => {
        const { key, path } = record;
        if (isDevelopment()) {
          const kinds = record.registrations.map(
            (each) => each.field.options().kind,
          );
          if (options.kind === 'checkbox' && kinds.includes('checkbox')) {
            warn(
              `form: two checkboxes are bound to "${key}", so they share one ` +
                'value. Put them in a CheckboxGroup to make a list of them.',
            );
          }
        }
        record.registrations.push(registration);
        if (options.hasDefault) {
          if (!fieldDefaults.has(key)) {
            if (!hasPath(source, path)) {
              fieldDefaults.set(key, options.defaultValue);
              defaults.set(
                writePath(defaults.get(), path, options.defaultValue),
              );
              if (!changed.has(key)) {
                values.set(writePath(values.get(), path, options.defaultValue));
              }
            }
          } else if (
            isDevelopment() &&
            !isEqualFor(record)(fieldDefaults.get(key), options.defaultValue)
          ) {
            warn(
              `form: fields bound to "${key}" have different defaults; the ` +
                "first one's is the form's. Give the form the default instead.",
            );
          }
        }
        bump();
      });
      let isReleased = false;
      return () => {
        if (isReleased) return;
        isReleased = true;
        ctx.batch(() => {
          const index = record.registrations.indexOf(registration);
          if (index !== -1) record.registrations.splice(index, 1);
          if (record.registrations.length === 0) {
            abortCheck(record);
            // `shouldPreserve: false` drops the value a microtask later,
            // unless the name registers again first, as in UI Kit.
            if (!field.options().shouldPreserve) {
              queueMicrotask(() => {
                if (record.registrations.length > 0) return;
                if (records.get(record.key) !== record) return;
                ctx.batch(() => {
                  records.delete(record.key);
                  changed.delete(record.key);
                  values.set(
                    writePath(values.get(), record.path, undefined, true),
                  );
                  bump();
                });
              });
            }
          }
          bump();
        });
      };
    };

    // A press on a submit button (spec, Live announcements): the blur it
    // causes checks nothing until the press ends, since an error shown on
    // the blur would move the button from under the pointer and lose the
    // click. A press that ends in a submit checks every field; one that
    // doesn't runs the blur's check then. The submit announces what it
    // shows, the blur's error included.
    let isSubmitPressed = false;
    const heldBlurs = new Set<string>();
    let pressTimer: ReturnType<typeof setTimeout> | undefined;
    let stopPress: (() => void) | undefined;
    const endPress = () => {
      stopPress?.();
      stopPress = undefined;
      clearTimeout(pressTimer);
      isSubmitPressed = false;
      const keys = [...heldBlurs];
      heldBlurs.clear();
      if (keys.length === 0) return;
      ctx.batch(() => {
        for (const key of keys) {
          const record = records.get(key);
          if (record && ownerOf(record)) void check(record, 'blur');
        }
      });
    };

    const blurred = (key: string) => {
      const record = records.get(key);
      const registration = record && ownerOf(record);
      if (!record || !registration) return;
      ctx.batch(() => {
        if (!record.isTouched) {
          record.isTouched = true;
          bump();
        }
        if (triggerOf(registration) !== 'blur') return;
        if (isSubmitPressed) heldBlurs.add(key);
        else void check(record, 'blur');
      });
    };

    const onPointerDown = (pointerEvent: PointerEvent) => {
      const root = rootForm();
      const target = pointerEvent.target as Element | null;
      const button = target?.closest?.('button, input') as HTMLElement | null;
      if (!root || !button || !isSubmitterOf(button, root)) return;
      endPress();
      isSubmitPressed = true;
      // The click and the submit it causes come right after the pointer is
      // let go, wherever that is.
      const view = root.ownerDocument.defaultView;
      if (!view) return;
      const onRelease = () => {
        clearTimeout(pressTimer);
        pressTimer = setTimeout(endPress);
      };
      view.addEventListener('pointerup', onRelease, true);
      view.addEventListener('pointercancel', onRelease, true);
      stopPress = () => {
        view.removeEventListener('pointerup', onRelease, true);
        view.removeEventListener('pointercancel', onRelease, true);
      };
    };
    ctx.effect(() => endPress);

    // Validating several names (spec, On submit and `validate()`).
    const activeRecords = (keys?: readonly string[]) =>
      [...records.values()].filter(
        (record) =>
          isActive(record) && (keys === undefined || keys.includes(record.key)),
      );
    const validateNames = async (
      cause: CheckCause,
      keys?: readonly string[],
    ): Promise<ValidateResult> => {
      const list = activeRecords(keys);
      const outcomes = await Promise.all(
        list.map((record) => check(record, cause, true)),
      );
      const errors: Record<string, readonly unknown[]> = {};
      for (const outcome of outcomes) {
        if (outcome.errors.length > 0) errors[outcome.key] = outcome.errors;
      }
      return {
        isValid:
          list.length > 0 && outcomes.every((each) => each.errors.length === 0),
        isStale: outcomes.some((each) => each.isStale),
        errors,
      };
    };

    /**
     * The controls in the `<form>` no field binds that fail their native
     * constraints: they are checked on submit as without UniAria.
     */
    const invalidUnbound = (): HTMLElement[] => {
      const root = rootForm();
      if (!root) return [];
      const bound = new Set<Element>();
      const roots: Element[] = [];
      const keys = new Set<string>();
      for (const record of records.values()) {
        const registration = ownerOf(record);
        if (!registration) continue;
        keys.add(record.key);
        for (const each of record.registrations) {
          for (const control of each.field.submitControls()) bound.add(control);
          const element = each.field.element();
          if (element) roots.push(element);
        }
      }
      return controlsOf(root).filter((element) => {
        const control = element as HTMLInputElement;
        if (!control.willValidate || bound.has(control)) return false;
        if (control.name && keys.has(control.name)) return false;
        if (roots.some((each) => each.contains(control))) return false;
        return !control.validity.valid;
      }) as HTMLElement[];
    };

    /** Announces a field's first error with its label (spec, Live announcements). */
    const announceError = (registration: Registration) => {
      const ids = registration.field.announcement();
      const doc = documentOf();
      if (ids && doc) announce({ 'aria-labelledby': ids }, { document: doc });
    };

    /**
     * Focuses the first invalid field, as a failed submit does (spec,
     * Focus): scrolled into view with its label and error, focus shown. An
     * unbound control first in order gets the browser's own report.
     */
    const focusInvalid = (unbound: readonly HTMLElement[] = []) => {
      type Candidate =
        | { readonly element: Element; readonly control: HTMLElement }
        | { readonly element: Element; readonly registration: Registration };
      const candidates: Candidate[] = [];
      for (const record of records.values()) {
        const registration = ownerOf(record);
        if (!registration || record.errors.length === 0) continue;
        const element =
          registration.field.element() ?? registration.field.focusTarget();
        if (element) candidates.push({ element, registration });
      }
      for (const control of unbound) {
        candidates.push({ element: control, control });
      }
      candidates.sort((a, b) => compareComposed(a.element, b.element));
      let first: Registration | undefined;
      for (const candidate of candidates) {
        if ('control' in candidate) {
          (candidate.control as HTMLInputElement).reportValidity();
          return;
        }
        const { registration } = candidate;
        first ??= registration;
        const target = registration.field.focusTarget();
        if (!target || !isFocusable(target)) continue;
        // Focus that can't move reads nothing: the form says the error.
        if (registration.field.hasFocus()) return announceError(registration);
        modalityTrackerFor(target)?.set('keyboard');
        const element = registration.field.element() ?? target;
        (element as Partial<HTMLElement>).scrollIntoView?.({
          block: 'nearest',
        });
        target.focus({ preventScroll: true });
        return;
      }
      if (first) announceError(first);
    };

    const nextFrame = () =>
      new Promise<void>((resolve) => {
        const view = documentOf()?.defaultView;
        if (view) view.requestAnimationFrame(() => resolve());
        else setTimeout(resolve);
      });

    // Submitting (spec, Submitting).
    const isSubmitting = ctx.state(false);
    const submitError = ctx.state<unknown>(undefined);
    let submission: Submission | undefined;
    let passing: Passing | undefined;

    /**
     * Posts the `<form>` natively from a new task: a browser ignores
     * `requestSubmit()` while the first `submit` event dispatches.
     */
    const post = (
      element: HTMLFormElement,
      submitter: HTMLElement | null,
      include: SubmitValues,
    ) =>
      new Promise<SubmitStatus>((resolve) => {
        setTimeout(() => {
          if (
            !element.isConnected ||
            (submitter && !isSubmitterOf(submitter, element))
          ) {
            if (isDevelopment()) {
              warn(
                'form: the form or its submit button left the page before ' +
                  'the native post, so nothing was sent.',
              );
            }
            return resolve('stale');
          }
          const current: Passing = { include, hasArrived: false };
          passing = current;
          try {
            HTMLFormElement.prototype.requestSubmit.call(
              element,
              submitter ?? undefined,
            );
          } catch (error) {
            if (isDevelopment()) {
              warn(`form: the native post failed: ${String(error)}`);
            }
          } finally {
            passing = undefined;
          }
          resolve(current.hasArrived ? 'submitted' : 'stale');
        });
      });

    const runSubmit = async (
      options: SubmitOptions,
      signal: AbortSignal,
      finish: (result: SubmitResult) => void,
    ) => {
      const submitter = options.submitter ?? null;
      const include = options.include ?? props.submitValues();
      const before = values.get();
      // `formnovalidate` on the submitter skips the checks, as in HTML.
      const isUnchecked =
        (submitter as HTMLButtonElement | null)?.formNoValidate === true;
      if (!isUnchecked) {
        const result = await validateNames('submit');
        const unbound = invalidUnbound();
        if (signal.aborted) return finish({ status: 'stale' });
        // Values that changed meanwhile settle it, as in UI Kit.
        if (result.isStale || values.get() !== before) {
          return finish({ status: 'stale' });
        }
        const errors: Record<string, readonly unknown[]> = {
          ...result.errors,
        };
        for (const control of unbound) {
          const name =
            (control as HTMLInputElement).name || control.id || 'control';
          errors[name] = [(control as HTMLInputElement).validationMessage];
        }
        if (Object.keys(errors).length > 0) {
          ctx.emit('submitFailed', { status: 'invalid', errors });
          if (options.shouldFocus ?? true) {
            await nextFrame();
            ctx.batch(() => focusInvalid(unbound));
          }
          return finish({ status: 'invalid', errors });
        }
      }
      const payload = include === 'all' ? values.get() : activeValues();
      const handler = props.handleSubmit();
      const element = rootForm();
      if (handler) {
        let formData: FormData | undefined;
        if (element) {
          try {
            formData = new FormData(element, submitter ?? undefined);
          } catch {
            formData = new FormData(element);
          }
        }
        try {
          await handler(payload, { signal, submitter, include, formData });
        } catch (error) {
          if (signal.aborted) return finish({ status: 'stale' });
          submitError.set(error);
          ctx.emit('submitFailed', { status: 'failed', error });
          if (isDevelopment() && !partElement(ctx, 'error')) {
            warn(
              'form: handleSubmit failed, but no error part is rendered to ' +
                'show submitError, so the user is told nothing.',
            );
          }
          return finish({ status: 'failed', error });
        }
        if (signal.aborted) return finish({ status: 'stale' });
        ctx.emit('submitted', { values: payload });
        return finish({ status: 'submitted' });
      }
      if (!element) {
        ctx.emit('submitted', { values: payload });
        return finish({ status: 'submitted' });
      }
      const status = await post(element, submitter, include);
      if (signal.aborted) return finish({ status: 'stale' });
      if (status === 'submitted') ctx.emit('submitted', { values: payload });
      finish({ status });
    };

    const submit = (options: SubmitOptions = {}): Promise<SubmitResult> => {
      if (submission) return Promise.resolve({ status: 'ignored' });
      const controller = new AbortController();
      return new Promise<SubmitResult>((resolve) => {
        const current: Submission = {
          controller,
          finish: (result) => {
            if (submission !== current) return;
            submission = undefined;
            isSubmitting.set(false);
            resolve(result);
          },
        };
        submission = current;
        ctx.batch(() => {
          submitError.set(undefined);
          isSubmitting.set(true);
        });
        void runSubmit(options, controller.signal, current.finish);
      });
    };

    const cancelSubmit = () => {
      const current = submission;
      if (!current) return;
      current.controller.abort();
      current.finish({ status: 'stale' });
    };

    let hasWarnedAction = false;
    const onSubmit = (submitEvent: SubmitEvent) => {
      const root = rootForm();
      if (!root || submitEvent.target !== root) return;
      // The form's own native post goes through.
      if (passing) {
        passing.hasArrived = true;
        return;
      }
      submitEvent.preventDefault();
      if (isDevelopment()) {
        if (!root.noValidate) {
          warn(
            'form: the <form> has no novalidate, so the browser blocks a ' +
              'submit with invalid native controls before the form checks ' +
              'its fields. Write novalidate in the markup.',
          );
        }
        if (
          !hasWarnedAction &&
          props.handleSubmit() &&
          root.getAttribute('action')?.startsWith('javascript:')
        ) {
          hasWarnedAction = true;
          warn(
            'form: the <form> has both handleSubmit and a function in its ' +
              'action; handleSubmit runs and the action never does.',
          );
        }
      }
      // The submit checks every field, the held blurs' included.
      heldBlurs.clear();
      void submit({
        submitter: (submitEvent.submitter as HTMLElement) ?? null,
      });
    };

    // During a native post, the values with no native control in the form
    // go into its data (spec, Submitting).
    partEffect(ctx, 'root', (element) => {
      const onFormData = (formDataEvent: FormDataEvent) => {
        const current = passing;
        if (!current || formDataEvent.target !== element) return;
        const payload =
          current.include === 'all' ? values.get() : activeValues();
        for (const record of records.values()) {
          if (current.include === 'active' && !isActive(record)) continue;
          if (!hasPath(payload, record.path)) continue;
          const isPosted = record.registrations.some((registration) =>
            registration.field
              .submitControls()
              .some(
                (control) => (control as HTMLInputElement).form === element,
              ),
          );
          if (isPosted) continue;
          appendValue(
            formDataEvent.formData,
            record.key,
            readPath(payload, record.path),
          );
        }
      };
      element.addEventListener('formdata', onFormData);
      return () => element.removeEventListener('formdata', onFormData);
    });

    // Resetting (spec, Resetting).
    const resetValues = (resetSource: ValuesChange['source']) => {
      ctx.batch(() => {
        cancelSubmit();
        const names = new Set<string>(changed);
        for (const record of [...records.values()]) {
          names.add(record.key);
          clearRecord(record);
          // A name with no field left goes with its value.
          if (!isActive(record)) records.delete(record.key);
        }
        changed.clear();
        values.set(defaults.get());
        submitError.set(undefined);
        epoch.set(epoch.get() + 1);
        bump();
        reportChange(names, resetSource, 'reset');
      });
    };

    let resetting: { event: Event | undefined } | undefined;
    const onReset = (resetEvent: Event) => {
      const root = rootForm();
      if (!root || resetEvent.target !== root) return;
      if (resetting) {
        resetting.event = resetEvent;
        return;
      }
      // A listener after this one may still cancel it: the reset waits for
      // the dispatch to end.
      setTimeout(() => {
        if (!resetEvent.defaultPrevented) resetValues('user');
      });
    };

    const reset = (options: FormResetOptions = {}) => {
      ctx.batch(() => {
        if (options.values) replaceDefaults(options.values, 'all', false);
        const root = rootForm();
        if (root) {
          const current: { event: Event | undefined } = { event: undefined };
          resetting = current;
          try {
            HTMLFormElement.prototype.reset.call(root);
          } finally {
            resetting = undefined;
          }
          if (current.event?.defaultPrevented) return;
        }
        resetValues('program');
      });
    };

    // The submit error, announced when it shows (spec, Live announcements).
    const isErrorShown = () => submitError.get() !== undefined;
    let spoken = '';
    const textOf = (element: Element) =>
      (element.textContent ?? '').replace(/\s+/g, ' ').trim();
    const speak = (element: HTMLElement) => {
      spoken = textOf(element);
      if (spoken) announce(spoken, { document: element.ownerDocument });
    };
    ctx.watch(isErrorShown, (isShown) => {
      const error = partElement(ctx, 'error');
      if (isShown && error) ctx.afterFlush(() => speak(error));
    });
    partEffect(
      ctx,
      'error',
      (error) => {
        spoken = textOf(error);
        const view = error.ownerDocument.defaultView;
        if (!view) return;
        const observer = new view.MutationObserver(() => {
          if (textOf(error) !== spoken) speak(error);
        });
        observer.observe(error, {
          childList: true,
          characterData: true,
          subtree: true,
        });
        return () => observer.disconnect();
      },
      isErrorShown,
    );

    // The form stopping lets a running submit go.
    ctx.effect(() => () => cancelSubmit());

    if (isDevelopment()) {
      ctx.effect(() => {
        const root = rootForm();
        if (root && root.localName !== 'form') {
          warn(
            `form: the root part is a <${root.localName}>; it must be the ` +
              '<form> element.',
          );
        }
      });
    }

    // The public state, derived again only when something it reads changed.
    const summary = ctx.memo(
      () =>
        [
          fields(),
          values.get(),
          defaults.get(),
          activeValues(),
          recordsVersion.get(),
          isSubmitting.get(),
          submitError.get(),
          props.isDisabled(),
          props.isReadOnly(),
        ] as const,
      (
        fieldStates,
        current,
        defaultValues,
        active,
        _version,
        isSubmittingNow,
        error,
        isDisabled,
        isReadOnly,
      ) => {
        const states = Object.values(fieldStates);
        const activeRecords = [...records.values()].filter(isActive);
        // Changed names without a record count for dirtiness too (UI Kit).
        const isDirty =
          states.some((state) => state.isDirty) ||
          [...changed].some((key) => {
            if (fieldStates[key]) return false;
            const path = pathOf(key);
            return !isShallowEqual(
              readPath(current, path),
              readPath(defaultValues, path),
            );
          });
        const isTouched = states.some((state) => state.isTouched);
        const checked = activeRecords.filter((record) =>
          isCheckable(ownerOf(record)!),
        );
        return {
          values: current,
          activeValues: active,
          defaultValues,
          fields: fieldStates,
          isDirty,
          isTouched,
          isValid:
            activeRecords.length > 0 &&
            checked.every(
              (record) => fieldStates[record.key]?.status === 'valid',
            ),
          isInvalid: activeRecords.some(
            (record) => fieldStates[record.key]?.status === 'invalid',
          ),
          isValidating: states.some((state) => state.status === 'validating'),
          isSubmitting: isSubmittingNow,
          submitError: error,
          canReset:
            !isSubmittingNow &&
            (isDirty ||
              isTouched ||
              error !== undefined ||
              states.some(
                (state) =>
                  state.status !== 'unvalidated' || state.errors.length > 0,
              )),
          isDisabled,
          isReadOnly,
        };
      },
    );

    const linkApi: FormLinkApi = {
      read: (path) => readPath(values.get(), path),
      write: (path, value) =>
        write(path, value, {
          cause: 'change',
          validation: 'auto',
          shouldTouch: true,
          report: 'user',
        }),
      register,
      blurred,
      view,
      isSubmitPressed: () => isSubmitPressed,
    };

    return {
      ...linkApi,
      summary,
      isErrorShown,
      handlers: {
        submit: onSubmit,
        reset: onReset,
        pointerdown: onPointerDown,
      },
      submit,
      cancelSubmit,
      reset,
      validate: (names?: readonly Name[]) =>
        validateNames(
          'validate',
          names?.map((name) => keyOf(name)),
        ),
      focusInvalid: () => focusInvalid(),
      setValue: (name: Name, value: unknown, options: SetValueOptions = {}) => {
        const isUser = options.source === 'user';
        write(toPath(name), value, {
          cause: isUser ? 'change' : 'program',
          validation: options.validation ?? 'auto',
          shouldTouch: options.shouldTouch ?? false,
          report:
            (options.shouldNotify ?? isUser)
              ? (options.source ?? 'program')
              : undefined,
        });
      },
      setValues: (next: Values, options: SetValueOptions = {}) => {
        ctx.batch(() => {
          for (const [key, value] of Object.entries(next)) {
            const isUser = options.source === 'user';
            write([key], value, {
              cause: isUser ? 'change' : 'program',
              validation: options.validation ?? 'auto',
              shouldTouch: options.shouldTouch ?? false,
              report:
                (options.shouldNotify ?? isUser)
                  ? (options.source ?? 'program')
                  : undefined,
            });
          }
        });
      },
      setDefaultValues: (next: Values, options: SetDefaultValuesOptions = {}) =>
        replaceDefaults(
          next,
          options.replaceValues ?? 'untouched',
          options.shouldNotify ?? false,
        ),
      touch: (name: Name, isTouched = true) => {
        const record = ensure(toPath(name));
        if (record.isTouched === isTouched) return;
        record.isTouched = isTouched;
        bump();
      },
      setFieldErrors: (name: Name, errors: readonly unknown[]) => {
        const record = ensure(toPath(name));
        ctx.batch(() => {
          abortCheck(record);
          record.errors = errors.length > 0 ? [...errors] : NO_ERRORS;
          record.status = errors.length > 0 ? 'invalid' : 'valid';
          record.cause = 'server';
          bump();
        });
      },
      clearFieldErrors: (name?: Name) => {
        ctx.batch(() => {
          const list =
            name === undefined
              ? [...records.values()]
              : [records.get(keyOf(name))].filter(
                  (record): record is FieldRecord => record !== undefined,
                );
          for (const record of list) {
            abortCheck(record);
            record.errors = NO_ERRORS;
            record.status = 'valid';
            record.cause = 'server';
          }
          bump();
        });
      },
      setSubmitError: (error: unknown) => submitError.set(error),
      clearSubmitError: () => submitError.set(undefined),
      batch: <T>(fn: () => T): T => ctx.batch(fn),
    };
  },
  expose({ api }) {
    return api.summary();
  },
  connect({ ids, api }) {
    const state = api.summary();
    const root: DomPartProps = {
      attrs: {
        id: ids.root,
        novalidate: '',
        'data-submitting': flag(state.isSubmitting),
        'data-invalid': flag(state.isInvalid),
        'data-dirty': flag(state.isDirty),
        'data-validating': flag(state.isValidating),
        'data-disabled': flag(state.isDisabled),
        'data-readonly': flag(state.isReadOnly),
      },
      on: api.handlers,
    };
    const error: DomPartProps = {
      attrs: {
        id: ids.error,
        hidden: flag(!api.isErrorShown()),
      },
    };
    return { root, error };
  },
});
