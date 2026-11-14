export * from "minimatch-modern";
export { minimatch as default } from "minimatch-modern";
export function make_re(
  pattern: string,
  options?: import("minimatch-modern").MinimatchOptions,
): { test(path: string): boolean };
