import AsyncStorage from "@react-native-async-storage/async-storage";
import { PropsWithChildren, createContext, useContext, useEffect, useState } from "react";
export type VoticPurpose = "learning" | "work" | "research" | "personal" | "accessibility";
export const PURPOSES = [
  { value: "learning" as const, label: "School & learning", icon: "school-outline" as const },
  { value: "work" as const, label: "Work", icon: "briefcase-outline" as const },
  { value: "research" as const, label: "Research", icon: "search-outline" as const },
  { value: "personal" as const, label: "Personal reading", icon: "book-outline" as const },
  { value: "accessibility" as const, label: "Accessibility", icon: "accessibility-outline" as const },
];
const KEY = "votic.mobile.purpose.v1";
type Value = { purpose: VoticPurpose | null; hydrated: boolean };
const Context = createContext<Value | null>(null);
/**
 * The purpose chosen in the old app tour, kept read-only so people who chose one keep sensible suggestions
 * until they answer the personalization questions (see suggestions.ts). Nothing sets it anymore.
 */
export function PurposeProvider({ children }: PropsWithChildren) {
  const [purpose, setPurposeState] = useState<VoticPurpose | null>(null);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    void AsyncStorage.getItem(KEY).then((value) => {
      if (PURPOSES.some((item) => item.value === value)) setPurposeState(value as VoticPurpose);
      setHydrated(true);
    });
  }, []);
  return <Context.Provider value={{ purpose, hydrated }}>{children}</Context.Provider>;
}
export function useVoticPurpose() {
  const value = useContext(Context);
  if (!value) throw new Error("useVoticPurpose must be used inside PurposeProvider");
  return value;
}
