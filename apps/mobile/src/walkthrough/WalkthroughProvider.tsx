import { useFocusEffect } from "expo-router";
import {
  PropsWithChildren,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  FLOWS,
  FlowContext,
  FlowId,
  SECTIONS,
  SectionId,
  TargetId,
  WalkthroughStep,
  applicableSteps,
} from "./walkthroughFlows";
import { Rect } from "./placement";
import {
  EMPTY_WALKTHROUGH,
  FlowStatus,
  WalkthroughState,
  loadWalkthroughState,
  saveWalkthroughState,
} from "./walkthroughState";

type Measure = () => Promise<Rect | null>;
export type MeasureNode = (node: unknown) => Promise<Rect | null>;
export type ActiveFlow = { id: FlowId; context: FlowContext; steps: WalkthroughStep[]; index: number };

type WalkthroughContextValue = {
  hydrated: boolean;
  state: WalkthroughState;
  active: ActiveFlow | null;
  /** Shows a section or tip if it hasn't been finished, skipped, or learned already and nothing else is showing. */
  request: (id: FlowId, context?: FlowContext) => boolean;
  next: () => void;
  skip: () => void;
  /** Hides the current flow without recording anything, e.g. when its screen is left. It shows again next time. */
  dismiss: (id: FlowId) => void;
  /** Screens call this when a highlighted control is used for real. */
  pressed: (target: TargetId) => void;
  isDone: (id: FlowId) => boolean;
  /** Replay: forgets one section, or every walkthrough and tip. */
  reset: (id: SectionId | "all") => void;
  registerTarget: (id: TargetId, measure: Measure | null) => void;
  measureTarget: (id: TargetId) => Promise<Rect | null>;
  measureNode: MeasureNode;
};

const WalkthroughContext = createContext<WalkthroughContextValue | null>(null);

const measureInWindow: MeasureNode = (node) =>
  new Promise((resolve) => {
    const view = node as {
      measureInWindow?: (callback: (x: number, y: number, width: number, height: number) => void) => void;
    } | null;
    if (!view?.measureInWindow) return resolve(null);
    view.measureInWindow((x, y, width, height) =>
      resolve(width > 0 && height > 0 ? { x, y, width, height } : null),
    );
  });

/**
 * Progressive, contextual coaching. Separate from account onboarding: it only runs inside Votic, and it
 * remembers each section and tip on its own, so one walkthrough never marks another as seen.
 */
