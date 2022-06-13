// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

interface IExecutionManager {
    function addStrategy(address strategy) external;

    function removeStrategy(address strategy) external;

    function isStrategyWhitelisted(address strategy) external view returns (bool);

    function viewWhitelistedStrategies() external view returns (address[] memory, uint256);

    function viewCountWhitelistedStrategies() external view returns (uint256);
}
