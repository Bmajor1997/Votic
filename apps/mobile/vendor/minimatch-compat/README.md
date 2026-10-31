# Minimatch compatibility adapter

All matching is delegated to the registry release `minimatch@11.0.3`, installed as
`minimatch-modern`. This directory contains no copied legacy pattern parser or matcher.

The mobile dependency override sends both older and newer consumers through the adapter:

- Older ESLint plugins call `require("minimatch")` as a function. Newer consumers use named exports.
- Jest 29 still uses glob 7, which reads `_glob` on compiled path segments and invokes `String.match`.
  The adapter adds those interfaces to upstream's nonrecursive Matcher objects; matching still uses
  their upstream `test()` method. No backtracking regular expression is generated.
- `defaults()` returns another callable adapter, with the upstream defaults preserved.
- eslint-plugin-import's `makeRe()` consumer uses only `test()`. The adapter supplies that interface
  through upstream `Minimatch.match()`. It deliberately does not implement an arbitrary RegExp compiler
  or the removed AST API. This is a compatibility layer for the installed consumers, not a general
  replacement for all historical minimatch internals.

The local wrapper itself is unscannable by OSV, as expected for a private file dependency. The actual
upstream matcher remains a separately installed/scanned registry package. A clean scan alone does not
validate this adapter: `src/config/patternDependencies.test.ts` exercises CommonJS, native Node ESM,
defaults, class APIs, the older Jest glob walker, the current walker, and cancellation. Full Expo/Jest
and build checks remain necessary after changes.

Remove the adapter and its file dependency/override together when all installed consumers support the
current upstream module and compiled-segment APIs. Until then, review it when upgrading minimatch.
