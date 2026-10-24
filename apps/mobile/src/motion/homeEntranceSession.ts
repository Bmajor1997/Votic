/** An in-memory sign-in latch. Restored sessions and token refreshes never re-arm it. */
export function create_home_entrance_session() {
  let owner: string | null = null;
  let generation = 0;
  let pending = false;
  return {
    observe(uid: string | null, restored: boolean) {
      if (uid === owner) return;
      owner = uid;
      generation += 1;
      pending = Boolean(uid && !restored);
    },
    key: () => generation,
    pending: (uid: string | null, ticket: number) =>
      Boolean(uid && uid === owner && ticket === generation && pending),
    claim(uid: string | null, ticket: number) {
      if (!uid || uid !== owner || ticket !== generation || !pending) return false;
      pending = false;
      return true;
    },
  };
}
export type HomeEntranceSession = ReturnType<typeof create_home_entrance_session>;
