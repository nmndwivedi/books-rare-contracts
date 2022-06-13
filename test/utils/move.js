const { network } = require("hardhat")

exports.moveBlocks = async (amount) => {
  console.log("Moving blocks...")
  for (let index = 0; index < amount; index++) {
    await network.provider.request({
      method: "evm_mine",
      params: [],
    })
  }
  console.log(`Moved ${amount} blocks`)
}

exports.moveTime = async (amount) => {
  console.log("Moving blocks...")
  await network.provider.send("evm_increaseTime", [amount])
  await network.provider.send("evm_mine")

  console.log(`Moved forward in time ${amount} seconds`)
}