package com.pocketx.wallet

import android.app.Application
import dagger.hilt.android.HiltAndroidApp

@HiltAndroidApp
class PocketXApp : Application() {
    override fun onCreate() {
        super.onCreate()
        // Initialize TrustWalletCore once
        System.loadLibrary("TrustWalletCore")
    }
}
