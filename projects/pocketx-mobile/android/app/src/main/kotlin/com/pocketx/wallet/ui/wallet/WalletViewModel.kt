package com.pocketx.wallet.ui.wallet

import androidx.lifecycle.ViewModel
import com.pocketx.wallet.data.repository.PocketXRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import javax.inject.Inject

data class WalletUiState(
    val balance: String? = null,
    val usdBalance: Double? = null,
    val chainSymbol: String = "ETH",
    val address: String? = null,
    val error: String? = null,
)

@HiltViewModel
class WalletViewModel @Inject constructor(
    private val repo: PocketXRepository,
) : ViewModel() {
    private val _state = MutableStateFlow(WalletUiState())
    val state: StateFlow<WalletUiState> = _state.asStateFlow()

    init {
        loadWallet()
    }

    private fun loadWallet() {
        kotlinx.coroutines.MainScope().launch {
            try {
                val wallet = repo.getWallet("sepolia")
                _state.value = _state.value.copy(
                    balance = wallet.balance,
                    usdBalance = wallet.usdBalance,
                    address = wallet.address,
                )
            } catch (e: Exception) {
                _state.value = _state.value.copy(error = e.message)
            }
        }
    }
}
