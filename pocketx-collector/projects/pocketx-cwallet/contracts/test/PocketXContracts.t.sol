// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {SafeProxy} from "../src/SafeProxy.sol";
import {SafeProxyFactory} from "../src/SafeProxyFactory.sol";
import {GasSponsor} from "../src/GasSponsor.sol";
import {MockERC20} from "../src/MockERC20.sol";

/**
 * @title PocketX Contract Test Suite
 * @notice Covers CT-001 through CT-006 per TEST_SCENARIOS_CT.md.
 *
 *   CT-001: SafeProxyFactory.createProxyWithNonce — Create Safe wallet
 *   CT-002: SafeProxy.execTransaction (simulated) — Single signature execution
 *   CT-003: SafeProxy.execTransaction (simulated) — 2/3 multisig execution
 *   CT-004: SafeProxy.execTransaction (simulated) — Insufficient signatures reject
 *   CT-005: ERC-20 transfer — Custodial wallet transfer
 *   CT-006: ERC-20 transferFrom — Gas-sponsored transfer
 *
 * @dev Uses a MockSafe singleton — state lives on the proxy (delegatecall).
 *      All interactions with the proxy's Safe state must go through the proxy.
 */
contract PocketXContractTest is Test {
    SafeProxyFactory public factory;
    MockSafe public mockSafe;
    GasSponsor public gasSponsor;
    MockERC20 public token;

    address public owner;
    address public alice;
    address public bob;
    address public charlie;
    address public relayer;

    event ProxyCreation(SafeProxy indexed proxy, address singleton);

    function setUp() public {
        owner = makeAddr("owner");
        alice = makeAddr("alice");
        bob = makeAddr("bob");
        charlie = makeAddr("charlie");
        relayer = makeAddr("relayer");

        factory = new SafeProxyFactory();
        mockSafe = new MockSafe();

        gasSponsor = new GasSponsor(owner);
        token = new MockERC20();

        vm.deal(relayer, 100 ether);
        vm.deal(owner, 100 ether);
        vm.deal(alice, 10 ether);

        // The test contract deployed MockERC20, so it holds the initial supply.
        token.transfer(alice, 10_000 * 10**18);
    }

    // ============================================================================
    // CT-001: SafeProxyFactory.createProxyWithNonce — Create Safe Wallet
    // ============================================================================

    /// @notice CT-001: Basic proxy creation — address prediction + create (with owner).
    function test_CT001_createProxyWithNonce() public {
        address[] memory owners = new address[](1);
        owners[0] = alice;
        bytes memory initializer = abi.encodeWithSignature(
            "setup(address[],uint256)", owners, uint256(1)
        );
        uint256 saltNonce = 42;

        address predicted = factory.computeProxyAddress(address(mockSafe), initializer, saltNonce);
        assertTrue(predicted != address(0));

        SafeProxy proxy = factory.createProxyWithNonce(address(mockSafe), initializer, saltNonce);

        assertTrue(address(proxy) != address(0));
        assertEq(address(proxy), predicted);
        assertTrue(address(proxy).code.length > 0);
    }

    /// @notice CT-001b: Chain-specific proxy.
    function test_CT001b_createChainSpecificProxy() public {
        address[] memory owners = new address[](1);
        owners[0] = alice;
        bytes memory initializer = abi.encodeWithSignature(
            "setup(address[],uint256)", owners, uint256(1)
        );
        uint256 saltNonce = 7;

        address predicted = factory.computeChainSpecificProxyAddress(address(mockSafe), initializer, saltNonce);
        SafeProxy proxy = factory.createChainSpecificProxyWithNonce(address(mockSafe), initializer, saltNonce);

        assertTrue(address(proxy) != address(0));
        assertEq(address(proxy), predicted);
    }

    /// @notice CT-001c: Proxy with setup — verify through the proxy.
    function test_CT001c_createProxyWithSetup() public {
        address[] memory owners = new address[](2);
        owners[0] = alice;
        owners[1] = bob;

        bytes memory initializer = abi.encodeWithSignature(
            "setup(address[],uint256)", owners, uint256(1)
        );
        SafeProxy proxy = factory.createProxyWithNonce(address(mockSafe), initializer, 1);
        assertTrue(address(proxy) != address(0));

        // State lives on proxy — call through proxy
        (bool ok1, bytes memory data1) = address(proxy).call(
            abi.encodeWithSignature("getOwnerCount()")
        );
        assertTrue(ok1);
        assertEq(abi.decode(data1, (uint256)), 2);
    }

    /// @notice CT-001d: Revert — zero singleton.
    function test_CT001d_revertZeroSingleton() public {
        vm.expectRevert("Singleton contract not deployed");
        factory.createProxyWithNonce(address(0), bytes(""), 1);
    }

    /// @notice CT-001e: Revert — EOA as singleton.
    function test_CT001e_revertEOASingleton() public {
        vm.expectRevert("Singleton contract not deployed");
        factory.createProxyWithNonce(alice, bytes(""), 1);
    }

    // ============================================================================
    // CT-002: Single Signature Execution (1/1 Safe)
    // ============================================================================

    /// @notice CT-002: Single owner executes a transaction.
    function test_CT002_singleSigExecution() public {
        address[] memory owners = new address[](1);
        owners[0] = alice;

        bytes memory initializer = abi.encodeWithSignature(
            "setup(address[],uint256)", owners, uint256(1)
        );
        SafeProxy proxy = factory.createProxyWithNonce(address(mockSafe), initializer, 42);

        // Fund proxy
        vm.deal(address(proxy), 5 ether);

        // Verify setup via proxy
        (bool ok, bytes memory ret) = address(proxy).call(abi.encodeWithSignature("getThreshold()"));
        assertTrue(ok);
        assertEq(abi.decode(ret, (uint256)), 1);

        // Execute transfer via proxy (with sufficient "signatures" set via mock API)
        // First approve the execution
        vm.prank(alice);
        (bool a1, ) = address(proxy).call(
            abi.encodeWithSignature("approveExecution(address,uint256)", bob, 1 ether)
        );
        require(a1, "approve failed");

        // Set required = 1 for the mock's executeFromProxy
        vm.prank(alice);
        (bool a2, ) = address(proxy).call(
            abi.encodeWithSignature("setRequiredSignatures(uint256)", uint256(1))
        );
        require(a2, "setRequired failed");

        // Execute
        vm.prank(alice);
        (bool execOk, ) = address(proxy).call(
            abi.encodeWithSignature("executeFromProxy(address,uint256)", bob, 1 ether)
        );
        assertTrue(execOk);

        assertEq(bob.balance, 1 ether);
        assertEq(address(proxy).balance, 4 ether);
    }

    // ============================================================================
    // CT-003: 2/3 Multisig Execution
    // ============================================================================

    /// @notice CT-003: 2 of 3 signers approve and execute.
    function test_CT003_multiSigExecution() public {
        address[] memory owners = new address[](3);
        owners[0] = alice;
        owners[1] = bob;
        owners[2] = charlie;

        bytes memory initializer = abi.encodeWithSignature(
            "setup(address[],uint256)", owners, uint256(2)
        );
        SafeProxy proxy = factory.createProxyWithNonce(address(mockSafe), initializer, 99);

        vm.deal(address(proxy), 10 ether);

        // Set required signatures (via proxy to mock storage)
        vm.prank(alice);
        (bool s1, ) = address(proxy).call(
            abi.encodeWithSignature("setRequiredSignatures(uint256)", uint256(2))
        );
        require(s1);

        // Alice + Bob approve
        bytes memory approveData = abi.encodeWithSignature(
            "approveExecution(address,uint256)", bob, 1 ether
        );
        vm.prank(alice);
        (bool a1, ) = address(proxy).call(approveData);
        require(a1);
        vm.prank(bob);
        (bool a2, ) = address(proxy).call(approveData);
        require(a2);

        // Execute — threshold met
        vm.prank(alice);
        (bool execOk, ) = address(proxy).call(
            abi.encodeWithSignature("executeFromProxy(address,uint256)", bob, 1 ether)
        );
        assertTrue(execOk);
        assertEq(bob.balance, 1 ether);
    }

    // ============================================================================
    // CT-004: Insufficient Signatures Reject
    // ============================================================================

    /// @notice CT-004: Only 1/2 signatures — execution must revert.
    function test_CT004_insufficientSignaturesReject() public {
        address[] memory owners = new address[](3);
        owners[0] = alice;
        owners[1] = bob;
        owners[2] = charlie;

        bytes memory initializer = abi.encodeWithSignature(
            "setup(address[],uint256)", owners, uint256(2)
        );
        SafeProxy proxy = factory.createProxyWithNonce(address(mockSafe), initializer, 100);

        vm.deal(address(proxy), 10 ether);

        vm.prank(alice);
        address(proxy).call(
            abi.encodeWithSignature("setRequiredSignatures(uint256)", uint256(2))
        );

        // Only Alice approves
        vm.prank(alice);
        address(proxy).call(
            abi.encodeWithSignature("approveExecution(address,uint256)", bob, 1 ether)
        );

        // Execute rejected
        vm.prank(alice);
        vm.expectRevert("Insufficient signatures");
        address(proxy).call(
            abi.encodeWithSignature("executeFromProxy(address,uint256)", bob, 1 ether)
        );

        assertEq(address(proxy).balance, 10 ether, "Balance unchanged after reject");
    }

    // ============================================================================
    // CT-005: ERC-20 Transfer
    // ============================================================================

    /// @notice CT-005: Simple transfer.
    function test_CT005_erc20Transfer() public {
        uint256 beforeA = token.balanceOf(alice);
        uint256 beforeB = token.balanceOf(bob);
        uint256 amount = 500 * 10**18;

        vm.prank(alice);
        bool ok = token.transfer(bob, amount);
        assertTrue(ok);
        assertEq(token.balanceOf(alice), beforeA - amount);
        assertEq(token.balanceOf(bob), beforeB + amount);
    }

    /// @notice CT-005b: Insufficient balance reverts.
    function test_CT005b_transferInsufficientBalance() public {
        vm.prank(alice);
        vm.expectRevert("insufficient balance");
        token.transfer(bob, 1_000_000_000 * 10**18);
    }

    /// @notice CT-005c: Transfer to zero reverts.
    function test_CT005c_transferZeroAddress() public {
        vm.prank(alice);
        vm.expectRevert();
        token.transfer(address(0), 100 * 10**18);
    }

    // ============================================================================
    // CT-006: ERC-20 transferFrom via GasSponsor (Meta-Transaction)
    // ============================================================================

    /// @notice CT-006: Gas-sponsored transferFrom.
    function test_CT006_gasSponsoredTransferFrom() public {
        // Use a user with a known private key for EIP-712 signing
        (address sponsorUser, uint256 sponsorKey) = makeAddrAndKey("sponsorUser");
        vm.deal(sponsorUser, 1 ether);

        uint256 approveAmt = 1000 * 10**18;
        token.transfer(sponsorUser, approveAmt);

        vm.prank(sponsorUser);
        token.approve(address(gasSponsor), approveAmt);

        // Fund pool + whitelist relayer
        vm.prank(owner);
        gasSponsor.fundGasPool{value: 10 ether}();
        vm.startPrank(owner);
        gasSponsor.setRelayerWhitelisted(relayer, true);
        gasSponsor.setRelayerWhitelistEnabled(true);
        vm.stopPrank();

        uint256 transferAmt = 200 * 10**18;
        uint256 nonce = gasSponsor.nonces(sponsorUser);
        uint256 deadline = block.timestamp + 1 hours;

        bytes memory transferData = abi.encodeWithSignature(
            "transferFrom(address,address,uint256)", sponsorUser, bob, transferAmt
        );

        GasSponsor.MetaTx memory metaTx = GasSponsor.MetaTx({
            from: sponsorUser,
            to: address(token),
            value: 0,
            data: transferData,
            nonce: nonce,
            deadline: deadline
        });

        // EIP-712 sign
        bytes32 structHash = keccak256(abi.encode(
            keccak256(
                "MetaTx(address from,address to,uint256 value,bytes data,uint256 nonce,uint256 deadline)"
            ),
            metaTx.from, metaTx.to, metaTx.value,
            keccak256(metaTx.data), metaTx.nonce, metaTx.deadline
        ));

        bytes32 domainSep = keccak256(abi.encode(
            keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
            keccak256(bytes("PocketX GasSponsor")), keccak256(bytes("1")),
            block.chainid, address(gasSponsor)
        ));

        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domainSep, structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(sponsorKey, digest);
        bytes memory sig = abi.encodePacked(r, s, v);

        uint256 bobBefore = token.balanceOf(bob);

        vm.prank(relayer);
        gasSponsor.executeMetaTx(metaTx, sig);

        assertEq(token.balanceOf(bob), bobBefore + transferAmt);
        assertEq(gasSponsor.nonces(sponsorUser), nonce + 1);
    }

    /// @notice CT-006b: Invalid signature reverts.
    function test_CT006b_invalidSignatureReverts() public {
        vm.prank(owner);
        gasSponsor.fundGasPool{value: 1 ether}();

        GasSponsor.MetaTx memory metaTx = GasSponsor.MetaTx({
            from: alice, to: address(token), value: 0,
            data: bytes(""), nonce: 0, deadline: block.timestamp + 1 hours
        });
        bytes memory badSig = new bytes(65);

        vm.expectRevert(GasSponsor.InvalidSignature.selector);
        gasSponsor.executeMetaTx(metaTx, badSig);
    }

    /// @notice CT-006c: Expired deadline.
    function test_CT006c_expiredDeadlineReverts() public {
        vm.prank(owner);
        gasSponsor.fundGasPool{value: 1 ether}();

        (address signer, uint256 key) = makeAddrAndKey("deadlineSigner");

        GasSponsor.MetaTx memory metaTx = GasSponsor.MetaTx({
            from: signer, to: address(token), value: 0,
            data: bytes(""), nonce: 0, deadline: block.timestamp - 1
        });

        bytes32 structHash = keccak256(abi.encode(
            keccak256(
                "MetaTx(address from,address to,uint256 value,bytes data,uint256 nonce,uint256 deadline)"
            ),
            signer, metaTx.to, metaTx.value,
            keccak256(metaTx.data), metaTx.nonce, metaTx.deadline
        ));
        bytes32 domainSep = gasSponsor.domainSeparator();
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domainSep, structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, digest);
        bytes memory sig = abi.encodePacked(r, s, v);

        vm.expectRevert(GasSponsor.ExpiredTransaction.selector);
        gasSponsor.executeMetaTx(metaTx, sig);
    }

    /// @notice CT-006d: Wrong nonce.
    function test_CT006d_invalidNonceReverts() public {
        vm.prank(owner);
        gasSponsor.fundGasPool{value: 1 ether}();

        (address signer, uint256 key) = makeAddrAndKey("nonceSigner");

        GasSponsor.MetaTx memory metaTx = GasSponsor.MetaTx({
            from: signer, to: address(token), value: 0,
            data: bytes(""), nonce: 5, deadline: block.timestamp + 1 hours
        });

        bytes32 structHash = keccak256(abi.encode(
            keccak256(
                "MetaTx(address from,address to,uint256 value,bytes data,uint256 nonce,uint256 deadline)"
            ),
            signer, metaTx.to, metaTx.value,
            keccak256(metaTx.data), metaTx.nonce, metaTx.deadline
        ));
        bytes32 domainSep = gasSponsor.domainSeparator();
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domainSep, structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, digest);
        bytes memory sig = abi.encodePacked(r, s, v);

        vm.expectRevert(GasSponsor.InvalidNonce.selector);
        gasSponsor.executeMetaTx(metaTx, sig);
    }

    // ============================================================================
    // Additional: Access control & edge cases
    // ============================================================================

    function test_onlyOwnerCanWithdraw() public {
        vm.prank(owner);
        gasSponsor.fundGasPool{value: 5 ether}();
        vm.prank(alice);
        vm.expectRevert(GasSponsor.Unauthorized.selector);
        gasSponsor.withdrawGasPool(payable(alice), 1 ether);
    }

    function test_relayerWhitelistBlocked() public {
        vm.prank(owner);
        gasSponsor.fundGasPool{value: 1 ether}();
        vm.prank(owner);
        gasSponsor.setRelayerWhitelistEnabled(true);

        GasSponsor.MetaTx memory metaTx = GasSponsor.MetaTx({
            from: alice, to: address(token), value: 0,
            data: bytes(""), nonce: 0, deadline: block.timestamp + 1 hours
        });
        bytes memory badSig = new bytes(65);

        vm.expectRevert(GasSponsor.NotWhitelisted.selector);
        vm.prank(relayer);
        gasSponsor.executeMetaTx(metaTx, badSig);
    }

    function test_ownerCanSetRelayerWhitelisted() public {
        vm.prank(owner);
        gasSponsor.setRelayerWhitelisted(relayer, true);
        assertTrue(gasSponsor.whitelistedRelayers(relayer));
    }

    function test_ownerTransferOwnership() public {
        vm.prank(owner);
        gasSponsor.transferOwnership(alice);
        assertEq(gasSponsor.owner(), alice);
    }

    function test_transferOwnershipZeroAddressReverts() public {
        vm.prank(owner);
        vm.expectRevert(GasSponsor.ZeroAddress.selector);
        gasSponsor.transferOwnership(address(0));
    }

    function test_gasPoolReceive() public {
        vm.prank(alice);
        (bool ok, ) = address(gasSponsor).call{value: 1 ether}("");
        assertTrue(ok);
        assertEq(address(gasSponsor).balance, 1 ether);
    }
}

