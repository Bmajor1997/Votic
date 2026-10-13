package com.votic.playback

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.media.MediaMetadata
import android.media.session.MediaSession
import android.media.session.PlaybackState
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.os.SystemClock
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import java.util.Locale
import org.json.JSONObject

/** Owns narration and transport commands independently of the React Native screen/JS timers. */
class VoticPlaybackService : Service() {
  companion object {
    private const val CHANNEL = "votic-listening"
    private const val NOTIFICATION_ID = 2401
    @Volatile var state: Map<String, Any?> = emptyMap()
      private set
    // Written on the JS module's thread and read on the main thread.
    @Volatile var observer: ((Map<String, Any?>) -> Unit)? = null
    @Volatile var pending: PlaybackDocument? = null
    @Volatile var instance: VoticPlaybackService? = null
      private set
    private const val PROGRESS_STORE = "votic.playback.progress"
    fun clear_state(context: Context? = instance) {
      context?.getSharedPreferences(PROGRESS_STORE, MODE_PRIVATE)?.edit()?.clear()?.apply()
      state = emptyMap()
      runCatching { observer?.invoke(state) }
    }
    fun restore_state(context: Context): Map<String, Any?> {
      if (state.isNotEmpty()) return state
      val stored = context.getSharedPreferences(PROGRESS_STORE, MODE_PRIVATE).getString("position", null)
        ?: return state
      try {
        val json = JSONObject(stored)
        // A restored checkpoint is a position, never a claim that a dead process is still playing.
        state = mapOf("accountId" to json.getString("accountId"), "documentId" to json.getString("documentId"),
          "title" to json.optString("title"), "passageIndex" to json.getInt("passageIndex"),
          "wordIndex" to json.getInt("wordIndex"), "playing" to false,
          "completed" to json.optBoolean("completed"), "error" to null)
      } catch (_: Exception) { context.getSharedPreferences(PROGRESS_STORE, MODE_PRIVATE).edit().clear().apply() }
      return state
    }
  }

  private val main = Handler(Looper.getMainLooper())
  private var document: PlaybackDocument? = null
  private var at = 0
  private var offset = 0
  private var ready = false
  private var wanted = false
  private var playing = false
  private var completed = false
  private var failure: String? = null
  private var utterance: String? = null
  private var serial = 0L
  private var engine: TextToSpeech? = null
  // The document whose voice and speed the engine is set to, so the voice list is searched once per document.
  private var configuredFor: PlaybackDocument? = null
  private lateinit var mediaSession: MediaSession
  private lateinit var audio: AudioManager
  private var focusRequest: AudioFocusRequest? = null
  private var hasFocus = false
  private var wakeLock: PowerManager.WakeLock? = null
  private var destroyed = false
  private var lastCheckpoint = 0L
  private val attributes = AudioAttributes.Builder()
    .setUsage(AudioAttributes.USAGE_MEDIA).setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build()
  private val focusListener = AudioManager.OnAudioFocusChangeListener { change ->
    // Speech must stop even for a duck request. Never resume on GAIN: the person chooses Play.
    if (change == AudioManager.AUDIOFOCUS_LOSS ||
      change == AudioManager.AUDIOFOCUS_LOSS_TRANSIENT ||
      change == AudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK) {
      val interrupt = Runnable { if (!destroyed) pause() }
      if (Looper.myLooper() == main.looper) interrupt.run() else main.post(interrupt)
    }
  }
  private val unplugged = object : BroadcastReceiver() {
    override fun onReceive(context: Context?, intent: Intent?) {
      if (intent?.action == AudioManager.ACTION_AUDIO_BECOMING_NOISY) pause()
    }
  }

