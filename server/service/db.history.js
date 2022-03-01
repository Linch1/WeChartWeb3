var TokenHistory = require('../models/token_history');

async function findPairs( contract ){
    let documents = await TokenHistory.find(
        { dependantToken: contract }
    ).lean().exec();
    if(!documents.length) return null;
    return documents;
}
async function findPairsMultiple( contracts ){
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