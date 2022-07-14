const UtilsAddresses = require("../utils/addresses");
const EnumChainId = require("./chain.id");

const EnumContracts = {
    [EnumChainId.BSC]: {
        MAIN_ROUTER: UtilsAddresses.toCheckSum("0x10ED43C718714eb63d5aA57B78B54704E256024E"), // Pancake
        MAIN_FACTORY: UtilsAddresses.toCheckSum("0xca143ce32fe78f1f7019d7d551a6402fc5350c73") // Pancake
    }
};

module.exports = EnumContracts