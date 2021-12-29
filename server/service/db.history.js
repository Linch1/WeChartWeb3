require('dotenv').config();
var TokenHistory = require('../models/token_history');

async function findHistory( contract, from, to ){
    let conditions = [];
    if( from ) conditions.push({$gte: ['$$item.time', parseInt(from)]});
    if( to ) conditions.push({$lt: ['$$item.time', parseInt(to)]});
    let history_doc = await TokenHistory.aggregate([
        { $match: { contract: contract }  },
        { 
            $project: {
                'price.history': {
                    $filter: {
                        input: '$price.history',
                        as: 'item',
                        cond: {
                            $and: conditions
                        }
                    }
                }
            }
        }
    ])
    .sort({'price.history.time': 1});
    return history_doc[0].price.history;
}
async function findLastHistory( contract, from, to ){
    let past_history = await TokenHistory.aggregate([
        {
            "$match": {
                contract: contract
            }
        },
        {
            "$unwind": "$price.history"
        },
        {
            "$match": {
                "price.history.time": {
                    $lt: parseInt(from)
                }
            }
        },
        { $sort: { "price.history.time": -1 } },
        { $limit: 1 }
    ]);
    let history = past_history[0].price.history;
    return history;
}
async function findPrice( contract ){
    let history = await TokenHistory.findOne({ contract: contract }, {'price.history': { $slice: -1 } } ).lean().exec();
    if( !history || !history.price.records ) { return null }
    return history.price.history[0].value;
}
module.exports = {
    findLastHistory,
    findHistory,
    findPrice
}