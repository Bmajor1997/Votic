const sharedGlobals = {
  console: "readonly",
  process: "readonly",
  Buffer: "readonly",
  URL: "readonly",
  Blob: "readonly",
  FormData: "readonly",
  Headers: "readonly",
  AbortController: "readonly",
  fetch: "readonly",
  document: "readonly",
  window: "readonly",
  localStorage: "readonly",
  requestAnimationFrame: "readonly",
  speechSynthesis: "readonly",
  SpeechSynthesisUtterance: "readonly",
  FileReader: "readonly",
  Node: "readonly",
  setTimeout: "readonly",
  clearTimeout: "readonly",
};

export default [
  // apps/mobile has its own TypeScript/React lint config (apps/mobile/eslint.config.js).
  { ignores: ["node_modules/**", "playwright-report/**", "test-results/**", "apps/mobile/**"] },
  {
    files: ["**/*.js"],
    languageOptions: { ecmaVersion: "latest", sourceType: "module", globals: sharedGlobals },
    rules: {
      "no-undef": "error",
      "no-unreachable": "error",
      "no-dupe-keys": "error",
      "no-constant-binary-expression": "error"
    }
  }
];
