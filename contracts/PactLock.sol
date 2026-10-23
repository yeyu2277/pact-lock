// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title PactLock Bilateral Deposit Escrow
/// @notice Both parties fund the agreed amounts and confirm completion before settlement; active orders cannot be cancelled or reallocated.
/// @dev Transaction terms are agreed off-chain. Supports only native currency and standard ERC20 tokens with exact transfers and no rebasing.
///      All amounts use the asset's smallest unit; the second completion confirmation settles the order, while each party must call claim to receive funds.
///      Claimable amounts are derived from the order state and original terms; only claim flags are stored, not separate claimable balances.
contract PactLock is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // Funding roles: the payer funds the payment and their own deposit; the payee funds their own deposit.
    enum Role {
        Payer, // 0: Payer.
        Payee  // 1: Payee.
    }

    // Cancelled and Settled are terminal states; cancellation is allowed only before activation in Open or PendingActivation.
    enum State {
        None,              // 0: The order does not exist.
        Open,              // 1: Published and awaiting acceptance by a counterparty.
        PendingActivation, // 2: A public order has been accepted and awaits activation by the creator.
        Active,            // 3: Active, with funds locked until both parties confirm completion.
        Cancelled,         // 4: Cancelled; each funded participant can claim their entire original contribution.
        Settled            // 5: Settled; each party can claim the amount allocated under the original terms.
    }

    // Fixed terms, participants, state, and accounting for one order; no off-chain transaction content is stored.
    struct Order {
        // Order creator, who may be either the payer or the payee.
        address creator;
        // Designated counterparty; zero allows public acceptance, otherwise only this address may accept.
        address designatedCounterparty;
        // Actual counterparty; zero until the order is accepted.
        address counterparty;
        // Asset shared by all funds in this order; zero denotes the chain's native currency.
        address asset;
        // Payer address; zero until acceptance if the creator is the payee.
        address payer;
        // Payee address; zero until acceptance if the creator is the payer.
        address payee;
        // Creator's selected funding role; the accepting party automatically takes the opposite role.
        Role creatorRole;
        // Current order state; see State for the meaning of each value.
        State state;
        // Payment from the payer to the payee after both parties confirm completion; may be zero.
        uint256 paymentAmount;
        // Payer's deposit; must be greater than zero at creation.
        uint256 payerDeposit;
        // Payee's deposit; must be greater than zero at creation.
        uint256 payeeDeposit;
        // Funds not yet eligible for claims; cleared on cancellation or the second completion confirmation.
        uint256 lockedAmount;
        // Whether the payer has irrevocably confirmed completion; the order settles immediately once both parties confirm.
        bool payerConfirmed;
        // Whether the payee has irrevocably confirmed completion; the order settles immediately once both parties confirm.
        bool payeeConfirmed;
        // Whether the payer has claimed their entire entitlement for this order; set to true after a successful claim.
        bool payerClaimed;
        // Whether the payee has claimed their entire entitlement for this order; set to true after a successful claim.
        bool payeeClaimed;
    }

    // Order accounting indexed by ID; no array is maintained for enumeration. Events can be used to build an index.
    mapping(bytes32 => Order) private _orders;
    /// @notice Total liability for an asset: locked funds plus unclaimed entitlements across all relevant orders.
    /// @dev Keys are asset addresses, with zero denoting native currency; unsolicited transfers do not increase liabilities.
    mapping(address => uint256) public totalLiability;
    /// @notice Incrementing nonce for the next order, also equal to the total number of successfully created orders.
    /// @dev Starts at zero and does not decrease on cancellation or settlement; a reverted creation also rolls back the nonce update.
    uint256 public nextOrderNonce;

    /// @notice The order does not exist.
    /// @param orderId ID of the order being queried or operated on.
    error UnknownOrder(bytes32 orderId);
    /// @notice The generated order ID is already in use; existing orders cannot be overwritten.
    /// @param orderId Conflicting order ID.
    error OrderIdCollision(bytes32 orderId);
    /// @notice The order's current state does not permit this operation.
    /// @param orderId ID of the order being operated on.
    /// @param actual Actual order state.
    error InvalidState(bytes32 orderId, State actual);
    /// @notice The payer's or payee's deposit is zero.
    error InvalidDeposits();
    /// @notice The designated counterparty cannot be the creator or this escrow contract.
    /// @param counterparty Invalid designated counterparty address.
    error InvalidCounterparty(address counterparty);
    /// @notice A nonzero asset address must contain contract code and cannot be this escrow contract.
    /// @param asset Invalid asset address.
    error InvalidAsset(address asset);
    /// @notice The caller is not authorized to perform this operation.
    /// @param caller Unauthorized caller address.
    error Unauthorized(address caller);
    /// @notice The creator cannot accept their own order.
    error SelfAcceptance();
    /// @notice This participant has already confirmed completion and cannot confirm again.
    /// @param orderId ID of the order being operated on.
    /// @param participant Participant attempting to confirm again.
    error AlreadyConfirmed(bytes32 orderId, address participant);
    /// @notice The native currency amount attached to the call does not match the required amount.
    /// @param expected Required msg.value; zero for ERC20 orders.
    /// @param actual Actual msg.value received.
    error IncorrectNativeValue(uint256 expected, uint256 actual);
    /// @notice The observed balance changes do not match the agreed transfer amount.
    /// @param asset Asset that does not satisfy the exact transfer requirements.
    error UnsupportedTransfer(address asset);
    /// @notice The actual asset balance cannot cover the liabilities of all relevant orders.
    /// @param asset Asset with insufficient reserves; zero denotes native currency.
    error InsolventAsset(address asset);
    /// @notice The claim recipient cannot be the zero address or this escrow contract.
    /// @param recipient Invalid recipient address.
    error InvalidRecipient(address recipient);
    /// @notice The caller has no remaining claimable amount for this order.
    /// @param orderId ID of the order being operated on.
    /// @param participant Participant attempting to claim.
    error NothingToClaim(bytes32 orderId, address participant);
    /// @notice Sending native currency to the recipient failed; the entire claim is reverted.
    /// @param recipient Recipient of the failed native currency transfer.
    error NativeTransferFailed(address recipient);
    /// @notice The creator has created an order and fully funded their role.
    /// @param orderId Unique order ID for queries and off-chain sharing.
    /// @param creator Order creator's address.
    /// @param asset Shared asset address; zero denotes native currency.
    /// @param creatorRole Creator's role as payer or payee.
    /// @param designatedCounterparty Designated counterparty; zero allows public acceptance.
    /// @param paymentAmount Agreed payment amount in the asset's smallest unit.
    /// @param payerDeposit Agreed payer deposit in the asset's smallest unit.
    /// @param payeeDeposit Agreed payee deposit in the asset's smallest unit.
    event OrderCreated(
        bytes32 indexed orderId,
        address indexed creator,
        address indexed asset,
        Role creatorRole,
        address designatedCounterparty,
        uint256 paymentAmount,
        uint256 payerDeposit,
        uint256 payeeDeposit
    );
    /// @notice The counterparty has funded the opposite role; immediate activation depends on whether a counterparty was designated.
    /// @param orderId ID of the accepted order.
    /// @param counterparty Address of the actual accepting party.
    event OrderAccepted(bytes32 indexed orderId, address indexed counterparty);
    /// @notice The order is active and can no longer be cancelled.
    /// @param orderId ID of the activated order.
    event OrderActivated(bytes32 indexed orderId);
    /// @notice The order was cancelled before activation; each funded participant may claim their entire original contribution.
    /// @param orderId ID of the cancelled order.
    /// @param cancelledBy Creator or counterparty who cancelled the order.
    event OrderCancelled(bytes32 indexed orderId, address indexed cancelledBy);
    /// @notice One party has confirmed completion; the second confirmation also emits OrderSettled in the same transaction. Transfers still require claim.
    /// @param orderId ID of the order being confirmed.
    /// @param participant Participant confirming completion.
    event CompletionConfirmed(bytes32 indexed orderId, address indexed participant);
    /// @notice The second completion confirmation has settled the order; both parties may claim their original allocations, but no wallet transfers have occurred yet.
    /// @param orderId ID of the settled order.
    /// @param payerAmount Deposit amount claimable by the payer.
    /// @param payeeAmount Payment plus the payee's deposit, claimable by the payee.
    event OrderSettled(bytes32 indexed orderId, uint256 payerAmount, uint256 payeeAmount);
    /// @notice A participant has successfully claimed their entire remaining entitlement for this order.
    /// @param orderId ID of the order to which the funds belong.
    /// @param participant Entitlement owner, who is the caller of claim.
    /// @param recipient Actual recipient of the funds, which may be specified separately by the entitlement owner.
    /// @param amount Amount claimed in the order asset's smallest unit.
    event FundsClaimed(
        bytes32 indexed orderId,
        address indexed participant,
        address indexed recipient,
        uint256 amount
    );

    /// @notice Creates an order and fully funds the creator's role without storing any off-chain transaction content.
    /// @dev A payer creator funds the payment plus the payer deposit; a payee creator funds only the payee deposit.
    ///      Native currency orders require exact msg.value; ERC20 orders require prior approval and zero msg.value.
    ///      All amounts use the selected asset's smallest unit; terms are immutable after creation, and acceptance has no deadline.
    /// @param creatorRole Creator's role: Role.Payer (0) or Role.Payee (1).
    /// @param designatedCounterparty Only address allowed to accept; zero allows public acceptance. Cannot be the creator or this contract.
    /// @param asset Shared asset address; zero denotes native currency, otherwise a standard ERC20 contract with exact transfers.
    /// @param paymentAmount Agreed payment from the payer to the payee; may be zero.
    /// @param payerDeposit Payer's deposit; must be greater than zero.
    /// @param payeeDeposit Payee's deposit; must be greater than zero.
    /// @return orderId Unique bytes32 order ID, without an unpredictability guarantee; transaction callers should read it from the OrderCreated receipt event.
    function createOrder(
        Role creatorRole,
        address designatedCounterparty,
        address asset,
        uint256 paymentAmount,
        uint256 payerDeposit,
        uint256 payeeDeposit
    ) external payable nonReentrant returns (bytes32 orderId) {
        if (payerDeposit == 0 || payeeDeposit == 0) revert InvalidDeposits();
        if (designatedCounterparty == msg.sender || designatedCounterparty == address(this)) {
            revert InvalidCounterparty(designatedCounterparty);
        }
        if (asset != address(0) && (asset == address(this) || asset.code.length == 0)) {
            revert InvalidAsset(asset);
        }
        // Check the total order funding for overflow upfront, even when collecting only the creator's contribution.
        uint256 totalFunding = paymentAmount + payerDeposit + payeeDeposit;
        uint256 creatorFunding = creatorRole == Role.Payer ? totalFunding - payeeDeposit : payeeDeposit;
        orderId = keccak256(abi.encode(block.chainid, address(this), msg.sender, nextOrderNonce++));
        if (_orders[orderId].state != State.None) revert OrderIdCollision(orderId);

        Order storage order = _orders[orderId];
        order.creator = msg.sender;
        order.designatedCounterparty = designatedCounterparty;
        order.asset = asset;
        order.creatorRole = creatorRole;
        order.state = State.Open;
        order.paymentAmount = paymentAmount;
        order.payerDeposit = payerDeposit;
        order.payeeDeposit = payeeDeposit;
        order.lockedAmount = creatorFunding;
        if (creatorRole == Role.Payer) order.payer = msg.sender;
        else order.payee = msg.sender;
        totalLiability[asset] += creatorFunding;

        _collect(asset, creatorFunding);
        emit OrderCreated(orderId, msg.sender, asset, creatorRole, designatedCounterparty,
            paymentAmount, payerDeposit, payeeDeposit);
    }

    /// @notice Accepts an Open order and fully funds the role opposite to the creator's.
    /// @dev Creators cannot accept their own orders; designated orders may only be accepted by the designated address and become Active immediately.
    ///      Public orders enter PendingActivation and require creator activation; either party may still cancel at this stage.
    ///      The payer funds the payment plus the payer deposit; the payee funds only the payee deposit.
    ///      Native currency orders require exact msg.value; ERC20 orders require prior approval and no attached native currency.
    /// @param orderId ID of an order that has not yet been accepted or cancelled.
    function acceptOrder(bytes32 orderId) external payable nonReentrant {
        Order storage order = _getOrder(orderId);
        _requireState(orderId, order, State.Open);
        if (msg.sender == order.creator) revert SelfAcceptance();
        if (order.designatedCounterparty != address(0) && msg.sender != order.designatedCounterparty) {
            revert Unauthorized(msg.sender);
        }

        uint256 funding;
        order.counterparty = msg.sender;
        if (order.creatorRole == Role.Payer) {
            order.payee = msg.sender;
            funding = order.payeeDeposit;
        } else {
            order.payer = msg.sender;
            funding = order.paymentAmount + order.payerDeposit;
        }
        bool designated = order.designatedCounterparty != address(0);
        order.state = designated ? State.Active : State.PendingActivation;
        order.lockedAmount += funding;
        totalLiability[order.asset] += funding;

        _collect(order.asset, funding);
        emit OrderAccepted(orderId, msg.sender);
        if (designated) emit OrderActivated(orderId);
    }

    /// @notice Approves the accepting party for a public order and irrevocably activates the order.
    /// @dev Only the creator may call in PendingActivation; active orders have no cancellation, refund, or timeout release mechanism.
    ///      Designated orders activate automatically on acceptance and neither need nor permit this call afterward.
    /// @param orderId ID of an accepted public order awaiting creator activation.
    function activateOrder(bytes32 orderId) external nonReentrant {
        Order storage order = _getOrder(orderId);
        _requireState(orderId, order, State.PendingActivation);
        if (msg.sender != order.creator) revert Unauthorized(msg.sender);
        order.state = State.Active;
        emit OrderActivated(orderId);
    }

    /// @notice Cancels an order only before activation, allowing funded participants to independently claim their entire original contributions.
    /// @dev Only the creator may cancel an Open order; either the creator or counterparty may cancel in PendingActivation.
    ///      No transfers occur here; participants must call claim. Cancelled orders cannot be accepted again, and Active orders can never be cancelled.
    /// @param orderId ID of an order still in Open or PendingActivation.
    function cancelOrder(bytes32 orderId) external nonReentrant {
        Order storage order = _getOrder(orderId);
        State state = order.state;
        if (state != State.Open && state != State.PendingActivation) revert InvalidState(orderId, state);
        if (msg.sender != order.creator && (state != State.PendingActivation || msg.sender != order.counterparty)) {
            revert Unauthorized(msg.sender);
        }
        order.state = State.Cancelled;
        order.lockedAmount = 0;
        // Refunds are derived from original contributions at claim time; funds remain in escrow, so total liability is unchanged.
        emit OrderCancelled(orderId, msg.sender);
    }

    /// @notice Records the caller's irrevocable completion confirmation; the second party's confirmation settles the order in the same transaction.
    /// @dev Only the payer or payee of an Active order may call, at most once per party.
    ///      Funds remain locked after the first confirmation; the second changes the state to Settled, with no separate settlement method.
    ///      The payer may claim their deposit; the payee may claim the payment plus their deposit, under the original terms without refund reallocation.
    ///      No transfers occur here; each party must call claim so that one party's refusal to receive funds cannot block the other.
    /// @param orderId ID of an active order in which the caller is the payer or payee.
    function confirmCompletion(bytes32 orderId) external nonReentrant {
        Order storage order = _getOrder(orderId);
        _requireState(orderId, order, State.Active);
        if (msg.sender == order.payer) {
            if (order.payerConfirmed) revert AlreadyConfirmed(orderId, msg.sender);
            order.payerConfirmed = true;
        } else if (msg.sender == order.payee) {
            if (order.payeeConfirmed) revert AlreadyConfirmed(orderId, msg.sender);
            order.payeeConfirmed = true;
        } else revert Unauthorized(msg.sender);
        emit CompletionConfirmed(orderId, msg.sender);
        if (order.payerConfirmed && order.payeeConfirmed) {
            order.state = State.Settled;
            order.lockedAmount = 0;
            emit OrderSettled(orderId, order.payerDeposit, order.paymentAmount + order.payeeDeposit);
        }
    }

    /// @notice Transfers the caller's entire remaining entitlement in a cancelled or settled order to the specified recipient.
    /// @dev Only the payer or payee may claim their own entitlement, in full; the amount is derived from the state and original terms.
    ///      Marks the entitlement as claimed and reduces liability before transferring; failures fully revert, allowing retries with another recipient.
    ///      One party's failed claim does not affect the other; claim flags prevent repeated claims by the same participant.
    /// @param orderId ID of a Cancelled or Settled order with a remaining entitlement for the caller.
    /// @param recipient Actual recipient, which may differ from the caller; cannot be zero or this escrow contract.
    function claim(bytes32 orderId, address payable recipient) external nonReentrant {
        Order storage order = _getOrder(orderId);
        if (order.state != State.Cancelled && order.state != State.Settled) {
            revert InvalidState(orderId, order.state);
        }
        if (recipient == address(0) || recipient == address(this)) revert InvalidRecipient(recipient);
        if (msg.sender != order.payer && msg.sender != order.payee) revert Unauthorized(msg.sender);
        uint256 amount = _claimable(order, msg.sender);
        if (amount == 0) revert NothingToClaim(orderId, msg.sender);
        uint256 beforeBalance = order.asset == address(0)
            ? address(this).balance : IERC20(order.asset).balanceOf(address(this));
        _assertSolvent(order.asset, beforeBalance);
        if (msg.sender == order.payer) order.payerClaimed = true;
        else order.payeeClaimed = true;
        totalLiability[order.asset] -= amount;

        _send(order.asset, recipient, amount, beforeBalance);
        emit FundsClaimed(orderId, msg.sender, recipient, amount);
    }

    /// @notice Returns the complete data for one order; anyone may query it.
    /// @dev Reverts for nonexistent orders; the state becomes Settled immediately upon the second completion confirmation.
    /// @param orderId ID of a successfully created order.
    /// @return Order data copy containing fixed terms, participants, current state, confirmation flags, locked amount, and claim flags.
    function getOrder(bytes32 orderId) external view returns (Order memory) {
        return _getOrder(orderId);
    }

    /// @notice Calculates an order's claimable amount from its state, original amounts, and claim flags; anyone may query it.
    /// @dev Reverts for nonexistent orders; returns zero for the zero address, nonparticipants, or participants not yet entitled to claim.
    /// @param orderId ID of a successfully created order.
    /// @param participant Payer or payee to query; does not have to be the caller.
    /// @return Claimable amount in the order asset's smallest unit; zero after a successful claim. This amount is not stored separately.
    function getClaimable(bytes32 orderId, address participant) external view returns (uint256) {
        return _claimable(_getOrder(orderId), participant);
    }

    /// @dev Claims require a terminal state; cancellation refunds original contributions, settlement pays the original allocation, and nonparticipants or prior claimants receive zero.
    /// @param order Storage reference to the order being evaluated.
    /// @param participant Payer or payee to query; zero is not treated as an unfunded participant.
    /// @return Entire entitlement under the original terms, without transferring funds or updating claim flags.
    function _claimable(Order storage order, address participant) private view returns (uint256) {
        if (order.state != State.Cancelled && order.state != State.Settled) return 0;
        if (participant == address(0)) return 0;
        if (participant == order.payer && !order.payerClaimed) {
            return order.state == State.Cancelled ? order.paymentAmount + order.payerDeposit : order.payerDeposit;
        }
        if (participant == order.payee && !order.payeeClaimed) {
            return order.state == State.Cancelled ? order.payeeDeposit : order.paymentAmount + order.payeeDeposit;
        }
        return 0;
    }

    /// @dev Retrieves an order storage reference, treating None as a nonexistent order.
    /// @param orderId ID of the order to retrieve.
    /// @return order Storage reference to an existing order, allowing the caller to read or update it.
    function _getOrder(bytes32 orderId) private view returns (Order storage order) {
        order = _orders[orderId];
        if (order.state == State.None) revert UnknownOrder(orderId);
    }

    /// @dev Validates the order state and reverts with the actual state on a mismatch.
    /// @param orderId Order ID included in error reports.
    /// @param order Storage reference to the order being checked.
    /// @param expected State required by the current operation.
    function _requireState(bytes32 orderId, Order storage order, State expected) private view {
        if (order.state != expected) revert InvalidState(orderId, order.state);
    }

    /// @dev Collects funds from msg.sender; the caller must have already updated order accounting and the asset's total liability.
    ///      Checks msg.value for native currency and the exact received balance increase for ERC20, rejecting inexact transfers.
    ///      Reuses the post-transfer balance to check liability coverage without another query; failures revert funding and prior accounting updates.
    /// @param asset Asset address; zero denotes native currency.
    /// @param amount Amount to collect in the asset's smallest unit, already included in totalLiability.
    function _collect(address asset, uint256 amount) private {
        uint256 afterBalance;
        if (asset == address(0)) {
            if (msg.value != amount) revert IncorrectNativeValue(amount, msg.value);
            afterBalance = address(this).balance;
        } else {
            if (msg.value != 0) revert IncorrectNativeValue(0, msg.value);
            IERC20 token = IERC20(asset);
            uint256 beforeBalance = token.balanceOf(address(this));
            token.safeTransferFrom(msg.sender, address(this), amount);
            afterBalance = token.balanceOf(address(this));
            if (afterBalance < beforeBalance || afterBalance - beforeBalance != amount) {
                revert UnsupportedTransfer(asset);
            }
        }
        _assertSolvent(asset, afterBalance);
    }

    /// @dev Transfers one participant's claim; the caller must have already set the claim flag and reduced the asset's total liability.
    ///      Uses a low-level call and checks success for native currency; for ERC20, verifies both escrow spending and recipient receipt equal amount exactly.
    ///      Reuses the pre-claim balance snapshot and post-transfer balance to check actual spending and liability coverage; failures revert the entire claim.
    /// @param asset Asset address; zero denotes native currency.
    /// @param recipient Validated recipient that is neither zero nor this escrow contract.
    /// @param amount Amount to pay in the asset's smallest unit, already deducted from totalLiability.
    /// @param beforeBalance Actual balance read and verified as solvent by claim before reducing liability; reused as the pre-transfer snapshot.
    function _send(address asset, address payable recipient, uint256 amount, uint256 beforeBalance) private {
        uint256 afterBalance;
        if (asset == address(0)) {
            (bool success,) = recipient.call{value: amount}("");
            if (!success) revert NativeTransferFailed(recipient);
            afterBalance = address(this).balance;
        } else {
            IERC20 token = IERC20(asset);
            uint256 recipientBefore = token.balanceOf(recipient);
            token.safeTransfer(recipient, amount);
            afterBalance = token.balanceOf(address(this));
            uint256 recipientAfter = token.balanceOf(recipient);
            if (afterBalance > beforeBalance || beforeBalance - afterBalance != amount ||
                recipientAfter < recipientBefore || recipientAfter - recipientBefore != amount) {
                revert UnsupportedTransfer(asset);
            }
        }
        _assertSolvent(asset, afterBalance);
    }

    /// @dev Compares an already measured balance with total liability without querying again; surplus funds create no claim entitlement.
    /// @param asset Asset address to check; zero denotes native currency.
    /// @param balance Actual balance measured by the caller at the relevant transfer stage; must not be an estimate or a snapshot from the wrong stage.
    function _assertSolvent(address asset, uint256 balance) private view {
        if (balance < totalLiability[asset]) revert InsolventAsset(asset);
    }
}
