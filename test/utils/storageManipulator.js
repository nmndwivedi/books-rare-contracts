const { ethers } = require('hardhat')

exports.toBytes32 = (bn) => {
  return ethers.utils.hexlify(ethers.utils.zeroPad(bn.toHexString(), 32));
};

exports.setStorageAt = async (address, index, value) => {
  await ethers.provider.send("hardhat_setStorageAt", [address, index, value]);
  await ethers.provider.send("evm_mine", []); // mine next block
};

exports.getStorageAt = async (address, index) => {
  return await ethers.provider.getStorageAt(address, index);
};