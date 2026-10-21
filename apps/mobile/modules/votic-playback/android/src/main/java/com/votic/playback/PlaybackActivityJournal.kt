package com.votic.playback

import android.content.Context
import android.os.SystemClock
import org.json.JSONObject

/** Cumulative, durable checkpoints. Only TTS onStart/onDone and transport events run the clock. */
class PlaybackActivityJournal(private val context: Context) {
  companion object {
    private fun localHour(time: Long): Long {
      val calendar = java.util.Calendar.getInstance().apply { timeInMillis = time }
      return time - calendar.get(java.util.Calendar.MINUTE) * 60000L - calendar.get(java.util.Calendar.SECOND) * 1000L - calendar.get(java.util.Calendar.MILLISECOND)
    }
    private var liveSession: String? = null
    private const val STORE = "votic.playback.activity.v1"
    @Synchronized fun events(context: Context, accountId: String): List<Map<String, Any>> =
      context.getSharedPreferences(STORE, Context.MODE_PRIVATE).all.values.mapNotNull { raw ->
        runCatching {
          val event = JSONObject(raw as String)
          if (event.getString("accountId") != accountId) null else mapOf(
            "id" to event.getString("id"), "accountId" to accountId,
            "documentId" to event.getString("documentId"), "start" to event.getLong("start"),
            "durationMs" to event.getLong("durationMs"))
        }.getOrNull()
      }
    @Synchronized fun acknowledge(context: Context, accountId: String, raw: String) {
      val events = org.json.JSONArray(raw)
      val preferences = context.getSharedPreferences(STORE, Context.MODE_PRIVATE)
      val edit = preferences.edit()
      val hour = localHour(System.currentTimeMillis()) / 60000
      for (index in 0 until events.length()) {
        val received = events.getJSONObject(index)
        val id = received.getString("id")
        val stored = preferences.getString(id, null)?.let { JSONObject(it) } ?: continue
        if (id.startsWith("$liveSession:") && id.endsWith(":$hour")) continue
        if (stored.getString("accountId") == accountId && stored.getLong("durationMs") == received.getLong("durationMs")) edit.remove(id)
      }
      edit.commit()
    }
    @Synchronized fun clear(context: Context, accountId: String) {
      val preferences = context.getSharedPreferences(STORE, Context.MODE_PRIVATE)
      val edit = preferences.edit()
      for (event in events(context, accountId)) edit.remove(event["id"] as String)
      edit.commit()
    }
  }
  private val identity = SpeechSessionIdentity()
  private var session = identity.id.also { liveSession = it }
  private var active: PlaybackDocument? = null
  private val clock = MeasuredSpeechClock()
  fun speechStarted(document: PlaybackDocument) {
    if (active != null) checkpoint()
    session = identity.forAccount(document.accountId)
    liveSession = session
    active = document
    clock.start(SystemClock.elapsedRealtime())
  }
  fun checkpoint() {
    val document = active ?: return
    val now = SystemClock.elapsedRealtime()
    val elapsed = clock.checkpoint(now)
    if (elapsed == 0L) return
    val wallEnd = System.currentTimeMillis()
    var cursor = wallEnd - elapsed
    // Split at local hour boundaries, including zones with fractional UTC offsets.
    val preferences = context.getSharedPreferences(STORE, Context.MODE_PRIVATE)
    val edit = preferences.edit()
    while (cursor < wallEnd) {
      val hourStart = localHour(cursor)
      val hour = hourStart / 60000
      val end = minOf(wallEnd, hourStart + 3_600_000L)
      val id = "$session:${document.documentId}:$hour"
      val prior = preferences.getString(id, null)?.let { JSONObject(it) }
      val event = prior ?: JSONObject().put("id", id).put("accountId", document.accountId)
        .put("documentId", document.documentId).put("start", cursor).put("durationMs", 0L)
      event.put("durationMs", event.getLong("durationMs") + end - cursor)
      edit.putString(id, event.toString())
      cursor = end
    }
    // commit finishes before emitting a state notification or stopping the service.
    edit.commit()
  }
  fun speechStopped() { checkpoint(); active = null; clock.reset() }
  fun close() { speechStopped(); if (liveSession == session) liveSession = null }
}
