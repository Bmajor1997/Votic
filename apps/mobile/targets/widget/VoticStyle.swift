import SwiftUI
import WidgetKit

/// The same color families as the Home cards in the app (src/home/widgetDesign.ts), light and dark.
struct VoticTone {
  let surface: Color
  let border: Color
  let ink: Color
  let detail: Color
  let art: Color
  let strong: Color
  let onStrong: Color

  private init(_ surface: UInt32, _ border: UInt32, _ ink: UInt32, _ detail: UInt32, _ art: UInt32,
               _ strong: UInt32, _ onStrong: UInt32) {
    self.surface = Color(hex: surface)
    self.border = Color(hex: border)
    self.ink = Color(hex: ink)
    self.detail = Color(hex: detail)
    self.art = Color(hex: art)
    self.strong = Color(hex: strong)
    self.onStrong = Color(hex: onStrong)
  }

  static func named(_ name: String, dark: Bool) -> VoticTone {
    switch (name, dark) {
    case ("activity", false): return VoticTone(0xDFF2ED, 0xB7DACE, 0x164B40, 0x3E655C, 0xBFDFD3, 0x176653, 0xFFFFFF)
    case ("activity", true): return VoticTone(0x163B35, 0x335E54, 0xE1F7ED, 0xB7D7CB, 0x285449, 0x8BD8BC, 0x153E32)
    case ("pdf", false): return VoticTone(0xFBE7E6, 0xEBC4C1, 0x6D302F, 0x754B49, 0xF1C7C3, 0xA93E3A, 0xFFFFFF)
    case ("pdf", true): return VoticTone(0x452C36, 0x70505B, 0xFFECEF, 0xE6C2C9, 0x63404B, 0xF3B4BD, 0x572731)
    case ("slides", false): return VoticTone(0xFCECDD, 0xEBCDB1, 0x673D20, 0x705039, 0xF2D0AF, 0xA45A20, 0xFFFFFF)
    case ("slides", true): return VoticTone(0x42332A, 0x705641, 0xFFF0DE, 0xE4CBB4, 0x604937, 0xECC092, 0x4B321D)
    case ("book", false): return VoticTone(0xEAE6FD, 0xCBC3EE, 0x3E3471, 0x544B73, 0xCEC5F2, 0x6150A7, 0xFFFFFF)
    case ("book", true): return VoticTone(0x2D2C4C, 0x515177, 0xEFEEFF, 0xC9C6E9, 0x44446C, 0xBEB6F2, 0x302855)
    case ("text", false): return VoticTone(0xE1F0F3, 0xBDD9DF, 0x234D59, 0x435F67, 0xBFDEE5, 0x286979, 0xFFFFFF)
    case ("text", true): return VoticTone(0x213A45, 0x405E6B, 0xE5F5FA, 0xBCD7E1, 0x345462, 0x98CEDF, 0x213F4B)
    case (_, true): return VoticTone(0x17345B, 0x365986, 0xEDF4FF, 0xC1D3EE, 0x294D7C, 0x91B8FF, 0x132C50)
    default: return VoticTone(0xD8E6FF, 0xB8CEF3, 0x183967, 0x3E587C, 0xB5CEFA, 0x245BC2, 0xFFFFFF)
    }
  }
}

extension Color {
  init(hex: UInt32) {
    self.init(
      .sRGB,
      red: Double((hex >> 16) & 0xFF) / 255,
      green: Double((hex >> 8) & 0xFF) / 255,
      blue: Double(hex & 0xFF) / 255,
      opacity: 1)
  }
}

extension View {
  /// The widget's background. iOS 17 needs it declared as the container background; iOS 16 draws it directly.
  @ViewBuilder
  func voticWidgetBackground(_ color: Color) -> some View {
    if #available(iOSApplicationExtension 17.0, *) {
      containerBackground(for: .widget) { color }
    } else {
      background(color)
    }
  }
}

extension WidgetConfiguration {
  /// Votic draws its own padding, so it looks the same on iOS 16 and 17+.
  func voticContentMargins() -> some WidgetConfiguration {
    if #available(iOSApplicationExtension 17.0, *) {
      return contentMarginsDisabled()
    } else {
      return self
    }
  }
}

/// The padding Votic uses inside home-screen widgets.
let voticWidgetPadding: CGFloat = 16

/// A short label above a widget's main content, like "CONTINUE".
struct Eyebrow: View {
  let text: String
  let color: Color
  var body: some View {
    Text(text)
      .font(.system(size: 11, weight: .bold, design: .rounded))
      .tracking(0.6)
      .foregroundStyle(color)
      .lineLimit(1)
  }
}

/// A rounded progress track.
struct ProgressTrack: View {
  let value: Double
  let fill: Color
  let track: Color
  var height: CGFloat = 6
  var body: some View {
    GeometryReader { geometry in
      ZStack(alignment: .leading) {
        Capsule().fill(track)
        Capsule()
          .fill(fill)
          .frame(width: max(height, geometry.size.width * min(1, max(0, value))))
          .opacity(value > 0 ? 1 : 0)
          .widgetAccentable()
      }
    }
    .frame(height: height)
    .accessibilityHidden(true)
  }
}

/// A small text-document cover in the document's color family: a type band and a few lines of "text".
struct DocumentCover: View {
  let document: VoticSnapshot.Document
  let dark: Bool
  var width: CGFloat = 58
  var height: CGFloat = 76

  var body: some View {
    let tone = VoticTone.named(document.tone, dark: dark)
    VStack(alignment: .leading, spacing: 0) {
      Text(coverLabel)
        .font(.system(size: 8, weight: .heavy, design: .rounded))
        .foregroundStyle(tone.onStrong)
        .lineLimit(1)
        .padding(.horizontal, 5)
        .frame(maxWidth: .infinity, minHeight: 14, alignment: .leading)
        .background(tone.strong)
      VStack(alignment: .leading, spacing: 4) {
        ForEach(0..<4, id: \.self) { line in
          Capsule()
            .fill(tone.art)
            .frame(width: (width - 14) * (line == 3 ? 0.55 : line == 1 ? 0.85 : 1), height: 3)
        }
      }
      .padding(7)
      Spacer(minLength: 0)
    }
    .frame(width: width, height: height)
    .background(dark ? tone.surface : Color.white)
    .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
    .overlay(RoundedRectangle(cornerRadius: 8, style: .continuous).stroke(tone.border, lineWidth: 1))
    .accessibilityHidden(true)
  }

  private var coverLabel: String {
    switch document.kind {
    case "PowerPoint": return "PPT"
    case "Word": return "DOC"
    case "Markdown": return "MD"
    case "Text": return "TXT"
    default: return document.kind.uppercased()
    }
  }
}

/// A plain message for states without a document: signed out, an empty library, or everything finished.
struct WidgetMessage: View {
  let symbol: String
  let title: String
  let message: String?
  let tone: VoticTone

  var body: some View {
    VStack(alignment: .leading, spacing: 6) {
      Image(systemName: symbol)
        .font(.system(size: 22, weight: .semibold))
        .foregroundStyle(tone.strong)
        .widgetAccentable()
      Spacer(minLength: 0)
      Text(title)
        .font(.system(size: 17, weight: .bold, design: .rounded))
        .foregroundStyle(tone.ink)
        .lineLimit(2)
        .minimumScaleFactor(0.85)
      if let message {
        Text(message)
          .font(.system(size: 13))
          .foregroundStyle(tone.detail)
          .lineLimit(3)
          .minimumScaleFactor(0.85)
      }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    .accessibilityElement(children: .combine)
  }
}
