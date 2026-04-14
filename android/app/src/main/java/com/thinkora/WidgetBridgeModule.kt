package com.thinkora

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap

class WidgetBridgeModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "WidgetBridge"

    private fun prefs(): SharedPreferences =
        reactApplicationContext.getSharedPreferences("thinkora_widget", Context.MODE_PRIVATE)

    @ReactMethod
    fun updateWidgetData(data: ReadableMap) {
        val editor = prefs().edit()

        // Tasks data
        if (data.hasKey("tasks")) {
            editor.putString("tasks_json", data.getString("tasks") ?: "[]")
        }
        // Habits data
        if (data.hasKey("habits")) {
            editor.putString("habits_json", data.getString("habits") ?: "[]")
        }
        // Timestamp
        editor.putLong("last_updated", System.currentTimeMillis())
        editor.apply()

        // Trigger widget updates
        val ctx = reactApplicationContext
        triggerWidgetUpdate(ctx, TasksWidget::class.java)
        triggerWidgetUpdate(ctx, HabitsWidget::class.java)
    }

    private fun triggerWidgetUpdate(ctx: Context, widgetClass: Class<*>) {
        val mgr = AppWidgetManager.getInstance(ctx)
        val ids = mgr.getAppWidgetIds(ComponentName(ctx, widgetClass))
        if (ids.isNotEmpty()) {
            val intent = Intent(ctx, widgetClass).apply {
                action = AppWidgetManager.ACTION_APPWIDGET_UPDATE
                putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids)
            }
            ctx.sendBroadcast(intent)
        }
    }
}
