import AsyncStorage from "@react-native-async-storage/async-storage";
import { PropsWithChildren, createContext, useContext, useEffect, useState } from "react";
import type { ExplanationStyle } from "../api/voticApi";
import { normalizePlaybackRate } from "../playback/rates";
export type { ExplanationStyle } from "../api/voticApi";
export type VoticPurpose = "learning" | "work" | "research" | "personal" | "accessibility";
export const PURPOSES = [
  {
    value: "learning" as const,
    label: "School & learning",
    detail: "Study, review, and remember",
    icon: "school-outline" as const,
  },
  {
    value: "work" as const,
    label: "Work",
    detail: "Get through reports and find decisions",
    icon: "briefcase-outline" as const,
  },
  {
    value: "research" as const,
    label: "Research",
    detail: "Dig into papers and compare findings",
    icon: "search-outline" as const,
  },
  {
    value: "personal" as const,
    label: "Personal reading",
    detail: "Read and listen at your own pace",
    icon: "book-outline" as const,
  },
  {
    value: "accessibility" as const,
    label: "Accessibility",
    detail: "Make text easier to read and hear",
    icon: "accessibility-outline" as const,
  },
];
export const EXPLANATION_STYLES = [
  { value: "quick" as const, label: "Quick", detail: "A sentence or two" },
  { value: "simple" as const, label: "Simple", detail: "Plain words, no jargon" },
  { value: "detailed" as const, label: "Detailed", detail: "The full picture, with context" },
  { value: "adaptive" as const, label: "Adapt to the question", detail: "Short or long, as needed" },
];
const KEY = "votic.mobile.purpose.v1";
const EXPLANATION_KEY = "votic.mobile.explanation-style.v1";
const RATE_KEY = "votic.mobile.default-playback-rate.v1";
type Value = {
  purpose: VoticPurpose | null;
  setPurpose: (value: VoticPurpose) => void;
  explanationStyle: ExplanationStyle;
  setExplanationStyle: (value: ExplanationStyle) => void;
  /** The listening speed new documents start at. Each document then remembers its own. */
  defaultPlaybackRate: number;
  setDefaultPlaybackRate: (value: number) => void;
  hydrated: boolean;
};
const Context = createContext<Value | null>(null);
export function PurposeProvider({ children }: PropsWithChildren) {
  const [purpose, setPurposeState] = useState<VoticPurpose | null>(null);
  const [explanationStyle, setExplanationStyleState] = useState<ExplanationStyle>("adaptive");
  const [defaultPlaybackRate, setDefaultPlaybackRateState] = useState(1);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    void AsyncStorage.multiGet([KEY, EXPLANATION_KEY, RATE_KEY])
      .then(([[, value], [, style], [, rate]]) => {
        if (PURPOSES.some((item) => item.value === value)) setPurposeState(value as VoticPurpose);
        if (EXPLANATION_STYLES.some((item) => item.value === style))
          setExplanationStyleState(style as ExplanationStyle);
        if (rate) setDefaultPlaybackRateState(normalizePlaybackRate(Number(rate)));
      })
      .catch(() => {})
      .finally(() => setHydrated(true));
  }, []);
  function setPurpose(value: VoticPurpose) {
    setPurposeState(value);
    void AsyncStorage.setItem(KEY, value).catch(() => {});
  }
  function setExplanationStyle(value: ExplanationStyle) {
    setExplanationStyleState(value);
    void AsyncStorage.setItem(EXPLANATION_KEY, value).catch(() => {});
  }
  function setDefaultPlaybackRate(value: number) {
    const rate = normalizePlaybackRate(value);
    setDefaultPlaybackRateState(rate);
    void AsyncStorage.setItem(RATE_KEY, String(rate)).catch(() => {});
  }
  return (
    <Context.Provider
      value={{
        purpose,
        setPurpose,
        explanationStyle,
        setExplanationStyle,
        defaultPlaybackRate,
        setDefaultPlaybackRate,
        hydrated,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useVoticPurpose() {
  const value = useContext(Context);
  if (!value) throw new Error("useVoticPurpose must be used inside PurposeProvider");
  return value;
}
