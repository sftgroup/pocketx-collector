// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.20;

import {SafeProxy} from "./SafeProxy.sol";

/**
 * @title SafeProxyFactory
 * @notice Factory to atomically create and initialize Safe Proxy contracts via CREATE2.
 * @dev This contract allows deterministic address calculation and creation of Safe proxy
 *      instances. It supports nonce-based salt derivation for predictable addresses and
 *      chain-specific proxy creation for per-network uniqueness.
 *
 *      Security features:
 *      - CREATE2 deterministic addresses (front-running resistant with unique saltNonce)
 *      - Singleton contract existence verification before proxy creation
 *      - Optional initializer call in the same transaction (atomic setup)
 *      - Chain-specific proxies via EIP-155 chainId inclusion in salt
 *
 *      Important: This is a helper layer. The actual Safe singleton and Safe modules
 *      are managed by the Safe contracts themselves. We do NOT deploy those — only the proxy.
 *
 * @author Stefan George — @Georgi87 (Gnosis)
 * @author PocketX Team6 — audited adaptation for Solidity 0.8.20
 */
contract SafeProxyFactory {
    // ============ Events ============

    /**
     * @notice A new Safe proxy was created.
     * @param proxy The address of the created proxy.
     * @param singleton The singleton (master copy) address.
     */
    event ProxyCreation(SafeProxy indexed proxy, address singleton);

    /**
     * @notice A new Safe proxy was created with full creation details (L2-style event).
     * @param proxy The address of the created proxy.
     * @param singleton The singleton address.
     * @param initializer The initialization payload sent to the proxy after creation.
     * @param saltNonce The salt nonce used for CREATE2.
     */
    event ProxyCreationL2(
        SafeProxy indexed proxy,
        address singleton,
        bytes initializer,
        uint256 saltNonce
    );

    /**
     * @notice A chain-specific proxy was created (salt includes chainId).
     */
    event ChainSpecificProxyCreationL2(
        SafeProxy indexed proxy,
        address singleton,
        bytes initializer,
        uint256 saltNonce,
        uint256 chainId
    );

    // ============ Read-only Helpers ============

    /**
     * @notice Retrieve the raw SafeProxy creation bytecode (for off-chain address computation).
     * @return creationCode The SafeProxy constructor bytecode.
     */
    function proxyCreationCode() public pure returns (bytes memory) {
        return type(SafeProxy).creationCode;
    }

    /**
     * @notice Compute the keccak256 hash of the creation code for a given singleton.
     * @param singleton Address of the singleton contract.
     * @return codeHash The keccak256 of (creationCode || uint256(singleton)).
     */
    function proxyCreationCodehash(address singleton) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(type(SafeProxy).creationCode, uint256(uint160(singleton))));
    }

    // ============ Core Deployment ============

    /**
     * @notice Internal helper to deploy a SafeProxy via CREATE2 and optionally call an initializer.
     * @dev Uses checks-effects-interactions pattern: validates singleton first,
     *      deploys, then optionally calls initializer.
     * @param _singleton Address of the singleton (master copy) Safe contract.
     * @param initializer ABI-encoded initializer call payload (empty bytes to skip init).
     * @param salt The CREATE2 salt to use.
     * @return proxy The deployed SafeProxy instance.
     */
    function deployProxy(
        address _singleton,
        bytes memory initializer,
        bytes32 salt
    ) internal returns (SafeProxy proxy) {
        require(isContract(_singleton), "Singleton contract not deployed");

        bytes memory deploymentData = abi.encodePacked(type(SafeProxy).creationCode, uint256(uint160(_singleton)));

        /// @solidity memory-safe-assembly
        assembly {
            proxy := create2(0x00, add(0x20, deploymentData), mload(deploymentData), salt)
        }
        require(address(proxy) != address(0), "Create2 call failed");

        // Optional initializer call — CEI: deployment done, now perform external call.
        if (initializer.length > 0) {
            // @audit external call — success check handled inline
            /// @solidity memory-safe-assembly
            assembly {
                if iszero(call(gas(), proxy, 0, add(initializer, 0x20), mload(initializer), 0, 0)) {
                    let ptr := mload(0x40)
                    returndatacopy(ptr, 0x00, returndatasize())
                    revert(ptr, returndatasize())
                }
            }
        }
    }

    // ============ Public Entry Points ============

    /**
     * @notice Deploy a new Safe proxy with `_singleton` and `saltNonce`.
     * @dev Salt is derived as keccak256(keccak256(initializer), saltNonce).
     *      This ensures that different initializers with the same nonce produce
     *      different proxy addresses.
     *
     *      Replayable across chains with the same saltNonce — use
     *      createChainSpecificProxyWithNonce for per-chain uniqueness.
     *
     * @param _singleton Address of the singleton Safe implementation to use.
     * @param initializer ABI-encoded initialization data for the new proxy.
     * @param saltNonce A nonce to derive the CREATE2 salt.
     * @return proxy The deployed SafeProxy instance.
     */
    function createProxyWithNonce(
        address _singleton,
        bytes memory initializer,
        uint256 saltNonce
    ) public returns (SafeProxy proxy) {
        bytes32 salt = keccak256(abi.encodePacked(keccak256(initializer), saltNonce));
        proxy = deployProxy(_singleton, initializer, salt);
        emit ProxyCreation(proxy, _singleton);
    }

    /**
     * @notice Deploy a new Safe proxy and emit an L2-style event with full details.
     * @dev Same as createProxyWithNonce but emits ProxyCreationL2 for easier off-chain indexing.
     */
    function createProxyWithNonceL2(
        address _singleton,
        bytes memory initializer,
        uint256 saltNonce
    ) public returns (SafeProxy proxy) {
        proxy = createProxyWithNonce(_singleton, initializer, saltNonce);
        emit ProxyCreationL2(proxy, _singleton, initializer, saltNonce);
    }

    /**
     * @notice Deploy a chain-specific Safe proxy that cannot be replayed on other chains.
     * @dev Salt includes the chainId, ensuring the same saltNonce on different chains
     *      produces different proxy addresses. Useful for governance/admin accounts.
     * @param _singleton Address of the singleton Safe implementation.
     * @param initializer ABI-encoded initialization data.
     * @param saltNonce A nonce to derive the CREATE2 salt.
     * @return proxy The deployed SafeProxy instance.
     */
    function createChainSpecificProxyWithNonce(
        address _singleton,
        bytes memory initializer,
        uint256 saltNonce
    ) public returns (SafeProxy proxy) {
        bytes32 salt = keccak256(abi.encodePacked(keccak256(initializer), saltNonce, block.chainid));
        proxy = deployProxy(_singleton, initializer, salt);
        emit ProxyCreation(proxy, _singleton);
        emit ChainSpecificProxyCreationL2(proxy, _singleton, initializer, saltNonce, block.chainid);
    }

    /**
     * @notice Compute the predicted address of a Safe proxy before deployment.
     * @dev Useful for frontend to pre-display the address before creation.
     * @param _singleton Address of the singleton Safe implementation.
     * @param initializer ABI-encoded initialization data.
     * @param saltNonce The salt nonce.
     * @return predicted The predicted CREATE2 address.
     */
    function computeProxyAddress(
        address _singleton,
        bytes memory initializer,
        uint256 saltNonce
    ) public view returns (address predicted) {
        bytes32 salt = keccak256(abi.encodePacked(keccak256(initializer), saltNonce));
        bytes32 codeHash = proxyCreationCodehash(_singleton);
        bytes32 hash = keccak256(abi.encodePacked(bytes1(0xff), address(this), salt, codeHash));
        predicted = address(uint160(uint256(hash)));
    }

    /**
     * @notice Same as computeProxyAddress but with chainId in the salt.
     */
    function computeChainSpecificProxyAddress(
        address _singleton,
        bytes memory initializer,
        uint256 saltNonce
    ) public view returns (address predicted) {
        bytes32 salt = keccak256(abi.encodePacked(keccak256(initializer), saltNonce, block.chainid));
        bytes32 codeHash = proxyCreationCodehash(_singleton);
        bytes32 hash = keccak256(abi.encodePacked(bytes1(0xff), address(this), salt, codeHash));
        predicted = address(uint160(uint256(hash)));
    }

    // ============ Utility ============

    /**
     * @notice Check if an address has code deployed (i.e., is a contract).
     * @dev Inline assembly more gas-efficient than extcodesize-based checks.
     * @param account The address to check.
     * @return True if the address holds contract code.
     */
    function isContract(address account) internal view returns (bool) {
        uint256 size;
        /// @solidity memory-safe-assembly
        assembly {
            size := extcodesize(account)
        }
        return size > 0;
    }
}
