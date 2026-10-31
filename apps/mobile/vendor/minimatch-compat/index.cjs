// Older ESLint/Jest consumers call require("minimatch") directly. Upstream v11 exports an object.
// All matching is delegated to the patched upstream release; no legacy matcher is copied here.
function callable(api) {
  const matcher = typeof api === "function" ? api : api.minimatch;
  const match = (path, pattern, options) => matcher(path, pattern, options);
  Object.assign(match, api);
  match.Minimatch = class CompatibleMinimatch extends api.Minimatch {
    constructor(pattern, options) {
      super(pattern, options);
      // glob 7 reads _glob and calls String.match on compiled path segments. Upstream v11 uses
      // nonrecursive Matcher objects instead of regexes. Add that interface without generating regexes
      // or replacing their patched matching implementation.
      for (const parts of this.set) {
        for (const segment of parts) {
          if (segment && typeof segment === "object" && typeof segment.test === "function") {
            segment._glob = segment.pattern;
            segment[Symbol.match] = (text) => (segment.test(text) ? [text] : null);
          }
        }
      }
    }
    static defaults(options) {
      return callable(api.defaults(options)).Minimatch;
    }
    makeRe() {
      // eslint-plugin-import only uses the returned object's test() method. Keep matching on the
      // patched nonrecursive engine rather than recreating the removed backtracking-regex compiler.
      return { test: (path) => this.match(path) };
    }
  };
  match.makeRe = (pattern, options) => new match.Minimatch(pattern, options).makeRe();
  match.defaults = (options) => callable(api.defaults(options));
  return match;
}

const modern = require("minimatch-modern");
const compatible = callable(modern);
module.exports = compatible;
// Explicit names also support native ESM consumers importing this CommonJS adapter.
module.exports.minimatch = modern.minimatch;
module.exports.Minimatch = compatible.Minimatch;
module.exports.GLOBSTAR = modern.GLOBSTAR;
module.exports.sep = modern.sep;
module.exports.defaults = compatible.defaults;
module.exports.filter = modern.filter;
module.exports.braceExpand = modern.braceExpand;
module.exports.makeRe = compatible.makeRe;
module.exports.match = modern.match;
module.exports.escape = modern.escape;
module.exports.unescape = modern.unescape;
