package com.notiox

import android.app.Activity
import android.content.Intent
import android.speech.RecognizerIntent
import android.util.Log
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule

class SpeechModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext), ActivityEventListener {

    companion object {
        private const val SPEECH_REQUEST_CODE = 1001
        private const val TAG = "SpeechModule"
    }

    init {
        reactContext.addActivityEventListener(this)
    }

    override fun getName(): String = "SpeechModule"

    private fun sendEvent(eventName: String, params: WritableMap?) {
        reactContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(eventName, params)
    }

    @ReactMethod
    fun startListening(locale: String) {
        Log.d(TAG, "startListening called, locale=$locale")
        val activity = reactApplicationContext.currentActivity
        if (activity == null) {
            Log.e(TAG, "currentActivity is NULL")
            val map = Arguments.createMap()
            map.putString("error", "No foreground activity found")
            sendEvent("onSpeechError", map)
            return
        }

        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, locale)
            putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 3)
            putExtra(RecognizerIntent.EXTRA_PROMPT, "Speak now...")
        }

        try {
            Log.d(TAG, "starting speech intent activity")
            activity.startActivityForResult(intent, SPEECH_REQUEST_CODE)
            val map = Arguments.createMap()
            map.putString("status", "ready")
            sendEvent("onSpeechStart", map)
        } catch (e: Exception) {
            Log.e(TAG, "failed to start speech intent: ${e.message}", e)
            val map = Arguments.createMap()
            map.putString("error", "Speech recognition not available: ${e.message}")
            sendEvent("onSpeechError", map)
        }
    }

    override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
        Log.d(TAG, "onActivityResult requestCode=$requestCode resultCode=$resultCode")
        if (requestCode != SPEECH_REQUEST_CODE) return

        val endMap = Arguments.createMap()
        endMap.putString("status", "end")
        sendEvent("onSpeechEnd", endMap)

        if (resultCode == Activity.RESULT_OK && data != null) {
            val results = data.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS)
            Log.d(TAG, "speech results=$results")
            val map = Arguments.createMap()
            val arr = Arguments.createArray()
            results?.forEach { arr.pushString(it) }
            map.putArray("value", arr)
            sendEvent("onSpeechResults", map)
        } else {
            Log.d(TAG, "speech cancelled or failed, resultCode=$resultCode")
            val map = Arguments.createMap()
            map.putString("error", if (resultCode == Activity.RESULT_CANCELED) "cancelled" else "Recognition failed")
            sendEvent("onSpeechError", map)
        }
    }

    override fun onNewIntent(intent: Intent) {}

    @ReactMethod
    fun stopListening() {
        // Intent-based recognition is stopped by the system dialog
    }

    @ReactMethod
    fun destroy() {
        // Nothing to destroy with intent-based approach
    }

    @ReactMethod
    fun isAvailable(promise: Promise) {
        val activity = reactApplicationContext.currentActivity
        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH)
        val available = activity?.packageManager?.queryIntentActivities(intent, 0)?.isNotEmpty() ?: false
        promise.resolve(available)
    }

    @ReactMethod
    fun addListener(eventName: String) {}

    @ReactMethod
    fun removeListeners(count: Int) {}
}
