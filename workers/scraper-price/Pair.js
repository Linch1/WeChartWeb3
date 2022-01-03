const EnumChainId = require("../../enum/chain.id");
const EnumContracts = require("../../enum/contracts");

class Pair {

    constructor( web3 ){
        this.web3 = web3;
        this.ROUTERS = {
            [EnumContracts[EnumChainId.BSC].ROUTERS.PANCAKE.toLowerCase()] : {
                _hexadem: '0x00fb7f630766e6a796048ea87d01acd3068e8ff67d078148a3fa3f4a84f69bd5',
                _factory: '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73'
            }
        }
    }

    getPair(router, tokenA, tokenB) {
        let _hexadem = this.ROUTERS[router]._hexadem;
        let _factory = this.ROUTERS[router]._factory;
        let [token0, token1] = tokenA < tokenB ? [tokenA, tokenB] : [tokenB, tokenA];
        let abiEncoded1 =  this.web3.eth.abi.encodeParameters(['address', 'address'], [token0, token1]);
        abiEncoded1 = abiEncoded1.split("0".repeat(24)).join("");
        let salt = this.web3.utils.soliditySha3(abiEncoded1);
        let abiEncoded2 =  this.web3.eth.abi.encodeParameters(['address', 'bytes32'], [_factory, salt]);
        abiEncoded2 = abiEncoded2.split("0".repeat(24)).join("").substr(2);
        let pair = '0x' + this.web3.utils.soliditySha3( '0xff' + abiEncoded2, _hexadem ).substr(26);
        return pair.toLowerCase();
    }
}

module.exports = Pair;