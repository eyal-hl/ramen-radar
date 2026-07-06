import { describe, expect, test } from 'vitest';
import { assertCurrentVersion } from './concurrency';

describe('optimistic concurrency', () => {
  test('allows creating a document that does not exist', () => {
    expect(() => assertCurrentVersion(undefined, undefined)).not.toThrow();
  });

  test('allows saving when the update token is unchanged', () => {
    expect(() => assertCurrentVersion('v1', 'v1')).not.toThrow();
  });

  test('rejects a stale editor', () => {
    expect(() => assertCurrentVersion('v1', 'v2')).toThrow('changed since you opened it');
  });
});
