import Foundation

/// What the Votic app last shared with its widgets. Written by the app (src/widgets/widgetSnapshot.ts)
/// into the App Group; the widgets only read it.
struct VoticSnapshot: Codable {
  struct Document: Codable, Identifiable {
    let id: String
    let title: String
    /// "PDF", "Word", "PowerPoint", "EPUB", "Markdown", or "Text".
    let kind: String
    /// pdf, slides, book, chapter, or text.
    let tone: String
    /// 0 to 1.
    let progress: Double
    /// "42% · about 10 min left", "Not started", or "Finished".
    let status: String
    /// "listen" or "read": how it was last used.
    let mode: String
  }

  struct Day: Codable {
    /// Local calendar day, "2026-10-09".
    let date: String
    let readingSeconds: Int
    let listeningSeconds: Int
  }

  let version: Int
  let signedIn: Bool
  /// The document to continue ("continue" in the JSON, which is a Swift keyword).
  let current: Document?
  let upNext: [Document]
  let documentCount: Int
  let days: [Day]

  enum CodingKeys: String, CodingKey {
    case version, signedIn, upNext, documentCount, days
    case current = "continue"
  }

  static let appGroup = "group.com.votic.app"
  static let key = "votic.widgets.snapshot.v1"

  /// The snapshot the app last saved, or nil before Votic has been opened (or if it can't be read).
  static func load() -> VoticSnapshot? {
    guard
      let json = UserDefaults(suiteName: appGroup)?.string(forKey: key),
      let data = json.data(using: .utf8),
      let snapshot = try? JSONDecoder().decode(VoticSnapshot.self, from: data),
      snapshot.version == 1
    else { return nil }
    return snapshot
  }

  /// Shown in the widget gallery before Votic has shared anything, and as the loading placeholder.
  static let preview = VoticSnapshot(
    version: 1,
    signedIn: true,
    current: Document(
      id: "preview", title: "The Psychology of Money", kind: "PDF", tone: "pdf", progress: 0.42,
      status: "42% · about 18 min left", mode: "listen"),
    upNext: [
      Document(
        id: "preview-2", title: "Biology 101: Cell Division", kind: "Word", tone: "chapter",
        progress: 0.75, status: "75% · about 6 min left", mode: "read"),
      Document(
        id: "preview-3", title: "Meditations", kind: "EPUB", tone: "book", progress: 0.08,
        status: "8% · about 140 min left", mode: "listen"),
      Document(
        id: "preview-4", title: "Team offsite agenda", kind: "PowerPoint", tone: "slides",
        progress: 1, status: "Finished", mode: "read"),
    ],
    documentCount: 4,
    days: VoticSnapshot.previewDays()
  )

  private static func previewDays() -> [Day] {
    let minutes: [(Int, Int, Int)] = [(0, 18, 25), (1, 30, 15), (2, 0, 0), (3, 10, 40), (4, 22, 8)]
    return minutes.compactMap { entry -> Day? in
      let (back, reading, listening) = entry
      guard let date = Calendar.current.date(byAdding: .day, value: -back, to: Date()) else { return nil }
      return Day(date: VoticWeek.key(for: date), readingSeconds: reading * 60, listeningSeconds: listening * 60)
    }
  }
}

/// This week's reading and listening, worked out from the shared daily totals at the moment the widget
/// draws, so it stays right after midnight or a new week even if Votic hasn't been opened since.
struct VoticWeek {
  struct Day: Identifiable {
    let id: Int
    /// "M", "T", "W"...
    let letter: String
    let seconds: Int
    let isToday: Bool
    let isFuture: Bool
  }

  let reading: Int
  let listening: Int
  let days: [Day]
  /// Consecutive active days ending today, or yesterday when today has no activity yet.
  let streak: Int

  var total: Int { reading + listening }

  /// A day counts as active after one minute, the same rule the app's Statistics uses.
  static let activeDaySeconds = 60

  /// Weeks start on Monday, as they do in the app.
  static var calendar: Calendar {
    var calendar = Calendar(identifier: .gregorian)
    calendar.firstWeekday = 2
    calendar.timeZone = .current
    return calendar
  }

