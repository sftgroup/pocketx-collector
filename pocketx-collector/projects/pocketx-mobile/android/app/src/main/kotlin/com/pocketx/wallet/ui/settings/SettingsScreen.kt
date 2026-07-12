package com.pocketx.wallet.ui.settings

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

@Composable
fun SettingsScreen(onBack: () -> Unit) {
    Column(modifier = Modifier.fillMaxSize().padding(16.dp)) {
        Text("Settings", style = MaterialTheme.typography.headlineSmall)
        Spacer(modifier = Modifier.height(16.dp))

        // TODO: Password set/change, i18n toggle, logout, export key

        Spacer(modifier = Modifier.height(16.dp))
        TextButton(onClick = onBack) { Text("Back") }
    }
}
