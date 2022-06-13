exports.numToHex = (num) => {
    return "0x" + num.toString(16);
}

exports.hexToNum = (hex) => {
    return parseInt(hex.substring(2), 16);
}