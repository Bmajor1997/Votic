import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { ComponentProps, ReactNode, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Switch, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ACTIVE_DAY_MS,
  INSIGHT_MIN_DAYS,
  INSIGHT_MIN_MS,
  Period,
  PeriodKind,
  askSummary,
  chartSeries,
  documentRanking,
  formatDuration,
  hasEarlierPeriod,
  insights,
  monthCalendar,
  periodFor,
  spokenDuration,
  streaks,
  summarize,
} from "../src/activity/activityModel";
import { useActivity } from "../src/activity/ActivityProvider";
import { ASK_CATEGORY_LABELS } from "../src/activity/askCategories";
import { TimeChart, seriesColors } from "../src/activity/TimeChart";
import { DocumentCover } from "../src/components/DocumentCover";
import { controlSizes, radii, spacing, typography } from "../src/design/tokens";
import { progressLabel, readableTitle } from "../src/documents/documentDisplay";
import { useDocumentLibrary } from "../src/documents/DocumentLibraryProvider";
import { useVoticTheme } from "../src/theme/ThemeProvider";

type Section = "ask" | "activity" | "documents" | "insights";
type IconName = ComponentProps<typeof Ionicons>["name"];
const SECTION_TITLES: Record<Section, string> = {
  ask: "Ask Votic",
  activity: "Activity",
  documents: "Documents",
  insights: "Personal insights",
};
const KINDS: { value: PeriodKind; label: string }[] = [
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "all", label: "All time" },
];

function longDate(ms: number) {
  return new Date(ms).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
}

