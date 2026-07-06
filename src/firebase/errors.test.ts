import { describe, expect, test } from 'vitest';
import { isPermissionDenied } from './errors';

describe('Firebase errors', () => {
  test('recognizes permission-denied errors without trusting arbitrary messages', () => {
    expect(isPermissionDenied({ code: 'permission-denied' })).toBe(true);
    expect(isPermissionDenied({ code: 'firestore/permission-denied' })).toBe(true);
    expect(isPermissionDenied(new Error('permission-denied'))).toBe(false);
  });
});
