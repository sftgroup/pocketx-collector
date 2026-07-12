package com.pocketx.wallet.ui.navigation

import androidx.compose.runtime.Composable
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import com.pocketx.wallet.ui.login.LoginScreen
import com.pocketx.wallet.ui.wallet.WalletScreen
import com.pocketx.wallet.ui.send.SendScreen
import com.pocketx.wallet.ui.safe.SafeScreen
import com.pocketx.wallet.ui.settings.SettingsScreen

sealed class Screen(val route: String) {
    data object Login : Screen("login")
    data object Wallet : Screen("wallet")
    data object Send : Screen("send")
    data object Receive : Screen("receive")
    data object Safe : Screen("safe")
    data object Settings : Screen("settings")
    data object Transactions : Screen("transactions")
}

@Composable
fun PocketXNavHost(navController: NavHostController) {
    NavHost(
        navController = navController,
        startDestination = Screen.Login.route,
    ) {
        composable(Screen.Login.route) {
            LoginScreen(
                onLoginSuccess = {
                    navController.navigate(Screen.Wallet.route) {
                        popUpTo(Screen.Login.route) { inclusive = true }
                    }
                }
            )
        }
        composable(Screen.Wallet.route) {
            WalletScreen(
                onSend = { navController.navigate(Screen.Send.route) },
                onSafe = { navController.navigate(Screen.Safe.route) },
                onSettings = { navController.navigate(Screen.Settings.route) },
            )
        }
        composable(Screen.Send.route) {
            SendScreen(onBack = { navController.popBackStack() })
        }
        composable(Screen.Safe.route) {
            SafeScreen(onBack = { navController.popBackStack() })
        }
        composable(Screen.Settings.route) {
            SettingsScreen(onBack = { navController.popBackStack() })
        }
    }
}
