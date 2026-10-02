import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { ReactNode, useRef } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { formatDuration, spokenDuration } from "../activity/activityModel";
import { useActivity } from "../activity/ActivityProvider";
import { DocumentCover } from "../components/DocumentCover";
import { VoticLogo } from "../components/VoticLogo";
import { controlSizes, radii, spacing, typography } from "../design/tokens";
import { positionLabel, progressLabel, readableTitle } from "../documents/documentDisplay";
import { useDocumentLibrary } from "../documents/DocumentLibraryProvider";
import { VoticDocument } from "../documents/types";
import { askSuggestions } from "../personalization/suggestions";
import { usePersonalization } from "../personalization/usePersonalization";
import { useVoticTheme } from "../theme/ThemeProvider";
import { useWalkthroughTarget } from "../walkthrough/WalkthroughProvider";
import {
  NoteItem,
  ResumeMode,
  changeLabel,
  homeInsight,
  lastSession,
  relativeDay,
  resumeModeFor,
  weekActivity,
} from "./homeModel";

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

// ---------- Continue ----------

/**
 * The one thing Home is for: picking up where you left off. The way the document was last used (listening or
 * reading) comes first; the other way is right beside it. The cover and title open it the same way.
 */
export function ContinueWidget({
  document,
  onOpen,
  targetRef,
}: {
  document: VoticDocument;
  onOpen: (source: React.RefObject<View | null>, mode: ResumeMode) => void;
  targetRef?: Target;
}) {
  const { theme } = useVoticTheme();
  const { log, hydrated } = useActivity();
  const cardRef = useRef<View>(null);
  const listenRef = useRef<View>(null);
  const readRef = useRef<View>(null);
  const title = readableTitle(document.title);
  const percent = Math.round(document.progress * 100);
  const started = document.progress > 0;
  const mode = hydrated ? resumeModeFor(log, document.id) : "read";
  const last = hydrated ? lastSession(log, document.id) : null;
  // The card already says "Continue", so the buttons stay short; screen readers hear the full action.
  const listenLabel = started ? "Resume listening" : "Listen";
  const readLabel = started ? "Resume reading" : "Read";
  const lastLine = last ? `${last.mode === "listen" ? "Listened" : "Read"} ${whenPhrase(last.at)}` : null;

  const listen = (
    <ResumeButton
      key="listen"
      sourceRef={listenRef}
      primary={mode === "listen"}
      icon="play"
      label="Listen"
      accessibilityLabel={`${listenLabel} to ${title}`}
      accessibilityHint="Opens the Reader and plays from where you left off"
      onPress={() => onOpen(listenRef, "listen")}
    />
  );
  const read = (
    <ResumeButton
      key="read"
      sourceRef={readRef}
      primary={mode === "read"}
      icon="book-outline"
      label="Read"
      accessibilityLabel={`${readLabel} ${title}`}
      accessibilityHint="Opens the document for reading, without audio controls"
      onPress={() => onOpen(readRef, "read")}
    />
  );
  return (
    <View
      ref={(node) => {
        cardRef.current = node;
        targetRef?.(node);
      }}
      collapsable={false}
      style={[s.continue, { backgroundColor: theme.sentenceHighlight, borderColor: theme.border }]}
    >
      {/* Tapping the document itself resumes the usual way. Screen readers use the two buttons below. */}
      <Pressable
        accessible={false}
        onPress={() => onOpen(cardRef, mode)}
        style={({ pressed }) => [s.continueTop, { opacity: pressed ? 0.75 : 1 }]}
      >
        <DocumentCover document={document} size="lg" />
        <View style={s.grow}>
          <Text numberOfLines={3} style={[s.continueTitle, { color: theme.text }]}>
            {title}
          </Text>
          <Text style={[s.meta, { color: theme.mutedText }]}>
            {lastLine ? `${positionLabel(document)} · ${lastLine}` : positionLabel(document)}
          </Text>
          {started ? (
            <View
              accessible
              accessibilityRole="progressbar"
              accessibilityLabel={`${title} progress`}
              accessibilityValue={{ min: 0, max: 100, now: percent }}
              style={[s.track, s.continueTrack, { backgroundColor: theme.border }]}
            >
              <View style={[s.fill, { backgroundColor: theme.accent, width: `${Math.max(2, percent)}%` }]} />
            </View>
          ) : null}
          <Text style={[s.meta, { color: theme.mutedText }]}>{progressLabel(document)}</Text>
        </View>
      </Pressable>
      <View style={s.continueActions}>{mode === "listen" ? [listen, read] : [read, listen]}</View>
    </View>
  );
}

