import SwiftUI
import WidgetKit

struct VoticEntry: TimelineEntry {
  let date: Date
  let snapshot: VoticSnapshot?
}

/// Both Votic widgets draw from the snapshot the app shares. The app reloads them whenever it changes; a
/// second entry at midnight moves "today" and starts a new week on time without the app.
struct VoticProvider: TimelineProvider {
  func placeholder(in context: Context) -> VoticEntry {
    VoticEntry(date: Date(), snapshot: .preview)
  }

  func getSnapshot(in context: Context, completion: @escaping (VoticEntry) -> Void) {
    // The widget gallery shows the person's own reading when there is some, and an example otherwise.
    // On the Home Screen itself, only real data is ever shown.
    let saved = VoticSnapshot.load()
    let snapshot = context.isPreview && saved?.current == nil ? VoticSnapshot.preview : saved
    completion(VoticEntry(date: Date(), snapshot: snapshot))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<VoticEntry>) -> Void) {
    let now = Date()
    let snapshot = VoticSnapshot.load()
    let midnight = VoticWeek.calendar.nextDate(
      after: now, matching: DateComponents(hour: 0, minute: 0, second: 5), matchingPolicy: .nextTime)
    var entries = [VoticEntry(date: now, snapshot: snapshot)]
    if let midnight { entries.append(VoticEntry(date: midnight, snapshot: snapshot)) }
    completion(Timeline(entries: entries, policy: .atEnd))
  }
}

// MARK: - Continue

struct ContinueWidget: Widget {
  let kind = "VoticContinue"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: VoticProvider()) { entry in
      ContinueWidgetView(entry: entry)
    }
    .configurationDisplayName("Continue")
    .description("Pick up where you left off. Listen or read in one tap.")
    .supportedFamilies([
      .systemSmall, .systemMedium, .systemLarge,
      .accessoryCircular, .accessoryRectangular, .accessoryInline,
    ])
    .voticContentMargins()
  }
}

struct ContinueWidgetView: View {
  let entry: VoticEntry
  @Environment(\.widgetFamily) private var family
  @Environment(\.colorScheme) private var colorScheme

  private var dark: Bool { colorScheme == .dark }
  private var tone: VoticTone { VoticTone.named("chapter", dark: dark) }

  var body: some View {
    switch family {
    case .accessoryCircular: ContinueCircular(snapshot: entry.snapshot)
    case .accessoryRectangular: ContinueRectangular(snapshot: entry.snapshot)
    case .accessoryInline: ContinueInline(snapshot: entry.snapshot)
    default:
      homeScreen
        .padding(voticWidgetPadding)
        .voticWidgetBackground(tone.surface)
    }
  }

  @ViewBuilder
  private var homeScreen: some View {
    if let snapshot = entry.snapshot, snapshot.signedIn {
      if let document = snapshot.current {
        Group {
          switch family {
          case .systemSmall: ContinueSmall(document: document, tone: tone, dark: dark)
          case .systemMedium: ContinueMedium(document: document, tone: tone, dark: dark)
          default:
            ContinueLarge(
              document: document, upNext: snapshot.upNext,
              week: VoticWeek(days: snapshot.days, now: entry.date), tone: tone, dark: dark)
          }
        }
        // A tap outside the buttons resumes the way the document was last used.
        .widgetURL(VoticLink.resume(document))
      } else {
        // Nothing in progress: an empty library, or everything finished.
        let empty = snapshot.documentCount == 0
        VStack(alignment: .leading, spacing: 10) {
          WidgetMessage(
            symbol: empty ? "doc.badge.plus" : "checkmark.seal",
            title: empty ? "Ready when you are" : "All caught up",
            message: family == .systemSmall
              ? nil
              : empty
                ? "Add a PDF, Word, PowerPoint, EPUB, or text file, then listen or read along."
                : "You've finished everything in your library. Add something new to keep going.",
            tone: tone)
          if family != .systemSmall {
            Link(destination: VoticLink.add) {
              PillButton(title: "Add document", symbol: "plus", filled: true, tone: tone)
            }
          }
        }
        .widgetURL(VoticLink.add)
      }
    } else {
      WidgetMessage(
        symbol: "person.crop.circle", title: "Open Votic",
        message: family == .systemSmall ? nil : "Sign in to see what you're reading and listening to.",
        tone: tone)
        .widgetURL(VoticLink.home)
    }
  }
}

/// "Listen" or "Read" as a button inside a widget (a link into the app).
struct PillButton: View {
  let title: String
  let symbol: String
  let filled: Bool
  let tone: VoticTone

