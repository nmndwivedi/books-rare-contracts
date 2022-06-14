// SPDX-License-Identifier: MIT
pragma solidity ^0.8.6;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {EnumerableSet} from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

import {IExecutionManager} from "./interfaces/IExecutionManager.sol";

error Strategy_AlreadyWhitelisted(address strategy);
error Strategy_NotWhitelisted(address strategy);

/**
 * @title ExecutionManager
 * @notice It allows adding/removing execution strategies for trading on the BooksRare exchange.
 */
contract ExecutionManager is IExecutionManager, Ownable {
    using EnumerableSet for EnumerableSet.AddressSet;

    EnumerableSet.AddressSet private _whitelistedStrategies;

    event StrategyRemoved(address indexed strategy);
    event StrategyWhitelisted(address indexed strategy);

    /**
     * @notice Add an execution strategy in the system
     * @param strategy address of the strategy to add
     */
    function addStrategy(address strategy) external override onlyOwner {
        if(_whitelistedStrategies.contains(strategy)) revert Strategy_AlreadyWhitelisted(strategy);

        _whitelistedStrategies.add(strategy);

        emit StrategyWhitelisted(strategy);
    }

    /**
     * @notice Remove an execution strategy from the system
     * @param strategy address of the strategy to remove
     */
    function removeStrategy(address strategy) external override onlyOwner {
        if(!_whitelistedStrategies.contains(strategy)) revert Strategy_NotWhitelisted(strategy);

        _whitelistedStrategies.remove(strategy);

        emit StrategyRemoved(strategy);
    }

    /**
     * @notice Returns if an execution strategy is in the system
     * @param strategy address of the strategy
     */
    function isStrategyWhitelisted(address strategy) external view override returns (bool) {
        return _whitelistedStrategies.contains(strategy);
    }

    /**
     * @notice View number of whitelisted strategies
     */
    function viewCountWhitelistedStrategies() external view override returns (uint256) {
        return _whitelistedStrategies.length();
    }

    /**
     * @notice See whitelisted strategies in the system
     */
    function viewWhitelistedStrategies()
        external
        view
        override
        returns (address[] memory, uint256)
    {
        uint256 length = _whitelistedStrategies.length();

        address[] memory whitelistedStrategies = new address[](length);

        for (uint256 i = 0; i < length; i++) {
            whitelistedStrategies[i] = _whitelistedStrategies.at(i);
        }

        return (whitelistedStrategies, length);
    }
}
