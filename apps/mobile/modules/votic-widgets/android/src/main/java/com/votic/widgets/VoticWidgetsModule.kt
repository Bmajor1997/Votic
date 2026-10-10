package com.votic.widgets

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/** Lets the app hand its widget snapshot to the Android home-screen widgets (src/widgets/widgetBridge.ts). */
class VoticWidgetsModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("VoticWidgets")

    Function("publish") { snapshot: String ->
      val context = appContext.reactContext?.applicationContext ?: return@Function
      VoticWidgetSnapshot.save(context, snapshot)
      VoticWidgets.refreshAll(context)
    }
  }
}