// ============================================================================
// MockSafe — Minimal Safe singleton for proxy-delegatecall testing
// ============================================================================

/**
 * @title MockSafe
 * @notice Mock of Gnosis Safe used as the singleton for proxy delegate calls.
 * @dev ALL state is stored on the proxy via delegatecall. Never call this
 *      contract directly — always call through the proxy address.
 */
contract MockSafe {
    address[] private _owners;
    mapping(address => bool) private _isOwner;
    uint256 private _threshold;
    uint256 private _ownerCount;
    uint256 private _setupCount;
    uint256 private _requiredSignatures;

    mapping(bytes32 => mapping(address => bool)) private _approvals;

    event SetupCalled(address[] owners, uint256 threshold);
    event ExecutionApproved(bytes32 indexed txHash, address indexed approver);

    function setup(address[] memory owners_, uint256 threshold_) external {
        require(owners_.length > 0, "Must have at least 1 owner");
        require(threshold_ > 0 && threshold_ <= owners_.length, "Invalid threshold");

        for (uint256 i = 0; i < _owners.length; i++) {
            _isOwner[_owners[i]] = false;
        }
        delete _owners;

        for (uint256 i = 0; i < owners_.length; i++) {
            require(!_isOwner[owners_[i]], "Duplicate owner");
            _isOwner[owners_[i]] = true;
        }
        _owners = owners_;
        _threshold = threshold_;
        _ownerCount = owners_.length;
        _setupCount++;

        emit SetupCalled(owners_, threshold_);
    }

    function executeFromProxy(address to, uint256 value) external {
        bytes32 txHash = keccak256(abi.encodePacked(to, value));

        uint256 approvalCount;
        for (uint256 i = 0; i < _owners.length; i++) {
            if (_approvals[txHash][_owners[i]]) {
                approvalCount++;
            }
        }
        require(approvalCount >= _requiredSignatures, "Insufficient signatures");

        // CEI: reset approvals
        for (uint256 i = 0; i < _owners.length; i++) {
            _approvals[txHash][_owners[i]] = false;
        }

        (bool success, ) = to.call{value: value}("");
        require(success, "Transfer failed");
    }

    function approveExecution(address to, uint256 value) external {
        require(_isOwner[msg.sender], "Not an owner");
        bytes32 txHash = keccak256(abi.encodePacked(to, value));
        _approvals[txHash][msg.sender] = true;
        emit ExecutionApproved(txHash, msg.sender);
    }

    function setRequiredSignatures(uint256 count) external {
        _requiredSignatures = count;
    }

    // --- Read-only getters for proxy tests ---
    function getOwnerCount() external view returns (uint256) { return _ownerCount; }
    function getThreshold() external view returns (uint256) { return _threshold; }
    function getSetupCount() external view returns (uint256) { return _setupCount; }

    receive() external payable {}
}
