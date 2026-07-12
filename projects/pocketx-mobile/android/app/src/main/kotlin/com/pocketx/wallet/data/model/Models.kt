package com.pocketx.wallet.data.model

import com.google.gson.annotations.SerializedName

// ── Auth ──
data class SendCodeRequest(val email: String)
data class VerifyCodeRequest(val email: String, val code: String)
data class LoginResponse(
    @SerializedName("accessToken") val accessToken: String,
    val email: String,
    val role: String? = null,
)

// ── Wallet ──
data class WalletData(
    val id: String,
    val address: String,
    val chain: String,
    val balance: String = "0",
    val usdBalance: Double = 0.0,
    val tokens: List<TokenAsset>? = null,
)

data class TokenAsset(
    val assetId: String,
    val symbol: String,
    val balance: String,
    val usdValue: Double = 0.0,
)

// ── Transaction ──
data class SendTxRequest(
    val walletId: String,
    val toAddress: String,
    val amount: String,
    val chain: String,
    val paymentPassword: String,
)

data class TxResponse(
    val txId: String,
    val txHash: String,
    val status: String,
    val gasSponsored: Boolean,
    val strategy: String,
)

data class PendingTx(
    val id: String,
    @SerializedName("to_address") val toAddress: String,
    val amount: String,
    val signature_strategy: String?,
    val status: String,
    @SerializedName("created_at") val createdAt: String,
)

// ── Safe Multi-Sig ──
data class SafeData(
    val address: String,
    val chain: String,
    val owners: List<String>,
    val threshold: Int,
    val balance: String = "0",
)

// ── API Response ──
data class ApiResponse<T>(
    val code: Int,
    val data: T?,
    val message: String?,
)