  override fun onCreate() {
    super.onCreate()
    instance = this
    audio = getSystemService(AudioManager::class.java)
    wakeLock = (getSystemService(POWER_SERVICE) as PowerManager)
      .newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "Votic:document-listening")
    if (Build.VERSION.SDK_INT >= 26) {
      getSystemService(NotificationManager::class.java).createNotificationChannel(
        NotificationChannel(CHANNEL, "Votic listening", NotificationManager.IMPORTANCE_LOW)
          .apply { description = "Play, pause, and move through a document without opening Votic." }
      )
    }
    mediaSession = MediaSession(this, "Votic listening")
    mediaSession.setCallback(object : MediaSession.Callback() {
      override fun onPlay() = dispatch("play")
      override fun onPause() = pause()
      override fun onStop() = end()
      override fun onSkipToPrevious() = dispatch("previous")
      override fun onSkipToNext() = dispatch("next")
    }, main)
    mediaSession.isActive = true
    val filter = IntentFilter(AudioManager.ACTION_AUDIO_BECOMING_NOISY)
    if (Build.VERSION.SDK_INT >= 33) registerReceiver(unplugged, filter, Context.RECEIVER_NOT_EXPORTED)
    else registerReceiver(unplugged, filter)
    engine = TextToSpeech(this) { result ->
      main.post {
        if (destroyed) return@post
        if (result != TextToSpeech.SUCCESS) {
          fail("Your device's reading voice could not start. Check its text-to-speech settings.")
          stopSelf()
        } else {
          ready = true
          engine?.setAudioAttributes(attributes)
          if (wanted) play()
        }
      }
    }
    main.postDelayed({
      if (!destroyed && !ready) { fail("Your device's reading voice took too long to start. Try again."); stopSelf() }
    }, 15_000)
  }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    // Meet the foreground-service deadline before initializing TTS or requesting audio focus.
    startForeground(NOTIFICATION_ID, notification())
    when (intent?.action) {
      "load" -> {
        val next = pending
        pending = null
        if (next == null) { if (document == null) end(); return START_NOT_STICKY }
        invalidate_speech()
        document = next
        at = next.passageIndex
        offset = next.passages[at].offset_for(next.wordIndex)
        completed = false
        failure = null
        wanted = true
        publish()
        play()
      }
      "play" -> play()
      "pause" -> pause()
      "previous" -> skip(-1)
      "next" -> skip(1)
      "stop" -> end()
      else -> end()
    }
    // Do not resurrect a killed app or restart private document speech after a reboot.
    return START_NOT_STICKY
  }

  private fun dispatch(action: String) {
    val intent = Intent(this, VoticPlaybackService::class.java).setAction(action)
    try {
      if (Build.VERSION.SDK_INT >= 26) startForegroundService(intent) else startService(intent)
    } catch (_: Exception) { fail("Votic could not resume listening. Open Votic and try again.") }
  }

  private fun request_focus(): Boolean {
    if (hasFocus) return true
    val result = if (Build.VERSION.SDK_INT >= 26) {
      val request = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
        .setAudioAttributes(attributes).setOnAudioFocusChangeListener(focusListener, main)
        .setWillPauseWhenDucked(true).build()
      focusRequest = request
      audio.requestAudioFocus(request)
    } else {
      @Suppress("DEPRECATION")
      audio.requestAudioFocus(focusListener, AudioManager.STREAM_MUSIC, AudioManager.AUDIOFOCUS_GAIN)
    }
    hasFocus = result == AudioManager.AUDIOFOCUS_REQUEST_GRANTED
    return hasFocus
  }

  private fun release_focus() {
    if (Build.VERSION.SDK_INT >= 26) focusRequest?.let { audio.abandonAudioFocusRequest(it) }
    else {
      @Suppress("DEPRECATION")
      audio.abandonAudioFocus(focusListener)
    }
    focusRequest = null
    hasFocus = false
    if (wakeLock?.isHeld == true) wakeLock?.release()
  }

  private fun play() {
    if (document == null || destroyed) { end(); return }
    wanted = true
    // Own focus while TTS initializes too. If Spotify starts during initialization,
    // its loss callback cancels wanted before the ready callback can start narration.
    if (!request_focus()) { fail("Listening paused because another app is using audio. Try Play again."); return }
    if (!ready) { publish(); return }
    if (wakeLock?.isHeld == false) wakeLock?.acquire()
    if (completed) { at = 0; offset = 0; completed = false }
    failure = null
    playing = true
    publish()
    speak_chunk()
  }

  private fun speak_chunk() {
    val current = document ?: return
    val passage = current.passages[at]
    val start = offset.coerceIn(0, passage.text.lastIndex)
    // Native TTS has a maximum utterance length; split long paragraphs at whitespace when possible.
    var end = (start + TextToSpeech.getMaxSpeechInputLength() - 1).coerceAtMost(passage.text.length)
    if (end < passage.text.length) {
      val space = passage.text.lastIndexOf(' ', end - 1)
      if (space > start) end = space + 1
    }
    val token = (++serial).toString()
    utterance = token
    engine?.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
      override fun onStart(id: String?) = Unit
      override fun onRangeStart(id: String?, rangeStart: Int, rangeEnd: Int, frame: Int) {
        main.post {
          if (id != utterance || destroyed) return@post
          offset = start + rangeStart
          publish(false)
        }
      }
      override fun onDone(id: String?) {
        main.post {
          if (id != utterance || destroyed || !playing) return@post
          if (end < passage.text.length) { offset = end; speak_chunk() }
          else if (at < current.passages.lastIndex) { at += 1; offset = 0; publish(); speak_chunk() }
          else {
            offset = passage.offsets.last()
            completed = true
            pause()
            getSystemService(NotificationManager::class.java).cancel(NOTIFICATION_ID)
            stopSelf()
          }
        }
      }
      @Deprecated("Required by Android's UtteranceProgressListener")
      override fun onError(id: String?) {
        main.post { if (id == utterance && !destroyed) fail("Your device could not read this passage. Try Play again.") }
      }
    })
    try {
      if (configuredFor !== current) {
        val selected = current.voice?.let { name -> engine?.voices?.firstOrNull { it.name == name } }
        if (selected != null) engine?.voice = selected else engine?.language = Locale.getDefault()
        engine?.setSpeechRate(current.rate)
        configuredFor = current
      }
      val result = engine?.speak(passage.text.substring(start, end), TextToSpeech.QUEUE_FLUSH, null, token)
      if (result == TextToSpeech.ERROR) fail("Your device could not read this passage. Check its installed voices.")
    } catch (_: Exception) { fail("Your device could not read this passage. Check its installed voices.") }
  }

  private fun invalidate_speech() {
    utterance = null
    engine?.stop()
  }

  fun pause() {
    wanted = false
    playing = false
    invalidate_speech()
    release_focus()
    publish()
    // A paused session is resumable, but no longer holds a foreground service or wake lock.
    stopForeground(STOP_FOREGROUND_DETACH)
  }

  private fun skip(delta: Int) {
    val current = document ?: return
    val resume = playing || wanted
    val target = (at + delta).coerceIn(0, current.passages.lastIndex)
    if (target == at) { if (!playing && !wanted) pause(); return }
    invalidate_speech()
    at = target
    offset = 0
    completed = false
    failure = null
    publish()
    if (resume) play() else pause()
  }

  private fun fail(message: String) {
    failure = message
    pause()
  }

  fun end() {
    pause()
    document = null
    clear_state()
    stopForeground(STOP_FOREGROUND_REMOVE)
    getSystemService(NotificationManager::class.java).cancel(NOTIFICATION_ID)
    stopSelf()
  }

  private fun publish(updateNotification: Boolean = true) {
    val current = document ?: return
    state = mapOf("accountId" to current.accountId, "documentId" to current.documentId,
      "title" to current.title, "passageIndex" to at, "wordIndex" to current.passages[at].word_at(offset),
      "playing" to playing, "completed" to completed, "error" to failure)
    // JS can be suspended while native narration progresses. Save only the small position snapshot.
    val now = SystemClock.elapsedRealtime()
    if (updateNotification || now - lastCheckpoint >= 1000) {
      lastCheckpoint = now
      getSharedPreferences(PROGRESS_STORE, MODE_PRIVATE).edit()
        .putString("position", JSONObject(state).toString()).apply()
    }
    runCatching { observer?.invoke(state) }
    if (updateNotification) {
      mediaSession.setMetadata(MediaMetadata.Builder()
        .putString(MediaMetadata.METADATA_KEY_TITLE, current.title)
        .putString(MediaMetadata.METADATA_KEY_ARTIST, "Votic · Passage ${at + 1} of ${current.passages.size}").build())
      val actions = PlaybackState.ACTION_PLAY or PlaybackState.ACTION_PAUSE or PlaybackState.ACTION_PLAY_PAUSE or
        PlaybackState.ACTION_STOP or PlaybackState.ACTION_SKIP_TO_PREVIOUS or PlaybackState.ACTION_SKIP_TO_NEXT
      // Position is intentionally unknown: passage navigation is not a seconds-based seek bar.
      mediaSession.setPlaybackState(PlaybackState.Builder().setActions(actions)
        .setState(if (playing) PlaybackState.STATE_PLAYING else PlaybackState.STATE_PAUSED,
          PlaybackState.PLAYBACK_POSITION_UNKNOWN, if (playing) current.rate else 0f).build())
      getSystemService(NotificationManager::class.java).notify(NOTIFICATION_ID, notification())
    }
  }

  private fun action(action: String): PendingIntent {
    val intent = Intent(this, VoticPlaybackService::class.java).setAction(action)
    val flags = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    return if (Build.VERSION.SDK_INT >= 26) PendingIntent.getForegroundService(this, action.hashCode(), intent, flags)
    else PendingIntent.getService(this, action.hashCode(), intent, flags)
  }

  private fun notification(): Notification {
    val builder = if (Build.VERSION.SDK_INT >= 26) Notification.Builder(this, CHANNEL) else Notification.Builder(this)
    return builder.setSmallIcon(R.drawable.votic_playback_notification)
      .setContentTitle(document?.title ?: "Votic listening")
      .setContentText(failure ?: "Passage ${at + 1} · Read it. Hear it. Understand it.")
      .setCategory(Notification.CATEGORY_TRANSPORT).setVisibility(Notification.VISIBILITY_PRIVATE)
      .setOnlyAlertOnce(true).setShowWhen(false).setOngoing(playing)
      .setDeleteIntent(action("stop"))
      .addAction(Notification.Action.Builder(android.R.drawable.ic_media_previous, "Previous passage", action("previous")).build())
      .addAction(Notification.Action.Builder(if (playing) android.R.drawable.ic_media_pause else android.R.drawable.ic_media_play,
        if (playing) "Pause" else "Play", action(if (playing) "pause" else "play")).build())
      .addAction(Notification.Action.Builder(android.R.drawable.ic_media_next, "Next passage", action("next")).build())
      .addAction(Notification.Action.Builder(android.R.drawable.ic_menu_close_clear_cancel, "Stop listening", action("stop")).build())
      .setStyle(Notification.MediaStyle().setMediaSession(mediaSession.sessionToken).setShowActionsInCompactView(0, 1, 2))
      .build()
  }

  override fun onDestroy() {
    destroyed = true
    wanted = false
    playing = false
    invalidate_speech()
    release_focus()
    // Preserve the last position for the foreground UI, including normal completion.
    document?.let { lastCheckpoint = 0; publish(false) }
    engine?.shutdown()
    engine = null
    document = null
    getSystemService(NotificationManager::class.java).cancel(NOTIFICATION_ID)
    mediaSession.release()
    unregisterReceiver(unplugged)
    main.removeCallbacksAndMessages(null)
    instance = null
    super.onDestroy()
  }
}
