var EnumChainId = require('./chain.id');

const EnumMainTokens = {
    [EnumChainId.BSC_TESTNET]: {
        ETH: {
            address: "0xd66c6b4f0be8ce5b39d52e0fd1344c389929b378",
            decimals: 18
        },//
        BUSD: {
            address: "0xed24fc36d5ee211ea25a80239fb8c4cfd80f12ee",
            decimals: 18
        },//
        DAI: {
            address: "0xec5dcb5dbf4b114c9d0f65bccab49ec54f6a0867",
            decimals: 18
        },//
        BTC: {
            address: "0x6ce8da28e2f864420840cf74474eff5fd80e65b8",
            decimals: 18
        },//
        XRP: {
            address: "0xa83575490d7df4e2f47b7d38ef351a2722ca45b9",
            decimals: 18
        },//
        USDC: {
            address: "0x64544969ed7ebf5f083679233325356ebe738930",
            decimals: 18
        },//
        USDT: {
            address: "0x337610d27c682e347c9cd60bd4b3b107c9d34ddd",
            decimals: 18
        },//
        CST: {
            address: "0x0730eCd23F920d00C2D7AC5b245675B8423b0Ef1",
            decimals: 9
        }
    },
    [EnumChainId.BSC]: {
        BTC: {
            address: "0x7130d2a12b9bcbfae4f2634d864a1ee1ce3ead9c",
            decimals: 18
        },//
        DOT: {
            address: "0x7083609fce4d1d8dc0c979aab8c869ea2c873402",
            decimals: 18
        },//

        WBNB: {
            address: "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c",
            decimals: 18
        },
        BUSD: {
            address: "0xe9e7cea3dedca5984780bafc599bd69add087d56",
            decimals: 18
        },//
        USDC: {
            address: "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d",
            decimals: 18
        },//
        USDT: {
            address: "0x55d398326f99059ff775485246999027b3197955",
            decimals: 18
        },//
        DAI: {
            address: "0x1af3f329e8be154074d8769d1ffa4ee058b1dbc3",
            decimals: 18
        },

        STABLECOINS: [
            "0xe9e7cea3dedca5984780bafc599bd69add087d56", // BUSD
            "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d", // USDC
            "0x55d398326f99059ff775485246999027b3197955", // USDT
            "0x1af3f329e8be154074d8769d1ffa4ee058b1dbc3"
        ],
        MAIN: "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c"
    }
}
module.exports = EnumMainTokens;