package com.thinkora

import android.app.Activity
import android.content.IntentSender
import com.facebook.react.bridge.*
import com.google.android.play.core.appupdate.AppUpdateInfo
import com.google.android.play.core.appupdate.AppUpdateManagerFactory
import com.google.android.play.core.appupdate.AppUpdateOptions
import com.google.android.play.core.install.model.AppUpdateType
import com.google.android.play.core.install.model.UpdateAvailability

class InAppUpdateModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext), ActivityEventListener {

    companion object {
        private const val UPDATE_REQUEST_CODE = 2001
    }

    private var updatePromise: Promise? = null

    init {
        reactContext.addActivityEventListener(this)
    }

    override fun getName(): String = "InAppUpdateModule"

    @ReactMethod
    fun checkForUpdate(promise: Promise) {
        val appUpdateManager = AppUpdateManagerFactory.create(reactContext)
        val appUpdateInfoTask = appUpdateManager.appUpdateInfo

        appUpdateInfoTask.addOnSuccessListener { appUpdateInfo: AppUpdateInfo ->
            val result = Arguments.createMap()
            if (appUpdateInfo.updateAvailability() == UpdateAvailability.UPDATE_AVAILABLE) {
                result.putBoolean("available", true)
                result.putInt("stalenessDays", appUpdateInfo.clientVersionStalenessDays() ?: 0)
                result.putInt("availableVersionCode", appUpdateInfo.availableVersionCode())
                result.putBoolean("isImmediate", appUpdateInfo.isUpdateTypeAllowed(AppUpdateType.IMMEDIATE))
                result.putBoolean("isFlexible", appUpdateInfo.isUpdateTypeAllowed(AppUpdateType.FLEXIBLE))
            } else {
                result.putBoolean("available", false)
            }
            promise.resolve(result)
        }

        appUpdateInfoTask.addOnFailureListener { e ->
            promise.reject("UPDATE_CHECK_FAILED", "Failed to check for update: ${e.message}", e)
        }
    }

    @ReactMethod
    fun startUpdate(updateType: Int, promise: Promise) {
        val activity = reactApplicationContext.currentActivity
        if (activity == null) {
            promise.reject("NO_ACTIVITY", "No foreground activity")
            return
        }

        updatePromise = promise
        val appUpdateManager = AppUpdateManagerFactory.create(reactContext)
        val appUpdateInfoTask = appUpdateManager.appUpdateInfo

        appUpdateInfoTask.addOnSuccessListener { appUpdateInfo: AppUpdateInfo ->
            if (appUpdateInfo.updateAvailability() == UpdateAvailability.UPDATE_AVAILABLE) {
                try {
                    val options = AppUpdateOptions.newBuilder(updateType).build()
                    appUpdateManager.startUpdateFlowForResult(
                        appUpdateInfo,
                        activity,
                        options,
                        UPDATE_REQUEST_CODE
                    )
                } catch (e: IntentSender.SendIntentException) {
                    updatePromise?.reject("UPDATE_FLOW_FAILED", "Failed to start update flow: ${e.message}", e)
                    updatePromise = null
                }
            } else {
                updatePromise?.reject("NO_UPDATE", "No update available")
                updatePromise = null
            }
        }

        appUpdateInfoTask.addOnFailureListener { e ->
            updatePromise?.reject("UPDATE_FLOW_FAILED", "Failed to start update: ${e.message}", e)
            updatePromise = null
        }
    }

    override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: android.content.Intent?) {
        if (requestCode != UPDATE_REQUEST_CODE) return

        if (resultCode == Activity.RESULT_OK) {
            updatePromise?.resolve("UPDATE_ACCEPTED")
        } else if (resultCode == Activity.RESULT_CANCELED) {
            updatePromise?.resolve("UPDATE_CANCELED")
        } else {
            updatePromise?.reject("UPDATE_FAILED", "Update flow failed with result code: $resultCode")
        }
        updatePromise = null
    }

    override fun onNewIntent(intent: android.content.Intent) {}

    @ReactMethod
    fun addListener(eventName: String) {}

    @ReactMethod
    fun removeListeners(count: Int) {}
}
