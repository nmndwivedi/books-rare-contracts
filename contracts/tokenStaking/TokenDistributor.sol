// SPDX-License-Identifier: MIT
pragma solidity ^0.8.6;

import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {IERC20, SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {IBooksRareToken} from "../interfaces/IBooksRareToken.sol";

error Distributor_LengthsMustMatchNumberPeriods();
error Distributor_WrongRewardParameters();
error Deposit_AmountMustBeGreaterThan0();
error Withdraw_AmountMustBeGreaterThan0OrLowerThanUserBalance();
error Withdraw_AmountMustBeGreaterThan0();

/**
 * @title TokenDistributor
 * @notice It handles the distribution of BOOKS token.
 * It auto-adjusts block rewards over a set number of periods.
 */
contract TokenDistributor is ReentrancyGuard {
    using SafeERC20 for IERC20;
    using SafeERC20 for IBooksRareToken;

    struct StakingPeriod {
        uint256 rewardPerBlockForStaking;
        uint256 rewardPerBlockForOthers;
        uint256 periodLengthInBlock;
    }

    struct UserInfo {
        uint256 stakedAmount; // Amount of staked tokens provided by user
        uint256 rewardDebt; // Reward debt
    }

    // Precision factor for calculating rewards
    uint256 public constant PRECISION_FACTOR = 10**12;

    IBooksRareToken public immutable BooksRareToken;

    address public immutable tokenSplitter;

    // Number of reward periods
    uint256 public immutable NUMBER_PERIODS;

    // Block number when rewards start
    uint256 public immutable START_BLOCK;

    // Accumulated tokens per share
    uint256 public accumulatedTokensPerStakedToken;

    // Current phase for rewards
    uint256 public currentPhase;

    // Block number when rewards end
    uint256 public endBlock;

    // Block number of the last update
    uint256 public lastRewardBlock;

    // Tokens distributed per block for other purposes (team + treasury + trading rewards)
    uint256 public rewardPerBlockForOthers;

    // Tokens distributed per block for staking
    uint256 public rewardPerBlockForStaking;

    // Total amount staked
    uint256 public totalAmountStaked;

    mapping(uint256 => StakingPeriod) public stakingPeriod;

    mapping(address => UserInfo) public userInfo;

    event Compound(address indexed user, uint256 harvestedAmount);
    event Deposit(address indexed user, uint256 amount, uint256 harvestedAmount);
    event NewRewardsPerBlock(uint256 indexed currentPhase, uint256 startBlock, uint256 rewardPerBlockForStaking, uint256 rewardPerBlockForOthers);
    event Withdraw(address indexed user, uint256 amount, uint256 harvestedAmount);

    /**
     * @notice Constructor
     * @param _BooksRareToken BOOKS token address
     * @param _tokenSplitter token splitter contract address (for team and trading rewards)
     * @param _startBlock start block for reward program
     * @param _rewardsPerBlockForStaking array of rewards per block for staking
     * @param _rewardsPerBlockForOthers array of rewards per block for other purposes (team + treasury + trading rewards)
     * @param _periodLengthsInBlocks array of period lengths
     * @param _numberPeriods number of periods with different rewards/lengths (e.g., if 3 changes --> 4 periods)
     */
    constructor(
        address _BooksRareToken,
        address _tokenSplitter,
        uint256 _startBlock,
        uint256[] memory _rewardsPerBlockForStaking,
        uint256[] memory _rewardsPerBlockForOthers,
        uint256[] memory _periodLengthsInBlocks,
        uint256 _numberPeriods
    ) {
        if(!((_periodLengthsInBlocks.length == _numberPeriods) && (_rewardsPerBlockForStaking.length == _numberPeriods) &&
                (_rewardsPerBlockForStaking.length == _numberPeriods))) revert Distributor_LengthsMustMatchNumberPeriods();

        // 1. Operational checks for supply
        uint256 nonCirculatingSupply = IBooksRareToken(_BooksRareToken).SUPPLY_CAP() -
            IBooksRareToken(_BooksRareToken).totalSupply();

        uint256 amountTokensToBeMinted;

        for (uint256 i = 0; i < _numberPeriods; i++) {
            amountTokensToBeMinted +=
                (_rewardsPerBlockForStaking[i] * _periodLengthsInBlocks[i]) +
                (_rewardsPerBlockForOthers[i] * _periodLengthsInBlocks[i]);

            stakingPeriod[i] = StakingPeriod({
                rewardPerBlockForStaking: _rewardsPerBlockForStaking[i],
                rewardPerBlockForOthers: _rewardsPerBlockForOthers[i],
                periodLengthInBlock: _periodLengthsInBlocks[i]
            });
        }

        if(amountTokensToBeMinted != nonCirculatingSupply) revert Distributor_WrongRewardParameters();

        // 2. Store values
        BooksRareToken = IBooksRareToken(_BooksRareToken);
        tokenSplitter = _tokenSplitter;
        rewardPerBlockForStaking = _rewardsPerBlockForStaking[0];
        rewardPerBlockForOthers = _rewardsPerBlockForOthers[0];

        START_BLOCK = _startBlock;
        endBlock = _startBlock + _periodLengthsInBlocks[0];

        NUMBER_PERIODS = _numberPeriods;

        // Set the lastRewardBlock as the startBlock
        lastRewardBlock = _startBlock;
    }

    /**
     * @notice Deposit staked tokens and compounds pending rewards
     * @param amount amount to deposit (in BOOKS)
     */
    function deposit(uint256 amount) external nonReentrant {
        if(amount <= 0) revert Deposit_AmountMustBeGreaterThan0();

        // Update pool information
        _updatePool();

        // Transfer BOOKS tokens to this contract
        BooksRareToken.safeTransferFrom(msg.sender, address(this), amount);

        uint256 pendingRewards;

        // If not new deposit, calculate pending rewards (for auto-compounding)
        if (userInfo[msg.sender].stakedAmount > 0) {
            pendingRewards = ((userInfo[msg.sender].stakedAmount * accumulatedTokensPerStakedToken) / PRECISION_FACTOR) - userInfo[msg.sender].rewardDebt;
        }

        // Adjust user information
        userInfo[msg.sender].stakedAmount += (amount + pendingRewards);
        userInfo[msg.sender].rewardDebt = (userInfo[msg.sender].stakedAmount * accumulatedTokensPerStakedToken) / PRECISION_FACTOR;

        // Increase totalAmountStaked
        totalAmountStaked += (amount + pendingRewards);

        emit Deposit(msg.sender, amount, pendingRewards);
    }

    /**
     * @notice Compound based on pending rewards
     */
    function harvestAndCompound() external nonReentrant {
        // Update pool information
        _updatePool();

        // Calculate pending rewards
        uint256 pendingRewards = ((userInfo[msg.sender].stakedAmount * accumulatedTokensPerStakedToken) / PRECISION_FACTOR) -
            userInfo[msg.sender].rewardDebt;

        // Return if no pending rewards
        if (pendingRewards == 0) {
            // It doesn't throw revertion (to help with the fee-sharing auto-compounding contract)
            return;
        }

        // Adjust user amount for pending rewards
        userInfo[msg.sender].stakedAmount += pendingRewards;

        // Adjust totalAmountStaked
        totalAmountStaked += pendingRewards;

        // Recalculate reward debt based on new user amount
        userInfo[msg.sender].rewardDebt = (userInfo[msg.sender].stakedAmount * accumulatedTokensPerStakedToken) / PRECISION_FACTOR;

        emit Compound(msg.sender, pendingRewards);
    }

    /**
     * @notice Update pool rewards
     */
    function updatePool() external nonReentrant {
        _updatePool();
    }

    /**
     * @notice Withdraw staked tokens and compound pending rewards
     * @param withdrawAmount amount to withdraw
     */
    function withdraw(uint256 withdrawAmount) external nonReentrant {
        if(!((userInfo[msg.sender].stakedAmount >= withdrawAmount) && (withdrawAmount > 0))) revert Withdraw_AmountMustBeGreaterThan0OrLowerThanUserBalance();

        // Update pool
        _updatePool();

        // Calculate pending rewards
        uint256 pendingRewards = ((userInfo[msg.sender].stakedAmount * accumulatedTokensPerStakedToken) / PRECISION_FACTOR) -
            userInfo[msg.sender].rewardDebt;

        // Adjust user information
        userInfo[msg.sender].stakedAmount = userInfo[msg.sender].stakedAmount + pendingRewards - withdrawAmount;
        userInfo[msg.sender].rewardDebt = (userInfo[msg.sender].stakedAmount * accumulatedTokensPerStakedToken) / PRECISION_FACTOR;

        // Adjust total amount staked
        totalAmountStaked = totalAmountStaked + pendingRewards - withdrawAmount;

        // Transfer BOOKS tokens to the sender
        BooksRareToken.safeTransfer(msg.sender, withdrawAmount);

        emit Withdraw(msg.sender, withdrawAmount, pendingRewards);
    }

    /**
     * @notice Withdraw all staked tokens and collect tokens
     */
    function withdrawAll() external nonReentrant {
        if(userInfo[msg.sender].stakedAmount <= 0) revert Withdraw_AmountMustBeGreaterThan0();

        // Update pool
        _updatePool();

        // Calculate pending rewards and amount to transfer (to the sender)
        uint256 pendingRewards = ((userInfo[msg.sender].stakedAmount * accumulatedTokensPerStakedToken) / PRECISION_FACTOR) -
            userInfo[msg.sender].rewardDebt;

        uint256 amountToTransfer = userInfo[msg.sender].stakedAmount + pendingRewards;

        // Adjust total amount staked
        totalAmountStaked = totalAmountStaked - userInfo[msg.sender].stakedAmount;

        // Adjust user information
        userInfo[msg.sender].stakedAmount = 0;
        userInfo[msg.sender].rewardDebt = 0;

        // Transfer BOOKS tokens to the sender
        BooksRareToken.safeTransfer(msg.sender, amountToTransfer);

        emit Withdraw(msg.sender, amountToTransfer, pendingRewards);
    }

    /**
     * @notice Calculate pending rewards for a user
     * @param user address of the user
     * @return Pending rewards
     */
    function calculatePendingRewards(address user) external view returns (uint256) {
        if ((block.number > lastRewardBlock) && (totalAmountStaked != 0)) {
            uint256 multiplier = _getMultiplier(lastRewardBlock, block.number);

            uint256 tokenRewardForStaking = multiplier * rewardPerBlockForStaking;

            uint256 adjustedEndBlock = endBlock;
            uint256 adjustedCurrentPhase = currentPhase;

            // Check whether to adjust multipliers and reward per block
            while ((block.number > adjustedEndBlock) && (adjustedCurrentPhase < (NUMBER_PERIODS - 1))) {
                // Update current phase
                adjustedCurrentPhase++;

                // Update rewards per block
                uint256 adjustedRewardPerBlockForStaking = stakingPeriod[adjustedCurrentPhase].rewardPerBlockForStaking;

                // Calculate adjusted block number
                uint256 previousEndBlock = adjustedEndBlock;

                // Update end block
                adjustedEndBlock = previousEndBlock + stakingPeriod[adjustedCurrentPhase].periodLengthInBlock;

                // Calculate new multiplier
                uint256 newMultiplier = (block.number <= adjustedEndBlock)
                    ? (block.number - previousEndBlock)
                    : stakingPeriod[adjustedCurrentPhase].periodLengthInBlock;

                // Adjust token rewards for staking
                tokenRewardForStaking += (newMultiplier * adjustedRewardPerBlockForStaking);
            }

            uint256 adjustedTokensPerStakedToken = accumulatedTokensPerStakedToken + (tokenRewardForStaking * PRECISION_FACTOR) / totalAmountStaked;

            return (userInfo[user].stakedAmount * adjustedTokensPerStakedToken) / PRECISION_FACTOR - userInfo[user].rewardDebt;
        } else {
            return (userInfo[user].stakedAmount * accumulatedTokensPerStakedToken) / PRECISION_FACTOR - userInfo[user].rewardDebt;
        }
    }

    /**
     * @notice Update reward variables of the pool
     */
    function _updatePool() internal {
        if (block.number <= lastRewardBlock) {
            return;
        }

        if (totalAmountStaked == 0) {
            lastRewardBlock = block.number;
            return;
        }

        // Calculate multiplier
        uint256 multiplier = _getMultiplier(lastRewardBlock, block.number);

        // Calculate rewards for staking and others
        uint256 tokenRewardForStaking = multiplier * rewardPerBlockForStaking;
        uint256 tokenRewardForOthers = multiplier * rewardPerBlockForOthers;

        // Check whether to adjust multipliers and reward per block
        while ((block.number > endBlock) && (currentPhase < (NUMBER_PERIODS - 1))) {
            // Update rewards per block
            _updateRewardsPerBlock(endBlock);

            uint256 previousEndBlock = endBlock;

            // Adjust the end block
            endBlock += stakingPeriod[currentPhase].periodLengthInBlock;

            // Adjust multiplier to cover the missing periods with other lower inflation schedule
            uint256 newMultiplier = _getMultiplier(previousEndBlock, block.number);

            // Adjust token rewards
            tokenRewardForStaking += (newMultiplier * rewardPerBlockForStaking);
            tokenRewardForOthers += (newMultiplier * rewardPerBlockForOthers);
        }

        // Mint tokens only if token rewards for staking are not null
        if (tokenRewardForStaking > 0) {
            // It allows protection against potential issues to prevent funds from being locked
            bool mintStatus = BooksRareToken.mint(address(this), tokenRewardForStaking);
            if (mintStatus) {
                accumulatedTokensPerStakedToken = accumulatedTokensPerStakedToken + ((tokenRewardForStaking * PRECISION_FACTOR) / totalAmountStaked);
            }

            BooksRareToken.mint(tokenSplitter, tokenRewardForOthers);
        }

        // Update last reward block only if it wasn't updated after or at the end block
        if (lastRewardBlock <= endBlock) {
            lastRewardBlock = block.number;
        }
    }

    /**
     * @notice Update rewards per block
     * @dev Rewards are halved by 2 (for staking + others)
     */
    function _updateRewardsPerBlock(uint256 _newStartBlock) internal {
        // Update current phase
        currentPhase++;

        // Update rewards per block
        rewardPerBlockForStaking = stakingPeriod[currentPhase].rewardPerBlockForStaking;
        rewardPerBlockForOthers = stakingPeriod[currentPhase].rewardPerBlockForOthers;

        emit NewRewardsPerBlock(currentPhase, _newStartBlock, rewardPerBlockForStaking, rewardPerBlockForOthers);
    }

    /**
     * @notice Return reward multiplier over the given "from" to "to" block.
     * @param from block to start calculating reward
     * @param to block to finish calculating reward
     * @return the multiplier for the period
     */
    function _getMultiplier(uint256 from, uint256 to) internal view returns (uint256) {
        if (to <= endBlock) {
            return to - from;
        } else if (from >= endBlock) {
            return 0;
        } else {
            return endBlock - from;
        }
    }
}
