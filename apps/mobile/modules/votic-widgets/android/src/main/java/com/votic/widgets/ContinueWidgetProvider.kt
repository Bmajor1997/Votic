package com.votic.widgets

import android.content.Context
import android.view.View
import android.widget.RemoteViews

/**
 * Continue: the document in progress, opened most recently. Small shows the document and its progress;
 * medium adds Listen and Read; large adds Up next and this week at a glance.
 */
class ContinueWidgetProvider : VoticWidgetProvider() {
  override val sizes = WidgetSize.values().toList()

  override fun build(context: Context, size: WidgetSize, snapshot: VoticWidgetSnapshot?): RemoteViews {
    if (snapshot == null || !snapshot.signedIn) {
      return message(
        context, size, R.drawable.votic_widget_ic_person, "Open Votic",
        "Sign in to see what you're reading and listening to.", VoticWidgets.link(context), showAction = false,
      )
    }
    val document = snapshot.current
      ?: return if (snapshot.documentCount == 0) {
        message(
          context, size, R.drawable.votic_widget_ic_note_add, "Ready when you are",
          "Add a PDF, Word, PowerPoint, EPUB, or text file, then listen or read along.",
          VoticWidgets.link(context, "add"), showAction = true,
        )
      } else {
        message(
          context, size, R.drawable.votic_widget_ic_done, "All caught up",
          "You've finished everything in your library. Add something new to keep going.",
          VoticWidgets.link(context, "add"), showAction = true,
        )
      }
    return when (size) {
      WidgetSize.SMALL -> small(context, document, compact = true)
      WidgetSize.SMALL_TALL -> small(context, document, compact = false)
      WidgetSize.MEDIUM ->
        RemoteViews(context.packageName, R.layout.votic_widget_continue_wide).also { top(context, it, document) }
      WidgetSize.MEDIUM_TALL ->
        RemoteViews(context.packageName, R.layout.votic_widget_continue_medium).also {
          top(context, it, document)
          it.setInt(R.id.cover_line4, "setBackgroundResource", lineFor(document.tone))
        }
      WidgetSize.LARGE -> large(context, document, snapshot)
    }
  }

  private fun small(context: Context, document: WidgetDocument, compact: Boolean): RemoteViews {
    val views = RemoteViews(
      context.packageName,
      if (compact) R.layout.votic_widget_continue_small_compact else R.layout.votic_widget_continue_small,
    )
    if (compact) views.setTextViewText(R.id.kind_label, document.kind) else cover(views, document)
    views.setTextViewText(R.id.title, document.title)
    views.setProgressBar(R.id.progress, 100, document.percent, false)
    views.setTextViewText(R.id.status, document.shortStatus)
    views.setImageViewResource(
      R.id.mode_icon, if (document.listens) R.drawable.votic_widget_ic_headphones else R.drawable.votic_widget_ic_book,
    )
    views.setOnClickPendingIntent(R.id.widget_root, VoticWidgets.resume(context, document))
    views.setContentDescription(
      R.id.widget_root,
      "${if (document.listens) "Continue listening" else "Continue reading"}. ${spoken(document)}",
    )
    return views
  }

  /** The document with Listen and Read; the way it was last used is the filled button. */
  private fun top(context: Context, views: RemoteViews, document: WidgetDocument) {
    cover(views, document)
    views.setTextViewText(R.id.title, document.title)
    views.setProgressBar(R.id.progress, 100, document.percent, false)
    views.setTextViewText(R.id.status, document.status)
    views.setViewVisibility(R.id.listen_filled, if (document.listens) View.VISIBLE else View.GONE)
    views.setViewVisibility(R.id.listen_outline, if (document.listens) View.GONE else View.VISIBLE)
    views.setViewVisibility(R.id.read_filled, if (document.listens) View.GONE else View.VISIBLE)
    views.setViewVisibility(R.id.read_outline, if (document.listens) View.VISIBLE else View.GONE)
    val listen = VoticWidgets.resume(context, document, "listen")
    val read = VoticWidgets.resume(context, document, "read")
    for (id in listOf(R.id.listen_filled, R.id.listen_outline)) {
      views.setOnClickPendingIntent(id, listen)
      views.setContentDescription(id, "Continue listening to ${document.title}")
    }
    for (id in listOf(R.id.read_filled, R.id.read_outline)) {
      views.setOnClickPendingIntent(id, read)
      views.setContentDescription(id, "Continue reading ${document.title}")
    }
    views.setOnClickPendingIntent(R.id.widget_root, VoticWidgets.resume(context, document))
    views.setContentDescription(R.id.title, spoken(document))
  }

