export class RemixCliError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RemixCliError";
  }
}

export function fail(message: string): never {
  throw new RemixCliError(message);
}
