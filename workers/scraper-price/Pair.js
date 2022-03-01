const EnumChainId = require("../../enum/chain.id");
const EnumContracts = require("../../enum/contracts");

class Pair {

    constructor( web3 ){
        this.web3 = web3;
        this.ROUTERS = {
            [ EnumContracts[EnumChainId.BSC].ROUTERS.PANCAKE  ] : {
                _hexadem: '0x00fb7f630766e6a796048ea87d01acd3068e8ff67d078148a3fa3f4a84f69bd5',
                _factory: EnumContracts[EnumChainId.BSC].FACTORIES.PANCAKE
            },
            [ EnumContracts[EnumChainId.BSC].ROUTERS.MDEX ] : {
                _hexadem: '0x0d994d996174b05cfc7bed897dc1b20b4c458fc8d64fe98bc78b3c64a6b4d093',
                _factory:  EnumContracts[EnumChainId.BSC].FACTORIES.MDEX
            },
            [ EnumContracts[EnumChainId.BSC].ROUTERS.BISWAP ] : {
                _hexadem: '0xfea293c909d87cd4153593f077b76bb7e94340200f4ee84211ae8e4f9bd7ffdf',
                _factory:  EnumContracts[EnumChainId.BSC].FACTORIES.BISWAP
            },
            [ EnumContracts[EnumChainId.BSC].ROUTERS.BABYSWAP ] : {
                _hexadem: '0x48c8bec5512d397a5d512fbb7d83d515e7b6d91e9838730bd1aa1b16575da7f5',
                _factory:  EnumContracts[EnumChainId.BSC].FACTORIES.BABYSWAP
            },
            [ EnumContracts[EnumChainId.BSC].ROUTERS.BABYSWAP ] : {
                _hexadem: '0x48c8bec5512d397a5d512fbb7d83d515e7b6d91e9838730bd1aa1b16575da7f5',
                _factory:  EnumContracts[EnumChainId.BSC].FACTORIES.BABYSWAP
            },
            [ EnumContracts[EnumChainId.BSC].ROUTERS.APESWAP ] : {
                _hexadem: '0xf4ccce374816856d11f00e4069e7cada164065686fbef53c6167a63ec2fd8c5b',
                _factory:  EnumContracts[EnumChainId.BSC].FACTORIES.APESWAP
            },
            [ EnumContracts[EnumChainId.BSC].ROUTERS.AUTOSHARK ] : {
                _hexadem: '0x024c8482358faf5eeea4ff7f0a18734bc482bf2e61ec04711fcee726756287ee',
                _factory:  EnumContracts[EnumChainId.BSC].FACTORIES.AUTOSHARK
            },
            [ EnumContracts[EnumChainId.BSC].ROUTERS.DEFINIX ] : {
                _hexadem: '0x898b8e59fbd4e8d6538b7d59d469440d56e24a77616ec248916ca9b36712dfe2',
                _factory:  EnumContracts[EnumChainId.BSC].FACTORIES.DEFINIX
            },
            [ EnumContracts[EnumChainId.BSC].ROUTERS.SUSHISWAP ] : {
                _hexadem: '0xe18a34eb0e04b04f7a0ac29a6e80748dca96319b42c54d679cb821dca90c6303',
                _factory:  EnumContracts[EnumChainId.BSC].FACTORIES.SUSHISWAP
            }
        }
    }

    getPair(router, tokenA, tokenB) {
        if(!this.ROUTERS[router]) return null;
        let _hexadem = this.ROUTERS[router]._hexadem;
        let _factory = this.ROUTERS[router]._factory;
        let [token0, token1] = tokenA < tokenB ? [tokenA, tokenB] : [tokenB, tokenA];
        let abiEncoded1 =  this.web3.eth.abi.encodeParameters(['address', 'address'], [token0, token1]);
        abiEncoded1 = abiEncoded1.split("0".repeat(24)).join("");
        let salt = this.web3.utils.soliditySha3(abiEncoded1);
        let abiEncoded2 =  this.web3.eth.abi.encodeParameters(['address', 'bytes32'], [_factory, salt]);
        abiEncoded2 = abiEncoded2.split("0".repeat(24)).join("").substr(2);
        let pair = '0x' + this.web3.utils.soliditySha3( '0xff' + abiEncoded2, _hexadem ).substr(26);
        return pair;
    }
}

module.exports = Pair;