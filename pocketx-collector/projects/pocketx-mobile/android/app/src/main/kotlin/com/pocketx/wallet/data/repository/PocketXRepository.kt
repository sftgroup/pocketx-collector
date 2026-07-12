package com.pocketx.wallet.data.repository

import com.pocketx.wallet.data.api.PocketXApi
import com.pocketx.wallet.data.model.*
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Centralized auth/wallet state backed by our backend API
 * Mirrors frontend/src/services/api.ts
 */
@Singleton
class PocketXRepository @Inject constructor(
    private val api: PocketXApi,
) {
    private var jwt: String? = null

    fun getToken(): String? = jwt
    fun setToken(token: String?) { jwt = token }

    // ── Auth ──
    suspend fun sendCode(email: String) = api.sendCode(SendCodeRequest(email))

    suspend fun verifyCode(email: String, code: String): LoginResponse {
        val res = api.verifyCode(VerifyCodeRequest(email, code))
        if (res.code != 0 || res.data == null) {
            throw Exception(res.message ?: "Login failed")
        }
        jwt = res.data.accessToken
        return res.data
    }

    // ── Wallet ──
    suspend fun getWallet(chain: String): WalletData {
        val res = api.getWallet(chain, auth())
        if (res.code != 0 || res.data == null) {
            throw Exception(res.message ?: "Failed to load wallet")
        }
        return res.data
    }

    suspend fun createWallet(chain: String): WalletData {
        val res = api.createWallet(auth(), mapOf("chain" to chain))
        if (res.code != 0 || res.data == null) {
            throw Exception(res.message ?: "Failed to create wallet")
        }
        return res.data
    }

    // ── Send ──
    suspend fun sendTx(request: SendTxRequest): TxResponse {
        val res = api.sendTx(auth(), request)
        if (res.code != 0 || res.data == null) {
            throw Exception(res.message ?: "Send failed")
        }
        return res.data
    }

    suspend fun getPendingTxs(): List<PendingTx> {
        val res = api.getPendingTxs(auth())
        if (res.code != 0) throw Exception(res.message ?: "Failed")
        return res.data ?: emptyList()
    }

    suspend fun confirmTx(txId: String, password: String): TxResponse {
        val res = api.confirmTx(txId, auth(), mapOf("paymentPassword" to password))
        if (res.code != 0 || res.data == null) throw Exception(res.message ?: "Confirm failed")
        return res.data
    }

    suspend fun rejectTx(txId: String) {
        val res = api.rejectTx(txId, auth())
        if (res.code != 0) throw Exception(res.message ?: "Reject failed")
    }

    // ── Safe ──
    suspend fun getSafes(): List<SafeData> {
        val res = api.getSafes(auth())
        if (res.code != 0) throw Exception(res.message ?: "Failed")
        return res.data ?: emptyList()
    }

    private fun auth() = "Bearer $jwt"
}