  private static let formatter: DateFormatter = {
    let formatter = DateFormatter()
    formatter.calendar = Calendar(identifier: .gregorian)
    formatter.locale = Locale(identifier: "en_US_POSIX")
    formatter.timeZone = .current
    formatter.dateFormat = "yyyy-MM-dd"
    return formatter
  }()

  static func key(for date: Date) -> String { formatter.string(from: date) }

  init(days shared: [VoticSnapshot.Day], now: Date = Date()) {
    let calendar = VoticWeek.calendar
    var byDate: [String: VoticSnapshot.Day] = [:]
    for day in shared { byDate[day.date] = day }

    let today = calendar.startOfDay(for: now)
    let weekStart = calendar.dateInterval(of: .weekOfYear, for: today)?.start ?? today
    let letters = ["M", "T", "W", "T", "F", "S", "S"]
    var reading = 0
    var listening = 0
    var days: [Day] = []
    for index in 0..<7 {
      let date = calendar.date(byAdding: .day, value: index, to: weekStart) ?? weekStart
      let entry = byDate[VoticWeek.key(for: date)]
      let dayReading = max(0, entry?.readingSeconds ?? 0)
      let dayListening = max(0, entry?.listeningSeconds ?? 0)
      reading += dayReading
      listening += dayListening
      days.append(
        Day(
          id: index, letter: letters[index], seconds: dayReading + dayListening,
          isToday: calendar.isDate(date, inSameDayAs: today), isFuture: date > today))
    }

    func active(_ date: Date) -> Bool {
      guard let day = byDate[VoticWeek.key(for: date)] else { return false }
      return day.readingSeconds + day.listeningSeconds >= VoticWeek.activeDaySeconds
    }
    var cursor = today
    if !active(cursor) { cursor = calendar.date(byAdding: .day, value: -1, to: cursor) ?? cursor }
    var streak = 0
    while active(cursor) {
      streak += 1
      guard let previous = calendar.date(byAdding: .day, value: -1, to: cursor) else { break }
      cursor = previous
    }

    self.reading = reading
    self.listening = listening
    self.days = days
    self.streak = streak
  }

  /// "2 h 5 min", "45 min", "under 1 min", or "0 min", as the app writes durations.
  static func duration(_ seconds: Int) -> String {
    let minutes = Int((Double(seconds) / 60).rounded())
    if seconds > 0 && minutes == 0 { return "under 1 min" }
    if minutes < 60 { return "\(minutes) min" }
    let hours = minutes / 60
    let rest = minutes % 60
    return rest > 0 ? "\(hours) h \(rest) min" : "\(hours) h"
  }

  /// The same duration for VoiceOver, in words.
  static func spokenDuration(_ seconds: Int) -> String {
    let minutes = Int((Double(seconds) / 60).rounded())
    if seconds > 0 && minutes == 0 { return "less than a minute" }
    let hours = minutes / 60
    let rest = minutes % 60
    var parts: [String] = []
    if hours > 0 { parts.append("\(hours) \(hours == 1 ? "hour" : "hours")") }
    if rest > 0 || hours == 0 { parts.append("\(rest) \(rest == 1 ? "minute" : "minutes")") }
    return parts.joined(separator: " ")
  }
}

/// Links back into Votic. The app handles them in app/widget.tsx.
enum VoticLink {
  static func url(open: String? = nil, id: String? = nil) -> URL {
    var components = URLComponents()
    components.scheme = "votic"
    components.host = "widget"
    var items: [URLQueryItem] = []
    if let open { items.append(URLQueryItem(name: "open", value: open)) }
    if let id { items.append(URLQueryItem(name: "id", value: id)) }
    components.queryItems = items.isEmpty ? nil : items
    return components.url ?? URL(string: "votic://widget")!
  }

  static func resume(_ document: VoticSnapshot.Document, mode: String? = nil) -> URL {
    url(open: (mode ?? document.mode) == "listen" ? "listen" : "read", id: document.id)
  }

  static let statistics = url(open: "statistics")
  static let add = url(open: "add")
  static let home = url()
}