/** "today", "yesterday", "3 days ago", or "on Sep 27". */
function whenPhrase(time: number) {
  const day = relativeDay(time);
  if (day === "Today" || day === "Yesterday") return day.toLowerCase();
  return day.endsWith("ago") ? day : `on ${day}`;
}

function ResumeButton({
  sourceRef,
  primary,
  icon,
  label,
  accessibilityLabel,
  accessibilityHint,
  onPress,
}: {
  sourceRef: React.RefObject<View | null>;
  primary: boolean;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  accessibilityLabel: string;
  accessibilityHint: string;
  onPress: () => void;
}) {
  const { theme } = useVoticTheme();
  return (
    <View ref={sourceRef} collapsable={false} style={s.half}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
        onPress={onPress}
        style={({ pressed }) => [
          s.resume,
          primary
            ? { backgroundColor: theme.accent, opacity: pressed ? 0.88 : 1 }
            : {
                borderWidth: 1,
                borderColor: theme.border,
                backgroundColor: pressed ? theme.surfaceMuted : theme.surface,
              },
        ]}
      >
        <Ionicons name={icon} size={19} color={primary ? theme.onAccent : theme.text} />
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.75}
          style={[s.resumeText, { color: primary ? theme.onAccent : theme.text }]}
        >
          {label}
        </Text>
      </Pressable>
    </View>
  );
}

// ---------- Ask Votic ----------

const DOCUMENT_QUESTIONS = new Set([
  "Summarize this document",
  "Explain this section",
  "Explain this section simply",
  "Find key points",
  "Help me understand this passage",
  "Quiz me on this document",
  "Find action items",
  "Highlight key decisions",
  "Identify key findings",
  "Explain the evidence",
  "Find information",
]);

/**
 * A compact way into Ask Votic about the document on Home. Two suggestions come from the person's
 * personalization answers; a suggestion fills in the question so it can be edited before sending.
 */
