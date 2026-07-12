package com.pocketx.wallet.data.api

import com.pocketx.wallet.data.model.*
import retrofit2.http.*

interface PocketXApi {
    // Auth
    @POST("api/v2/auth/send-code")
    suspend fun sendCode(@Body body: SendCodeRequest): ApiResponse<Any>

    @POST("api/v2/auth/verify-code")
    suspend fun verifyCode(@Body body: VerifyCodeRequest): ApiResponse<LoginResponse>

    // Wallet
    @GET("api/v2/wallet/{chainId}")
    suspend fun getWallet(
        @Path("chainId") chainId: String,
        @Header("Authorization") token: String,
    ): ApiResponse<WalletData>

    @POST("api/v2/wallet/create")
    suspend fun createWallet(
        @Header("Authorization") token: String,
        @Body body: Map<String, String>,
    ): ApiResponse<WalletData>

    // Transaction
    @POST("api/v2/tx/send")
    suspend fun sendTx(
        @Header("Authorization") token: String,
        @Body body: SendTxRequest,
    ): ApiResponse<TxResponse>

    @GET("api/v2/tx/pending")
    suspend fun getPendingTxs(
        @Header("Authorization") token: String,
    ): ApiResponse<List<PendingTx>>

    @POST("api/v2/tx/{id}/confirm")
    suspend fun confirmTx(
        @Path("id") txId: String,
        @Header("Authorization") token: String,
        @Body body: Map<String, String>,
    ): ApiResponse<TxResponse>

    @POST("api/v2/tx/{id}/reject")
    suspend fun rejectTx(
        @Path("id") txId: String,
        @Header("Authorization") token: String,
    ): ApiResponse<Any>

    // Safe Multi-Sig
    @GET("api/v2/safe/list")
    suspend fun getSafes(
        @Header("Authorization") token: String,
    ): ApiResponse<List<SafeData>>

    @POST("api/v2/safe/create")
    suspend fun createSafe(
        @Header("Authorization") token: String,
        @Body body: Map<String, Any>,
    ): ApiResponse<SafeData>
}
