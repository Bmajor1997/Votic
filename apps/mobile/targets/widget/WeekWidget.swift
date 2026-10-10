import SwiftUI
import WidgetKit

struct WeekWidget: Widget {
  let kind = "VoticWeek"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: VoticProvider()) { entry in
      WeekWidgetView(entry: entry)
    }
    .configurationDisplayName("This Week")
    .description("Your reading and listening time this week, day by day.")
    .supportedFamilies([.systemSmall, .systemMedium, .accessoryRectangular])
    .voticContentMargins()
  }
}

struct WeekWidgetView: View {
  let entry: VoticEntry
  @Environment(\.widgetFamily) private var family
  @Environment(\.colorScheme) private var colorScheme

  private var tone: VoticTone { VoticTone.named("activity", dark: colorScheme == .dark) }

  var body: some View {
    let signedIn = entry.snapshot?.signedIn == true
    let week = VoticWeek(days: signedIn ? entry.snapshot?.days ?? [] : [], now: entry.date)
    Group {
      if family == .accessoryRectangular {
        WeekRectangular(week: week, signedIn: signedIn)
      } else if !signedIn {
        WidgetMessage(
          symbol: "chart.bar", title: "Open Votic",
          message: family == .systemSmall ? nil : "Sign in to see your reading and listening this week.",
          tone: tone)
          .padding(voticWidgetPadding)
          .voticWidgetBackground(tone.surface)
      } else if family == .systemMedium {
        WeekMedium(week: week, tone: tone)
          .padding(voticWidgetPadding)
          .voticWidgetBackground(tone.surface)
      } else {
        WeekSmall(week: week, tone: tone)
          .padding(voticWidgetPadding)
          .voticWidgetBackground(tone.surface)
      }
    }
    .widgetURL(signedIn ? VoticLink.statistics : VoticLink.home)
  }
}

private func spokenWeek(_ week: VoticWeek) -> String {
  guard week.total > 0 else { return "This week: no reading or listening yet. Opens Statistics." }
  var parts = [
    "This week: \(VoticWeek.spokenDuration(week.total))",
    "reading \(VoticWeek.spokenDuration(week.reading)), listening \(VoticWeek.spokenDuration(week.listening))",
  ]
  if week.streak >= 2 { parts.append("\(week.streak) days in a row") }
  return parts.joined(separator: ". ") + ". Opens Statistics."
}

/// Seven bars, Monday to Sunday. Today is labeled in bold; days still to come are left blank.
struct DayBars: View {
  let week: VoticWeek
  let color: Color
  let empty: Color
  var maxHeight: CGFloat = 40
  var barWidth: CGFloat = 8
  var showLetters = true
  var labelColor: Color = .secondary

  var body: some View {
    let peak = max(week.days.map(\.seconds).max() ?? 0, 1)
    HStack(alignment: .bottom, spacing: barWidth * 0.6) {
      ForEach(week.days) { day in
        VStack(spacing: 3) {
          Capsule()
            .fill(day.seconds > 0 ? color : empty)
            .frame(
              width: barWidth,
              height: day.seconds > 0 ? max(barWidth / 2, maxHeight * CGFloat(day.seconds) / CGFloat(peak)) : barWidth / 2
            )
            .frame(height: maxHeight, alignment: .bottom)
            .opacity(day.isFuture ? 0.45 : 1)
            .widgetAccentable(day.seconds > 0)
          if showLetters {
            Text(day.letter)
              .font(.system(size: 10, weight: day.isToday ? .heavy : .semibold, design: .rounded))
              .foregroundStyle(labelColor)
              .opacity(day.isToday ? 1 : 0.75)
          }
        }
      }
    }
    .accessibilityHidden(true)
  }
}

struct WeekSmall: View {
  let week: VoticWeek
  let tone: VoticTone