export function AskWidget({ document }: { document: VoticDocument }) {
  const { theme } = useVoticTheme();
  const { openDocument } = useDocumentLibrary();
  const { answers, purpose } = usePersonalization();
  const title = readableTitle(document.title);
  const suggestions = askSuggestions(answers, purpose)
    .filter((item) => DOCUMENT_QUESTIONS.has(item))
    .slice(0, 2);
  function ask(question?: string) {
    openDocument(document.id);
    router.push(question ? { pathname: "/assistant", params: { initialQuestion: question } } : "/assistant");
  }
  return (
    <View style={[s.ask, { borderColor: theme.border, backgroundColor: theme.surface }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Ask Votic about ${title}`}
        onPress={() => ask()}
        style={({ pressed }) => [s.askRow, { opacity: pressed ? 0.7 : 1 }]}
      >
        <VoticLogo compact markOnly />
        <View style={s.grow}>
          <Text style={[s.askTitle, { color: theme.text }]}>Ask Votic</Text>
          <Text numberOfLines={1} style={[s.meta, { color: theme.mutedText }]}>
            About {title}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={theme.mutedText} />
      </Pressable>
      {suggestions.length ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={s.chipRow}
          contentContainerStyle={s.chips}
        >
          {suggestions.map((question) => (
            <Pressable
              key={question}
              accessibilityRole="button"
              accessibilityLabel={`Ask Votic: ${question}`}
              onPress={() => ask(question)}
              style={({ pressed }) => [
                s.chip,
                {
                  borderColor: theme.border,
                  backgroundColor: pressed ? theme.surfaceMuted : theme.background,
                },
              ]}
            >
              <Text numberOfLines={1} style={[s.chipText, { color: theme.text }]}>
                {question}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}

// ---------- This week ----------

/**
 * This week at a glance: total time, how it splits between reading and listening, a small day-by-day
 * strip, and one factual note when there's enough activity. The whole card opens Statistics.
 */
export function WeekWidget() {
  const { theme } = useVoticTheme();
  const { log, hydrated } = useActivity();
  const { documents } = useDocumentLibrary();
  const weekTarget = useWalkthroughTarget("home.week");
  // Until the log has loaded, nothing is shown rather than a misleading "0 min".
  if (!hydrated) return null;
  const week = weekActivity(log);
  const insight = homeInsight(log, documents);
  const peak = Math.max(...week.days.map((day) => day.total), 1);
  const listeningShare = week.total ? week.listening / week.total : 0;
  const spoken = week.total
    ? [
        `This week: ${spokenDuration(week.total)}`,
        `reading ${spokenDuration(week.reading)}, listening ${spokenDuration(week.listening)}`,
        week.change !== null ? changeLabel(week.change) : null,
        insight,
        "Open Statistics.",
      ]
        .filter(Boolean)
        .join(". ")
    : "This week: no reading or listening yet. Open Statistics.";
  return (
    <Pressable
      ref={weekTarget}
      accessibilityRole="button"
      accessibilityLabel={spoken}
      onPress={() => router.push("/statistics")}
      style={({ pressed }) => [
        s.week,
        { borderColor: theme.border, backgroundColor: pressed ? theme.surfaceMuted : theme.surface },
      ]}
    >
      {/* Says where the card leads, since Statistics no longer has its own row on Home. */}
      <View style={s.weekHeader}>
        <Text style={[s.eyebrow, { color: theme.mutedText }]}>THIS WEEK</Text>
        <View style={s.weekLink}>
          <Ionicons name="stats-chart" size={14} color={theme.accentText} />
          <Text style={[s.weekLinkText, { color: theme.accentText }]}>Statistics</Text>
          <Ionicons name="chevron-forward" size={15} color={theme.accentText} />
        </View>
      </View>
      <View style={s.weekTop}>
        <View style={s.grow}>
          {week.total ? (
            <>
              <Text style={[s.weekTotal, { color: theme.text }]}>{formatDuration(week.total)}</Text>
              {week.change !== null ? (
                <Text style={[s.meta, { color: theme.mutedText }]}>{changeLabel(week.change)}</Text>
              ) : null}
            </>
          ) : (
            <Text style={[s.weekEmpty, { color: theme.text }]}>Read or listen to see your week here</Text>
          )}
        </View>
        {week.total ? (
          <View style={s.days} importantForAccessibility="no-hide-descendants">
            {week.days.map((day, index) => (
              <View key={index} style={s.day}>
                <View style={s.dayBarArea}>
                  <View
                    style={[
                      s.dayBar,
                      {
                        height: day.total ? Math.max(4, (day.total / peak) * 40) : 4,
                        backgroundColor: day.total ? theme.accent : theme.border,
                      },
                    ]}
                  />
                </View>
                <Text
                  style={[
                    s.dayLabel,
                    {
                      color: day.isToday ? theme.text : theme.mutedText,
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
          <View style={[s.track, s.splitTrack, { backgroundColor: theme.wordHighlight }]}>
            <View
              style={[s.fill, { width: `${(1 - listeningShare) * 100}%`, backgroundColor: theme.accent }]}
            />
          </View>
          <View style={s.splitLabels}>
            <Text style={[s.meta, { color: theme.mutedText }]}>Reading {formatDuration(week.reading)}</Text>
            <Text style={[s.meta, { color: theme.mutedText }]}>
              Listening {formatDuration(week.listening)}
            </Text>
          </View>
        </View>
      ) : null}
      {insight ? (
        <Text style={[s.insight, { color: theme.text, borderTopColor: theme.border }]}>{insight}</Text>
      ) : null}
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
  onOpen: (document: VoticDocument, source: React.RefObject<View | null>) => void;
  onMore: (document: VoticDocument) => void;
  targetRef?: Target;
  optionsTargetRef?: Target;
}) {
  return (
    <View ref={targetRef} collapsable={false} style={s.section}>
      <SectionHeader
        title="Recent"
        actionLabel="See all documents"
        onAction={() => router.push("/documents")}
      />
      <Shelf>
        {documents.map((document, index) => (
          <RecentCard
            key={document.id}
            document={document}
            onOpen={(source) => onOpen(document, source)}
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
  onOpen: (source: React.RefObject<View | null>) => void;
  onMore: () => void;
  moreRef?: Target;
}) {
  const { theme } = useVoticTheme();
  const ref = useRef<View>(null);
  const title = readableTitle(document.title);
  const percent = Math.round(document.progress * 100);
  return (
    <View ref={ref} collapsable={false} style={s.recent}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open ${title}`}
        accessibilityHint={progressLabel(document)}
        onPress={() => onOpen(ref)}
        style={({ pressed }) => [s.recentMain, { opacity: pressed ? 0.7 : 1 }]}
      >
        <View style={[s.recentCover, { backgroundColor: theme.surfaceMuted }]}>
          <DocumentCover document={document} size="lg" />
        </View>
        <Text numberOfLines={2} style={[s.recentTitle, { color: theme.text }]}>
          {title}
        </Text>
        {document.progress >= 1 ? (
          <Text style={[s.meta, { color: theme.mutedText }]}>Finished</Text>
        ) : document.progress > 0 ? (
          <View style={s.recentProgress}>
            <View style={[s.track, s.grow, { backgroundColor: theme.border }]}>
              <View style={[s.fill, { width: `${Math.max(3, percent)}%`, backgroundColor: theme.accent }]} />
            </View>
            <Text style={[s.meta, { color: theme.mutedText }]}>{percent}%</Text>
          </View>
        ) : (
          <Text style={[s.meta, { color: theme.mutedText }]}>Not started</Text>
        )}
      </Pressable>
      <Pressable
        ref={moreRef}
        accessibilityRole="button"
        accessibilityLabel={`More options for ${title}`}
        onPress={onMore}
        hitSlop={4}
        style={s.recentMore}
      >
        <Ionicons name="ellipsis-horizontal" size={19} color={theme.mutedText} />
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
  if (!notes.length) return null;
  return (
    <View style={s.section}>
      <SectionHeader
        title="From your notes"
        actionLabel="See all notes"
        onAction={() => router.push("/notes")}
      />
      <Shelf>
        {notes.map((item) => {
          const { passage, document } = item;
          // Lead with what the person wrote (a title, then the note); the saved passage fills in below it.
          const [heading, body = ""] = [passage.title, passage.note, passage.text]
            .map((part) => part?.trim())
            .filter((part): part is string => Boolean(part));
          const source = readableTitle(document.title);
          return (
            <Pressable
              key={document.id + passage.id}
              accessibilityRole="button"
              accessibilityLabel={`${passage.pinned ? "Pinned note. " : ""}${heading}. From ${source}, ${relativeDay(passage.updatedAt)}.`}
              accessibilityHint="Opens the document at this passage"
              onPress={() => onOpen(item)}
              style={({ pressed }) => [
                s.note,
                { borderColor: theme.border, backgroundColor: pressed ? theme.surfaceMuted : theme.surface },
              ]}
            >
              <View style={s.noteTop}>
                {passage.pinned ? <Ionicons name="pin" size={14} color={theme.accentText} /> : null}
                <Text numberOfLines={2} style={[s.noteHeading, { color: theme.text }]}>
                  {heading}
                </Text>
              </View>
              {body ? (
                <Text numberOfLines={3} style={[s.noteBody, { color: theme.mutedText }]}>
                  {body}
                </Text>
              ) : null}
              <Text numberOfLines={1} style={[s.noteSource, { color: theme.mutedText }]}>
                {source} · {relativeDay(passage.updatedAt)}
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

  continue: { borderWidth: 1, borderRadius: radii.lg, padding: spacing.lg, gap: spacing.lg },
  continueTop: { flexDirection: "row", gap: spacing.lg, alignItems: "flex-start" },
  continueTitle: { fontSize: 20, lineHeight: 26, fontWeight: "800", letterSpacing: -0.2, marginBottom: 2 },
  continueTrack: { marginVertical: spacing.xs },
  continueActions: { flexDirection: "row", gap: spacing.sm },
  half: { flex: 1, minWidth: 0 },
  resume: {
    minHeight: 50,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  resumeText: { fontSize: 16, fontWeight: "800", flexShrink: 1 },

  ask: {
    borderWidth: 1,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  askRow: {
    minHeight: controlSizes.minimumTouch,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  askTitle: { fontSize: 16, fontWeight: "800" },
  chipRow: { marginHorizontal: -spacing.lg },
  chips: { flexDirection: "row", gap: spacing.sm, paddingHorizontal: spacing.lg },
  chip: {
    minHeight: 40,
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    justifyContent: "center",
  },
  chipText: { fontSize: 14, fontWeight: "600" },

  week: { borderWidth: 1, borderRadius: radii.lg, padding: spacing.lg, gap: spacing.md },
  weekHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  weekLink: { flexDirection: "row", alignItems: "center", gap: 4 },
  weekLinkText: { fontSize: 14, fontWeight: "800" },
  weekTop: { flexDirection: "row", alignItems: "flex-end", gap: spacing.lg },
  weekTotal: { fontSize: 28, lineHeight: 34, fontWeight: "800", letterSpacing: -0.5, marginTop: 2 },
  weekEmpty: { fontSize: 16, lineHeight: 22, fontWeight: "700", marginTop: spacing.xs },
  days: { flexDirection: "row", gap: 5 },
  day: { alignItems: "center", gap: 4 },
  dayBarArea: { height: 40, justifyContent: "flex-end" },
  dayBar: { width: 8, borderRadius: 4 },
  dayLabel: { fontSize: 11 },
  split: { gap: spacing.xs },
  splitTrack: { height: 6 },
  splitLabels: { flexDirection: "row", justifyContent: "space-between", flexWrap: "wrap", gap: spacing.sm },
  insight: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "500",
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.md,
  },

  shelf: { marginHorizontal: -SCREEN_GUTTER },
  shelfContent: { paddingHorizontal: SCREEN_GUTTER, gap: spacing.md },
  recent: { width: 132 },
  recentMain: { gap: spacing.xs },
  recentCover: {
    height: 132,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  recentTitle: { fontSize: 14, lineHeight: 19, fontWeight: "700", minHeight: 38 },
  recentProgress: { flexDirection: "row", alignItems: "center", gap: spacing.sm, minHeight: 18 },
  recentMore: {
    position: "absolute",
    top: 2,
    right: 2,
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },

  note: {
    width: 232,
    minHeight: 136,
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: spacing.xs,
  },
  noteTop: { flexDirection: "row", gap: 6, alignItems: "baseline" },
  noteHeading: { flex: 1, fontSize: 15, lineHeight: 20, fontWeight: "700" },
  noteBody: { fontSize: 14, lineHeight: 19 },
  noteSource: { fontSize: 12, marginTop: "auto", paddingTop: spacing.xs },
});
