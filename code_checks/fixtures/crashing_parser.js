// A parser that crashes before replying, like a native module failure.
process.once("message", () => process.exit(3));