  var body: some View {
    VStack(alignment: .leading, spacing: 4) {
      HStack {
        Eyebrow(text: "THIS WEEK", color: tone.detail)
        Spacer(minLength: 4)
        Image(systemName: "chart.bar.fill")
          .font(.system(size: 12, weight: .bold))
          .foregroundStyle(tone.strong)
          .widgetAccentable()
      }
      Text(week.total > 0 ? VoticWeek.duration(week.total) : "No activity")
        .font(.system(size: week.total > 0 ? 24 : 19, weight: .bold, design: .rounded))
        .foregroundStyle(tone.ink)
        .lineLimit(1)
        .minimumScaleFactor(0.7)
      Text(caption)
        .font(.system(size: 11, weight: .semibold))
        .foregroundStyle(tone.detail)
        .lineLimit(1)
        .minimumScaleFactor(0.8)
      Spacer(minLength: 0)
      DayBars(week: week, color: tone.strong, empty: tone.art, maxHeight: 34, barWidth: 9, labelColor: tone.detail)
        .frame(maxWidth: .infinity)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    .accessibilityElement(children: .ignore)
    .accessibilityLabel(spokenWeek(week))
  }

  private var caption: String {
    if week.streak >= 2 { return "\(week.streak) days in a row" }
    if week.total == 0 { return "Listen or read to start" }
    return week.listening > week.reading ? "Mostly listening" : "Mostly reading"
  }
}

struct WeekMedium: View {
  let week: VoticWeek
  let tone: VoticTone

  var body: some View {
    HStack(alignment: .top, spacing: 16) {
      // The streak line is the first thing to go when the widget is short (the smallest iPhones).
      ViewThatFits(in: .vertical) {
        summary(showStreak: true)
        summary(showStreak: false)
      }
      .frame(maxWidth: .infinity, alignment: .leading)
      DayBars(week: week, color: tone.strong, empty: tone.art, maxHeight: 74, barWidth: 10, labelColor: tone.detail)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    .accessibilityElement(children: .ignore)
    .accessibilityLabel(spokenWeek(week))
  }
}

extension WeekMedium {
  @ViewBuilder
  func summary(showStreak: Bool) -> some View {
    VStack(alignment: .leading, spacing: 4) {
      Eyebrow(text: "THIS WEEK", color: tone.detail)
      Text(week.total > 0 ? VoticWeek.duration(week.total) : "No activity")
        .font(.system(size: week.total > 0 ? 26 : 20, weight: .bold, design: .rounded))
        .foregroundStyle(tone.ink)
        .lineLimit(1)
        .minimumScaleFactor(0.7)
      if week.total > 0 {
        ProgressTrack(
          value: Double(week.reading) / Double(max(week.total, 1)), fill: tone.strong, track: tone.art, height: 6
        )
        .padding(.vertical, 2)
        LegendDot(color: tone.strong, text: "Reading \(VoticWeek.duration(week.reading))", textColor: tone.detail)
        LegendDot(color: tone.art, text: "Listening \(VoticWeek.duration(week.listening))", textColor: tone.detail)
      } else {
        Text("Your reading and listening time will show here once you start.")
          .font(.system(size: 12))
          .foregroundStyle(tone.detail)
          .lineLimit(3)
      }
      if showStreak && week.streak >= 2 {
        Spacer(minLength: 0)
        Label("\(week.streak) days in a row", systemImage: "flame.fill")
          .font(.system(size: 12, weight: .semibold))
          .foregroundStyle(tone.strong)
          .widgetAccentable()
      }
    }
  }
}

struct LegendDot: View {
  let color: Color
  let text: String
  let textColor: Color

  var body: some View {
    HStack(spacing: 4) {
      Circle().fill(color).frame(width: 7, height: 7)
      Text(text)
        .font(.system(size: 11, weight: .semibold))
        .foregroundStyle(textColor)
        .lineLimit(1)
        .minimumScaleFactor(0.75)
    }
  }
}

struct WeekRectangular: View {
  let week: VoticWeek
  let signedIn: Bool

  var body: some View {
    HStack(alignment: .bottom, spacing: 8) {
      VStack(alignment: .leading, spacing: 1) {
        Text("This week")
          .font(.system(size: 11, weight: .semibold))
          .widgetAccentable()
        Text(signedIn ? (week.total > 0 ? VoticWeek.duration(week.total) : "No activity") : "Open Votic")
          .font(.system(size: 16, weight: .bold, design: .rounded))
          .lineLimit(1)
          .minimumScaleFactor(0.7)
      }
      Spacer(minLength: 4)
      if signedIn {
        DayBars(week: week, color: .primary, empty: .secondary.opacity(0.4), maxHeight: 26, barWidth: 5, showLetters: false)
      }
    }
    .accessibilityElement(children: .ignore)
    .accessibilityLabel(signedIn ? spokenWeek(week) : "Open Votic")
  }
}
