// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title GasSponsor — Gas Station Network Compatible Paymaster
 * @notice Supports gasless (meta) transactions where a relayer pays gas on behalf of users.
 * @dev This is a standalone paymaster / relay-hub contract that PocketX can deploy
 *      to sponsor gas for custodial wallet users.
 *
 *      Architecture:
 *      - Users sign a meta-transaction off-chain.
 *      - A relayer (PocketX backend) submits the transaction and pays gas.
 *      - The paymaster reimburses the relayer from a pre-funded gas pool.
 *
 *      Security:
 *      - EIP-712 typed structured data for replay protection
 *      - Nonce-based replay prevention (sequential nonces per user)
 *      - Signature verification via ECDSA recovery
 *      - Deadline-based expiry to prevent stale transactions
 *      - Funds management with owner-only controls
 *
 * @author PocketX Team6
 */
contract GasSponsor {
    // ============ Errors ============
    error InvalidSignature();
    error ExpiredTransaction();
    error InvalidNonce();
    error InsufficientGasFunds();
    error TransferFailed();
    error Unauthorized();
    error InvalidTarget();
    error ZeroAddress();
    error NotWhitelisted();
    error ZeroDeposit();
    error InvalidSigner();

    // ============ Events ============

    /**
     * @notice Emitted when a meta-transaction is executed.
     * @param user The EOA that signed the meta-transaction.
     * @param target The contract that was called.
     * @param value The ETH value sent.
     * @param nonce The user's nonce consumed.
     * @param gasUsed The actual gas consumed.
     */
    event MetaTransactionExecuted(
        address indexed user,
        address indexed target,
        uint256 value,
        uint256 nonce,
        uint256 gasUsed
    );

    /**
     * @notice Emitted when gas pool is topped up by the owner.
     * @param funder The address that funded the pool.
     * @param amount The amount deposited.
     */
    event GasPoolFunded(address indexed funder, uint256 amount);

    /**
     * @notice Emitted when gas pool funds are withdrawn by the owner.
     * @param recipient The address receiving the withdrawal.
     * @param amount The amount withdrawn.
     */
    event GasPoolWithdrawn(address indexed recipient, uint256 amount);

    /**
     * @notice Emitted when relayer reimbursement is processed.
     * @param relayer The relayer that was reimbursed.
     * @param amount The ETH amount reimbursed.
     */
    event RelayerReimbursed(address indexed relayer, uint256 amount);

    // ============ Structs ============

    /**
     * @notice A meta-transaction request signed by the user.
     * @param from The signer (user) address.
     * @param to The target contract to call.
     * @param value The ETH value to send with the call.
     * @param data The calldata for the target call.
     * @param nonce A sequential nonce for replay prevention.
     * @param deadline The timestamp after which this tx is invalid.
     */
    struct MetaTx {
        address from;
        address to;
        uint256 value;
        bytes data;
        uint256 nonce;
        uint256 deadline;
    }

    // ============ EIP-712 Typehash ============

    bytes32 private constant META_TX_TYPEHASH = keccak256(
        "MetaTx(address from,address to,uint256 value,bytes data,uint256 nonce,uint256 deadline)"
    );

    bytes32 private immutable DOMAIN_SEPARATOR;

    // ============ State ============

    /// @notice Owner of the gas pool (PocketX admin / operator).
    address public owner;

    /// @notice Available gas pool balance for relayer reimbursement.
    uint256 public gasPoolBalance;

    /// @notice Current nonce per user. Incremented after each successful meta-tx.
    mapping(address => uint256) public nonces;

    /// @notice Relayer whitelist — if enabled, only whitelisted relayers can submit.
    mapping(address => bool) public whitelistedRelayers;

    /// @notice Whether relayer whitelist is enforced.
    bool public relayerWhitelistEnabled;

    // ============ Modifiers ============

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    // ============ Constructor ============

    /**
     * @notice Initialize the GasSponsor with EIP-712 domain separator.
     * @param _owner The initial owner of the gas pool.
     */
    constructor(address _owner) {
        if (_owner == address(0)) revert ZeroAddress();
        owner = _owner;

        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes("PocketX GasSponsor")),
                keccak256(bytes("1")),
                block.chainid,
                address(this)
            )
        );
    }

    // ============ Owner Functions ============

    /**
     * @notice Deposit ETH into the gas pool for relayer reimbursement.
     */
    function fundGasPool() external payable onlyOwner {
        if (msg.value == 0) revert ZeroDeposit();
        gasPoolBalance += msg.value;
        emit GasPoolFunded(msg.sender, msg.value);
    }

    /**
     * @notice Withdraw ETH from the gas pool (owner only).
     * @param to Recipient address.
     * @param amount Amount to withdraw.
     */
    function withdrawGasPool(address payable to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        if (amount > gasPoolBalance) revert InsufficientGasFunds();
        // CEI: State before external call
        gasPoolBalance -= amount;
        (bool success, ) = to.call{value: amount}("");
        if (!success) revert TransferFailed();
        emit GasPoolWithdrawn(to, amount);
    }

    /**
     * @notice Set the relayer whitelist enforcement flag.
     */
    function setRelayerWhitelistEnabled(bool _enabled) external onlyOwner {
        relayerWhitelistEnabled = _enabled;
    }

    /**
     * @notice Add or remove a relayer from the whitelist.
     */
    function setRelayerWhitelisted(address relayer, bool whitelisted) external onlyOwner {
        whitelistedRelayers[relayer] = whitelisted;
    }

    /**
     * @notice Transfer ownership of the gas pool.
     */
    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        owner = newOwner;
    }

    // ============ Meta-Transaction Execution ============

    /**
     * @notice Execute a meta-transaction signed by the user.
     * @dev The relayer calls this and pays gas. The relayer is reimbursed from the gas pool.
     *
     *      Flow: Check signature → validate nonce/deadline → execute → reimburse relayer.
     *
     * @param tx_ The meta-transaction request.
     * @param signature The EIP-712 typed signature from the user (from address).
     */
    function executeMetaTx(MetaTx calldata tx_, bytes calldata signature) external {
        // --- Checks ---
        // 1. Relayer whitelist (optional)
        if (relayerWhitelistEnabled) {
            if (!whitelistedRelayers[msg.sender]) revert NotWhitelisted();
        }

        // 2. Verify signature (CEI: all checks before effects/interactions)
        address signer = _verifyMetaTx(tx_, signature);
        if (signer != tx_.from) revert InvalidSigner();

        // 3. Validate nonce
        if (tx_.nonce != nonces[signer]) revert InvalidNonce();

        // 4. Validate deadline
        if (block.timestamp > tx_.deadline) revert ExpiredTransaction();

        // --- Effects (CEI) ---
        // Increment nonce BEFORE external call
        nonces[signer]++;

        // --- Interactions ---
        // Record gas before execution for fair reimbursement
        uint256 gasBefore = gasleft();

        // Execute the target call
        (bool success, ) = tx_.to.call{value: tx_.value}(tx_.data);
        if (!success) revert TransferFailed();

        // Calculate gas used and fee
        uint256 gasUsed = gasBefore - gasleft() + 21000; // base tx cost + overhead
        uint256 fee = gasUsed * tx.gasprice;

        // Reimburse relayer from gas pool
        if (fee > gasPoolBalance) revert InsufficientGasFunds();
        gasPoolBalance -= fee;

        (bool reimbursementOk, ) = payable(msg.sender).call{value: fee}("");
        if (!reimbursementOk) revert TransferFailed();

        emit MetaTransactionExecuted(signer, tx_.to, tx_.value, tx_.nonce, gasUsed);
        emit RelayerReimbursed(msg.sender, fee);
    }

    // ============ Signature Verification ============

    /**
     * @notice Internal EIP-712 signature verification.
     * @param tx_ The meta-transaction.
     * @param signature The full signature (65 bytes: r, s, v).
     * @return signer The recovered signer address.
     */
    function _verifyMetaTx(MetaTx calldata tx_, bytes calldata signature) internal view returns (address signer) {
        bytes32 structHash = keccak256(
            abi.encode(
                META_TX_TYPEHASH,
                tx_.from,
                tx_.to,
                tx_.value,
                keccak256(tx_.data),
                tx_.nonce,
                tx_.deadline
            )
        );

        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash));

        // Convert signature bytes to internal ECDSA format via OpenZeppelin helper
        // ECDSA.recover uses internal tryRecover which handles v/r/s validation
        bytes32 r;
        bytes32 s;
        uint8 v;
        /// @solidity memory-safe-assembly
        assembly {
            r := calldataload(signature.offset)
            s := calldataload(add(signature.offset, 32))
            v := byte(0, calldataload(add(signature.offset, 64)))
        }

        // ECDSA requires v = 27 or 28; normalize and check
        if (v < 27) v += 27;
        if (v != 27 && v != 28) revert InvalidSignature();

        // Manual ECDSA recovery with signature malleability protection (high s-value check)
        // Per EIP-2: s must be in the lower half of the secp256k1 curve order
        if (uint256(s) > 0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0) {
            revert InvalidSignature();
        }

        signer = ecrecover(digest, v, r, s);
        if (signer == address(0)) revert InvalidSignature();
    }

    /**
     * @notice Get the EIP-712 domain separator for this contract.
     * @return The domain separator.
     */
    function domainSeparator() external view returns (bytes32) {
        return DOMAIN_SEPARATOR;
    }

    /**
     * @notice Get the current nonce and deadline for a user (for off-chain tx construction).
     * @param user The user address.
     * @return nonce The current nonce.
     * @return deadline A suggested deadline (1 hour from now).
     */
    function getNonceAndDeadline(address user) external view returns (uint256 nonce, uint256 deadline) {
        nonce = nonces[user];
        deadline = block.timestamp + 1 hours;
    }

    // ============ Receive ETH ============

    /// @dev Allow direct ETH transfers to the gas pool.
    receive() external payable {
        // Anyone can fund the gas pool
        gasPoolBalance += msg.value;
        emit GasPoolFunded(msg.sender, msg.value);
    }

    /// @dev Also accept ETH via fallback
    fallback() external payable {
        gasPoolBalance += msg.value;
        emit GasPoolFunded(msg.sender, msg.value);
    }
}