export function WalkthroughProvider({
  children,
  measureNode = measureInWindow,
  now = Date.now,
}: PropsWithChildren<{ measureNode?: MeasureNode; now?: () => number }>) {
  const [state, setState] = useState<WalkthroughState>(EMPTY_WALKTHROUGH);
  const [hydrated, setHydrated] = useState(false);
  const [active, setActive] = useState<ActiveFlow | null>(null);
  const targets = useRef(new Map<TargetId, Measure>());
  const activeRef = useRef<ActiveFlow | null>(null);
  const stateRef = useRef(state);
  useEffect(() => {
    activeRef.current = active;
    stateRef.current = state;
  });

  useEffect(() => {
    let current = true;
    void loadWalkthroughState(now())
      .catch(() => EMPTY_WALKTHROUGH)
      .then((loaded) => {
        if (!current) return;
        stateRef.current = loaded;
        setState(loaded);
        setHydrated(true);
      });
    return () => {
      current = false;
    };
  }, [now]);

  const record = useCallback(
    (id: FlowId, status: FlowStatus) => {
      setState((previous) => {
        const next: WalkthroughState = {
          ...previous,
          flows: { ...previous.flows, [id]: { status, at: now() } },
        };
        stateRef.current = next;
        void saveWalkthroughState(next).catch(() => {});
        return next;
      });
    },
    [now],
  );

  /** The first step at or after `from` whose control is on screen (or that needs no control). */
  const firstShowable = useCallback((steps: WalkthroughStep[], from: number) => {
    for (let index = from; index < steps.length; index += 1) {
      const target = steps[index].target;
      if (!target || targets.current.has(target)) return index;
    }
    return -1;
  }, []);

  const finish = useCallback(
    (status: FlowStatus) => {
      const current = activeRef.current;
      if (!current) return;
      activeRef.current = null;
      setActive(null);
      record(current.id, status);
    },
    [record],
  );

  const advance = useCallback(() => {
    const current = activeRef.current;
    if (!current) return;
    const index = firstShowable(current.steps, current.index + 1);
    if (index < 0) return finish("completed");
    const next = { ...current, index };
    activeRef.current = next;
    setActive(next);
  }, [finish, firstShowable]);

  // Stable actions (they only read refs), so screens can depend on them without re-running effects.
  const hydratedRef = useRef(hydrated);
  useEffect(() => {
    hydratedRef.current = hydrated;
  });
  const request = useCallback(
    (id: FlowId, context: FlowContext = {}) => {
      if (!hydratedRef.current || activeRef.current || stateRef.current.flows[id]) return false;
      const steps = applicableSteps(FLOWS[id], context);
      const index = firstShowable(steps, 0);
      if (index < 0) return false;
      const flow = { id, context, steps, index };
      activeRef.current = flow;
      setActive(flow);
      return true;
    },
    [firstShowable],
  );
  const skip = useCallback(() => finish("skipped"), [finish]);
  const dismiss = useCallback((id: FlowId) => {
    if (activeRef.current?.id !== id) return;
    activeRef.current = null;
    setActive(null);
  }, []);
  const pressed = useCallback(
    (target: TargetId) => {
      const current = activeRef.current;
      const step = current?.steps[current.index];
      if (!current || !step?.interactive || step.target !== target) return;
      if (step.completesOnPress) return finish("completed");
      // Let the press update the screen (e.g. expand the dock) before looking for the next control.
      setTimeout(advance, 120);
    },
    [advance, finish],
  );
  const reset = useCallback((id: SectionId | "all") => {
    if (activeRef.current && (id === "all" || activeRef.current.id === id)) {
      activeRef.current = null;
      setActive(null);
    }
    setState((previous) => {
      const flows = { ...previous.flows };
      if (id === "all") for (const key of Object.keys(flows)) delete flows[key as FlowId];
      else delete flows[id];
      const next = { ...previous, flows };
      stateRef.current = next;
      void saveWalkthroughState(next).catch(() => {});
      return next;
    });
  }, []);
  const registerTarget = useCallback((id: TargetId, measure: Measure | null) => {
    if (measure) targets.current.set(id, measure);
    else targets.current.delete(id);
  }, []);
  const measureTarget = useCallback(
    (id: TargetId) => targets.current.get(id)?.() ?? Promise.resolve(null),
    [],
  );

  const value = useMemo<WalkthroughContextValue>(
    () => ({
      hydrated,
      state,
      active,
      request,
      next: advance,
      skip,
      dismiss,
      pressed,
      isDone: (id) => Boolean(state.flows[id]),
      reset,
      registerTarget,
      measureTarget,
      measureNode,
    }),
    [
      hydrated,
      state,
      active,
      request,
      advance,
      skip,
      dismiss,
      pressed,
      reset,
      registerTarget,
      measureTarget,
      measureNode,
    ],
  );
  return <WalkthroughContext.Provider value={value}>{children}</WalkthroughContext.Provider>;
}

export function useWalkthrough() {
  const value = useContext(WalkthroughContext);
  if (!value) throw new Error("useWalkthrough must be used inside WalkthroughProvider");
  return value;
}

/** Attaches a walkthrough target id to a real control: `ref={useWalkthroughTarget("documents.upload")}`. */
export function useWalkthroughTarget(id: TargetId) {
  const { registerTarget, measureNode } = useWalkthrough();
  return useCallback(
    (node: unknown) => registerTarget(id, node ? () => measureNode(node) : null),
    [id, registerTarget, measureNode],
  );
}

/** Waits for layout and screen transitions to settle before pointing at anything. */
export const TRIGGER_DELAY_MS = 450;

/**
 * Shows the first eligible flow when this screen is focused, and hides an unfinished one (without
 * recording it) when the screen is left, so it shows again on the next visit.
 */
export function useWalkthroughTrigger(
  candidates: { id: FlowId; when?: boolean }[],
  context: FlowContext = {},
) {
  const { request, dismiss, hydrated, state } = useWalkthrough();
  // Read when the screen is focused, not tracked: a walkthrough finishing, or the screen's content changing,
  // never starts another one during the same visit.
  const latest = useRef({ candidates, context, flows: state.flows });
  useEffect(() => {
    latest.current = { candidates, context, flows: state.flows };
  });
  useFocusEffect(
    useCallback(() => {
      if (!hydrated) return;
      let shown: FlowId | null = null;
      const timer = setTimeout(() => {
        const { candidates: options, context: facts, flows } = latest.current;
        const eligible = options.find((candidate) => candidate.when !== false && !flows[candidate.id]);
        if (eligible && request(eligible.id, facts)) shown = eligible.id;
      }, TRIGGER_DELAY_MS);
      return () => {
        clearTimeout(timer);
        if (shown) dismiss(shown);
      };
    }, [hydrated, request, dismiss]),
  );
}

export { SECTIONS };
