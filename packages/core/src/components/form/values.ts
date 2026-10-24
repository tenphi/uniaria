/**
 * Names and values in a form (Form spec, How it works): a name is one key
 * (`'email'`, a key that may hold a dot) or a path of keys and indexes
 * (`['users', 0, 'email']`), as in Cube UI Kit's modern form
 * (`references/cube-ui-kit/src/components/form/Form/modern/values.ts`).
 * Values are nested along paths and never changed in place: a write copies
 * the containers on its path, so every other branch keeps its identity.
 */

/** A field's name: one key, or a path of keys and indexes. */
export type Name = string | readonly (string | number)[];

/** A name as keys, one per level. */
export type Path = readonly string[];

/** A form's values: nested along paths. */
export type Values = Readonly<Record<string, unknown>>;

type Container = Record<string, unknown> | unknown[];

const UNSAFE = new Set(['__proto__', 'prototype', 'constructor']);

/** A name as its path. Throws for an empty path or an unsafe key. */
export function toPath(name: Name): Path {
  const parts = typeof name === 'string' ? [name] : name;
  if (parts.length === 0) {
    throw new Error('[uniaria] form: a name needs at least one key.');
  }
  return parts.map((part) => {
    if (typeof part === 'number' && (!Number.isSafeInteger(part) || part < 0)) {
      throw new Error(
        `[uniaria] form: "${part}" isn't an index; indexes are whole numbers from 0.`,
      );
    }
    const key = String(part);
    if (UNSAFE.has(key)) {
      throw new Error(`[uniaria] form: "${key}" can't be a key.`);
    }
    return key;
  });
}

/**
 * The key a name is known by: its keys joined with `.`, with `.` and `\` in
 * a key escaped by `\`, so `'user.email'` and `['user', 'email']` differ.
 * It is also the `name` a field writes on its native control.
 */
export function keyOf(name: Name): string {
  return toPath(name)
    .map((part) => part.replace(/\\/g, '\\\\').replace(/\./g, '\\.'))
    .join('.');
}

/** The path a key stands for: `keyOf()` undone. */
export function pathOf(key: string): Path {
  const path = [''];
  for (let index = 0; index < key.length; index++) {
    const char = key[index]!;
    if (char === '.') path.push('');
    else {
      path[path.length - 1] += char === '\\' ? (key[++index] ?? '') : char;
    }
  }
  return path;
}

/** Whether `value` is a plain object, as `{}` or `Object.create(null)` is. */
export function isPlainObject(
  value: unknown,
): value is Record<string, unknown> {
  if (!value || typeof value !== 'object') return false;
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isContainer(value: unknown): value is Container {
  return Array.isArray(value) || isPlainObject(value);
}

/** The value at `path`, or `undefined` when there is none. */
export function readPath(root: unknown, path: Path): unknown {
  let value = root;
  for (const key of path) {
    if (!isContainer(value) || !Object.hasOwn(value, key)) return undefined;
    value = (value as Record<string, unknown>)[key];
  }
  return value;
}

/** Whether `root` has a value at `path`, `undefined` included. */
export function hasPath(root: unknown, path: Path): boolean {
  const parent = readPath(root, path.slice(0, -1));
  return isContainer(parent) && Object.hasOwn(parent, path.at(-1)!);
}

/**
 * `root` with `value` at `path`, or without it with `isRemove`: the
 * containers on the path are copied, an index makes an array where none is.
 * Returns `root` itself when nothing changes.
 */
export function writePath<T extends Values>(
  root: T,
  path: Path,
  value: unknown,
  isRemove = false,
): T {
  const write = (current: unknown, depth: number): unknown => {
    const key = path[depth]!;
    const container = isContainer(current) ? current : undefined;
    const exists = container !== undefined && Object.hasOwn(container, key);
    const previous = exists
      ? (container as Record<string, unknown>)[key]
      : undefined;
    const isLast = depth === path.length - 1;
    if (isRemove && !exists) return current;
    const next = isLast ? value : write(previous, depth + 1);
    if (exists && Object.is(previous, next) && !(isRemove && isLast)) {
      return current;
    }
    let copy: Container;
    if (Array.isArray(container)) copy = [...container];
    else if (container) copy = { ...container };
    else copy = depth > 0 && /^(0|[1-9]\d*)$/.test(key) ? [] : {};
    if (isRemove && isLast) {
      delete (copy as Record<string, unknown>)[key];
    } else {
      (copy as Record<string, unknown>)[key] = next;
    }
    return copy;
  };
  return write(root, 0) as T;
}

/**
 * Whether a field holding `value` is empty for `isRequired` (Form spec,
 * Validation): `null`, `undefined`, `''`, `false` and `[]`.
 */
export function isEmpty(value: unknown): boolean {
  return (
    value === null ||
    value === undefined ||
    value === '' ||
    value === false ||
    (Array.isArray(value) && value.length === 0)
  );
}

/**
 * What counts as a change for `isDirty` by default: `Object.is`, then one
 * level into arrays and plain objects, as in UI Kit.
 */
export function isShallowEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (!isContainer(a) || !isContainer(b)) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) return false;
  return keys.every(
    (key) =>
      Object.hasOwn(b, key) &&
      Object.is(
        (a as Record<string, unknown>)[key],
        (b as Record<string, unknown>)[key],
      ),
  );
}

/**
 * Whether two paths are the same field or one holds the other: a write to
 * either changes the other's value.
 */
export function isRelated(a: Path, b: Path): boolean {
  const length = Math.min(a.length, b.length);
  for (let index = 0; index < length; index++) {
    if (a[index] !== b[index]) return false;
  }
  return true;
}
