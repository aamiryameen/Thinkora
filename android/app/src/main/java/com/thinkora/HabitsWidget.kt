package com.thinkora

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.view.View
import android.widget.RemoteViews
import org.json.JSONArray
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class HabitsWidget : AppWidgetProvider() {

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        for (id in appWidgetIds) {
            updateWidget(context, appWidgetManager, id)
        }
    }

    companion object {
        private data class HabitRow(val rowId: Int, val dotId: Int, val nameId: Int, val streakId: Int)

        private val ROWS = listOf(
            HabitRow(R.id.widget_habit_row_1, R.id.widget_habit_dot_1, R.id.widget_habit_name_1, R.id.widget_habit_streak_1),
            HabitRow(R.id.widget_habit_row_2, R.id.widget_habit_dot_2, R.id.widget_habit_name_2, R.id.widget_habit_streak_2),
            HabitRow(R.id.widget_habit_row_3, R.id.widget_habit_dot_3, R.id.widget_habit_name_3, R.id.widget_habit_streak_3),
            HabitRow(R.id.widget_habit_row_4, R.id.widget_habit_dot_4, R.id.widget_habit_name_4, R.id.widget_habit_streak_4),
        )

        private fun todayKey(): String =
            SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date())

        private fun calcStreak(completedDates: List<String>): Int {
            if (completedDates.isEmpty()) return 0
            val sdf = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())
            val sorted = completedDates.mapNotNull {
                try { sdf.parse(it) } catch (e: Exception) { null }
            }.sortedDescending()

            var streak = 0
            var prev = Date()
            val ms1Day = 86400000L
            for (d in sorted) {
                val diff = (prev.time - d.time) / ms1Day
                if (diff <= 1) {
                    streak++
                    prev = d
                } else break
            }
            return streak
        }

        fun updateWidget(context: Context, mgr: AppWidgetManager, widgetId: Int) {
            val prefs = context.getSharedPreferences("thinkora_widget", Context.MODE_PRIVATE)
            val json = prefs.getString("habits_json", "[]") ?: "[]"

            val views = RemoteViews(context.packageName, R.layout.widget_habits)

            // Tap to open app
            val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)
            val pi = PendingIntent.getActivity(
                context, 1, launchIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(R.id.widget_habits_title, pi)

            try {
                val arr = JSONArray(json)
                val today = todayKey()
                val habits = mutableListOf<JSONObject>()

                for (i in 0 until arr.length()) {
                    val h = arr.getJSONObject(i)
                    if (!h.optBoolean("archived", false)) {
                        habits.add(h)
                    }
                }

                val doneCount = habits.count { h ->
                    val dates = h.optJSONArray("completedDates")
                    dates != null && (0 until dates.length()).any { dates.getString(it) == today }
                }

                views.setTextViewText(R.id.widget_habits_count, "$doneCount/${habits.size}")

                if (habits.isEmpty()) {
                    views.setViewVisibility(R.id.widget_habits_empty, View.VISIBLE)
                } else {
                    views.setViewVisibility(R.id.widget_habits_empty, View.GONE)
                }

                val display = habits.take(4)

                for ((idx, row) in ROWS.withIndex()) {
                    if (idx < display.size) {
                        val habit = display[idx]
                        val datesArr = habit.optJSONArray("completedDates")
                        val dates = if (datesArr != null) {
                            (0 until datesArr.length()).map { datesArr.getString(it) }
                        } else emptyList()

                        val isDoneToday = dates.contains(today)
                        val streak = calcStreak(dates)

                        views.setViewVisibility(row.rowId, View.VISIBLE)
                        views.setTextViewText(row.nameId, habit.optString("name", "Habit"))
                        // Dot: filled if done today
                        views.setTextViewText(row.dotId, if (isDoneToday) "✓" else "○")
                        views.setTextColor(row.dotId,
                            if (isDoneToday) 0xFF4ADE80.toInt() else 0xAAFFFFFF.toInt())
                        // Streak
                        views.setTextViewText(row.streakId,
                            if (streak > 0) "🔥$streak" else "")
                    } else {
                        views.setViewVisibility(row.rowId, View.GONE)
                    }
                }

            } catch (e: Exception) {
                views.setTextViewText(R.id.widget_habits_count, "Tap to open")
                views.setViewVisibility(R.id.widget_habits_empty, View.VISIBLE)
                views.setTextViewText(R.id.widget_habits_empty, "Open app to sync")
            }

            mgr.updateAppWidget(widgetId, views)
        }
    }
}
