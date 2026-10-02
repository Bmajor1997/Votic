import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Screen } from "../../src/components/Screen";
import { radii, spacing, typography } from "../../src/design/tokens";
import { DocumentActionsSheet } from "../../src/documents/DocumentActionsSheet";
import { useDocumentLibrary } from "../../src/documents/DocumentLibraryProvider";
import { mostRecentIncomplete } from "../../src/documents/insights";
import { VoticDocument } from "../../src/documents/types";
import { openFrom, useDocumentImport } from "../../src/documents/useDocumentImport";
import { useDocumentTransition } from "../../src/navigation/DocumentTransitionProvider";
import { GettingStartedCard } from "../../src/onboarding/GettingStartedCard";
import { useOnboarding } from "../../src/onboarding/OnboardingProvider";
import { homeNotes } from "../../src/home/homeModel";
import {
  ContinueWidget,
  EmptyContinueWidget,
  NotesShelf,
  RecentShelf,
  WeekWidget,
} from "../../src/home/HomeWidgets";
import { useVoticTheme } from "../../src/theme/ThemeProvider";
import { useWalkthroughTarget, useWalkthroughTrigger } from "../../src/walkthrough/WalkthroughProvider";

export default function Home() {
  const { theme } = useVoticTheme();
  const { documents, loaded, openDocument } = useDocumentLibrary();
  const { checklistDismissed } = useOnboarding();
  const transition = useDocumentTransition();
  const addRef = useRef<View>(null);
  const { importing, importDocument } = useDocumentImport(addRef);
  const [menuDocument, setMenuDocument] = useState<VoticDocument | null>(null);
  const featured = mostRecentIncomplete(documents);
  const recent = [...documents]
    .filter((document) => document.id !== featured?.id)
    .sort((a, b) => (b.lastOpenedAt || b.updatedAt) - (a.lastOpenedAt || a.updatedAt))
    .slice(0, 8);
  const notes = homeNotes(documents);
  // With nothing added yet, Home keeps its usual sections, each saying what will show up there.
  const empty = loaded && !documents.length;
  const continueTarget = useWalkthroughTarget("home.continue");
  const recentTarget = useWalkthroughTarget("home.recent");
  const startTarget = useWalkthroughTarget("home.start");
  const optionsTarget = useWalkthroughTarget("home.documentOptions");
  useWalkthroughTrigger(
    [{ id: "intro" }, { id: "home" }, { id: "home.documentOptions", when: recent.length > 0 }],
    {
      hasDocuments: documents.length > 0,
      hasContinue: Boolean(featured),
      hasStart: !checklistDismissed || !documents.length,
      hasRecent: recent.length > 0,
      hasNotes: notes.length > 0,
    },
  );

  return (
    <Screen title="Home" hideTitle>
      <GettingStartedCard />
      {!loaded ? (
        <View accessible accessibilityLabel="Loading your library" style={s.loading}>
          <ActivityIndicator color={theme.accent} />
        </View>
      ) : null}
      {empty ? (
        <Text accessibilityRole="header" style={[s.pageTitle, { color: theme.text }]}>
          Continue
        </Text>
      ) : null}
      {empty ? (
        <EmptyContinueWidget
          onAdd={() => void importDocument()}
          importing={importing}
          addRef={addRef}
          // While the getting-started checklist is up, that's where the Home walkthrough starts.
          targetRef={checklistDismissed ? startTarget : undefined}
        />
      ) : null}
      {loaded && documents.length ? (
        <View style={s.headerRow}>
          <Text accessibilityRole="header" style={[s.pageTitle, { color: theme.text }]}>
            {featured ? "Continue" : "Your library"}
          </Text>
          <View ref={addRef} collapsable={false}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add document"
              accessibilityState={{ busy: importing }}
              disabled={importing}
              onPress={() => void importDocument()}
              style={({ pressed }) => [
                s.addButton,
                { borderColor: theme.border, backgroundColor: pressed ? theme.surfaceMuted : theme.surface },
              ]}
            >
              {importing ? (
                <ActivityIndicator size="small" color={theme.accent} />
              ) : (
                <Ionicons name="add" size={20} color={theme.accent} />
              )}
              <Text style={[s.addText, { color: theme.text }]}>Add</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
      {featured ? (
        <ContinueWidget
          document={featured}
          targetRef={continueTarget}
          onOpen={(source, mode) => {
            if (transition.transitioning) return;
            openDocument(featured.id);
            // Listen opens with narration controls and starts playing; Read opens without audio controls.
            openFrom(
              source,
              transition,
              mode === "listen" ? { mode: "listen", autoplay: "1" } : { mode: "read" },
            );
          }}
        />
      ) : null}
      {loaded ? <WeekWidget /> : null}
      {recent.length || empty ? (
        <RecentShelf
          documents={recent}
          targetRef={recentTarget}
          optionsTargetRef={optionsTarget}
          onOpen={(document, source) => {
            if (transition.transitioning) return;
            openDocument(document.id);
            openFrom(source, transition);
          }}
          onMore={setMenuDocument}
        />
      ) : null}
      <NotesShelf
        notes={notes}
        showEmpty={empty}
        onOpen={({ document, passage }) => {
          if (transition.transitioning) return;
          // Opens the document at the saved passage.
          openDocument(document.id, passage.sentenceIndex);
          router.push("/reader");
        }}
      />
      <DocumentActionsSheet
        document={menuDocument}
        onClose={() => setMenuDocument(null)}
        onOpen={(document) => {
          openDocument(document.id);
          router.push("/reader");
        }}
      />
    </Screen>
  );
}

const s = StyleSheet.create({
  loading: { paddingVertical: spacing.xxl, alignItems: "center" },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md },
  pageTitle: { ...typography.screenTitle, fontSize: 26, flexShrink: 1 },
  addButton: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  addText: { fontSize: 15, fontWeight: "700" },
});