  var body: some View {
    Label(title, systemImage: symbol)
      .font(.system(size: 14, weight: .bold, design: .rounded))
      .labelStyle(.titleAndIcon)
      .lineLimit(1)
      .minimumScaleFactor(0.8)
      .foregroundStyle(filled ? tone.onStrong : tone.ink)
      .frame(maxWidth: .infinity, minHeight: 32)
      .background(
        Capsule().fill(filled ? tone.strong : Color.clear)
      )
      .overlay(Capsule().stroke(filled ? Color.clear : tone.border, lineWidth: 1))
      .widgetAccentable(filled)
  }
}

private func modeSymbol(_ mode: String) -> String { mode == "listen" ? "headphones" : "book" }

private func spokenSummary(_ document: VoticSnapshot.Document) -> String {
  "\(document.title), \(document.kind). \(document.status)."
}

/// Small: the document and its progress. Tapping anywhere resumes the way it was last used.
struct ContinueSmall: View {
  let document: VoticSnapshot.Document
  let tone: VoticTone
  let dark: Bool

  var body: some View {
    VStack(alignment: .leading, spacing: 5) {
      HStack(alignment: .top) {
        DocumentCover(document: document, dark: dark, width: 30, height: 38)
        Spacer(minLength: 4)
        Image(systemName: modeSymbol(document.mode))
          .font(.system(size: 13, weight: .bold))
          .foregroundStyle(tone.onStrong)
          .frame(width: 28, height: 28)
          .background(Circle().fill(tone.strong))
          .widgetAccentable()
      }
      Spacer(minLength: 0)
      Text(document.title)
        .font(.system(size: 15, weight: .bold, design: .rounded))
        .foregroundStyle(tone.ink)
        .lineLimit(3)
        .minimumScaleFactor(0.85)
        .privacySensitive()
      ProgressTrack(value: document.progress, fill: tone.strong, track: tone.art, height: 5)
      Text(shortStatus(document))
        .font(.system(size: 11, weight: .semibold))
        .foregroundStyle(tone.detail)
        .lineLimit(1)
        .minimumScaleFactor(0.8)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    .accessibilityElement(children: .ignore)
    .accessibilityLabel(
      "\(document.mode == "listen" ? "Continue listening" : "Continue reading"). \(spokenSummary(document))")
  }
}

/// "42% · 10 min left" for the narrow small widget.
func shortStatus(_ document: VoticSnapshot.Document) -> String {
  document.status.replacingOccurrences(of: "about ", with: "")
}

/// Medium: the document, with Listen and Read side by side. The way it was last used is filled.
struct ContinueMedium: View {
  let document: VoticSnapshot.Document
  let tone: VoticTone
  let dark: Bool

  var body: some View {
    HStack(alignment: .top, spacing: 14) {
      Link(destination: VoticLink.resume(document)) {
        DocumentCover(document: document, dark: dark, width: 62, height: 82)
      }
      .accessibilityHidden(true)
      VStack(alignment: .leading, spacing: 4) {
        Eyebrow(text: "CONTINUE", color: tone.detail)
        // On the smallest iPhones the title shortens to one line to make room for the buttons.
        Text(document.title)
          .font(.system(size: 15, weight: .bold, design: .rounded))
          .foregroundStyle(tone.ink)
          .lineLimit(2)
          .minimumScaleFactor(0.85)
          .privacySensitive()
        Text(document.status)
          .font(.system(size: 12, weight: .semibold))
          .foregroundStyle(tone.detail)
          .lineLimit(1)
          .minimumScaleFactor(0.8)
        ProgressTrack(value: document.progress, fill: tone.strong, track: tone.art, height: 5)
        Spacer(minLength: 4)
        ResumeButtons(document: document, tone: tone)
      }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
  }
}

struct ResumeButtons: View {
  let document: VoticSnapshot.Document
  let tone: VoticTone

  var body: some View {
    let listenFirst = document.mode == "listen"
    HStack(spacing: 8) {
      Link(destination: VoticLink.resume(document, mode: "listen")) {
        PillButton(title: "Listen", symbol: "play.fill", filled: listenFirst, tone: tone)
      }
      .accessibilityLabel("Continue listening to \(document.title)")
      Link(destination: VoticLink.resume(document, mode: "read")) {
        PillButton(title: "Read", symbol: "book", filled: !listenFirst, tone: tone)
      }
      .accessibilityLabel("Continue reading \(document.title)")
    }
  }
}

/// Large: Continue, what's next in the library, and this week at a glance.
struct ContinueLarge: View {
  let document: VoticSnapshot.Document
  let upNext: [VoticSnapshot.Document]
  let week: VoticWeek
  let tone: VoticTone
  let dark: Bool

