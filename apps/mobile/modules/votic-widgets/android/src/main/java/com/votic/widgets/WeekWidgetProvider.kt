package com.votic.widgets

import android.content.Context
import android.graphics.Typeface
import android.text.SpannableString
import android.text.Spanned
import android.text.style.StyleSpan
import android.util.TypedValue
import android.view.View
import android.widget.RemoteViews

/** This Week: reading and listening time, Monday to Sunday. A tap opens Statistics. */
class WeekWidgetProvider : VoticWidgetProvider() {
  override val sizes = listOf(WidgetSize.SMALL, WidgetSize.SMALL_TALL, WidgetSize.MEDIUM, WidgetSize.MEDIUM_TALL)

  override fun build(context: Context, size: WidgetSize, snapshot: VoticWidgetSnapshot?): RemoteViews {
    if (snapshot == null || !snapshot.signedIn) {
      val views = RemoteViews(context.packageName, R.layout.votic_widget_week_message)
      views.setImageViewResource(R.id.message_icon, R.drawable.votic_widget_ic_chart)
      views.setTextViewText(R.id.message_title, "Open Votic")
      views.setTextViewText(R.id.message_body, "Sign in to see your reading and listening this week.")
      ContinueWidgetProvider.showMessageParts(views, size, showAction = false)
      views.setOnClickPendingIntent(R.id.widget_root, VoticWidgets.link(context))
      return views
    }
    val week = VoticWeek(snapshot.days)
    val narrow = size == WidgetSize.SMALL || size == WidgetSize.SMALL_TALL
    // Short sizes (about 82dp inside the padding) drop the extra line and use a smaller total.
    val short = size == WidgetSize.SMALL || size == WidgetSize.MEDIUM
    val views = RemoteViews(
      context.packageName,
      if (narrow) R.layout.votic_widget_week_small else R.layout.votic_widget_week_medium,
    )
    views.setTextViewText(R.id.week_total, if (week.total > 0) VoticWeek.duration(week.total) else "No activity")
    if (short) views.setTextViewTextSize(R.id.week_total, TypedValue.COMPLEX_UNIT_SP, 21f)
    addBars(context, views, week, R.layout.votic_widget_bar_activity, labeled = true)

    if (narrow) {
      views.setViewVisibility(R.id.week_caption, if (short) View.GONE else View.VISIBLE)
      views.setTextViewText(
        R.id.week_caption,
        when {
          week.streak >= 2 -> "${week.streak} days in a row"
          week.total == 0 -> "Listen or read to start"
          week.listening > week.reading -> "Mostly listening"
          else -> "Mostly reading"
        },
      )
    } else {
      val active = week.total > 0
      views.setViewVisibility(R.id.week_split, if (active) View.VISIBLE else View.GONE)
      // The short size has room for one line under the split: which way the week leaned.
      views.setViewVisibility(R.id.week_legend, if (active && !short) View.VISIBLE else View.GONE)
      views.setViewVisibility(R.id.week_mix, if (active && short) View.VISIBLE else View.GONE)
      views.setTextViewText(R.id.week_mix, if (week.listening > week.reading) "Mostly listening" else "Mostly reading")
      views.setViewVisibility(R.id.week_empty, if (active) View.GONE else View.VISIBLE)
      views.setInt(R.id.week_empty, "setMaxLines", if (short) 2 else 3)
      views.setProgressBar(R.id.week_split, 100, if (active) week.reading * 100 / week.total else 0, false)
      views.setTextViewText(R.id.week_reading, "Reading ${VoticWeek.duration(week.reading)}")
      views.setTextViewText(R.id.week_listening, "Listening ${VoticWeek.duration(week.listening)}")
      views.setViewVisibility(R.id.week_streak_row, if (week.streak >= 2 && !short) View.VISIBLE else View.GONE)
      views.setTextViewText(R.id.week_streak, "${week.streak} days in a row")
    }

    views.setOnClickPendingIntent(R.id.widget_root, VoticWidgets.link(context, "statistics"))
    views.setContentDescription(R.id.widget_root, spoken(week))
    return views
  }

  companion object {
    /** Seven day bars, Monday to Sunday, scaled to the busiest day. Today's letter is bold. */
    fun addBars(context: Context, views: RemoteViews, week: VoticWeek, layout: Int, labeled: Boolean) {
      views.removeAllViews(R.id.week_bars)
      val peak = maxOf(week.dayTotals.maxOrNull() ?: 0, 1)
      week.dayTotals.forEachIndexed { index, seconds ->
        val bar = RemoteViews(context.packageName, layout)
        // A day with any time shows at least a sliver, so it never looks like nothing happened.
        val level = if (seconds > 0) maxOf(8, seconds * 100 / peak) else 0
        bar.setProgressBar(R.id.bar, 100, level, false)
        if (labeled) {
          val letter = SpannableString(VoticWeek.LETTERS[index])
          if (index == week.todayIndex) {
            letter.setSpan(StyleSpan(Typeface.BOLD), 0, letter.length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
          }
          bar.setTextViewText(R.id.bar_letter, letter)
        }
        views.addView(R.id.week_bars, bar)
      }
    }

    fun spoken(week: VoticWeek): String {
      if (week.total == 0) return "This week: no reading or listening yet. Opens Statistics."
      val parts = mutableListOf(
        "This week: ${VoticWeek.spokenDuration(week.total)}",
        "reading ${VoticWeek.spokenDuration(week.reading)}, listening ${VoticWeek.spokenDuration(week.listening)}",
      )
      if (week.streak >= 2) parts.add("${week.streak} days in a row")
      return parts.joinToString(". ") + ". Opens Statistics."
    }
  }
}
