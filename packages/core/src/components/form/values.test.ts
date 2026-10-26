import { describe, expect, it } from 'vitest';

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

describe('names', () => {
  it('turns a key or a path into keys', () => {
    expect(toPath('email')).toEqual(['email']);
    expect(toPath('user.email')).toEqual(['user.email']);
    expect(toPath(['users', 0, 'email'])).toEqual(['users', '0', 'email']);
  });

  it('refuses an empty path, a bad index and an unsafe key', () => {
    expect(() => toPath([])).toThrow();
    expect(() => toPath(['users', -1])).toThrow();
    expect(() => toPath(['users', 1.5])).toThrow();
    expect(() => toPath('__proto__')).toThrow();
  });

  it('escapes dots and backslashes in a key, and undoes it', () => {
    expect(keyOf(['users', 0, 'email'])).toBe('users.0.email');
    expect(keyOf('user.email')).toBe('user\\.email');
    expect(keyOf(['a\\b', 'c'])).toBe('a\\\\b.c');
    for (const name of ['user.email', ['a\\b', 'c.d'], ['users', 0]]) {
      expect(pathOf(keyOf(name))).toEqual(toPath(name));
    }
  });
});

describe('values', () => {
  it('reads along a path', () => {
    const values = { users: [{ email: 'a@b.c' }] };
    expect(readPath(values, ['users', '0', 'email'])).toBe('a@b.c');
    expect(readPath(values, ['users', '1', 'email'])).toBeUndefined();
    expect(hasPath(values, ['users', '0', 'email'])).toBe(true);
    expect(hasPath({ name: undefined }, ['name'])).toBe(true);
    expect(hasPath({}, ['name'])).toBe(false);
  });

  it('copies only the containers on the path it writes', () => {
    const other = { kept: true };
    const values = { user: { email: 'a@b.c' }, other };
    const next = writePath(values, ['user', 'email'], 'x@y.z');
    expect(next).toEqual({ user: { email: 'x@y.z' }, other });
    expect(next.other).toBe(other);
    expect(values.user.email).toBe('a@b.c');
    expect(writePath(values, ['user', 'email'], 'a@b.c')).toBe(values);
  });

  it('makes an array for an index, and removes a key', () => {
    expect(writePath({}, ['users', '0', 'email'], 'a')).toEqual({
      users: [{ email: 'a' }],
    });
    expect(writePath({ a: 1, b: 2 }, ['a'], undefined, true)).toEqual({ b: 2 });
    const values = { a: 1 };
    expect(writePath(values, ['b'], undefined, true)).toBe(values);
  });

  it('counts null, undefined, empty text, false and [] as empty', () => {
    for (const value of [null, undefined, '', false, []]) {
      expect(isEmpty(value)).toBe(true);
    }
    for (const value of [0, ' ', true, ['a'], {}]) {
      expect(isEmpty(value)).toBe(false);
    }
  });

  it('compares one level into arrays and plain objects', () => {
    expect(isShallowEqual(['a'], ['a'])).toBe(true);
    expect(isShallowEqual({ a: 1 }, { a: 1 })).toBe(true);
    expect(isShallowEqual([{}], [{}])).toBe(false);
    expect(isShallowEqual(['a'], { 0: 'a' })).toBe(false);
  });

  it('relates a path to the paths it holds', () => {
    expect(isRelated(['user'], ['user', 'email'])).toBe(true);
    expect(isRelated(['user', 'email'], ['user'])).toBe(true);
    expect(isRelated(['user', 'email'], ['user', 'name'])).toBe(false);
  });
});
