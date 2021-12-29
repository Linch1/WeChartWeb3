const EnumChainId = require("./chain.id");

const EnumContracts = {
    [EnumChainId.BSC]: {
        ROUTERS: {
            PANCAKE: "0x10ED43C718714eb63d5aA57B78B54704E256024E"
        },
        FACTORIES: {
            PANCAKE: "0xca143ce32fe78f1f7019d7d551a6402fc5350c73"
        }
    }
};

module.exports = EnumContracts