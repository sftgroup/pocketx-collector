package com.pocketx.wallet.ui.send

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

@Composable
fun SendScreen(onBack: () -> Unit) {
    var toAddress by remember { mutableStateOf("") }
    var amount by remember { mutableStateOf("") }

    Column(modifier = Modifier.fillMaxSize().padding(16.dp)) {
        Text("Send", style = MaterialTheme.typography.headlineSmall)
        Spacer(modifier = Modifier.height(16.dp))

        OutlinedTextField(value = toAddress, onValueChange = { toAddress = it },
            label = { Text("To Address") }, modifier = Modifier.fillMaxWidth(),
            singleLine = true)

        Spacer(modifier = Modifier.height(12.dp))

        OutlinedTextField(value = amount, onValueChange = { amount = it },
            label = { Text("Amount (ETH)") }, modifier = Modifier.fillMaxWidth(),
            singleLine = true)

        Spacer(modifier = Modifier.height(16.dp))

        Button(onClick = { /* TODO: send via ViewModel */ },
            modifier = Modifier.fillMaxWidth()) {
            Text("Send")
        }

        Spacer(modifier = Modifier.height(12.dp))

        TextButton(onClick = onBack) { Text("Back") }
    }
}
