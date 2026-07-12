package com.pocketx.wallet.ui.wallet

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel

@Composable
fun WalletScreen(
    onSend: () -> Unit,
    onSafe: () -> Unit,
    onSettings: () -> Unit,
    viewModel: WalletViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsState()

    Column(
        modifier = Modifier.fillMaxSize().padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(
            "PocketX Wallet",
            style = MaterialTheme.typography.headlineSmall,
        )

        Spacer(modifier = Modifier.height(24.dp))

        Card(modifier = Modifier.fillMaxWidth()) {
            Column(modifier = Modifier.padding(20.dp)) {
                Text("Balance", style = MaterialTheme.typography.labelSmall)
                Text(
                    text = if (state.balance.isNullOrEmpty()) "Loading..." else "${state.balance} ${state.chainSymbol}",
                    style = MaterialTheme.typography.headlineLarge,
                )
                if (state.usdBalance != null) {
                    Text(
                        "≈ \$${state.usdBalance}",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceEvenly) {
            Button(onClick = onSend) { Text("Send") }
            Button(onClick = onSafe) { Text("Safe") }
            Button(onClick = onSettings) { Text("Settings") }
        }
    }
}
