package com.votic.widgets

import android.app.AlarmManager
import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.util.SizeF
import android.widget.RemoteViews
import java.util.Calendar

/**
 * The sizes Votic's widgets draw, in order of preference. Each is the smallest size its layout fits in:
 * Android only guarantees about 110dp for two rows, so short sizes get compact layouts.
 */
enum class WidgetSize(val dp: SizeF) {
  SMALL(SizeF(110f, 110f)),
  SMALL_TALL(SizeF(110f, 150f)),
  MEDIUM(SizeF(220f, 110f)),
  MEDIUM_TALL(SizeF(220f, 150f)),
  LARGE(SizeF(220f, 320f)),
}

object VoticWidgets {
  /** Sent to the providers just after midnight, so "today" and the week move on without the app. */
  const val ACTION_MIDNIGHT = "com.votic.widgets.MIDNIGHT"
  private const val MIDNIGHT_REQUEST = 7301

  /** Redraws every Votic widget from the snapshot the app last shared. */
  fun refreshAll(context: Context) {
    VoticWidgetProvider.updateAll(context, ContinueWidgetProvider::class.java) { ContinueWidgetProvider() }
    VoticWidgetProvider.updateAll(context, WeekWidgetProvider::class.java) { WeekWidgetProvider() }
  }

  /** A link back into Votic. The app handles these in app/widget.tsx. */
  fun link(context: Context, open: String? = null, id: String? = null): PendingIntent {
    val uri = Uri.Builder().scheme("votic").authority("widget").apply {
      if (open != null) appendQueryParameter("open", open)
      if (id != null) appendQueryParameter("id", id)
    }.build()
    val intent = Intent(Intent.ACTION_VIEW, uri)
      .setPackage(context.packageName)
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
    return PendingIntent.getActivity(
      context,
      uri.toString().hashCode(),
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
  }

  fun resume(context: Context, document: WidgetDocument, mode: String = document.mode): PendingIntent =
    link(context, if (mode == "listen") "listen" else "read", document.id)

  fun scheduleMidnightRefresh(context: Context) {
    val alarms = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return
    val next = Calendar.getInstance().apply {
      add(Calendar.DAY_OF_MONTH, 1)
      set(Calendar.HOUR_OF_DAY, 0)
      set(Calendar.MINUTE, 0)
      set(Calendar.SECOND, 5)
      set(Calendar.MILLISECOND, 0)
    }
    // Inexact and not waking the phone: the widgets catch up the next time the screen is on.
    alarms.set(AlarmManager.RTC, next.timeInMillis, midnightIntent(context))
  }

  fun cancelMidnightRefresh(context: Context) {
    (context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager)?.cancel(midnightIntent(context))
  }

  private fun midnightIntent(context: Context): PendingIntent =
    PendingIntent.getBroadcast(
      context,
      MIDNIGHT_REQUEST,
      Intent(context, WeekWidgetProvider::class.java).setAction(ACTION_MIDNIGHT),
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )

  fun hasWidgets(context: Context): Boolean {
    val manager = AppWidgetManager.getInstance(context)
    return listOf(ContinueWidgetProvider::class.java, WeekWidgetProvider::class.java).any {
      manager.getAppWidgetIds(ComponentName(context, it)).isNotEmpty()
    }
  }
}

/**
 * Shared behavior for Votic's widgets: draw every size from the shared snapshot, let Android 12+ pick the
 * size that fits, and choose one on older versions from the widget's current size.
 */
abstract class VoticWidgetProvider : AppWidgetProvider() {
  /** The sizes this widget has a layout for. */
  protected abstract val sizes: List<WidgetSize>

  protected abstract fun build(context: Context, size: WidgetSize, snapshot: VoticWidgetSnapshot?): RemoteViews

  override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
    val snapshot = VoticWidgetSnapshot.load(context)
    ids.forEach { update(context, manager, it, snapshot) }
    VoticWidgets.scheduleMidnightRefresh(context)
  }

  override fun onAppWidgetOptionsChanged(context: Context, manager: AppWidgetManager, id: Int, options: Bundle) {
    update(context, manager, id, VoticWidgetSnapshot.load(context))
  }

  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action == VoticWidgets.ACTION_MIDNIGHT) {
      VoticWidgets.refreshAll(context)
      return
    }
    super.onReceive(context, intent)
  }

  override fun onDisabled(context: Context) {
    if (!VoticWidgets.hasWidgets(context)) VoticWidgets.cancelMidnightRefresh(context)
  }

  private fun update(context: Context, manager: AppWidgetManager, id: Int, snapshot: VoticWidgetSnapshot?) {
    val views = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      RemoteViews(sizes.associate { it.dp to build(context, it, snapshot) })
    } else {
      build(context, sizeFor(manager.getAppWidgetOptions(id)), snapshot)
    }
    manager.updateAppWidget(id, views)
  }

  /**
   * Before Android 12 the launcher reports the widget's size in dp (portrait: min width, max height); use the
   * most preferred size that fits. Android 12 and later choose from all the sizes themselves.
   */
  private fun sizeFor(options: Bundle): WidgetSize {
    val width = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH)
    val height = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT)
    return sizes.lastOrNull { it.dp.width <= width && it.dp.height <= height } ?: sizes.first()
  }

  companion object {
    fun updateAll(context: Context, type: Class<out VoticWidgetProvider>, create: () -> VoticWidgetProvider) {
      val manager = AppWidgetManager.getInstance(context)
      val ids = manager.getAppWidgetIds(ComponentName(context, type))
      if (ids.isNotEmpty()) create().onUpdate(context, manager, ids)
    }
  }
}
