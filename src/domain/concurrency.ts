export class StalePlaceError extends Error {
  constructor() {
    super('This place changed since you opened it. Reload it before saving again.');
    this.name = 'StalePlaceError';
  }
}

export function assertCurrentVersion(expected: string | undefined, current: string | undefined): void {
  if (expected !== current) throw new StalePlaceError();
}
