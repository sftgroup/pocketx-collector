package com.pocketx.wallet.ui.login

import androidx.lifecycle.ViewModel
import com.pocketx.wallet.data.repository.PocketXRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import javax.inject.Inject

data class LoginUiState(
    val codeSent: Boolean = false,
    val sendingCode: Boolean = false,
    val loggingIn: Boolean = false,
    val loginSuccess: Boolean = false,
    val error: String? = null,
)

@HiltViewModel
class LoginViewModel @Inject constructor(
    private val repo: PocketXRepository,
) : ViewModel() {
    private val _state = MutableStateFlow(LoginUiState())
    val state: StateFlow<LoginUiState> = _state.asStateFlow()

    fun sendCode(email: String) {
        _state.value = _state.value.copy(sendingCode = true, error = null)
        // In dev mode, code is always 888888 — skip actual API call
        _state.value = _state.value.copy(codeSent = true, sendingCode = false)
    }

    fun verifyCode(email: String, code: String) {
        _state.value = _state.value.copy(loggingIn = true, error = null)
        kotlinx.coroutines.MainScope().launch {
            try {
                repo.verifyCode(email, code)
                _state.value = _state.value.copy(loginSuccess = true, loggingIn = false)
            } catch (e: Exception) {
                _state.value = _state.value.copy(error = e.message, loggingIn = false)
            }
        }
    }
}
