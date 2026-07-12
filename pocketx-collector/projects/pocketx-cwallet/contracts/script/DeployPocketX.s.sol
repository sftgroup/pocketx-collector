// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {SafeProxyFactory} from "../src/SafeProxyFactory.sol";
import {SafeProxy} from "../src/SafeProxy.sol";
import {GasSponsor} from "../src/GasSponsor.sol";

/**
 * @title DeployPocketX
 * @notice Deploy script for PocketX v2.0 smart contracts.
 *
 *   Usage:
 *     forge script script/DeployPocketX.s.sol:DeployPocketX --rpc-url <URL> --broadcast
 *
 *   Environment variables:
 *     OWNER_ADDRESS — The address that will own the GasSponsor (default: deployer)
 *     SAFE_SINGLETON — Address of the deployed Gnosis Safe singleton (master copy)
 *
 *   ⚠️ This script does NOT perform any deployments itself — it must be broadcast
 *      by the architect using forge script --broadcast.
 *
 * @author PocketX Team6
 */
contract DeployPocketX is Script {
    function run() external {
        // --- Load configuration ---
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address ownerAddress = vm.envOr("OWNER_ADDRESS", vm.addr(deployerPrivateKey));

        console.log("Deployer: ", vm.addr(deployerPrivateKey));
        console.log("Owner:    ", ownerAddress);
        console.log("Chain ID: ", block.chainid);

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy SafeProxyFactory (SC-01)
        SafeProxyFactory factory = new SafeProxyFactory();
        console.log("SafeProxyFactory deployed at:", address(factory));

        // 2. Deploy GasSponsor (SC-02) — with owner
        GasSponsor gasSponsor = new GasSponsor(ownerAddress);
        console.log("GasSponsor deployed at:       ", address(gasSponsor));

        vm.stopBroadcast();

        // --- Log deployment summary ---
        console.log("");
        console.log("=== Deployment Summary ===");
        console.log("Network:        ", block.chainid);
        console.log("Factory:        ", address(factory));
        console.log("GasSponsor:     ", address(gasSponsor));
        console.log("GasSponsor owner:", ownerAddress);

        // --- Write ABI + address artifacts (optional, for frontend) ---
        // The forge build output already contains ABI; this is a convenience log.
        console.log("");
        console.log("To create a Safe proxy, call:");
        console.log("  factory.createProxyWithNonce(singleton, initializer, saltNonce)");
        console.log("  where singleton = deployed Gnosis Safe master copy address");
        console.log("");
        console.log("To predict address before creation:");
        console.log("  factory.computeProxyAddress(singleton, initializer, saltNonce)");
    }
}
