import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { DocumentCover } from "../../src/components/DocumentCover";
import { NotesShelf, RecentShelf, WeekWidget } from "../../src/home/HomeWidgets";
import { homeNotes } from "../../src/home/homeModel";
import { HomeEmptyAnimation } from "../../src/components/EmptyStateIllustrations";
import { Screen } from "../../src/components/Screen";
import { controlSizes, radii, spacing, typography } from "../../src/design/tokens";
import { DocumentActionsSheet } from "../../src/documents/DocumentActionsSheet";
import { positionLabel, progressLabel, readableTitle } from "../../src/documents/documentDisplay";
import { useDocumentLibrary } from "../../src/documents/DocumentLibraryProvider";
import { mostRecentIncomplete } from "../../src/documents/insights";
import { VoticDocument } from "../../src/documents/types";
import { openFrom, useDocumentImport } from "../../src/documents/useDocumentImport";
import { useDocumentTransition } from "../../src/navigation/DocumentTransitionProvider";
import { GettingStartedCard } from "../../src/onboarding/GettingStartedCard";
import { useOnboarding } from "../../src/onboarding/OnboardingProvider";
import { useVoticTheme } from "../../src/theme/ThemeProvider";

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

  return (
    <Screen title="Home" hideTitle>
      <GettingStartedCard />
      {!loaded ? (
        <View accessible accessibilityLabel="Loading your library" style={s.loading}>
          <ActivityIndicator color={theme.accentText} />
          <Text style={[s.featuredMeta, { color: theme.mutedText }]}>Preparing your library…</Text>
        </View>
      ) : null}
      {loaded && documents.length ? (
        <View style={s.headerRow}>
          <Text accessibilityRole="header" style={[s.pageTitle, { color: theme.text }]}>
            {featured ? "Continue" : "Your library"}
          </Text>
        </View>
      ) : null}
      {featured ? (
        <ContinueCard
          document={featured}
          onOpen={(source, listen) => {
            if (transition.transitioning) return;
            openDocument(featured.id);
            // Listen opens with narration controls and starts playing; Read opens without audio controls.
            openFrom(source, transition, listen ? { mode: "listen", autoplay: "1" } : { mode: "read" });
          }}
        />
      ) : null}
      {loaded ? <WeekWidget /> : null}
      {recent.length ? (
        <RecentShelf
          documents={recent}
          onOpen={(document, source) => {
            if (transition.transitioning) return;
            openDocument(document.id);
            openFrom(source, transition, { mode: "read" });
          }}
          onMore={setMenuDocument}
        />
      ) : null}
      {loaded ? (
        <NotesShelf
          notes={notes}
          onOpen={({ document, passage }) => {
            if (transition.transitioning) return;
            openDocument(document.id, passage.sentenceIndex);
            router.push("/reader");
          }}
        />
      ) : null}
      {loaded && !documents.length && checklistDismissed ? (
        <View style={s.empty}>
          <HomeEmptyAnimation />
          <Text accessibilityRole="header" style={[s.emptyTitle, { color: theme.text }]}>
            Your reading starts here
          </Text>
          <Text style={[s.emptyCopy, { color: theme.mutedText }]}>
            Add a PDF, Word, PowerPoint, EPUB, or text file to read and listen.
          </Text>
          <View ref={addRef} collapsable={false} style={s.emptyAction}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add document"
              accessibilityState={{ busy: importing }}
              disabled={importing}
              onPress={() => void importDocument()}
              style={[s.primary, { backgroundColor: theme.accent }]}
            >
              {importing ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Ionicons name="add" size={20} color="#FFF" />
              )}
              <Text style={s.primaryText}>Add document</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
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

/** The one thing Home is for: picking up where you left off. */
function ContinueCard({
  document,
  onOpen,
}: {
  document: VoticDocument;
  onOpen: (source: React.RefObject<View | null>, listen: boolean) => void;
}) {
  const { theme } = useVoticTheme();
  const listenRef = useRef<View>(null);
  const readRef = useRef<View>(null);
  const title = readableTitle(document.title);
  const percent = Math.round(document.progress * 100);
  const started = document.progress > 0;
  const listenLabel = started ? "Resume listening" : "Listen";
  const readLabel = started ? "Resume reading" : "Read";
  return (
    <View style={[s.featured, theme.elevation, { backgroundColor: theme.hero, borderColor: theme.border }]}>
      <View
        pointerEvents="none"
        accessible={false}
        importantForAccessibility="no-hide-descendants"
        style={[s.heroGlow, { backgroundColor: theme.isDark ? "#244F81" : "#C2D8FF" }]}
      />
      <Text style={[s.heroEyebrow, { color: theme.heroMuted }]}>YOUR NEXT CHAPTER</Text>
      <View style={s.featuredTop}>
        <DocumentCover document={document} size="lg" />
        <View style={s.featuredCopy}>
          <Text numberOfLines={3} style={[s.featuredTitle, { color: theme.heroText }]}>
            {title}
          </Text>
          <Text style={[s.featuredMeta, { color: theme.heroMuted }]}>{positionLabel(document)}</Text>
          <View
            accessible
            accessibilityRole="progressbar"
            accessibilityLabel={`${title} progress`}
            accessibilityValue={{ min: 0, max: 100, now: percent }}
            style={[s.track, { backgroundColor: theme.border }]}
          >
            <View
              style={[
                s.fill,
                { backgroundColor: theme.accent, width: `${Math.max(0, Math.min(100, percent))}%` },
              ]}
            />
          </View>
          <Text style={[s.featuredMeta, { color: theme.heroMuted }]}>{progressLabel(document)}</Text>
        </View>
      </View>
      <View style={s.featuredActions}>
        <View ref={listenRef} collapsable={false} style={s.half}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${listenLabel} to ${title}`}
            accessibilityHint="Opens the Reader and plays from where you left off"
            onPress={() => onOpen(listenRef, true)}
            style={({ pressed }) => [
              s.primary,
              s.featuredButton,
              { backgroundColor: theme.accent, opacity: pressed ? 0.88 : 1 },
            ]}
          >
            <Ionicons name="play" size={19} color="#FFF" />
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.75}
              style={[s.primaryText, s.shrink]}
            >
              {listenLabel}
            </Text>
          </Pressable>
        </View>
        <View ref={readRef} collapsable={false} style={s.half}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${readLabel} ${title}`}
            accessibilityHint="Opens the document for reading, without audio controls"
            onPress={() => onOpen(readRef, false)}
            style={({ pressed }) => [
              s.secondary,
              s.featuredButton,
              { borderColor: theme.border, backgroundColor: pressed ? theme.surfaceMuted : theme.surface },
            ]}
          >
            <Ionicons name="book-outline" size={19} color={theme.text} />
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.75}
              style={[s.secondaryText, s.shrink, { color: theme.text }]}
            >
              {readLabel}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  loading: { paddingVertical: spacing.xxl, alignItems: "center" },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md },
  pageTitle: { ...typography.screenTitle, fontSize: 26, flexShrink: 1 },
  addButton: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  addText: { fontSize: 15, fontWeight: "700" },
  heroGlow: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 110,
    right: -90,
    top: -100,
    opacity: 0.5,
  },
  heroEyebrow: { ...typography.eyebrow },
  featured: { overflow: "hidden", borderWidth: 1, borderRadius: 24, padding: spacing.xl, gap: spacing.lg },
  featuredTop: { flexDirection: "row", gap: spacing.lg, alignItems: "flex-start" },
  featuredCopy: { flex: 1, gap: spacing.xs },
  featuredTitle: { fontSize: 20, lineHeight: 26, fontWeight: "800", letterSpacing: -0.2 },
  featuredMeta: { fontSize: 14, lineHeight: 19 },
  track: { height: 6, borderRadius: 3, overflow: "hidden", marginTop: spacing.xs },
  fill: { height: "100%", borderRadius: 3 },
  // Listen and Read share one row in equal halves.
  featuredActions: { flexDirection: "row", gap: spacing.sm },
  half: { flex: 1, minWidth: 0 },
  shrink: { flexShrink: 1 },
  featuredButton: { paddingHorizontal: spacing.sm, gap: 6 },
  grow: { flex: 1, minWidth: 0 },
  primary: {
    minHeight: 50,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  primaryText: { color: "#FFF", fontSize: 16, fontWeight: "800" },
  secondary: {
    minHeight: 50,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  secondaryText: { fontSize: 16, fontWeight: "700" },
  week: {
    minHeight: 64,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  weekIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  weekTitle: { fontSize: 15, fontWeight: "800" },
  weekCopy: { fontSize: 14, lineHeight: 19 },
  section: { gap: spacing.xs },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionTitle: { ...typography.sectionTitle, fontSize: 18 },
  seeAll: { minHeight: controlSizes.minimumTouch, justifyContent: "center" },
  seeAllText: { fontSize: 15, fontWeight: "800" },
  row: { borderBottomWidth: 1, flexDirection: "row", alignItems: "center" },
  rowMain: {
    flex: 1,
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  rowTitle: { fontSize: 15, lineHeight: 20, fontWeight: "700" },
  rowMeta: { fontSize: 13, marginTop: 2 },
  more: {
    width: controlSizes.minimumTouch,
    height: controlSizes.minimumTouch,
    alignItems: "center",
    justifyContent: "center",
  },
  empty: { alignItems: "center", gap: spacing.md, paddingVertical: spacing.xl },
  emptyTitle: { ...typography.sectionTitle, textAlign: "center" },
  emptyCopy: { fontSize: 16, lineHeight: 23, textAlign: "center" },
  emptyAction: { alignSelf: "stretch", marginTop: spacing.sm },
});
