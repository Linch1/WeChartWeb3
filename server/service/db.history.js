var TokenHistory = require('../models/token_history');
const UtilsAddresses = require('../../utils/addresses');

async function findPairs( contract ){
    let documents = await TokenHistory.find(
        { dependantToken: UtilsAddresses.toCheckSum(contract) }
    ).lean().exec();
    if(!documents.length) return null;
    return documents;
}
async function findPairsMultiple( contracts ){
    for( let i = 0; i < contracts.length; i++ ){
        contracts[i] = UtilsAddresses.toCheckSum(contracts[i]);
    }
    let documents = await TokenHistory.find(
        { dependantToken: { $in: contracts } }
    ).lean().exec();
    if(!documents.length) return null;
    return documents;
}
module.exports = {
    findPairs,
    findPairsMultiple
}