  var body: some View {
    VStack(alignment: .leading, spacing: 10) {
      ContinueMedium(document: document, tone: tone, dark: dark)
        .frame(height: 118)
      if !upNext.isEmpty {
        Divider().overlay(tone.border)
        Eyebrow(text: "UP NEXT", color: tone.detail)
        ViewThatFits(in: .vertical) {
          upNextList(3)
          upNextList(2)
          upNextList(1)
        }
      }
      Spacer(minLength: 0)
      Link(destination: VoticLink.statistics) {
        WeekStrip(week: week, tone: tone)
      }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
  }

  private func upNextList(_ count: Int) -> some View {
    VStack(spacing: 6) {
      ForEach(upNext.prefix(count)) { item in
        Link(destination: VoticLink.resume(item, mode: "read")) {
          UpNextRow(document: item, tone: tone, dark: dark)
        }
      }
    }
  }
}

struct UpNextRow: View {
  let document: VoticSnapshot.Document
  let tone: VoticTone
  let dark: Bool

  var body: some View {
    HStack(spacing: 10) {
      DocumentCover(document: document, dark: dark, width: 24, height: 30)
      VStack(alignment: .leading, spacing: 3) {
        Text(document.title)
          .font(.system(size: 13, weight: .semibold, design: .rounded))
          .foregroundStyle(tone.ink)
          .lineLimit(1)
          .privacySensitive()
        if document.progress > 0 && document.progress < 1 {
          ProgressTrack(value: document.progress, fill: tone.strong, track: tone.art, height: 3)
        }
      }
      Spacer(minLength: 6)
      Text(document.progress >= 1 ? "Finished" : document.progress > 0 ? "\(Int((document.progress * 100).rounded()))%" : "New")
        .font(.system(size: 12, weight: .semibold))
        .foregroundStyle(tone.detail)
    }
    .accessibilityElement(children: .ignore)
    .accessibilityLabel("Open \(spokenSummary(document))")
  }
}

/// One line about this week, with a tiny day strip. Opens Statistics.
struct WeekStrip: View {
  let week: VoticWeek
  let tone: VoticTone

  var body: some View {
    HStack(spacing: 10) {
      VStack(alignment: .leading, spacing: 2) {
        Eyebrow(text: "THIS WEEK", color: tone.detail)
        Text(week.total > 0 ? VoticWeek.duration(week.total) : "No activity")
          .font(.system(size: 15, weight: .bold, design: .rounded))
          .foregroundStyle(tone.ink)
      }
      Spacer(minLength: 8)
      DayBars(week: week, color: tone.strong, empty: tone.art, maxHeight: 22, barWidth: 6, showLetters: false)
    }
    .accessibilityElement(children: .ignore)
    .accessibilityLabel(
      week.total > 0
        ? "This week: \(VoticWeek.spokenDuration(week.total)). Open Statistics."
        : "This week: no reading or listening yet. Open Statistics.")
  }
}

// MARK: - Lock Screen

struct ContinueCircular: View {
  let snapshot: VoticSnapshot?

  var body: some View {
    if let document = snapshot?.signedIn == true ? snapshot?.current : nil {
      Gauge(value: document.progress) {
        Image(systemName: modeSymbol(document.mode))
      } currentValueLabel: {
        Text("\(Int((document.progress * 100).rounded()))")
      }
      .gaugeStyle(.accessoryCircularCapacity)
      .widgetURL(VoticLink.resume(document))
      .accessibilityLabel("\(document.title), \(Int((document.progress * 100).rounded())) percent")
    } else {
      ZStack {
        AccessoryWidgetBackground()
        Image(systemName: "headphones").font(.system(size: 20, weight: .semibold))
      }
      .widgetURL(VoticLink.home)
      .accessibilityLabel("Open Votic")
    }
  }
}

struct ContinueRectangular: View {
  let snapshot: VoticSnapshot?

  var body: some View {
    if let document = snapshot?.signedIn == true ? snapshot?.current : nil {
      VStack(alignment: .leading, spacing: 2) {
        Label(document.mode == "listen" ? "Continue listening" : "Continue reading",
              systemImage: modeSymbol(document.mode))
          .font(.system(size: 11, weight: .semibold))
          .widgetAccentable()
        Text(document.title)
          .font(.system(size: 14, weight: .bold))
          .lineLimit(1)
          .privacySensitive()
        ProgressView(value: document.progress)
          .tint(.primary)
        Text(shortStatus(document))
          .font(.system(size: 11))
          .lineLimit(1)
      }
      .frame(maxWidth: .infinity, alignment: .leading)
      .widgetURL(VoticLink.resume(document))
    } else {
      Label("Open Votic", systemImage: "headphones")
        .font(.system(size: 14, weight: .semibold))
        .widgetURL(VoticLink.home)
    }
  }
}

struct ContinueInline: View {
  let snapshot: VoticSnapshot?

  var body: some View {
    if let document = snapshot?.signedIn == true ? snapshot?.current : nil {
      Label("\(Int((document.progress * 100).rounded()))% · \(document.title)", systemImage: modeSymbol(document.mode))
        .privacySensitive()
        .widgetURL(VoticLink.resume(document))
    } else {
      Label("Votic", systemImage: "headphones")
        .widgetURL(VoticLink.home)
    }
  }
}
