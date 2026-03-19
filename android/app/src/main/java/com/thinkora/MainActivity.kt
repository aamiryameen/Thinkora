package com.thinkora

import android.os.Bundle
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

class MainActivity : ReactActivity() {

  override fun getMainComponentName(): String = "Thinkora"

  override fun onCreate(savedInstanceState: Bundle?) {
    // Switch from SplashTheme to AppTheme before React Native renders
    setTheme(R.style.AppTheme)
    super.onCreate(savedInstanceState)
  }

  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)
}
