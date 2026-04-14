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

class TasksWidget : AppWidgetProvider() {

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
        private val ROW_IDS = listOf(
            Triple(R.id.widget_task_row_1, R.id.widget_task_text_1, R.id.widget_task_due_1),
            Triple(R.id.widget_task_row_2, R.id.widget_task_text_2, R.id.widget_task_due_2),
            Triple(R.id.widget_task_row_3, R.id.widget_task_text_3, R.id.widget_task_due_3),
            Triple(R.id.widget_task_row_4, R.id.widget_task_text_4, R.id.widget_task_due_4),
        )

        fun updateWidget(context: Context, mgr: AppWidgetManager, widgetId: Int) {
            val prefs = context.getSharedPreferences("thinkora_widget", Context.MODE_PRIVATE)
            val json = prefs.getString("tasks_json", "[]") ?: "[]"

            val views = RemoteViews(context.packageName, R.layout.widget_tasks)

            // Tap to open app
            val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)
            val pi = PendingIntent.getActivity(
                context, 0, launchIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(R.id.widget_tasks_title, pi)

            try {
                val arr = JSONArray(json)
                // Filter incomplete tasks, prioritize myDay/due today
                val today = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date())
                val pending = mutableListOf<JSONObject>()
                for (i in 0 until arr.length()) {
                    val t = arr.getJSONObject(i)
                    if (!t.optBoolean("completed", false)) {
                        pending.add(t)
                    }
                }
                // Sort: myDay first, then by dueDate
                pending.sortWith(compareByDescending<JSONObject> { it.optBoolean("myDay", false) }
                    .thenBy { it.optString("dueDate", "9999") })

                val display = pending.take(4)
                val remaining = pending.size - display.size

                // Update count
                views.setTextViewText(R.id.widget_tasks_count, "${pending.size} remaining")

                if (display.isEmpty()) {
                    views.setViewVisibility(R.id.widget_tasks_empty, View.VISIBLE)
                } else {
                    views.setViewVisibility(R.id.widget_tasks_empty, View.GONE)
                }

                for ((idx, triple) in ROW_IDS.withIndex()) {
                    val (rowId, textId, dueId) = triple
                    if (idx < display.size) {
                        val task = display[idx]
                        views.setViewVisibility(rowId, View.VISIBLE)
                        views.setTextViewText(textId, task.optString("title", "Task"))
                        val due = task.optString("dueDate", "")
                        if (due.isNotEmpty()) {
                            try {
                                val d = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.getDefault()).parse(due)
                                    ?: SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).parse(due)
                                val label = if (d != null) SimpleDateFormat("MMM d", Locale.getDefault()).format(d) else ""
                                views.setTextViewText(dueId, label)
                            } catch (e: Exception) {
                                views.setTextViewText(dueId, "")
                            }
                        } else {
                            views.setTextViewText(dueId, "")
                        }
                    } else {
                        views.setViewVisibility(rowId, View.GONE)
                    }
                }

                if (remaining > 0) {
                    views.setViewVisibility(R.id.widget_tasks_more, View.VISIBLE)
                    views.setTextViewText(R.id.widget_tasks_more, "+$remaining more")
                } else {
                    views.setViewVisibility(R.id.widget_tasks_more, View.GONE)
                }

            } catch (e: Exception) {
                views.setTextViewText(R.id.widget_tasks_count, "Tap to open")
                views.setViewVisibility(R.id.widget_tasks_empty, View.VISIBLE)
                views.setTextViewText(R.id.widget_tasks_empty, "Open app to sync")
            }

            mgr.updateAppWidget(widgetId, views)
        }
    }
}