export default function Statistics() {
  const { theme } = useVoticTheme();
  const params = useLocalSearchParams<{ section?: Section; kind?: PeriodKind; offset?: string }>();
  const section = params.section && params.section in SECTION_TITLES ? params.section : null;
  const [kind, setKind] = useState<PeriodKind>(
    params.kind && KINDS.some((item) => item.value === params.kind) ? params.kind : "week",
  );
  const [offset, setOffset] = useState(Number(params.offset) || 0);
  const { log, sampleData, setSampleData } = useActivity();
  const { documents } = useDocumentLibrary();
  const now = new Date();
  const period = periodFor(kind, offset, now, log.trackingStartedAt);
  const canGoBack = hasEarlierPeriod(period, log.trackingStartedAt);

  function openSection(next: Section) {
    router.push({ pathname: "/statistics", params: { section: next, kind, offset: String(offset) } });
  }

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={[s.safe, { backgroundColor: theme.background }]}>
      <View style={s.topBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => router.back()}
          style={({ pressed }) => [s.iconButton, { opacity: pressed ? 0.55 : 1 }]}
        >
          <Ionicons name="chevron-back" size={26} color={theme.text} />
        </Pressable>
        <Text accessibilityRole="header" numberOfLines={2} style={[s.title, { color: theme.text }]}>
          {section ? SECTION_TITLES[section] : "Your Votic activity"}
        </Text>
      </View>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {!section ? (
          <Text style={[s.intro, { color: theme.mutedText }]}>
            Your reading, listening, and moments of discovery.
          </Text>
        ) : null}
        <View accessibilityRole="radiogroup" style={[s.segmented, { backgroundColor: theme.surfaceMuted }]}>
          {KINDS.map((item) => {
            const active = item.value === kind;
            return (
              <Pressable
                key={item.value}
                accessibilityRole="radio"
                accessibilityState={{ checked: active }}
                onPress={() => {
                  setKind(item.value);
                  setOffset(0);
                }}
                style={[s.segment, active && { backgroundColor: theme.surface, borderColor: theme.border }]}
              >
                <Text style={[s.segmentText, { color: active ? theme.text : theme.mutedText }]}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <View style={s.periodRow}>
          {kind !== "all" ? (
            <PeriodArrow
              icon="chevron-back"
              label={`Previous ${kind}`}
              disabled={!canGoBack}
              onPress={() => setOffset(offset + 1)}
            />
          ) : null}
          <Text accessibilityRole="header" style={[s.periodLabel, { color: theme.text }]}>
            {period.label}
          </Text>
          {kind !== "all" ? (
            <PeriodArrow
              icon="chevron-forward"
              label={`Next ${kind}`}
              disabled={offset === 0}
              onPress={() => setOffset(Math.max(0, offset - 1))}
            />
          ) : null}
        </View>
        {sampleData ? (
          <Notice
            icon="flask-outline"
            text="Showing sample data for development. Your real statistics are unchanged."
          />
        ) : log.trackingStartedAt > period.start.getTime() ? (
          <Notice
            icon="information-circle-outline"
            text={`Votic started measuring on ${longDate(log.trackingStartedAt)}. Earlier reading and listening isn't included.`}
          />
        ) : null}

        {section === "ask" ? <AskDetail period={period} /> : null}
        {section === "activity" ? <ActivityDetail period={period} /> : null}
        {section === "documents" ? <DocumentsDetail period={period} /> : null}
        {section === "insights" ? <InsightsDetail period={period} /> : null}
        {!section ? (
          <>
            <Overview period={period} />
            <Card title={kind === "all" ? "Your time, month by month" : "Your time, day by day"}>
              <TimeChart points={chartSeries(log, period, now)} title={`Time for ${period.label}`} />
            </Card>
            <InsightsPreview period={period} onOpen={() => openSection("insights")} />
            <Text accessibilityRole="header" style={[s.sectionTitle, { color: theme.text }]}>
              Explore your activity
            </Text>
            <AskPreview period={period} onOpen={() => openSection("ask")} />
            <ActivityPreview period={period} onOpen={() => openSection("activity")} />
            <DocumentsPreview period={period} onOpen={() => openSection("documents")} />
            <Text style={[s.footnote, { color: theme.mutedText }]}>
              Reading counts while the Reader is open and you&apos;re scrolling or using it, and pauses after
              two minutes without activity. Listening counts while narration plays. Time spent listening
              isn&apos;t also counted as reading. Statistics stay on this device.
            </Text>
            {__DEV__ ? (
              <View style={[s.devRow, { borderColor: theme.border }]}>
                <Text style={[s.devText, { color: theme.mutedText }]}>Development: show sample data</Text>
                <Switch
                  accessibilityLabel="Show sample data (development only)"
                  value={sampleData}
                  onValueChange={(on) => setSampleData(on ? documents.map((document) => document.id) : null)}
                />
              </View>
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Overview({ period }: { period: Period }) {
  const { theme } = useVoticTheme();
  const { log } = useActivity();
  const summary = summarize(log, period.start, period.end);
  const comparison = insights(log, period).comparison;
  const ask = askSummary(log, period.start, period.end);
  // Preserve the rounding rule: the visible total equals the two time tiles.
  const total = (Math.round(summary.reading / 60_000) + Math.round(summary.listening / 60_000)) * 60_000;
  return (
    <>
      <View style={[s.heroCard, theme.elevation, { backgroundColor: theme.hero, borderColor: theme.border }]}>
        <View style={s.heroHeading}>
          <Text style={[s.eyebrow, { color: theme.heroMuted }]}>TIME WITH YOUR DOCUMENTS</Text>
          <Ionicons accessible={false} name="book-outline" size={26} color={theme.heroText} />
        </View>
        <View accessible accessibilityLabel={`Total time, ${spokenDuration(summary.total)}`}>
          <Text style={[s.hero, { color: theme.heroText }]}>{formatDuration(total)}</Text>
          <Text style={[s.sub, { color: theme.heroMuted }]}>Reading and listening in this period</Text>
        </View>
        <View style={[s.heroNote, { borderTopColor: theme.border }]}>
          <Ionicons
            accessible={false}
            name={comparison ? "analytics-outline" : "leaf-outline"}
            size={18}
            color={theme.heroText}
          />
          <Text style={[s.heroNoteText, { color: theme.heroMuted }]}>
            {comparison
              ? `${Math.abs(Math.round(comparison.change * 100))}% ${comparison.change >= 0 ? "more" : "less"} time than ${comparison.previousLabel}`
              : summary.total
                ? "Every moment is a chance to explore at your own pace."
                : "Start with a document. Your activity will appear here."}
          </Text>
        </View>
      </View>
      <View style={s.metricGrid}>
        <MetricTile
          label="Reading"
          value={formatDuration(summary.reading)}
          spoken={spokenDuration(summary.reading)}
          icon="book-outline"
        />
        <MetricTile
          label="Listening"
          value={formatDuration(summary.listening)}
          spoken={spokenDuration(summary.listening)}
          icon="headset-outline"
          tinted
        />
        <MetricTile label="Active days" value={String(summary.activeDays)} icon="calendar-outline" tinted />
        <MetricTile
          label="Questions asked"
          value={String(ask.questions)}
          icon="chatbubble-ellipses-outline"
        />
      </View>
    </>
  );
}
function MetricTile({
  label,
  value,
  spoken,
  icon,
  tinted = false,
}: {
  label: string;
  value: string;
  spoken?: string;
  icon: IconName;
  tinted?: boolean;
}) {
  const { theme } = useVoticTheme();
  const { width, fontScale } = useWindowDimensions();
  const stacked = width < 360 || fontScale > 1.3;
  return (
    <View
      accessible
      accessibilityLabel={`${label}, ${spoken ?? value}`}
      style={[
        s.metricTile,
        {
          flexBasis: stacked ? "100%" : "46%",
          backgroundColor: tinted ? theme.brandTint : theme.surfaceMuted,
          borderColor: theme.border,
        },
      ]}
    >
      <Ionicons
        accessible={false}
        name={icon}
        size={24}
        color={label === "Questions asked" ? theme.aiStatusText : theme.accentText}
      />
      <Text style={[s.metricValue, { color: theme.text }]}>{value}</Text>
      <Text style={[s.metricLabel, { color: theme.mutedText }]}>{label}</Text>
    </View>
  );
}
function AskPreview({ period, onOpen }: { period: Period; onOpen: () => void }) {
  const { log } = useActivity();
  const ask = askSummary(log, period.start, period.end);
  return (
    <ExploreRow
      icon="sparkles-outline"
      title="Ask Votic"
      detail={
        ask.questions
          ? `${ask.questions} questions · ${ask.conversations} conversations`
          : "Explore the questions you ask about your documents."
      }
      onOpen={onOpen}
    />
  );
}
function ActivityPreview({ period, onOpen }: { period: Period; onOpen: () => void }) {
  const { log } = useActivity();
  const streak = streaks(log);
  const summary = summarize(log, period.start, period.end);
  return (
    <ExploreRow
      icon="calendar-outline"
      title="Activity"
      detail={`${summary.activeDays} active ${summary.activeDays === 1 ? "day" : "days"} in this period · Current streak: ${streak.current} ${streak.current === 1 ? "day" : "days"}`}
      onOpen={onOpen}
    />
  );
}
function DocumentsPreview({ period, onOpen }: { period: Period; onOpen: () => void }) {
  const { log } = useActivity();
  const { documents } = useDocumentLibrary();
  const top = documentRanking(log, period.start, period.end)
    .map((entry) => ({ entry, document: documents.find((document) => document.id === entry.documentId) }))
    .find((item) => item.document);
  return (
    <ExploreRow
      icon="documents-outline"
      title="Documents"
      detail={
        top?.document
          ? `Most read: ${readableTitle(top.document.title)} · ${formatDuration(top.entry.total)}`
          : "See the documents you spend time reading and listening to."
      }
      onOpen={onOpen}
    />
  );
}
function InsightsPreview({ period, onOpen }: { period: Period; onOpen: () => void }) {
  const { theme } = useVoticTheme();
  const { log } = useActivity();
  const result = insights(log, period);
  const observation =
    result.enough && result.mostActiveTime
      ? `You read and listen most ${result.mostActiveTime.id === "night" ? "at night" : `in the ${result.mostActiveTime.label.toLowerCase()}`}.`
      : `Your personal insights take shape after ${INSIGHT_MIN_MS / 60_000} minutes across ${INSIGHT_MIN_DAYS} different days in this period.`;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Personal insights details"
      accessibilityHint={`${observation} Opens your reading and listening insights`}
      onPress={onOpen}
      style={({ pressed }) => [
        s.insightCard,
        { backgroundColor: pressed ? theme.brandTint : theme.surfaceMuted, borderColor: theme.border },
      ]}
    >
      <View style={s.heroHeading}>
        <Text style={[s.eyebrow, { color: theme.accentText }]}>A LITTLE ABOUT YOUR RHYTHM</Text>
        <Ionicons accessible={false} name="bulb-outline" size={24} color={theme.accentText} />
      </View>
      <Text style={[s.insightObservation, { color: theme.text }]}>{observation}</Text>
      <View style={s.insightLink}>
        <Text style={[s.details, { color: theme.accentText }]}>Personal insights</Text>
        <Ionicons accessible={false} name="arrow-forward" size={20} color={theme.accentText} />
      </View>
    </Pressable>
  );
}
function ExploreRow({
  icon,
  title,
  detail,
  onOpen,
}: {
  icon: IconName;
  title: string;
  detail: string;
  onOpen: () => void;
}) {
  const { theme } = useVoticTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title} details`}
      accessibilityHint={`${detail} Opens detailed statistics for the selected period`}
      onPress={onOpen}
      style={({ pressed }) => [
        s.exploreRow,
        { backgroundColor: pressed ? theme.surfaceMuted : theme.surface, borderColor: theme.border },
      ]}
    >
      <View style={[s.exploreIcon, { backgroundColor: theme.brandTint }]}>
        <Ionicons accessible={false} name={icon} size={24} color={theme.accentText} />
      </View>
      <View style={s.grow}>
        <Text style={[s.cardTitle, { color: theme.text }]}>{title}</Text>
        <Text style={[s.exploreDetail, { color: theme.mutedText }]}>{detail}</Text>
      </View>
      <Ionicons accessible={false} name="chevron-forward" size={20} color={theme.mutedText} />
    </Pressable>
  );
}

function AskDetail({ period }: { period: Period }) {
  const { theme } = useVoticTheme();
  const { log } = useActivity();
  const ask = askSummary(log, period.start, period.end);
  const largest = Math.max(1, ...ask.categories.map((item) => item.count));
  return (
    <>
      <Card>
        <View style={s.stats}>
          <Stat label="Questions asked" value={String(ask.questions)} />
          <Stat label="Conversations started" value={String(ask.conversations)} />
        </View>
      </Card>
      <Card title="Question types">
        {ask.categories.length ? (
          ask.categories.map((item) => (
            <View
              key={item.category}
              accessible
              accessibilityLabel={`${ASK_CATEGORY_LABELS[item.category]}: ${item.count}`}
              style={s.barRow}
            >
              <View style={s.barLabelRow}>
                <Text style={[s.barLabel, { color: theme.text }]}>{ASK_CATEGORY_LABELS[item.category]}</Text>
                <Text style={[s.barValue, { color: theme.mutedText }]}>{item.count}</Text>
              </View>
              <View style={[s.barTrack, { backgroundColor: theme.surfaceMuted }]}>
                <View
                  style={[
                    s.barFill,
                    { width: `${(item.count / largest) * 100}%`, backgroundColor: theme.accent },
                  ]}
                />
              </View>
            </View>
          ))
        ) : (
          <EmptyLine text="No questions in this period yet." />
        )}
      </Card>
      <Card title="Suggestions you use most">
        {ask.recurringPrompts.length ? (
          ask.recurringPrompts.map((item) => (
            <View key={item.prompt} accessible style={[s.listRow, { borderBottomColor: theme.border }]}>
              <Text style={[s.listTitle, { color: theme.text }]}>{item.prompt}</Text>
              <Text style={[s.barValue, { color: theme.mutedText }]}>{item.count} times</Text>
            </View>
          ))
        ) : (
          <EmptyLine text="Suggestions you use at least twice in this period appear here." />
        )}
      </Card>
      <Text style={[s.footnote, { color: theme.mutedText }]}>
        A question is each message you send to Ask Votic; trying a failed question again isn&apos;t counted
        twice. A conversation starts with the first question after you open Ask Votic. Types come from simple
        word rules on this device (for example &ldquo;summarize&rdquo; or &ldquo;compare&rdquo;); questions
        that don&apos;t match are counted as Other questions. Your question text isn&apos;t stored for
        Statistics.
      </Text>
    </>
  );
}

function ActivityDetail({ period }: { period: Period }) {
  const { theme } = useVoticTheme();
  const { log } = useActivity();
  const streak = streaks(log);
  const summary = summarize(log, period.start, period.end);
  const [monthOffset, setMonthOffset] = useState(0);
  const now = new Date();
  const month = new Date(now.getFullYear(), now.getMonth() - monthOffset, 1);
  const calendar = monthCalendar(log, month);
  const trackingMonth = new Date(log.trackingStartedAt);
  const earliest =
    month.getFullYear() * 12 + month.getMonth() <=
    trackingMonth.getFullYear() * 12 + trackingMonth.getMonth();
  return (
    <>
      <Card>
        <View style={s.stats}>
          <Stat label="Active days" value={String(summary.activeDays)} />
          <Stat label="Current streak" value={`${streak.current} ${streak.current === 1 ? "day" : "days"}`} />
          <Stat label="Longest streak" value={`${streak.longest} ${streak.longest === 1 ? "day" : "days"}`} />
        </View>
      </Card>
      <Card>
        <View style={s.periodRow}>
          <PeriodArrow
            icon="chevron-back"
            label="Previous month"
            disabled={earliest}
            onPress={() => setMonthOffset(monthOffset + 1)}
          />
          <Text style={[s.periodLabel, { color: theme.text }]}>{calendar.label}</Text>
          <PeriodArrow
            icon="chevron-forward"
            label="Next month"
            disabled={monthOffset === 0}
            onPress={() => setMonthOffset(Math.max(0, monthOffset - 1))}
          />
        </View>
        <View style={s.weekHeader}>
          {["M", "T", "W", "T", "F", "S", "S"].map((day, index) => (
            <Text key={index} style={[s.weekday, { color: theme.mutedText }]}>
              {day}
            </Text>
          ))}
        </View>
        {calendar.weeks.map((week, row) => (
          <View key={row} style={s.weekRow}>
            {week.map((cell, column) =>
              cell ? (
                <View
                  key={cell.key}
                  accessible
                  accessibilityLabel={`${calendar.label.split(" ")[0]} ${cell.day}, ${cell.active ? "active" : "no activity"}`}
                  style={[
                    s.day,
                    cell.active
                      ? { backgroundColor: theme.accent }
                      : { borderColor: theme.border, borderWidth: 1 },
                  ]}
                >
                  <Text
                    style={[
                      s.dayText,
                      {
                        color: cell.active ? "#FFF" : theme.mutedText,
                        fontWeight: cell.active ? "800" : "500",
                      },
                    ]}
                  >
                    {cell.day}
                  </Text>
                </View>
              ) : (
                <View key={`blank-${column}`} style={s.dayBlank} />
              ),
            )}
          </View>
        ))}
        <View style={s.legendRow}>
          <View style={[s.legendSwatch, { backgroundColor: theme.accent }]} />
          <Text style={[s.sub, { color: theme.mutedText }]}>Active day (filled, bold date)</Text>
        </View>
      </Card>
      <Text style={[s.footnote, { color: theme.mutedText }]}>
        A day is active after at least {ACTIVE_DAY_MS / 60_000} minute of reading or listening, in your
        device&apos;s time zone. Opening the app doesn&apos;t count. Your current streak counts back from
        today, or from yesterday if you haven&apos;t read yet today.
      </Text>
    </>
  );
}

function DocumentsDetail({ period }: { period: Period }) {
  const { theme } = useVoticTheme();
  const { log } = useActivity();
  const { documents, openDocument } = useDocumentLibrary();
  const ranked = documentRanking(log, period.start, period.end)
    .map((entry) => ({ entry, document: documents.find((document) => document.id === entry.documentId) }))
    .filter(
      (item): item is { entry: (typeof item)["entry"]; document: NonNullable<(typeof item)["document"]> } =>
        Boolean(item.document),
    );
  const recent = [...ranked].sort((a, b) => b.entry.lastActiveAt - a.entry.lastActiveAt).slice(0, 5);
  function open(id: string) {
    openDocument(id);
    router.push("/reader");
  }
  const row = ({ entry, document }: (typeof ranked)[number], index?: number) => (
    <Pressable
      key={document.id + (index ?? "r")}
      accessibilityRole="button"
      accessibilityLabel={`${index !== undefined ? `${index + 1}. ` : ""}${readableTitle(document.title)}, ${spokenDuration(entry.total)}, ${progressLabel(document)}. Open.`}
      onPress={() => open(document.id)}
      style={({ pressed }) => [
        s.docRow,
        s.listRow,
        { borderBottomColor: theme.border, opacity: pressed ? 0.7 : 1 },
      ]}
    >
      {index !== undefined ? <Text style={[s.rank, { color: theme.mutedText }]}>{index + 1}</Text> : null}
      <DocumentCover document={document} size="sm" />
      <View style={s.grow}>
        <Text numberOfLines={2} style={[s.docTitle, { color: theme.text }]}>
          {readableTitle(document.title)}
        </Text>
        <Text style={[s.sub, { color: theme.mutedText }]}>
          {formatDuration(entry.total)} · {progressLabel(document)}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={theme.mutedText} />
    </Pressable>
  );
  return (
    <>
      <Card title="Most read">
        {ranked.length ? (
          ranked.slice(0, 5).map((item, index) => row(item, index))
        ) : (
          <EmptyLine text="No documents read in this period." />
        )}
      </Card>
      {recent.length ? <Card title="Recently active">{recent.map((item) => row(item))}</Card> : null}
      <Text style={[s.footnote, { color: theme.mutedText }]}>
        Most read ranks documents by reading and listening time in this period. Progress is your position in
        each document; reading part of it again doesn&apos;t count as finishing it again.
      </Text>
    </>
  );
}

function InsightsDetail({ period }: { period: Period }) {
  const { theme } = useVoticTheme();
  const { log } = useActivity();
  const result = insights(log, period);
  const colors = seriesColors(theme.isDark);
  if (!result.enough)
    return (
      <Card>
        <EmptyLine
          text={`Insights appear after at least ${INSIGHT_MIN_MS / 60_000} minutes of reading or listening on ${INSIGHT_MIN_DAYS} different days in this period. So far: ${formatDuration(result.summary.total)} on ${result.summary.activeDays} ${result.summary.activeDays === 1 ? "day" : "days"}.`}
        />
      </Card>
    );
  const listeningPercent = Math.round(result.listeningShare * 100);
  return (
    <>
      <Card title="Reading and listening">
        <View
          accessible
          accessibilityLabel={`Reading ${100 - listeningPercent} percent, listening ${listeningPercent} percent`}
          style={s.split}
        >
          {100 - listeningPercent > 0 ? (
            <View style={[s.splitPart, { flex: 100 - listeningPercent, backgroundColor: colors.reading }]} />
          ) : null}
          {listeningPercent > 0 ? (
            <View style={[s.splitPart, { flex: listeningPercent, backgroundColor: colors.listening }]} />
          ) : null}
        </View>
        <View style={s.stats}>
          <Stat label="Reading" value={`${100 - listeningPercent}%`} swatch={colors.reading} />
          <Stat label="Listening" value={`${listeningPercent}%`} swatch={colors.listening} />
        </View>
      </Card>
      <Card title="When you're most active">
        {result.mostActiveWeekday ? (
          <InsightLine label="Day of the week" value={result.mostActiveWeekday} />
        ) : null}
        {result.mostActiveTime ? (
          <InsightLine
            label="Time of day"
            value={`${result.mostActiveTime.label} (${result.mostActiveTime.range})`}
          />
        ) : null}
        {!result.mostActiveWeekday && period.kind === "week" ? (
          <Text style={[s.sub, { color: theme.mutedText }]}>
            Choose Month or All time to see your most active day.
          </Text>
        ) : null}
      </Card>
      {result.comparison ? (
        <Card title="Compared with before">
          <InsightLine
            label={`Versus ${result.comparison.previousLabel}`}
            value={`${Math.abs(Math.round(result.comparison.change * 100))}% ${result.comparison.change >= 0 ? "more" : "less"} time`}
          />
        </Card>
      ) : null}
      <Text style={[s.footnote, { color: theme.mutedText }]}>
        Based on {formatDuration(result.summary.total)} across {result.summary.activeDays} active days in this
        period. &ldquo;Most active&rdquo; means when you read or listen the most, not how productive that time
        was. Comparisons appear only when both periods have at least 10 minutes.
      </Text>
    </>
  );
}

function Card({ title, children }: { title?: string; children: ReactNode }) {
  const { theme } = useVoticTheme();
  return (
    <View style={[s.card, theme.elevation, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      {title ? (
        <Text accessibilityRole="header" style={[s.cardTitle, { color: theme.text }]}>
          {title}
        </Text>
      ) : null}
      {children}
    </View>
  );
}

function Stat({
  label,
  value,
  spoken,
  swatch,
  small = false,
}: {
  label: string;
  value: string;
  spoken?: string;
  swatch?: string;
  small?: boolean;
}) {
  const { theme } = useVoticTheme();
  return (
    <View accessible accessibilityLabel={`${label}, ${spoken ?? value}`} style={s.stat}>
      <View style={s.statLabelRow}>
        {swatch ? <View style={[s.legendSwatch, { backgroundColor: swatch }]} /> : null}
        <Text style={[s.label, { color: theme.mutedText }]}>{label}</Text>
      </View>
      <Text style={[small ? s.statValueSmall : s.statValue, { color: theme.text }]}>{value}</Text>
    </View>
  );
}

function InsightLine({ label, value }: { label: string; value: string }) {
  const { theme } = useVoticTheme();
  return (
    <View accessible style={s.insightLine}>
      <Text style={[s.label, { color: theme.mutedText }]}>{label}</Text>
      <Text style={[s.insightValue, { color: theme.text }]}>{value}</Text>
    </View>
  );
}

function EmptyLine({ text }: { text: string }) {
  const { theme } = useVoticTheme();
  return <Text style={[s.sub, { color: theme.mutedText }]}>{text}</Text>;
}

function Notice({ icon, text }: { icon: IconName; text: string }) {
  const { theme } = useVoticTheme();
  return (
    <View style={[s.notice, { backgroundColor: theme.surfaceMuted }]}>
      <Ionicons name={icon} size={18} color={theme.text} />
      <Text style={[s.noticeText, { color: theme.text }]}>{text}</Text>
    </View>
  );
}

function PeriodArrow({
  icon,
  label,
  disabled,
  onPress,
}: {
  icon: IconName;
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  const { theme } = useVoticTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={s.iconButton}
    >
      <Ionicons name={icon} size={22} color={disabled ? theme.border : theme.text} />
    </Pressable>
  );
}

const s = StyleSheet.create({
  intro: { ...typography.body, marginBottom: spacing.sm },
  sectionTitle: { ...typography.sectionTitle, marginTop: spacing.sm },
  eyebrow: { ...typography.eyebrow, flexShrink: 1 },
  heroCard: { borderWidth: 1, borderRadius: radii.sheet, padding: spacing.xl, gap: spacing.lg },
  heroHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  heroNote: {
    borderTopWidth: 1,
    paddingTop: spacing.md,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  heroNoteText: { fontSize: 15, lineHeight: 23, flex: 1 },
  metricGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  metricTile: {
    flexGrow: 1,
    minWidth: 0,
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  metricValue: { fontSize: 26, fontWeight: "800", letterSpacing: -0.4 },
  metricLabel: { fontSize: 15, lineHeight: 22, fontWeight: "600" },
  insightCard: {
    minHeight: controlSizes.minimumTouch,
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: spacing.xl,
    gap: spacing.lg,
  },
  insightObservation: { ...typography.sectionTitle, lineHeight: 29 },
  insightLink: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  exploreRow: {
    minHeight: 88,
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  exploreIcon: {
    width: controlSizes.minimumTouch,
    height: controlSizes.minimumTouch,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
  },
  exploreDetail: { fontSize: 14, lineHeight: 21, marginTop: spacing.xs },
  safe: { flex: 1 },
  topBar: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.sm,
    gap: spacing.xs,
  },
  title: { ...typography.screenTitle, fontSize: 26, flex: 1 },
  iconButton: {
    width: controlSizes.minimumTouch,
    height: controlSizes.minimumTouch,
    alignItems: "center",
    justifyContent: "center",
  },
  content: { paddingHorizontal: spacing.xl, paddingBottom: spacing.section, gap: spacing.md },
  segmented: { flexDirection: "row", flexWrap: "wrap", padding: 3, borderRadius: 12, gap: 2 },
  segment: {
    flexGrow: 1,
    flexBasis: "auto",
    minHeight: controlSizes.minimumTouch,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xs,
  },
  segmentText: { fontSize: 15, fontWeight: "700" },
  periodRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.xs },
  periodLabel: { fontSize: 17, fontWeight: "800", textAlign: "center", flexShrink: 1 },
  notice: {
    borderRadius: radii.md,
    padding: spacing.md,
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "flex-start",
  },
  noticeText: { flex: 1, fontSize: 14, lineHeight: 20 },
  card: { borderWidth: 1, borderRadius: radii.lg, padding: spacing.lg, gap: spacing.md },
  cardTitle: { fontSize: 17, fontWeight: "800" },
  details: { fontSize: 14, fontWeight: "800" },
  label: { fontSize: 14 },
  hero: { fontSize: 44, lineHeight: 54, fontWeight: "800", letterSpacing: -0.8, marginTop: 2 },
  sub: { fontSize: 14, lineHeight: 20 },
  stats: { flexDirection: "row", flexWrap: "wrap", gap: spacing.lg },
  stat: { minWidth: 92, flexGrow: 1, gap: 2 },
  statLabelRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  statValue: { fontSize: 22, fontWeight: "800" },
  statValueSmall: { fontSize: 17, fontWeight: "800" },
  legendSwatch: { width: 10, height: 10, borderRadius: 3 },
  legendRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  grow: { flex: 1, minWidth: 0 },
  docRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  docTitle: { fontSize: 15, lineHeight: 20, fontWeight: "700" },
  rank: { width: 18, fontSize: 15, fontWeight: "800", textAlign: "center" },
  listRow: {
    minHeight: 64,
    borderBottomWidth: 1,
    paddingVertical: spacing.sm,
    justifyContent: "space-between",
  },
  listTitle: { fontSize: 15, fontWeight: "700", flex: 1 },
  barRow: { gap: 6 },
  barLabelRow: { flexDirection: "row", justifyContent: "space-between" },
  barLabel: { fontSize: 15, fontWeight: "600" },
  barValue: { fontSize: 14 },
  barTrack: { height: 8, borderRadius: 4, overflow: "hidden" },
  barFill: { height: "100%", borderRadius: 4 },
  weekHeader: { flexDirection: "row" },
  weekday: { flex: 1, textAlign: "center", fontSize: 12, fontWeight: "700" },
  weekRow: { flexDirection: "row", gap: 4 },
  day: { flex: 1, aspectRatio: 1, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  dayBlank: { flex: 1, aspectRatio: 1 },
  dayText: { fontSize: 13 },
  split: { height: 14, borderRadius: 7, overflow: "hidden", flexDirection: "row", gap: 2 },
  splitPart: { height: "100%" },
  insightLine: { gap: 2 },
  insightValue: { fontSize: 18, fontWeight: "800" },
  footnote: { fontSize: 13, lineHeight: 19 },
  devRow: {
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  devText: { fontSize: 14, flex: 1 },
});
