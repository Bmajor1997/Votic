import SwiftUI
import WidgetKit

/// Votic's iPhone widgets. Both read the snapshot the app shares (VoticSnapshot.swift).
@main
struct VoticWidgetBundle: WidgetBundle {
  var body: some Widget {
    ContinueWidget()
    WeekWidget()
  }
}
