// SPDX-License-Identifier: MIT
pragma solidity ^0.8.6;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {IERC20, SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

error Splitter_LengthsDiffer();
error Splitter_LengthMustBeGreaterThan0();
error Splitter_SharesAre0();
error Splitter_AccountHasNoShare();
error Splitter_NothingToTransfer();
error Owner_CurrentRecipientHasNoShares();
error Owner_NewRecipientHasExistingShares();

/**
 * @title TokenSplitter
 * @notice It splits BOOKS to team/treasury/trading volume reward accounts based on shares.
 */
contract TokenSplitter is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct AccountInfo {
        uint256 shares;
        uint256 tokensDistributedToAccount;
    }

    uint256 public immutable TOTAL_SHARES;

    IERC20 public immutable BooksRareToken;

    // Total BOOKS tokens distributed across all accounts
    uint256 public totalTokensDistributed;

    mapping(address => AccountInfo) public accountInfo;

    event NewSharesOwner(address indexed oldRecipient, address indexed newRecipient);
    event TokensTransferred(address indexed account, uint256 amount);

    /**
     * @notice Constructor
     * @param _accounts array of accounts addresses
     * @param _shares array of shares per account
     * @param _BooksRareToken address of the BOOKS token
     */
    constructor(
        address[] memory _accounts,
        uint256[] memory _shares,
        address _BooksRareToken
    ) {
        if(_accounts.length != _shares.length) revert Splitter_LengthsDiffer();
        if(_accounts.length == 0) revert Splitter_LengthMustBeGreaterThan0();

        uint256 currentShares;

        for (uint256 i = 0; i < _accounts.length; i++) {
            if(_shares[i] == 0) revert Splitter_SharesAre0();

            currentShares += _shares[i];
            accountInfo[_accounts[i]].shares = _shares[i];
        }

        TOTAL_SHARES = currentShares;
        BooksRareToken = IERC20(_BooksRareToken);
    }

    /**
     * @notice Release BOOKS tokens to the account
     * @param account address of the account
     */
    function releaseTokens(address account) external nonReentrant {
        if(accountInfo[account].shares <= 0) revert Splitter_AccountHasNoShare();

        // Calculate amount to transfer to the account
        uint256 totalTokensReceived = BooksRareToken.balanceOf(address(this)) + totalTokensDistributed;
        uint256 pendingRewards = ((totalTokensReceived * accountInfo[account].shares) / TOTAL_SHARES) - accountInfo[account].tokensDistributedToAccount;

        // Revert if equal to 0
        if(pendingRewards == 0) revert Splitter_NothingToTransfer();

        accountInfo[account].tokensDistributedToAccount += pendingRewards;
        totalTokensDistributed += pendingRewards;

        // Transfer funds to account
        BooksRareToken.safeTransfer(account, pendingRewards);

        emit TokensTransferred(account, pendingRewards);
    }

    /**
     * @notice Update share recipient
     * @param _newRecipient address of the new recipient
     * @param _currentRecipient address of the current recipient
     */
    function updateSharesOwner(address _newRecipient, address _currentRecipient) external onlyOwner {
        if(accountInfo[_currentRecipient].shares <= 0) revert Owner_CurrentRecipientHasNoShares();
        if(accountInfo[_newRecipient].shares != 0) revert Owner_NewRecipientHasExistingShares();

        // Copy shares to new recipient
        accountInfo[_newRecipient].shares = accountInfo[_currentRecipient].shares;
        accountInfo[_newRecipient].tokensDistributedToAccount = accountInfo[_currentRecipient]
            .tokensDistributedToAccount;

        // Reset existing shares
        accountInfo[_currentRecipient].shares = 0;
        accountInfo[_currentRecipient].tokensDistributedToAccount = 0;

        emit NewSharesOwner(_currentRecipient, _newRecipient);
    }

    /**
     * @notice Retrieve amount of BOOKS tokens that can be transferred
     * @param account address of the account
     */
    function calculatePendingRewards(address account) external view returns (uint256) {
        if (accountInfo[account].shares == 0) {
            return 0;
        }

        uint256 totalTokensReceived = BooksRareToken.balanceOf(address(this)) + totalTokensDistributed;
        uint256 pendingRewards = ((totalTokensReceived * accountInfo[account].shares) / TOTAL_SHARES) - accountInfo[account].tokensDistributedToAccount;

        return pendingRewards;
    }
}
