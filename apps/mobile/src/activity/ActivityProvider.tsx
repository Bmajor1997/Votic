import AsyncStorage from "@react-native-async-storage/async-storage";
import { PropsWithChildren, createContext, useContext, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import {
  ActivityKind,
  ActivityLog,
  AskEvent,
  addAskEvent,
  addInterval,
  emptyLog,
  parseLog,
} from "./activityModel";
import { sampleActivityLog } from "./sampleActivity";

export const ACTIVITY_KEY = "votic.mobile.activity.v1";
const SAVE_DELAY_MS = 2000;

type ActivityValue = {
  log: ActivityLog;
  hydrated: boolean;
  recordTime: (documentId: string, kind: ActivityKind, start: number, end: number) => void;
  recordAsk: (event: AskEvent) => void;
  /** Development builds only: shows generated statistics without touching real measurements. */
  sampleData: boolean;
  setSampleData: (documentIds: string[] | null) => void;
};
const ActivityContext = createContext<ActivityValue | null>(null);

export function ActivityProvider({ children }: PropsWithChildren) {
  const [log, setLog] = useState<ActivityLog>(() => emptyLog());
  const [hydrated, setHydrated] = useState(false);
  const [sample, setSample] = useState<ActivityLog | null>(null);
  const latest = useRef(log);
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Changes made before storage loads are applied on top of what was saved.
  const pending = useRef<((current: ActivityLog) => ActivityLog)[]>([]);
  const hydratedRef = useRef(false);

  function save() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (!dirty.current) return;
    dirty.current = false;
    void AsyncStorage.setItem(ACTIVITY_KEY, JSON.stringify(latest.current)).catch(() => {
      dirty.current = true;
    });
  }
  function change(update: (current: ActivityLog) => ActivityLog) {
    if (!hydratedRef.current) {
      pending.current.push(update);
      return;
    }
    latest.current = update(latest.current);
    setLog(latest.current);
    dirty.current = true;
    if (!timer.current) timer.current = setTimeout(save, SAVE_DELAY_MS);
  }

  useEffect(() => {
    let mounted = true;
    void AsyncStorage.getItem(ACTIVITY_KEY)
      .catch(() => null)
      .then((raw) => {
        if (!mounted) return;
        const saved = parseLog(raw);
        let loaded = saved ?? emptyLog();
        for (const update of pending.current) loaded = update(loaded);
        pending.current = [];
        latest.current = loaded;
        hydratedRef.current = true;
        // A new log (first launch of this version) is saved right away, so its start date sticks.
        dirty.current = !saved || loaded !== saved;
        setLog(loaded);
        setHydrated(true);
        save();
      });
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") save();
    });
    return () => {
      mounted = false;
      subscription.remove();
      save();
    };
  }, []);

  return (
    <ActivityContext.Provider
      value={{
        log: sample ?? log,
        hydrated,
        recordTime: (documentId, kind, start, end) =>
          change((current) => addInterval(current, documentId, kind, start, end)),
        recordAsk: (event) => change((current) => addAskEvent(current, event)),
        sampleData: Boolean(sample),
        setSampleData: (documentIds) =>
          setSample(__DEV__ && documentIds ? sampleActivityLog(documentIds) : null),
      }}
    >
      {children}
    </ActivityContext.Provider>
  );
}

export function useActivity() {
  const value = useContext(ActivityContext);
  if (!value) throw new Error("useActivity must be used inside ActivityProvider");
  return value;
}
