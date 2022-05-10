// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import {IBooksRareToken} from "../interfaces/IBooksRareToken.sol";

/**
 * @title BooksRareToken (LOOKS)
 * @notice
 */
contract BooksRareToken is ERC20, Ownable, IBooksRareToken {
    uint256 private immutable _SUPPLY_CAP;

    /**
     * @notice Constructor
     * @param _premintReceiver address that receives the premint
     * @param _premintAmount amount to premint
     * @param _cap supply cap (to prevent abusive mint)
     */
    constructor(
        address _premintReceiver,
        uint256 _premintAmount,
        uint256 _cap
    ) ERC20("BooksRare Token", "LOOKS") {
        require(_cap > _premintAmount, "LOOKS: Premint amount is greater than cap");
        // Transfer the sum of the premint to address
        _mint(_premintReceiver, _premintAmount);
        _SUPPLY_CAP = _cap;
    }

    /**
     * @notice Mint LOOKS tokens
     * @param account address to receive tokens
     * @param amount amount to mint
     * @return status true if mint is successful, false if not
     */
    function mint(address account, uint256 amount) external override onlyOwner returns (bool status) {
        if (totalSupply() + amount <= _SUPPLY_CAP) {
            _mint(account, amount);
            return true;
        }
        return false;
    }

    /**
     * @notice View supply cap
     */
    function SUPPLY_CAP() external view override returns (uint256) {
        return _SUPPLY_CAP;
    }
}
