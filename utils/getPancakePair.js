require('dotenv').config();
const Web3 = require('web3');
let web3 = new Web3(process.env.PROVIDER); // change me!

let tokenA = "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c"; // change me!
let tokenB = "0xe9e7cea3dedca5984780bafc599bd69add087d56"; // change me!

function getPair(tokenA, tokenB) {
    
    let _hexadem = '0x00fb7f630766e6a796048ea87d01acd3068e8ff67d078148a3fa3f4a84f69bd5';
    let _factory = "0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73";
    let [token0, token1] = tokenA < tokenB ? [tokenA, tokenB] : [tokenB, tokenA];

    let abiEncoded1 =  web3.eth.abi.encodeParameters(['address', 'address'], [token0, token1]);
    abiEncoded1 = abiEncoded1.split("0".repeat(24)).join("");
    let salt = web3.utils.soliditySha3(abiEncoded1);
    let abiEncoded2 =  web3.eth.abi.encodeParameters(['address', 'bytes32'], [_factory, salt]);
    abiEncoded2 = abiEncoded2.split("0".repeat(24)).join("").substr(2);
    let pair = '0x' + Web3.utils.soliditySha3( '0xff' + abiEncoded2, _hexadem ).substr(26);
    return pair
}

console.log( 'PAIR: ', getPair(tokenA, tokenB) )