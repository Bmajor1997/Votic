import { createContext, PropsWithChildren, useContext, useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";
import {
  load_accessibility_preferences,
  save_accessibility_preferences,
} from "../preferences/preferenceStorage";

export type TextSize = "default" | "large" | "extra-large";
export type ReadingSpacing = "compact" | "default" | "extra";
export type ReaderFont = "system" | "serif" | "accessible";
export type TextSpacing = "default" | "wide";
export type HighlightMode = "off" | "sentence" | "word" | "both";

type AccessibilityPreferences = {
  hydrated: boolean;
  /** Initial device motion preference and local settings have both loaded. */
  motionReady: boolean;
  textSize: TextSize;
  set_text_size: (value: TextSize) => void;
  readingSpacing: ReadingSpacing;
  set_reading_spacing: (value: ReadingSpacing) => void;
  readerFont: ReaderFont;
  set_reader_font: (value: ReaderFont) => void;
  textSpacing: TextSpacing;
  set_text_spacing: (value: TextSpacing) => void;
  highlightMode: HighlightMode;
  set_highlight_mode: (value: HighlightMode) => void;
  voiceIdentifier: string | null;
  set_voice_identifier: (value: string | null) => void;
  /** True when Votic or the device asks for less motion. */
  reduceMotion: boolean;
  /** The device's own Reduce Motion setting, which Votic always follows. */
  systemReduceMotion: boolean;
  set_reduce_motion: (value: boolean) => void;
  sentenceFlow: boolean;
  set_sentence_flow: (value: boolean) => void;
  wordEmphasis: boolean;
  set_word_emphasis: (value: boolean) => void;
  /** Stronger text and border contrast for the Reader's page, in every reader theme. */
  highContrast: boolean;
  set_high_contrast: (value: boolean) => void;
};

const AccessibilityContext = createContext<AccessibilityPreferences | null>(null);

export function AccessibilityProvider({ children }: PropsWithChildren) {
  const [textSize, setTextSize] = useState<TextSize>("default");
  const [readingSpacing, setReadingSpacing] = useState<ReadingSpacing>("default");
  const [readerFont, setReaderFont] = useState<ReaderFont>("system");
  const [textSpacing, setTextSpacing] = useState<TextSpacing>("default");
  const [highlightMode, setHighlightMode] = useState<HighlightMode>("both");
  const [voiceIdentifier, setVoiceIdentifier] = useState<string | null>(null);
  const [reduceMotionPreference, setReduceMotionPreference] = useState(false);
  const [systemReduceMotion, setSystemReduceMotion] = useState(false);
  const [systemMotionReady, setSystemMotionReady] = useState(false);
  const reduceMotion = reduceMotionPreference || systemReduceMotion;
  const setReduceMotion = setReduceMotionPreference;
  const [sentenceFlow, setSentenceFlow] = useState(true);
  const [wordEmphasis, setWordEmphasis] = useState(true);
  const [highContrast, setHighContrast] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    load_accessibility_preferences().then((saved) => {
      if (["default", "large", "extra-large"].includes(saved?.textSize)) setTextSize(saved.textSize);
      if (["compact", "default", "extra"].includes(saved?.readingSpacing))
        setReadingSpacing(saved.readingSpacing);
      if (["system", "serif", "accessible"].includes(saved?.readerFont)) setReaderFont(saved.readerFont);
      if (["default", "wide"].includes(saved?.textSpacing)) setTextSpacing(saved.textSpacing);
      if (["off", "sentence", "word", "both"].includes(saved?.highlightMode))
        setHighlightMode(saved.highlightMode);
      if (typeof saved?.voiceIdentifier === "string") setVoiceIdentifier(saved.voiceIdentifier);
      if (typeof saved?.reduceMotion === "boolean") setReduceMotionPreference(saved.reduceMotion);
      if (typeof saved?.sentenceFlow === "boolean") setSentenceFlow(saved.sentenceFlow);
      if (typeof saved?.wordEmphasis === "boolean") setWordEmphasis(saved.wordEmphasis);
      if (typeof saved?.highContrast === "boolean") setHighContrast(saved.highContrast);
      setHydrated(true);
    });
  }, []);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        setSystemReduceMotion(enabled);
        setSystemMotionReady(true);
      })
      .catch(() => {});
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setSystemReduceMotion);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (hydrated)
      save_accessibility_preferences({
        textSize,
        readingSpacing,
        readerFont,
        textSpacing,
        highlightMode,
        voiceIdentifier,
        reduceMotion: reduceMotionPreference,
        sentenceFlow,
        wordEmphasis,
        highContrast,
      }).catch(() => {});
  }, [
    textSize,
    readingSpacing,
    readerFont,
    textSpacing,
    highlightMode,
    voiceIdentifier,
    reduceMotionPreference,
    sentenceFlow,
    wordEmphasis,
    highContrast,
    hydrated,
  ]);

  return (
    <AccessibilityContext.Provider
      value={{
        hydrated,
        motionReady: hydrated && systemMotionReady,
        textSize,
        set_text_size: setTextSize,
        readingSpacing,
        set_reading_spacing: setReadingSpacing,
        readerFont,
        set_reader_font: setReaderFont,
        textSpacing,
        set_text_spacing: setTextSpacing,
        highlightMode,
        set_highlight_mode: setHighlightMode,
        voiceIdentifier,
        set_voice_identifier: setVoiceIdentifier,
        reduceMotion,
        systemReduceMotion,
        set_reduce_motion: setReduceMotion,
        sentenceFlow,
        wordEmphasis,
        set_sentence_flow: setSentenceFlow,
        set_word_emphasis: setWordEmphasis,
        highContrast,
        set_high_contrast: setHighContrast,
      }}
    >
      {children}
    </AccessibilityContext.Provider>
  );
}

/** Only personalization's highlight setting is account-specific; other accessibility choices stay on the device. */
export function AccountHighlightPreferences({
  children,
  highlightMode,
  set_highlight_mode,
}: PropsWithChildren<{
  highlightMode: HighlightMode;
  set_highlight_mode: (value: HighlightMode) => void;
}>) {
  const parent = useAccessibilityPreferences();
  return (
    <AccessibilityContext.Provider value={{ ...parent, highlightMode, set_highlight_mode }}>
      {children}
    </AccessibilityContext.Provider>
  );
}

export function useAccessibilityPreferences() {
  const context = useContext(AccessibilityContext);
  if (!context) throw new Error("useAccessibilityPreferences must be used inside AccessibilityProvider");
  return context;
}
