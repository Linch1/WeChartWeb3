var EnumChainId = require('./chain.id');
var UtilsAddresses  =require('../utils/addresses');

const EnumMainTokens = {
    [EnumChainId.BSC_TESTNET]: {
        ETH: {
            address: UtilsAddresses.toCheckSum("0xd66c6b4f0be8ce5b39d52e0fd1344c389929b378"),
            decimals: 18
        },//
        BUSD: {
            address: UtilsAddresses.toCheckSum("0xed24fc36d5ee211ea25a80239fb8c4cfd80f12ee"),
            decimals: 18
        },//
        DAI: {
            address: UtilsAddresses.toCheckSum("0xec5dcb5dbf4b114c9d0f65bccab49ec54f6a0867"),
            decimals: 18
        },//
        BTC: {
            address: UtilsAddresses.toCheckSum("0x6ce8da28e2f864420840cf74474eff5fd80e65b8"),
            decimals: 18
        },//
        XRP: {
            address: UtilsAddresses.toCheckSum("0xa83575490d7df4e2f47b7d38ef351a2722ca45b9"),
            decimals: 18
        },//
        USDC: {
            address: UtilsAddresses.toCheckSum("0x64544969ed7ebf5f083679233325356ebe738930"),
            decimals: 18
        },//
        USDT: {
            address: UtilsAddresses.toCheckSum("0x337610d27c682e347c9cd60bd4b3b107c9d34ddd"),
            decimals: 18
        },//
        CST: {
            address: UtilsAddresses.toCheckSum("0x0730eCd23F920d00C2D7AC5b245675B8423b0Ef1"),
            decimals: 9
        }
    },
    [EnumChainId.BSC]: {
        BTC: {
            address: UtilsAddresses.toCheckSum("0x7130d2a12b9bcbfae4f2634d864a1ee1ce3ead9c"),
            decimals: 18
        },//
        DOT: {
            address: UtilsAddresses.toCheckSum("0x7083609fce4d1d8dc0c979aab8c869ea2c873402"),
            decimals: 18
        },//

        WBNB: {
            address: UtilsAddresses.toCheckSum("0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c"),
            decimals: 18
        },
        BUSD: {
            address: UtilsAddresses.toCheckSum("0xe9e7cea3dedca5984780bafc599bd69add087d56"),
            decimals: 18
        },//
        USDC: {
            address: UtilsAddresses.toCheckSum("0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d"),
            decimals: 18
        },//
        USDT: {
            address: UtilsAddresses.toCheckSum("0x55d398326f99059ff775485246999027b3197955"),
            decimals: 18
        },//
        DAI: {
            address: UtilsAddresses.toCheckSum("0x1af3f329e8be154074d8769d1ffa4ee058b1dbc3"),
            decimals: 18
        },

        STABLECOINS: [
            UtilsAddresses.toCheckSum("0xe9e7cea3dedca5984780bafc599bd69add087d56"), // BUSD
            UtilsAddresses.toCheckSum("0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d"), // USDC
            UtilsAddresses.toCheckSum("0x55d398326f99059ff775485246999027b3197955"), // USDT
            UtilsAddresses.toCheckSum("0x1af3f329e8be154074d8769d1ffa4ee058b1dbc3")  // DAI
        ],
        MAIN: UtilsAddresses.toCheckSum("0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c")
    }
}

// [0x10ED43C718714eb63d5aA57B78B54704E256024E, 0x10ED43C718714eb63d5aA57B78B54704E256024E,0x10ED43C718714eb63d5aA57B78B54704E256024E,0x10ED43C718714eb63d5aA57B78B54704E256024E,0x0000000000000000000000000000000000000000]
// [0xe9e7cea3dedca5984780bafc599bd69add087d56, 0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c, 0x55d398326f99059ff775485246999027b3197955, 0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d]
// 1000000000000000000
module.exports = EnumMainTokens;

// usdc -> usdt -> ice -> ftm 