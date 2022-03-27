var EnumChainId = require('./chain.id');
var UtilsAddresses  =require('../utils/addresses');
const EnumMainTokens = require('./mainTokens');

const EnumArbitrageWhitelist = {
    [EnumChainId.BSC]: [ ...EnumMainTokens[EnumChainId.BSC].STABLECOINS ]
}

// [0x10ED43C718714eb63d5aA57B78B54704E256024E, 0x10ED43C718714eb63d5aA57B78B54704E256024E,0x10ED43C718714eb63d5aA57B78B54704E256024E,0x10ED43C718714eb63d5aA57B78B54704E256024E,0x0000000000000000000000000000000000000000]
// [0xe9e7cea3dedca5984780bafc599bd69add087d56, 0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c, 0x55d398326f99059ff775485246999027b3197955, 0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d]
// 1000000000000000000
module.exports = EnumArbitrageWhitelist;

// usdc -> usdt -> ice -> ftm 