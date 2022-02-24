const EnumChainId = require("./chain.id");

const EnumContracts = {
    [EnumChainId.BSC]: {
        ROUTERS: {
            PANCAKE: "0x10ED43C718714eb63d5aA57B78B54704E256024E",
            MDEX: "0x0384E9ad329396C3A6A401243Ca71633B2bC4333",
            BISWAP: "0x3a6d8cA21D1CF76F653A67577FA0D27453350dD8",
            BABYSWAP: "0x325e343f1de602396e256b67efd1f61c3a6b38bd",
            APESWAP: "0xcF0feBd3f17CEf5b47b0cD257aCf6025c5BFf3b7",
            AUTOSHARK: "0xB0EeB0632bAB15F120735e5838908378936bd484",
            DEFINIX: "0x151030a9Fa62FbB202eEe50Bd4A4057AB9E826AD",
            SUSHISWAP: "0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506",
        },
        FACTORIES: {
            PANCAKE: "0xca143ce32fe78f1f7019d7d551a6402fc5350c73",
            MDEX: "0x3cd1c46068daea5ebb0d3f55f6915b10648062b8",
            BISWAP: "0x858e3312ed3a876947ea49d572a7c42de08af7ee",
            BABYSWAP: "0x86407bea2078ea5f5eb5a52b2caa963bc1f889da",
            APESWAP: "0x0841BD0B734E4F5853f0dD8d7Ea041c241fb0Da6",
            AUTOSHARK: "0xe759dd4b9f99392be64f1050a6a8018f73b53a13",
            DEFINIX: "0x43ebb0cb9bd53a3ed928dd662095ace1cef92d19",
            SUSHISWAP: "0xc35dadb65012ec5796536bd9864ed8773abc74c4",
            

        }
    }
};

module.exports = EnumContracts