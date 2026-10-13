package com.votic.playback

import android.content.Intent
import android.os.Build
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class VoticPlaybackModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("VoticPlayback")
    Events("state")

    OnCreate {
      VoticPlaybackService.observer = { state -> sendEvent("state", state) }
    }
    OnDestroy { VoticPlaybackService.observer = null }

    Function("get_state") {
      val context = appContext.reactContext?.applicationContext
      if (context != null) VoticPlaybackService.restore_state(context) else VoticPlaybackService.state
    }

    AsyncFunction("start") { payload: String ->
      val context = appContext.reactContext?.applicationContext
        ?: throw IllegalStateException("Votic could not start background listening.")
      val document = PlaybackDocument.parse(payload)
      VoticPlaybackService.pending = document
      try {
        val intent = Intent(context, VoticPlaybackService::class.java).setAction("load")
        if (Build.VERSION.SDK_INT >= 26) context.startForegroundService(intent) else context.startService(intent)
      } catch (error: Exception) {
        VoticPlaybackService.pending = null
        throw error
      }
      Unit
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("pause") { VoticPlaybackService.instance?.pause(); Unit }.runOnQueue(Queues.MAIN)

    AsyncFunction("stop") {
      VoticPlaybackService.pending = null
      VoticPlaybackService.instance?.end()
      VoticPlaybackService.clear_state(appContext.reactContext?.applicationContext)
    }.runOnQueue(Queues.MAIN)
  }
}
