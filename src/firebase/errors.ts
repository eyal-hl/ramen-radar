export function isPermissionDenied(error: unknown): boolean {
  if (typeof error !== 'object' || error === null || !('code' in error)) return false;
  const code = String(error.code);
  return code === 'permission-denied' || code === 'firestore/permission-denied';
}
