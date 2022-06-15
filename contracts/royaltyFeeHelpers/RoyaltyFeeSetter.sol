// SPDX-License-Identifier: MIT
pragma solidity ^0.8.6;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";

import {IRoyaltyFeeRegistry} from "../interfaces/IRoyaltyFeeRegistry.sol";
import {IOwnable} from "../interfaces/IOwnable.sol";

import "hardhat/console.sol";

error Owner_MustNotBeERC2981(address collection);
error Owner_NotTheOwner(address caller, address caller2);
error Setter_NotTheSetter(address caller, address currentSetter);
error Setter_SetterAlreadySet(address currentSetter);
error Setter_NotERC721OrERC1155(address collection);

/**
 * @title RoyaltyFeeSetter
 * @notice It is used to allow creators to set royalty parameters in the RoyaltyFeeRegistry.
 */
contract RoyaltyFeeSetter is Ownable {
    /*
    * (XOR operation on the 4 bytes of keccak256 hashes of function signatures in the interface gives the ERC165 interface id)
        bytes4(keccak256('name()')) == 0x06fdde03
        bytes4(keccak256('symbol()')) == 0x95d89b41
        bytes4(keccak256('tokenURI(uint256)')) == 0xc87b56dd
            => 0x06fdde03 ^ 0x95d89b41 ^ 0xc87b56dd == 0x5b5e139f
    */

    // ERC721 interfaceID
    bytes4 public constant INTERFACE_ID_ERC721 = 0x80ac58cd;

    // ERC1155 interfaceID
    bytes4 public constant INTERFACE_ID_ERC1155 = 0xd9b67a26;

    // ERC2981 interfaceID
    bytes4 public constant INTERFACE_ID_ERC2981 = 0x2a55205a;

    address public immutable royaltyFeeRegistry;

    /**
     * @notice Constructor
     * @param _royaltyFeeRegistry address of the royalty fee registry
     */
    constructor(address _royaltyFeeRegistry) {
        royaltyFeeRegistry = _royaltyFeeRegistry;
    }

    /**
     * @notice Update royalty info for collection if owner
     * @dev Only to be called if there is no setter address
     * @param collection address of the NFT contract
     * @param setter address that sets the receiver
     * @param receiver receiver for the royalty fee
     * @param fee fee (500 = 5%, 1,000 = 10%)
     */
    function updateRoyaltyInfoForCollectionIfOwner(
        address collection,
        address setter,
        address receiver,
        uint256 fee
    ) external {
        if(IERC165(collection).supportsInterface(INTERFACE_ID_ERC2981)) revert Owner_MustNotBeERC2981(collection); // "Owner: Must not be ERC2981");
        if(msg.sender != IOwnable(collection).owner()) revert Owner_NotTheOwner(msg.sender, IOwnable(collection).owner()); // "Owner: Not the owner");

        (address currentSetter, , ) = IRoyaltyFeeRegistry(royaltyFeeRegistry).royaltyFeeInfoCollection(collection);
        if(currentSetter != address(0)) revert Setter_SetterAlreadySet(currentSetter); // "Setter: Already set");

        if(
            !(IERC165(collection).supportsInterface(INTERFACE_ID_ERC721) ||
                IERC165(collection).supportsInterface(INTERFACE_ID_ERC1155))
        ) revert Setter_NotERC721OrERC1155(collection);

        IRoyaltyFeeRegistry(royaltyFeeRegistry).updateRoyaltyInfoForCollection(collection, setter, receiver, fee);
    }

    /**
     * @notice Update royalty info for collection
     * @dev Only to be called if there msg.sender is the setter
     * @param collection address of the NFT contract
     * @param setter address that sets the receiver
     * @param receiver receiver for the royalty fee
     * @param fee fee (500 = 5%, 1,000 = 10%)
     */
    function updateRoyaltyInfoForCollectionIfSetter(
        address collection,
        address setter,
        address receiver,
        uint256 fee
    ) external {
        (address currentSetter, , ) = IRoyaltyFeeRegistry(royaltyFeeRegistry).royaltyFeeInfoCollection(collection);
        if(msg.sender != currentSetter) revert Setter_NotTheSetter(msg.sender, currentSetter); // "Setter: Not the setter");

        IRoyaltyFeeRegistry(royaltyFeeRegistry).updateRoyaltyInfoForCollection(collection, setter, receiver, fee);
    }

    /**
     * @notice Update royalty info for collection
     * @dev Can only be called by contract owner (of this)
     * @param collection address of the NFT contract
     * @param setter address that sets the receiver
     * @param receiver receiver for the royalty fee
     * @param fee fee (500 = 5%, 1,000 = 10%)
     */
    function updateRoyaltyInfoForCollection(
        address collection,
        address setter,
        address receiver,
        uint256 fee
    ) external onlyOwner {
        IRoyaltyFeeRegistry(royaltyFeeRegistry).updateRoyaltyInfoForCollection(collection, setter, receiver, fee);
    }

    /**
     * @notice Update owner of royalty fee registry
     * @dev Can be used for migration of this royalty fee setter contract
     * @param _owner new owner address
     */
    function updateOwnerOfRoyaltyFeeRegistry(address _owner) external onlyOwner {
        IOwnable(royaltyFeeRegistry).transferOwnership(_owner);
    }

    /**
     * @notice Update royalty info for collection
     * @param _royaltyFeeLimit new royalty fee limit (500 = 5%, 1,000 = 10%)
     */
    function updateRoyaltyFeeLimit(uint256 _royaltyFeeLimit) external onlyOwner {
        IRoyaltyFeeRegistry(royaltyFeeRegistry).updateRoyaltyFeeLimit(_royaltyFeeLimit);
    }

    /**
     * @notice Check royalty info for collection
     * @param collection collection address
     * @return (whether there is a setter (address(0 if not)),
     * Position
     * 0: Royalty setter is set in the registry
     * 1: ERC2981 and no setter
     * 2: setter can be set using owner()
     * 3: setter cannot be set, nor support for ERC2981
     */
    function checkForCollectionSetter(address collection) external view returns (address, uint8) {
        (address currentSetter, , ) = IRoyaltyFeeRegistry(royaltyFeeRegistry).royaltyFeeInfoCollection(collection);

        if (currentSetter != address(0)) {
            return (currentSetter, 0);
        }

        try IERC165(collection).supportsInterface(INTERFACE_ID_ERC2981) returns (bool interfaceSupport) {
            if (interfaceSupport) {
                return (address(0), 1);
            }
        } catch {}

        try IOwnable(collection).owner() returns (address setter) {
            return (setter, 2);
        } catch {
            return (address(0), 3);
        }
    }
}