  private fun large(context: Context, document: WidgetDocument, snapshot: VoticWidgetSnapshot): RemoteViews {
    val views = RemoteViews(context.packageName, R.layout.votic_widget_continue_large)
    top(context, views, document)
    views.setInt(R.id.cover_line4, "setBackgroundResource", lineFor(document.tone))

    views.removeAllViews(R.id.up_next)
    val upNext = snapshot.upNext.take(3)
    val hasUpNext = upNext.isNotEmpty()
    views.setViewVisibility(R.id.up_next_divider, if (hasUpNext) View.VISIBLE else View.GONE)
    views.setViewVisibility(R.id.up_next_label, if (hasUpNext) View.VISIBLE else View.GONE)
    for (item in upNext) {
      val row = RemoteViews(context.packageName, R.layout.votic_widget_next_row)
      row.setInt(R.id.row_band, "setBackgroundResource", bandFor(item.tone))
      row.setInt(R.id.row_line1, "setBackgroundResource", lineFor(item.tone))
      row.setInt(R.id.row_line2, "setBackgroundResource", lineFor(item.tone))
      row.setTextViewText(R.id.row_title, item.title)
      val inProgress = item.progress > 0 && item.progress < 1
      row.setViewVisibility(R.id.row_progress, if (inProgress) View.VISIBLE else View.GONE)
      row.setProgressBar(R.id.row_progress, 100, item.percent, false)
      row.setTextViewText(
        R.id.row_status,
        when {
          item.progress >= 1 -> "Finished"
          item.progress > 0 -> "${item.percent}%"
          else -> "New"
        },
      )
      row.setOnClickPendingIntent(R.id.row_root, VoticWidgets.resume(context, item, "read"))
      row.setContentDescription(R.id.row_root, "Open ${spoken(item)}")
      views.addView(R.id.up_next, row)
    }

    val week = VoticWeek(snapshot.days)
    views.setTextViewText(R.id.week_total, if (week.total > 0) VoticWeek.duration(week.total) else "No activity")
    WeekWidgetProvider.addBars(context, views, week, R.layout.votic_widget_bar_chapter, labeled = false)
    views.setOnClickPendingIntent(R.id.week_footer, VoticWidgets.link(context, "statistics"))
    views.setContentDescription(
      R.id.week_footer,
      if (week.total > 0) "This week: ${VoticWeek.spokenDuration(week.total)}. Open Statistics."
      else "This week: no reading or listening yet. Open Statistics.",
    )
    return views
  }

  /** Colors the cover in the document's family and labels its band with the file type. */
  private fun cover(views: RemoteViews, document: WidgetDocument) {
    views.setTextViewText(R.id.cover_band, document.coverLabel)
    views.setInt(R.id.cover_band, "setBackgroundResource", bandFor(document.tone))
    for (id in listOf(R.id.cover_line1, R.id.cover_line2, R.id.cover_line3)) {
      views.setInt(id, "setBackgroundResource", lineFor(document.tone))
    }
  }

  private fun message(
    context: Context,
    size: WidgetSize,
    icon: Int,
    title: String,
    body: String,
    link: android.app.PendingIntent,
    showAction: Boolean,
  ): RemoteViews {
    val views = RemoteViews(context.packageName, R.layout.votic_widget_message)
    views.setImageViewResource(R.id.message_icon, icon)
    views.setTextViewText(R.id.message_title, title)
    views.setTextViewText(R.id.message_body, body)
    showMessageParts(views, size, showAction)
    views.setOnClickPendingIntent(R.id.message_action, link)
    views.setOnClickPendingIntent(R.id.widget_root, link)
    views.setContentDescription(R.id.widget_root, "$title. $body")
    return views
  }

  companion object {
    /** What fits: small sizes show the title; short wide ones add the button; taller ones add the explanation. */
    fun showMessageParts(views: RemoteViews, size: WidgetSize, showAction: Boolean) {
      val icon = size != WidgetSize.MEDIUM
      val body = size == WidgetSize.SMALL_TALL || size == WidgetSize.MEDIUM_TALL || size == WidgetSize.LARGE
      val action = showAction && (size == WidgetSize.MEDIUM || size == WidgetSize.MEDIUM_TALL || size == WidgetSize.LARGE)
      views.setViewVisibility(R.id.message_icon, if (icon) View.VISIBLE else View.GONE)
      views.setViewVisibility(R.id.message_body, if (body) View.VISIBLE else View.GONE)
      views.setInt(R.id.message_body, "setMaxLines", if (size == WidgetSize.LARGE) 3 else 2)
      views.setViewVisibility(R.id.message_action_slot, if (action) View.VISIBLE else View.GONE)
    }

    fun bandFor(tone: String) = when (tone) {
      "pdf" -> R.drawable.votic_widget_band_pdf
      "slides" -> R.drawable.votic_widget_band_slides
      "book" -> R.drawable.votic_widget_band_book
      "text" -> R.drawable.votic_widget_band_text
      else -> R.drawable.votic_widget_band_chapter
    }

    fun lineFor(tone: String) = when (tone) {
      "pdf" -> R.drawable.votic_widget_line_pdf
      "slides" -> R.drawable.votic_widget_line_slides
      "book" -> R.drawable.votic_widget_line_book
      "text" -> R.drawable.votic_widget_line_text
      else -> R.drawable.votic_widget_line_chapter
    }

    fun spoken(document: WidgetDocument) = "${document.title}, ${document.kind}. ${document.status}."
  }
}
