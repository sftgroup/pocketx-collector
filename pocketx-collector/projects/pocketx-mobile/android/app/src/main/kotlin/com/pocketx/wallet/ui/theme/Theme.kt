package com.pocketx.wallet.ui.theme

import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

// PocketX Dark Theme — matching web palette
private val DarkScheme = darkColorScheme(
    primary = Color(0xFF6366F1),           // accent indigo
    secondary = Color(0xFF8B5CF6),         // accent purple
    tertiary = Color(0xFF06B6D4),          // cyan
    background = Color(0xFF0A0A0A),        // dark-950
    surface = Color(0xFF1A1A1A),           // dark-800
    onPrimary = Color.White,
    onSecondary = Color.White,
    onBackground = Color(0xFFF5F5F5),
    onSurface = Color(0xFFD4D4D8),         // dark-200
    error = Color(0xFFEF4444),
)

@Composable
fun PocketXTheme(content: @Composable () -> Unit) {
    androidx.compose.material3.MaterialTheme(
        colorScheme = DarkScheme,
        content = content,
    )
}
