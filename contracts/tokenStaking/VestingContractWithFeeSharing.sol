// SPDX-License-Identifier: MIT
pragma solidity ^0.8.6;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {IERC20, SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

error Unlock_Tooearly();
error Owner_CannotwithdrawBOOKS();
error Owner_Nothingtowithdraw();

/**
 * @title VestingContractWithFeeSharing
 * @notice It vests the BOOKS tokens to an owner over a linear schedule.
 * Other tokens can be withdrawn at any time.
 */
contract VestingContractWithFeeSharing is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable looksRareToken;

    // Number of unlock periods
    uint256 public immutable NUMBER_UNLOCK_PERIODS;

    // Standard amount unlocked at each unlock
    uint256 public immutable STANDARD_AMOUNT_UNLOCKED_AT_EACH_UNLOCK;

    // Start block for the linear vesting
    uint256 public immutable START_BLOCK;

    // Vesting period in blocks
    uint256 public immutable VESTING_BETWEEN_PERIODS_IN_BLOCKS;

    // Keeps track of maximum amount to withdraw for next unlock period
    uint256 public maxAmountToWithdrawForNextPeriod;

    // Next block number for unlock
    uint256 public nextBlockForUnlock;

    // Keep track of number of past unlocks
    uint256 public numberPastUnlocks;

    event OtherTokensWithdrawn(address indexed currency, uint256 amount);
    event TokensUnlocked(uint256 amount);

    /**
     * @notice Constructor
     * @param _vestingBetweenPeriodsInBlocks period length between each halving in blocks
     * @param _startBlock block number for start (must be same as TokenDistributor)
     * @param _numberUnlockPeriods number of unlock periods (e.g., 4)
     * @param _maxAmountToWithdraw maximum amount in BOOKS to withdraw per period
     * @param _looksRareToken address of the BOOKS token
     */
    constructor(
        uint256 _vestingBetweenPeriodsInBlocks,
        uint256 _startBlock,
        uint256 _numberUnlockPeriods,
        uint256 _maxAmountToWithdraw,
        address _looksRareToken
    ) {
        VESTING_BETWEEN_PERIODS_IN_BLOCKS = _vestingBetweenPeriodsInBlocks;
        START_BLOCK = _startBlock;
        NUMBER_UNLOCK_PERIODS = _numberUnlockPeriods;
        STANDARD_AMOUNT_UNLOCKED_AT_EACH_UNLOCK = _maxAmountToWithdraw;

        maxAmountToWithdrawForNextPeriod = _maxAmountToWithdraw;

        nextBlockForUnlock = _startBlock + _vestingBetweenPeriodsInBlocks;
        looksRareToken = IERC20(_looksRareToken);
    }

    /**
     * @notice Unlock BOOKS tokens
     * @dev It includes protection for overstaking
     */
    function unlockBooksRareToken() external nonReentrant onlyOwner {
        if(!(numberPastUnlocks == NUMBER_UNLOCK_PERIODS) || (block.number >= nextBlockForUnlock)) revert Unlock_Tooearly();

        uint256 balanceToWithdraw = looksRareToken.balanceOf(address(this));

        if (numberPastUnlocks < NUMBER_UNLOCK_PERIODS) {
            // Adjust next block for unlock
            nextBlockForUnlock += VESTING_BETWEEN_PERIODS_IN_BLOCKS;
            // Adjust number of past unlocks
            numberPastUnlocks++;

            if (balanceToWithdraw >= maxAmountToWithdrawForNextPeriod) {
                // Adjust balance to withdraw to match linear schedule
                balanceToWithdraw = maxAmountToWithdrawForNextPeriod;
                maxAmountToWithdrawForNextPeriod = STANDARD_AMOUNT_UNLOCKED_AT_EACH_UNLOCK;
            } else {
                // Adjust next period maximum based on the missing amount for this period
                maxAmountToWithdrawForNextPeriod =
                    maxAmountToWithdrawForNextPeriod +
                    (maxAmountToWithdrawForNextPeriod - balanceToWithdraw);
            }
        }

        // Transfer BOOKS to owner
        looksRareToken.safeTransfer(msg.sender, balanceToWithdraw);

        emit TokensUnlocked(balanceToWithdraw);
    }

    /**
     * @notice Withdraw any currency to the owner (e.g., WETH for fee sharing)
     * @param _currency address of the currency to withdraw
     */
    function withdrawOtherCurrency(address _currency) external nonReentrant onlyOwner {
        if(_currency == address(looksRareToken)) revert Owner_CannotwithdrawBOOKS();

        uint256 balanceToWithdraw = IERC20(_currency).balanceOf(address(this));

        // Transfer token to owner if not null
        if(balanceToWithdraw == 0) revert Owner_Nothingtowithdraw();
        IERC20(_currency).safeTransfer(msg.sender, balanceToWithdraw);

        emit OtherTokensWithdrawn(_currency, balanceToWithdraw);
    }
}
