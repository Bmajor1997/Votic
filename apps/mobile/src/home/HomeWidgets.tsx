import { NotePreview } from "../notes/components/NotePreview";
import { editorial } from "../design/editorial";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { ReactNode, useRef } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { format_duration, shown_total, spoken_duration } from "../activity/activityModel";
import { useActivity } from "../activity/ActivityProvider";
import { controlSizes, radii, spacing, typography } from "../design/tokens";
import { document_type_label, progress_label, readable_title } from "../documents/documentDisplay";
import { useDocumentLibrary } from "../documents/DocumentLibraryProvider";
import { VoticDocument } from "../documents/types";
import { useVoticTheme } from "../theme/ThemeProvider";
import { useWalkthroughTarget } from "../walkthrough/WalkthroughProvider";
import { NoteItem, change_label, home_insight, relative_day, week_activity } from "./homeModel";

import { HomeDocumentArtwork } from "./HomeCardArtwork";
import { widget_palette } from "./widgetDesign";

type Target = (node: View | null) => void;

/** A section title with an optional "See all". Spacing and type set the hierarchy, not boxes. */
export function SectionHeader({
  title,
  actionLabel,
  onAction,
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const { theme } = useVoticTheme();
  return (
    <View style={s.sectionHeader}>
      <Text accessibilityRole="header" style={[s.sectionTitle, { color: theme.text }]}>
        {title}
      </Text>
      {actionLabel && onAction ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          onPress={onAction}
          hitSlop={8}
          style={s.seeAll}
        >
          <Text style={[s.seeAllText, { color: theme.accentText }]}>See all</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

// ---------- This week ----------

/** Home points to Documents when there is no unfinished document to continue. */
export function EmptyContinueWidget({
  hasDocuments,
  onBrowse,
  targetRef,
}: {
  hasDocuments: boolean;
  onBrowse: () => void;
  targetRef?: Target;
}) {
  const { theme } = useVoticTheme();
  const colors = widget_palette(theme.isDark, "chapter");
  return (
    <View
      ref={targetRef}
      collapsable={false}
      testID="home-empty-continue"
      style={[
        s.emptyContinue,
        theme.elevation,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <View style={s.emptyContinueTop}>
        <View style={[s.emptyCover, { borderColor: colors.border, backgroundColor: colors.art }]}>
          <Ionicons name="document-outline" size={30} color={colors.detail} />
        </View>
        <View style={s.grow}>
          <Text accessibilityRole="header" style={[s.emptyContinueTitle, { color: colors.ink }]}>
            Your next read starts here
          </Text>
          <Text style={[s.emptyMessage, { color: colors.detail }]}>
            {hasDocuments
              ? "Go to Documents to choose your next read."
              : "Go to Documents to upload your first file."}
          </Text>
        </View>
      </View>
      {hasDocuments ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Browse documents"
          accessibilityHint="Opens Documents, where you can choose a file or add one"
          onPress={onBrowse}
          style={({ pressed }) => [
            s.emptyAdd,
            { backgroundColor: colors.strong, opacity: pressed ? 0.88 : 1 },
          ]}
        >
          <Ionicons name="folder-open-outline" size={20} color={colors.onStrong} />
          <Text style={[s.emptyAddText, { color: colors.onStrong }]}>Browse documents</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** What a Home section says before it has anything to show. */
function EmptyPanel({
  icon,
  title,
  message,
  color,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  title: string;
  message: string;
  color: { border: string; ink: string; detail: string };
}) {
  return (
    <View accessible style={[s.emptyPanel, { borderColor: color.border }]}>
      <Ionicons name={icon} size={22} color={color.detail} />
      <View style={s.grow}>
        <Text style={[s.emptyPanelTitle, { color: color.ink }]}>{title}</Text>
        <Text style={[s.emptyMessage, { color: color.detail }]}>{message}</Text>
      </View>
    </View>
  );
}

/**
 * This week at a glance: total time, how it splits between reading and listening, a small day-by-day
 * strip, and one factual note when there's enough activity. The whole card opens Statistics.
 */
export function WeekWidget() {
  const { theme } = useVoticTheme();
  const colors = widget_palette(theme.isDark, "activity");
  const { log, hydrated } = useActivity();
  const { documents } = useDocumentLibrary();
  const weekTarget = useWalkthroughTarget("home.week");
  // Until the log has loaded, nothing is shown rather than a misleading "0 min".
  if (!hydrated) return null;
  const week = week_activity(log);
  const insight = home_insight(log, documents);
  const peak = Math.max(...week.days.map((day) => day.total), 1);
  const listeningShare = week.total ? week.listening / week.total : 0;
  const spoken = week.total
    ? [
        `This week: ${spoken_duration(shown_total(week))}`,
        `reading ${spoken_duration(week.reading)}, listening ${spoken_duration(week.listening)}`,
        week.change !== null ? change_label(week.change) : null,
        insight,
        "Open Statistics.",
      ]
        .filter(Boolean)
        .join(". ")
    : "This week: no reading or listening yet. Open Statistics.";
  return (
    <Pressable
      ref={weekTarget}
      testID="home-week-card"
      accessibilityRole="button"
      accessibilityLabel={spoken}
      accessibilityHint="Shows your reading and listening activity"
      onPress={() => router.push("/statistics")}
      style={({ pressed }) => [
        s.week,
        theme.elevation,
        { borderColor: colors.border, backgroundColor: pressed ? colors.art : colors.surface },
      ]}
    >
      {/* Says where the card leads, since Statistics no longer has its own row on Home. */}
      <View style={s.weekHeader}>
        <View style={s.weekIdentity}>
          <View
            accessible={false}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={[s.widgetIcon, { backgroundColor: colors.art }]}
          >
            <Ionicons name="stats-chart-outline" size={18} color={colors.ink} />
          </View>
          <Text style={[s.eyebrow, { color: colors.detail }]}>THIS WEEK</Text>
        </View>
        <View style={s.weekLink}>
          <Text style={[s.weekLinkText, { color: colors.ink }]}>Statistics</Text>
          <Ionicons name="chevron-forward" size={15} color={colors.ink} />
        </View>
      </View>
      <View style={s.weekTop}>
        <View style={s.grow}>
          {week.total ? (
            <>
              <Text testID="home-week-total" style={[s.weekTotal, { color: colors.ink }]}>
                {format_duration(shown_total(week))}
              </Text>
              {week.change !== null ? (
                <Text style={[s.meta, { color: colors.detail }]}>{change_label(week.change)}</Text>
              ) : null}
            </>
          ) : (
            <>
              <Text style={[s.weekEmpty, { color: colors.ink }]}>No activity</Text>
              <Text style={[s.meta, { color: colors.detail }]}>
                Your reading and listening time will show here once you start.
              </Text>
            </>
          )}
        </View>
        {/* The day strip stays, empty, so the card looks the same before there's any activity. */}
        {week.days.length ? (
          <View style={s.days} importantForAccessibility="no-hide-descendants">
            {week.days.map((day, index) => (
              <View key={index} style={s.day}>
                <View style={s.dayBarArea}>
                  <View
                    style={[
                      s.dayBar,
                      {
                        height: day.total ? Math.max(4, (day.total / peak) * 40) : 4,
                        backgroundColor: day.total ? colors.strong : colors.border,
                      },
                    ]}
                  />
                </View>
                <Text
                  style={[
                    s.dayLabel,
                    {
                      color: day.isToday ? colors.ink : colors.detail,
                      fontWeight: day.isToday ? "800" : "600",
                    },
                  ]}
                >
                  {day.label}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
      {week.total ? (
        <View style={s.split} importantForAccessibility="no-hide-descendants">
          {/* Reading in the accent, listening in a lighter step of it, so both read as time spent. */}
          <View style={[s.track, s.splitTrack, { backgroundColor: colors.art }]}>
            <View
              style={[s.fill, { width: `${(1 - listeningShare) * 100}%`, backgroundColor: colors.strong }]}
            />
          </View>
          <View style={s.splitLabels}>
            <Text style={[s.meta, { color: colors.detail }]}>Reading {format_duration(week.reading)}</Text>
            <Text style={[s.meta, { color: colors.detail }]}>
              Listening {format_duration(week.listening)}
            </Text>
          </View>
        </View>
      ) : null}
      <View style={[s.weekFooter, { borderTopColor: colors.border }]}>
        <Ionicons name="trending-up-outline" size={17} color={colors.detail} accessible={false} />
        <Text style={[s.weekFooterText, { color: colors.detail }]}>
          {insight || "Small moments create lasting progress."}
        </Text>
      </View>
    </Pressable>
  );
}

// ---------- Recent documents ----------

/** Recently opened documents as a short horizontal shelf. The Documents tab has the full library. */
export function RecentShelf({
  documents,
  onOpen,
  onMore,
  targetRef,
  optionsTargetRef,
}: {
  documents: VoticDocument[];
  onOpen: (
    document: VoticDocument,
    source: React.RefObject<View | null>,
    heading: { text: string; node: Text | null },
  ) => void;
  onMore: (document: VoticDocument) => void;
  targetRef?: Target;
  optionsTargetRef?: Target;
}) {
  const { theme } = useVoticTheme();
  if (!documents.length)
    return (
      <View style={s.section}>
        <SectionHeader title="Recent files" />
        <EmptyPanel
          icon="time-outline"
          title="Your shelf starts here"
          message="Everything you open lines up here, so you can jump back in anytime."
          color={widget_palette(theme.isDark, "chapter")}
        />
      </View>
    );
  return (
    <View ref={targetRef} collapsable={false} style={s.section}>
      <SectionHeader
        title="Recent files"
        actionLabel="See all documents"
        onAction={() => router.push("/documents")}
      />
      <Shelf>
        {documents.map((document, index) => (
          <RecentCard
            key={document.id}
            document={document}
            onOpen={(source, heading) => onOpen(document, source, heading)}
            onMore={() => onMore(document)}
            moreRef={index === 0 ? optionsTargetRef : undefined}
          />
        ))}
      </Shelf>
    </View>
  );
}

function RecentCard({
  document,
  onOpen,
  onMore,
  moreRef,
}: {
  document: VoticDocument;
  onOpen: (source: React.RefObject<View | null>, heading: { text: string; node: Text | null }) => void;
  onMore: () => void;
  moreRef?: Target;
}) {
  const { theme } = useVoticTheme();
  const { fontScale } = useWindowDimensions();
  const ref = useRef<View>(null);
  const titleRef = useRef<Text>(null);
  const title = readable_title(document.title);
  const percent = Math.round(document.progress * 100);
  return (
    <View
      ref={ref}
      collapsable={false}
      testID="home-recent-card"
      style={[
        s.recent,
        {
          width: Math.min(320, 200 * Math.max(1, fontScale)),
          backgroundColor: "transparent",
        },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open ${title}`}
        accessibilityHint={`${document_type_label(document)}. ${progress_label(document)}`}
        onPress={() => onOpen(ref, { text: title, node: titleRef.current })}
        style={({ pressed }) => [s.recentMain, { opacity: pressed ? 0.7 : 1 }]}
      >
        <View style={s.recentCover}>
          <HomeDocumentArtwork document={document} />
        </View>
        <View style={s.recentCopy}>
          <Text
            ref={titleRef}
            numberOfLines={fontScale > 1.2 ? undefined : 2}
            style={[s.recentTitle, { color: theme.text }]}
          >
            {title}
          </Text>
          {document.progress >= 1 ? (
            <Text style={[s.meta, { color: theme.mutedText }]}>Finished</Text>
          ) : document.progress > 0 ? (
            <View style={s.recentProgress}>
              <View style={[s.track, s.grow, { backgroundColor: theme.border }]}>
                <View
                  style={[s.fill, { width: `${Math.max(3, percent)}%`, backgroundColor: theme.accent }]}
                />
              </View>
              <Text style={[s.meta, { color: theme.mutedText }]}>{percent}%</Text>
            </View>
          ) : (
            <Text style={[s.meta, { color: theme.mutedText }]}>Not started</Text>
          )}
        </View>
      </Pressable>
      <Pressable
        ref={moreRef}
        accessibilityRole="button"
        accessibilityLabel={`More options for ${title}`}
        accessibilityHint="Shows document actions"
        onPress={onMore}
        hitSlop={4}
        style={s.recentMore}
      >
        <View style={[s.moreBadge, { backgroundColor: theme.surface }]}>
          <Ionicons name="ellipsis-horizontal" size={19} color={theme.text} />
        </View>
      </Pressable>
    </View>
  );
}

// ---------- Notes ----------

/**
 * Notes worth coming back to: pinned ones first, then the newest. Each opens its document at the exact spot.
 * Not shown until there's at least one note.
 */
export function NotesShelf({ notes, onOpen }: { notes: NoteItem[]; onOpen: (item: NoteItem) => void }) {
  const { theme } = useVoticTheme();
  const colors = widget_palette(theme.isDark, "notes");
  const { fontScale } = useWindowDimensions();
  const notesTarget = useWalkthroughTarget("home.notes");
  return (
    <View ref={notes.length ? notesTarget : undefined} collapsable={false} style={s.section}>
      <SectionHeader
        title="Recent notes"
        actionLabel={notes.length ? "See all notes" : undefined}
        onAction={() => router.push("/notes")}
      />
      {!notes.length ? (
        <EmptyPanel
          icon="create-outline"
          title="No notes"
          message="Save a passage while you read and it lands here, ready to revisit."
          color={colors}
        />
      ) : null}
      <Shelf>
        {notes.map((item) => {
          const { passage, document } = item;
          // Lead with what the person wrote (a title, then the note); the saved passage fills in below it.
          const [heading] = [passage.title, passage.note, passage.text]
            .map((part) => part?.trim())
            .filter((part): part is string => Boolean(part));
          const source = readable_title(document.title);
          return (
            <Pressable
              key={document.id + passage.id}
              testID="home-note-card"
              accessibilityRole="button"
              accessibilityLabel={`${passage.pinned ? "Pinned note. " : ""}${heading}. From ${source}, ${relative_day(passage.updatedAt)}.`}
              accessibilityHint={
                document.notebookKind ? "Opens this note" : "Opens the document at this passage"
              }
              onPress={() => onOpen(item)}
              style={({ pressed }) => [
                s.note,
                {
                  width: Math.min(320, 232 * Math.max(1, fontScale)),
                  opacity: pressed ? 0.75 : 1,
                },
              ]}
            >
              <NotePreview document={document} passage={passage} />
              <Text
                numberOfLines={fontScale > 1.2 ? undefined : 1}
                style={[s.noteSource, { color: theme.mutedText }]}
              >
                {source} · {relative_day(passage.updatedAt)}
              </Text>
            </Pressable>
          );
        })}
      </Shelf>
    </View>
  );
}

/** A horizontal row that runs to the screen edges, so the next card peeks in and shows there's more. */
function Shelf({ children }: { children: ReactNode }) {
  return (
    <ScrollView
      testID="home-horizontal-shelf"
      horizontal
      showsHorizontalScrollIndicator={false}
      style={s.shelf}
      contentContainerStyle={s.shelfContent}
    >
      {children}
    </ScrollView>
  );
}

const SCREEN_GUTTER = 20;

const s = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  section: { gap: spacing.xs },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionTitle: { ...typography.sectionTitle, fontSize: 18 },
  seeAll: { minHeight: controlSizes.minimumTouch, justifyContent: "center" },
  seeAllText: { fontSize: 15, fontWeight: "800" },
  eyebrow: { ...typography.eyebrow },
  meta: { fontSize: 13, lineHeight: 18 },
  track: { height: 5, borderRadius: 3, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 3 },

  week: { overflow: "hidden", borderWidth: 1, borderRadius: radii.lg, padding: spacing.lg, gap: spacing.md },
  weekHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    flexWrap: "wrap",
  },
  weekIdentity: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  widgetIcon: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  noteMark: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.xs },
  noteRule: { height: 2, flex: 1, borderRadius: 1 },
  moreBadge: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  weekLink: { flexDirection: "row", alignItems: "center", gap: 4 },
  weekLinkText: { fontSize: 14, fontWeight: "800" },
  weekTop: { flexWrap: "wrap", flexDirection: "row", alignItems: "flex-end", gap: spacing.lg },
  weekTotal: { ...editorial, fontSize: 34, lineHeight: 41, marginTop: 2 },
  weekEmpty: { ...editorial, fontSize: 23, lineHeight: 30, marginTop: spacing.xs },
  days: { flexDirection: "row", gap: 5 },
  day: { alignItems: "center", gap: 4 },
  dayBarArea: { height: 40, justifyContent: "flex-end" },
  dayBar: { width: 8, borderRadius: 4, opacity: 0.92 },
  dayLabel: { fontSize: 11 },
  split: { gap: spacing.xs },
  splitTrack: { height: 6 },
  splitLabels: { flexDirection: "row", justifyContent: "space-between", flexWrap: "wrap", gap: spacing.sm },
  weekFooter: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.md,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  weekFooterText: { fontSize: 13, lineHeight: 19, flex: 1 },
  insight: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "500",
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.md,
  },

  shelf: { marginHorizontal: -SCREEN_GUTTER },
  shelfContent: { paddingHorizontal: SCREEN_GUTTER, paddingVertical: spacing.sm, gap: spacing.md },
  recent: { width: 200 },
  recentMain: { gap: spacing.xs },
  recentCover: {
    height: 218,
    overflow: "hidden",
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  recentCopy: { paddingTop: 4, paddingRight: 36, gap: 4 },
  recentTitle: { fontSize: 14, lineHeight: 19, fontWeight: "700", minHeight: 38 },
  recentProgress: { flexDirection: "row", alignItems: "center", gap: spacing.sm, minHeight: 18 },
  recentMore: {
    position: "absolute",
    top: 218,
    right: -8,
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },

  note: { width: 232, gap: spacing.sm },
  noteTop: { flexDirection: "row", gap: 6, alignItems: "baseline" },
  noteHeading: { flex: 1, fontSize: 15, lineHeight: 20, fontWeight: "700" },
  noteBody: { fontSize: 14, lineHeight: 19 },
  noteSource: { fontSize: 12, marginTop: "auto", paddingTop: spacing.xs },

  emptyContinue: {
    overflow: "hidden",
    borderWidth: 1,
    borderRadius: 24,
    padding: spacing.xl,
    gap: spacing.lg,
  },
  emptyContinueTop: { flexDirection: "row", gap: spacing.lg, alignItems: "flex-start" },
  emptyContinueTitle: { fontSize: 20, lineHeight: 26, fontWeight: "800", letterSpacing: -0.2 },
  emptyCover: {
    width: 76,
    height: 100,
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: radii.sm,
    alignItems: "center",
    justifyContent: "center",
  },

  emptyPanel: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: radii.lg,
    padding: spacing.lg,
  },
  emptyPanelTitle: { fontSize: 16, lineHeight: 22, fontWeight: "700" },
  emptyAdd: {
    minHeight: 50,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  emptyAddText: { fontSize: 16, fontWeight: "800" },
  emptyMessage: { fontSize: 14, lineHeight: 20, marginTop: 2 },
});
