// SPDX-License-Identifier: MIT
pragma solidity ^0.8.6;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/security/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

import {IERC20, SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";

import {OrderTypes} from "../../libraries/OrderTypes.sol";
import {SignatureChecker} from "../../libraries/SignatureChecker.sol";

error Airdrop_Merklerootnotset();
error Airdrop_Amounttoohigh();
error Airdrop_Toolatetoclaim();
error Airdrop_Alreadyclaimed();
error Airdrop_Ordernoteligibleforairdrop();
error Airdrop_Signatureinvalid();
error Airdrop_Collectionmustbeapproved();
error Airdrop_Invalidproof();
error Owner_Merklerootalreadyset();
error Owner_Newtimestamptoofar();
error Owner_Tooearlytoremoverewards();

/**
 * @title BooksRareAirdrop
 * @notice It distributes BOOKS tokens with a Merkle-tree airdrop.
 */
contract BooksRareAirdrop is Pausable, ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;
    using OrderTypes for OrderTypes.MakerOrder;

    IERC20 public immutable BooksRareToken;

    address public immutable MAIN_STRATEGY;
    address public immutable TRANSFER_MANAGER_ERC721;
    address public immutable TRANSFER_MANAGER_ERC1155;
    address public immutable WETH;

    bytes32 public immutable DOMAIN_SEPARATOR_EXCHANGE;

    uint256 public immutable MAXIMUM_AMOUNT_TO_CLAIM;

    bool public isMerkleRootSet;

    bytes32 public merkleRoot;

    uint256 public endTimestamp;

    mapping(address => bool) public hasClaimed;

    event AirdropRewardsClaim(address indexed user, uint256 amount);
    event MerkleRootSet(bytes32 merkleRoot);
    event NewEndTimestamp(uint256 endTimestamp);
    event TokensWithdrawn(uint256 amount);

    /**
     * @notice Constructor
     * @param _endTimestamp end timestamp for claiming
     * @param _BooksRareToken address of the BooksRare token
     * @param _domainSeparator domain separator for BooksRare exchange
     * @param _transferManagerERC721 address of the transfer manager for ERC721 for BooksRare exchange
     * @param _transferManagerERC1155 address of the transfer manager for ERC1155 for BooksRare exchange
     * @param _mainStrategy main strategy ("StandardSaleForFixedPrice")
     * @param _weth wrapped ETH address
     * @param _maximumAmountToClaim maximum amount to claim per a user
     */
    constructor(
        uint256 _endTimestamp,
        uint256 _maximumAmountToClaim,
        address _BooksRareToken,
        bytes32 _domainSeparator,
        address _transferManagerERC721,
        address _transferManagerERC1155,
        address _mainStrategy,
        address _weth
    ) {
        endTimestamp = _endTimestamp;
        MAXIMUM_AMOUNT_TO_CLAIM = _maximumAmountToClaim;

        BooksRareToken = IERC20(_BooksRareToken);

        DOMAIN_SEPARATOR_EXCHANGE = _domainSeparator;
        TRANSFER_MANAGER_ERC721 = _transferManagerERC721;
        TRANSFER_MANAGER_ERC1155 = _transferManagerERC1155;

        MAIN_STRATEGY = _mainStrategy;
        WETH = _weth;
    }

    /**
     * @notice Claim tokens for airdrop
     * @param amount amount to claim for the airdrop
     * @param merkleProof array containing the merkle proof
     * @param makerAsk makerAsk order
     * @param isERC721 whether the order is for ERC721 (true --> ERC721/ false --> ERC1155)
     */
    function claim(
        uint256 amount,
        bytes32[] calldata merkleProof,
        OrderTypes.MakerOrder calldata makerAsk,
        bool isERC721
    ) external whenNotPaused nonReentrant {
        if(!isMerkleRootSet) revert Airdrop_Merklerootnotset();
        if(amount > MAXIMUM_AMOUNT_TO_CLAIM) revert Airdrop_Amounttoohigh();
        if(block.timestamp > endTimestamp) revert Airdrop_Toolatetoclaim();

        // Verify the user has claimed
        if(!hasClaimed[msg.sender]) revert Airdrop_Alreadyclaimed();

        // Checks on orders
        if(_isOrderMatchingRequirements(makerAsk)) revert Airdrop_Ordernoteligibleforairdrop();

        // Compute the hash
        bytes32 askHash = makerAsk.hash();

        // Verify signature is legit
        if(!SignatureChecker.verify(
                askHash,
                makerAsk.signer,
                makerAsk.v,
                makerAsk.r,
                makerAsk.s,
                DOMAIN_SEPARATOR_EXCHANGE
            )) revert Airdrop_Signatureinvalid();


        // Verify tokens are approved
        if (isERC721) {
            if(!IERC721(makerAsk.collection).isApprovedForAll(msg.sender, TRANSFER_MANAGER_ERC721)) revert Airdrop_Collectionmustbeapproved();
        } else {
            if(!IERC1155(makerAsk.collection).isApprovedForAll(msg.sender, TRANSFER_MANAGER_ERC1155)) revert Airdrop_Collectionmustbeapproved();
        }

        // Compute the node and verify the merkle proof
        bytes32 node = keccak256(abi.encodePacked(msg.sender, amount));
        if(!MerkleProof.verify(merkleProof, merkleRoot, node)) revert Airdrop_Invalidproof();

        // Set as claimed
        hasClaimed[msg.sender] = true;

        // Transfer tokens
        BooksRareToken.safeTransfer(msg.sender, amount);

        emit AirdropRewardsClaim(msg.sender, amount);
    }

    /**
     * @notice Check whether it is possible to claim (it doesn't check orders)
     * @param user address of the user
     * @param amount amount to claim
     * @param merkleProof array containing the merkle proof
     */
    function canClaim(
        address user,
        uint256 amount,
        bytes32[] calldata merkleProof
    ) external view returns (bool) {
        if (block.timestamp <= endTimestamp) {
            // Compute the node and verify the merkle proof
            bytes32 node = keccak256(abi.encodePacked(user, amount));
            return MerkleProof.verify(merkleProof, merkleRoot, node);
        } else {
            return false;
        }
    }

    /**
     * @notice Pause airdrop
     */
    function pauseAirdrop() external onlyOwner whenNotPaused {
        _pause();
    }

    /**
     * @notice Set merkle root for airdrop
     * @param _merkleRoot merkle root
     */
    function setMerkleRoot(bytes32 _merkleRoot) external onlyOwner {
        if(isMerkleRootSet) revert Owner_Merklerootalreadyset();

        isMerkleRootSet = true;
        merkleRoot = _merkleRoot;

        emit MerkleRootSet(_merkleRoot);
    }

    /**
     * @notice Unpause airdrop
     */
    function unpauseAirdrop() external onlyOwner whenPaused {
        _unpause();
    }

    /**
     * @notice Update end timestamp
     * @param newEndTimestamp new endtimestamp
     * @dev Must be within 30 days
     */
    function updateEndTimestamp(uint256 newEndTimestamp) external onlyOwner {
        if(block.timestamp + 30 days <= newEndTimestamp) revert Owner_Newtimestamptoofar();
        endTimestamp = newEndTimestamp;

        emit NewEndTimestamp(newEndTimestamp);
    }

    /**
     * @notice Transfer tokens back to owner
     */
    function withdrawTokenRewards() external onlyOwner {
        if(block.timestamp <= (endTimestamp + 1 days)) revert Owner_Tooearlytoremoverewards();
        uint256 balanceToWithdraw = BooksRareToken.balanceOf(address(this));
        BooksRareToken.safeTransfer(msg.sender, balanceToWithdraw);

        emit TokensWithdrawn(balanceToWithdraw);
    }

    /**
     * @notice Check whether order is matching requirements for airdrop
     * @param makerAsk makerAsk order
     */
    function _isOrderMatchingRequirements(OrderTypes.MakerOrder calldata makerAsk) internal view returns (bool) {
        return
            (makerAsk.isOrderAsk) &&
            (makerAsk.signer == msg.sender) &&
            (makerAsk.amount > 0) &&
            (makerAsk.currency == WETH) &&
            (makerAsk.strategy == MAIN_STRATEGY);
    }
}
