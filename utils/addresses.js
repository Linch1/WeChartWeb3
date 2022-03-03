const Web3 = require('web3');
function toCheckSum( add ){
    if( !Web3.utils.isAddress(add) ) return null;
    return Web3.utils.toChecksumAddress(add);
}

let UtilsAddresses = {
    toCheckSum
}

module.exports = UtilsAddresses;