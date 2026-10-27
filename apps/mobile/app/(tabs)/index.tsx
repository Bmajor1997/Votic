import { editorial } from "../../src/design/editorial";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { ContinuePreview } from "../../src/home/ContinuePreview";
import { widget_palette } from "../../src/home/widgetDesign";
import { EmptyContinueWidget, NotesShelf, RecentShelf, WeekWidget } from "../../src/home/HomeWidgets";
import { home_notes } from "../../src/home/homeModel";
import { HomeLogoEntrance } from "../../src/home/HomeLogoEntrance";
import { Screen } from "../../src/components/Screen";
import { controlSizes, radii, spacing, typography } from "../../src/design/tokens";
import { DocumentActionsSheet } from "../../src/documents/DocumentActionsSheet";
import { position_label, progress_label, readable_title } from "../../src/documents/documentDisplay";
import { useDocumentLibrary } from "../../src/documents/DocumentLibraryProvider";
import { most_recent_incomplete } from "../../src/documents/insights";
import { readable_documents, VoticDocument } from "../../src/documents/types";
import { open_from } from "../../src/documents/useDocumentImport";
import { useDocumentTransition } from "../../src/navigation/DocumentTransitionProvider";
import { useVoticTheme } from "../../src/theme/ThemeProvider";
import { useWalkthroughTarget, useWalkthroughTrigger } from "../../src/walkthrough/WalkthroughProvider";

