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
async function findPairsWithFilters( filter ){
    return await TokenHistory.find(filter).lean().exec();
}
async function findTokensWithMultipleRouters( allowedRouters ){
    let routers = await TokenHistory.aggregate([
            {
                $match: {
                    router: { $in: allowedRouters }
                }
            },
            { 
                $group: { 
                    _id: { router: "$router"},
                    count: { "$sum": 1 },
                    docs: { $push: "$$ROOT" } 
                }
            }
        ],
        {allowDiskUse: true}       // For faster processing if set is larger
    ).exec()
    return routers;
}


module.exports = {
    findPairsWithFilters,
    findPairs,
    findPairsMultiple,
    findTokensWithMultipleRouters
}