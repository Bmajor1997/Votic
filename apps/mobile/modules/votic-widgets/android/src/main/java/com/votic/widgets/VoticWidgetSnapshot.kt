package com.votic.widgets

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale

/**
 * What the Votic app last shared with its widgets. Written by the app (src/widgets/widgetSnapshot.ts)
 * through VoticWidgetsModule; the widgets only read it.
 */
data class WidgetDocument(
  val id: String,
  val title: String,
  /** "PDF", "Word", "PowerPoint", "EPUB", "Markdown", or "Text". */
  val kind: String,
  /** pdf, slides, book, chapter, or text. */
  val tone: String,
  /** 0 to 1. */
  val progress: Double,
  /** "42% · about 10 min left", "Not started", or "Finished". */
  val status: String,
  /** "listen" or "read": how it was last used. */
  val mode: String,
) {
  val percent: Int get() = Math.round(progress.coerceIn(0.0, 1.0) * 100).toInt()
  val listens: Boolean get() = mode == "listen"

  /** "PDF", "DOC", "PPT"... for the small cover band. */
  val coverLabel: String
    get() = when (kind) {
      "PowerPoint" -> "PPT"
      "Word" -> "DOC"
      "Markdown" -> "MD"
      "Text" -> "TXT"
      else -> kind.uppercase(Locale.US)
    }

  /** "42% · 10 min left" for narrow widgets. */
  val shortStatus: String get() = status.replace("about ", "")
}

data class VoticWidgetSnapshot(
  val signedIn: Boolean,
  val current: WidgetDocument?,
  val upNext: List<WidgetDocument>,
  val documentCount: Int,
  /** Local day ("2026-10-09") to reading and listening seconds. */
  val days: Map<String, Pair<Int, Int>>,
) {
  companion object {
    private const val PREFS = "votic_widgets"
    const val KEY = "votic.widgets.snapshot.v1"

    fun save(context: Context, json: String) {
      context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY, json).apply()
    }

    /** The snapshot the app last saved, or null before Votic has been opened (or if it can't be read). */
    fun load(context: Context): VoticWidgetSnapshot? =
      parse(context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY, null))

    fun parse(json: String?): VoticWidgetSnapshot? {
      if (json.isNullOrEmpty()) return null
      return try {
        val root = JSONObject(json)
        if (root.optInt("version") != 1) return null
        val days = mutableMapOf<String, Pair<Int, Int>>()
        val dayArray = root.optJSONArray("days") ?: JSONArray()
        for (index in 0 until dayArray.length()) {
          val day = dayArray.getJSONObject(index)
          days[day.getString("date")] =
            Pair(day.optInt("readingSeconds").coerceAtLeast(0), day.optInt("listeningSeconds").coerceAtLeast(0))
        }
        val upNextArray = root.optJSONArray("upNext") ?: JSONArray()
        VoticWidgetSnapshot(
          signedIn = root.optBoolean("signedIn"),
          current = root.optJSONObject("continue")?.let(::document),
          upNext = (0 until upNextArray.length()).map { document(upNextArray.getJSONObject(it)) },
          documentCount = root.optInt("documentCount"),
          days = days,
        )
      } catch (error: Exception) {
        null
      }
    }

    private fun document(json: JSONObject) = WidgetDocument(
      id = json.getString("id"),
      title = json.optString("title", "Untitled document"),
      kind = json.optString("kind", "Text"),
      tone = json.optString("tone", "chapter"),
      progress = json.optDouble("progress", 0.0),
      status = json.optString("status"),
      mode = json.optString("mode", "read"),
    )
  }
}

/**
 * This week's reading and listening, worked out from the shared daily totals when the widget draws, so it
 * stays right after midnight or a new week even if Votic hasn't been opened since. Weeks start on Monday,
 * as they do in the app.
 */
class VoticWeek(days: Map<String, Pair<Int, Int>>, now: Date = Date()) {
  val reading: Int
  val listening: Int
  /** Monday to Sunday, reading plus listening seconds. */
  val dayTotals: IntArray
  /** 0 for Monday to 6 for Sunday. */
  val todayIndex: Int
  /** Consecutive active days ending today, or yesterday when today has no activity yet. */
  val streak: Int
  val total: Int get() = reading + listening

  init {
    val today = Calendar.getInstance().apply {
      time = now
      set(Calendar.HOUR_OF_DAY, 0)
      set(Calendar.MINUTE, 0)
      set(Calendar.SECOND, 0)
      set(Calendar.MILLISECOND, 0)
    }
    todayIndex = (today.get(Calendar.DAY_OF_WEEK) + 5) % 7
    val cursor = (today.clone() as Calendar).apply { add(Calendar.DAY_OF_MONTH, -todayIndex) }
    var weekReading = 0
    var weekListening = 0
    dayTotals = IntArray(7) {
      val (dayReading, dayListening) = days[key(cursor.time)] ?: Pair(0, 0)
      cursor.add(Calendar.DAY_OF_MONTH, 1)
      weekReading += dayReading
      weekListening += dayListening
      dayReading + dayListening
    }
    reading = weekReading
    listening = weekListening

    fun active(date: Calendar): Boolean {
      val (dayReading, dayListening) = days[key(date.time)] ?: return false
      return dayReading + dayListening >= ACTIVE_DAY_SECONDS
    }
    val back = today.clone() as Calendar
    if (!active(back)) back.add(Calendar.DAY_OF_MONTH, -1)
    var run = 0
    while (active(back) && run < 400) {
      run += 1
      back.add(Calendar.DAY_OF_MONTH, -1)
    }
    streak = run
  }

  companion object {
    /** A day counts as active after one minute, the same rule the app's Statistics uses. */
    const val ACTIVE_DAY_SECONDS = 60
    val LETTERS = arrayOf("M", "T", "W", "T", "F", "S", "S")

    fun key(date: Date): String = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(date)

    /** "2 h 5 min", "45 min", "under 1 min", or "0 min", as the app writes durations. */
    fun duration(seconds: Int): String {
      val minutes = Math.round(seconds / 60.0).toInt()
      if (seconds > 0 && minutes == 0) return "under 1 min"
      if (minutes < 60) return "$minutes min"
      val hours = minutes / 60
      val rest = minutes % 60
      return if (rest > 0) "$hours h $rest min" else "$hours h"
    }

    /** The same duration for TalkBack, in words. */
    fun spokenDuration(seconds: Int): String {
      val minutes = Math.round(seconds / 60.0).toInt()
      if (seconds > 0 && minutes == 0) return "less than a minute"
      val hours = minutes / 60
      val rest = minutes % 60
      val parts = mutableListOf<String>()
      if (hours > 0) parts.add("$hours ${if (hours == 1) "hour" else "hours"}")
      if (rest > 0 || hours == 0) parts.add("$rest ${if (rest == 1) "minute" else "minutes"}")
      return parts.joinToString(" ")
    }
  }
}
