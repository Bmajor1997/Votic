package com.votic.playback

import android.content.Intent
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.speech.tts.TextToSpeech
import expo.modules.kotlin.Promise
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

    Function("activity_events") { accountId: String ->
      val context = appContext.reactContext?.applicationContext
      if (context == null) emptyList<Map<String, Any>>() else PlaybackActivityJournal.events(context, accountId)
    }
    AsyncFunction("ack_activity") { accountId: String, payload: String ->
      appContext.reactContext?.applicationContext?.let { PlaybackActivityJournal.acknowledge(it, accountId, payload) }
      Unit
    }.runOnQueue(Queues.MAIN)
    AsyncFunction("clear_activity") { accountId: String ->
      appContext.reactContext?.applicationContext?.let { PlaybackActivityJournal.clear(it, accountId) }
      Unit
    }.runOnQueue(Queues.MAIN)
    AsyncFunction("set_sleep_timer") { seconds: Double, boundary: Boolean ->
      val service = VoticPlaybackService.instance ?: throw IllegalStateException("Start a listening session first.")
      service.setSleepTimer(seconds, boundary)
      Unit
    }.runOnQueue(Queues.MAIN)
    AsyncFunction("voice_status") { voiceName: String?, promise: Promise ->
      val context = appContext.reactContext?.applicationContext
      if (context == null) promise.resolve(mapOf("status" to "unknown"))
      else {
        val handler = Handler(Looper.getMainLooper())
        var finished = false
        var engine: TextToSpeech? = null
        fun finish(status: String) {
          if (finished) return
          finished = true
          engine?.shutdown()
          promise.resolve(mapOf("status" to status))
        }
        engine = TextToSpeech(context) { result -> handler.post {
          if (!finished) {
            if (result != TextToSpeech.SUCCESS) finish("unknown")
            else runCatching {
              if (voiceName == null) engine?.language = java.util.Locale.getDefault()
              val voice = if (voiceName == null) engine?.voice else engine?.voices?.firstOrNull { it.name == voiceName }
              finish(when {
                voice == null -> "missing"
                voice.features.contains(TextToSpeech.Engine.KEY_FEATURE_NOT_INSTALLED) -> "missing"
                voice.isNetworkConnectionRequired -> "network"
                else -> "offline"
              })
            }.onFailure { finish("unknown") }
          }
        } }
        handler.postDelayed({ finish("unknown") }, 10000)
      }
    }.runOnQueue(Queues.MAIN)
    AsyncFunction("open_voice_settings") {
      val context = appContext.reactContext?.applicationContext ?: throw IllegalStateException("Settings unavailable.")
      context.startActivity(Intent("com.android.settings.TTS_SETTINGS").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("pause") { VoticPlaybackService.instance?.pause(); Unit }.runOnQueue(Queues.MAIN)

    AsyncFunction("stop") {
      VoticPlaybackService.pending = null
      VoticPlaybackService.instance?.end()
      VoticPlaybackService.clear_state(appContext.reactContext?.applicationContext)
    }.runOnQueue(Queues.MAIN)
  }
}
