/** Bounds UI waiting without granting access or retrying a purchase. SDK work may still finish later. */
export async function store_deadline<T>(work: Promise<T>, timeoutMs = 12_000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new Error(
                "Membership check timed out. Retry, or restart Votic if the store remains unavailable.",
              ),
            ),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
