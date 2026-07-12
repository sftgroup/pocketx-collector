// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.20;

/**
 * @title IProxy — Proxy interface
 * @notice Helper interface to access the singleton address of the Proxy onchain.
 * @dev Compatible with the Gnosis Safe masterCopy() ABI.
 * @author Stefan George — <stefan@gnosis.io>
 */
interface IProxy {
    /**
     * @notice Returns the master copy (singleton) address used by this proxy.
     * @return singleton The address of the singleton/master copy implementation.
     */
    function masterCopy() external view returns (address);
}

/**
 * @title SafeProxy
 * @notice A generic proxy contract that delegates all calls to a singleton (master copy)
 *         contract, effectively providing upgradeability via delegatecall.
 * @dev The singleton address is immutable after construction. Built for Solidity 0.8.20+
 *      with native overflow checks (no SafeMath needed).
 *
 *      Storage layout:
 *        slot 0 — address internal singleton
 *      This MUST be the first state variable so that delegatecall storage layout
 *      in the singleton matches the proxy.
 *
 *      Security: The singleton address cannot be changed after construction, which
 *      prevents proxy admin takeover. The factory decides the singleton at proxy creation.
 *
 * @author Stefan George — <stefan@gnosis.io>
 * @author Richard Meissner — <richard@gnosis.io>
 */
contract SafeProxy {
    /// @dev The singleton address to delegate all calls to. MUST be slot 0.
    address internal immutable singleton;

    /**
     * @notice Safe proxy constructor.
     * @param _singleton Address of the singleton (master copy) contract. Must be a deployed contract.
     */
    constructor(address _singleton) {
        require(_singleton != address(0), "Invalid singleton address provided");
        singleton = _singleton;
    }

    /**
     * @notice Delegate all calls to the `singleton` implementation and forward return data.
     * @dev transparent-fallback — any call not matching `masterCopy()` is delegated.
     */
    fallback() external payable {
        address _singleton = singleton;
        // 0xa619486e == uint32(bytes4(keccak256("masterCopy()")))
        // Only intercept the masterCopy() selector — all other calls delegate to the singleton.
        bytes4 selector;
        /// @solidity memory-safe-assembly
        assembly {
            selector := calldataload(0)
        }
        if (selector == 0xa619486e) { // masterCopy()
            /// @solidity memory-safe-assembly
            assembly {
                mstore(0x00, shr(96, shl(96, _singleton)))
                return(0x00, 0x20)
            }
        }
        /// @solidity memory-safe-assembly
        assembly {
            calldatacopy(0, 0, calldatasize())
            let success := delegatecall(gas(), _singleton, 0, calldatasize(), 0, 0)
            returndatacopy(0, 0, returndatasize())
            if iszero(success) { revert(0, returndatasize()) }
            return(0, returndatasize())
        }
    }

    /// @dev Allow receiving ETH
    receive() external payable {}
}
