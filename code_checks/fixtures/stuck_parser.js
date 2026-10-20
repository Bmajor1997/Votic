// A parser that never finishes, for the timeout and cancellation checks.
process.once("message", () => { while (true) {} });
