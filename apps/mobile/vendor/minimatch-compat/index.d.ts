export * from "minimatch-modern";
export { minimatch as default } from "minimatch-modern";
export function makeRe(
  pattern: string,
  options?: import("minimatch-modern").MinimatchOptions,
): { test(path: string): boolean };
