/**
 * Ambient declarations for the headless verification build only.
 *
 * The React Native type package supplies `__DEV__` to the app build; this file
 * supplies it (and the couple of host globals the script uses) to the plain
 * Node build, without pulling in @types/node. `tsconfig.json` excludes this
 * directory so the two declarations never collide.
 */
declare const __DEV__: boolean;

declare const console: {
  log(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
};

declare const process: {
  exit(code: number): void;
  argv: string[];
};