export default function Home() {
  const { theme } = useVoticTheme();
  const { documents: everything, loaded, openDocument } = useDocumentLibrary();
  // Quick Notes is a notebook: its notes still show under Recent notes, but it isn't a document to continue.
  const documents = readable_documents(everything);
  const transition = useDocumentTransition();
  const [menuDocument, setMenuDocument] = useState<VoticDocument | null>(null);
  const featured = most_recent_incomplete(documents);
  const recent = [...documents]
    .filter((document) => document.id !== featured?.id)
    .sort((a, b) => (b.lastOpenedAt || b.updatedAt) - (a.lastOpenedAt || a.updatedAt))
    .slice(0, 8);
  const notes = home_notes(everything);
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
      hasStart: !featured,
      hasRecent: recent.length > 0,
      hasNotes: notes.length > 0,
    },
  );

  return (
    <Screen title="Home" hideTitle brand={<HomeLogoEntrance ready={loaded} />}>
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
      {loaded && !featured ? (
        <EmptyContinueWidget onBrowse={() => router.push("/documents")} targetRef={startTarget} />
      ) : null}
      {featured ? (
        <ContinueCard
          document={featured}
          targetRef={continueTarget}
          onOpen={(source, listen, heading) => {
            if (transition.transitioning) return;
            openDocument(featured.id);
            // Listen opens with narration controls and starts playing; Read opens without audio controls.
            open_from(
              source,
              transition,
              listen ? { mode: "listen", autoplay: "1" } : { mode: "read" },
              heading,
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
          onOpen={(document, source, heading) => {
            if (transition.transitioning) return;
            openDocument(document.id);
            open_from(source, transition, { mode: "read" }, heading);
          }}
          onMore={setMenuDocument}
        />
      ) : null}
      {loaded ? (
        <NotesShelf
          notes={notes}
          onOpen={({ document, passage }) => {
            if (transition.transitioning) return;
            // A Quick Note has no document passage to show; open that one note instead of the whole notebook.
            if (document.notebookKind) {
              router.push({
                pathname: "/notes",
                params: { note: passage.id, notebook: document.id, from: "home" },
              });
              return;
            }
            openDocument(document.id, passage.sentenceIndex);
            router.push("/reader");
          }}
        />
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
  targetRef,
}: {
  document: VoticDocument;
  onOpen: (
    source: React.RefObject<View | null>,
    listen: boolean,
    heading: { text: string; node: Text | null },
  ) => void;
  targetRef?: (node: View | null) => void;
}) {
  const { theme } = useVoticTheme();
  const colors = widget_palette(theme.isDark, "chapter");
  const cardRef = useRef<View>(null);
  const titleRef = useRef<Text>(null);
  const listenRef = useRef<View>(null);
  const readRef = useRef<View>(null);
  const title = readable_title(document.title);
  const percent = Math.round(document.progress * 100);
  const { width } = useWindowDimensions();
  const compact = width <= 350;
  const listenLabel = "Continue Listening";
  const readLabel = "Continue Reading";
  return (
    <View
      ref={(node) => {
        cardRef.current = node;
        targetRef?.(node);
      }}
      collapsable={false}
      testID="home-continue-card"
      style={[s.featured, theme.elevation, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      <View style={s.featuredHeading}>
        <View style={s.featuredHeadingLabel}>
          <Ionicons name="book-outline" size={17} color={colors.detail} />
          <Text style={[s.heroEyebrow, { color: colors.detail }]}>YOUR NEXT CHAPTER</Text>
        </View>
        <Ionicons name="bookmark-outline" size={20} color={colors.detail} accessibilityElementsHidden />
      </View>
      <View style={s.featuredTop}>
        <ContinuePreview document={document} />
        <View style={s.featuredCopy}>
          <Text ref={titleRef} style={[s.featuredTitle, { color: colors.ink }]}>
            {title}
          </Text>
          <Text style={[s.featuredMeta, { color: colors.detail }]}>{position_label(document)}</Text>
          <View
            accessible
            accessibilityRole="progressbar"
            accessibilityLabel={`${title} progress`}
            accessibilityValue={{ min: 0, max: 100, now: percent }}
            style={[s.track, { backgroundColor: colors.art }]}
          >
            <View
              style={[
                s.fill,
                { backgroundColor: colors.strong, width: `${Math.max(0, Math.min(100, percent))}%` },
              ]}
            />
          </View>
          <Text style={[s.featuredMeta, { color: colors.detail }]}>{progress_label(document)}</Text>
        </View>
      </View>
      <View style={[s.featuredFooter, { borderTopColor: colors.border }]}>
        <Ionicons name="leaf-outline" size={17} color={colors.detail} />
        <Text style={[s.featuredFooterText, { color: colors.detail }]}>Your story continues here.</Text>
      </View>
      <View testID="home-continue-actions" style={s.featuredActions}>
        <View ref={listenRef} collapsable={false} style={s.listenAction}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${listenLabel}: ${title}`}
            accessibilityHint="Opens the Reader and plays from where you left off"
            onPress={() => onOpen(cardRef, true, { text: title, node: titleRef.current })}
            style={({ pressed }) => [
              s.primary,
              s.featuredButton,
              { backgroundColor: colors.strong, opacity: pressed ? 0.88 : 1 },
            ]}
          >
            <Text
              style={[s.primaryText, s.continueLabel, compact && s.compactLabel, { color: colors.onStrong }]}
            >
              {listenLabel}
            </Text>
          </Pressable>
        </View>
        <View ref={readRef} collapsable={false} style={s.readAction}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${readLabel}: ${title}`}
            accessibilityHint="Opens the document for reading, without audio controls"
            onPress={() => onOpen(cardRef, false, { text: title, node: titleRef.current })}
            style={({ pressed }) => [
              s.secondary,
              s.featuredButton,
              { borderColor: colors.border, backgroundColor: pressed ? colors.art : colors.surface },
            ]}
          >
            <Text
              style={[s.secondaryText, s.continueLabel, compact && s.compactLabel, { color: colors.ink }]}
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
  pageTitle: { ...editorial, fontSize: 32, lineHeight: 40, flexShrink: 1 },
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
  heroEyebrow: { ...typography.eyebrow },
  featured: { overflow: "hidden", borderWidth: 1, borderRadius: 24, padding: spacing.xl, gap: spacing.lg },
  featuredHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  featuredHeadingLabel: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  featuredFooter: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.sm },
  featuredFooterText: { fontSize: 13, lineHeight: 19 },
  featuredTop: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md, alignItems: "flex-start" },
  featuredCopy: { flex: 1, minWidth: 120, gap: spacing.sm },
  featuredTitle: { ...editorial, fontSize: 25, lineHeight: 32 },
  featuredMeta: { fontSize: 14, lineHeight: 19 },
  track: { height: 6, borderRadius: 3, overflow: "hidden", marginTop: spacing.xs },
  fill: { height: "100%", borderRadius: 3 },
  // Always side by side, with the longer Listening label given a little more room. With large text a label
  // wraps onto a second line inside its own button, so both stay complete and in the same order.
  featuredActions: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: spacing.sm,
    marginHorizontal: -spacing.md,
  },
  listenAction: { flex: 18, minWidth: 0 },
  readAction: { flex: 16, minWidth: 0 },
  continueLabel: { flexShrink: 1, textAlign: "center" },
  compactLabel: { fontSize: 14 },
  // Fills its half, so both buttons match in height when one label wraps.
  featuredButton: { flexGrow: 1, paddingHorizontal: spacing.xs, paddingVertical: spacing.md },
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
