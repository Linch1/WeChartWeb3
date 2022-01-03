require('dotenv').config();
var TokenHistory = require('../models/token_history');

async function findHistory( contract, router, pair, from, to ){

    if(!router || !pair ) return [];
    
    let conditions = [];
    if( from ) conditions.push({$gte: ['$$item.time', parseInt(from)]});
    if( to ) conditions.push({$lt: ['$$item.time', parseInt(to)]});

    let history_doc = await TokenHistory.aggregate([
        { $match: { contract: contract }  },
        { 
            $project: {
                [`price.${router}.${pair}.history`]: {
                    $filter: {
                        input: `$price.${router}.${pair}.history`,
                        as: 'item',
                        cond: {
                            $and: conditions
                        }
                    }
                },
                contract: 1
            }
        },
        { $sort: { [`price.${router}.${pair}.history.time`]: -1 } },
    ]);
    return history_doc[0].price[router][pair].history;
}
async function findLastHistory( contract, router, pair, from, to ){
  
    let past_history = await TokenHistory.aggregate([
        {
            "$match": {
                contract: contract
            }
        },
        {
            "$project": {
              [`price.${router}.${pair}.history`]: 1,
              contract: 1
            }
        },
        {
            "$unwind": `$price.${router}.${pair}.history`
        },
        {
            "$match": {
                [`price.${router}.${pair}.history.time`]: {
                    $lt: parseInt(from)
                }
            }
        },
        { $sort: { [`price.${router}.${pair}.history.time`]: -1 } },
        { $limit: 1 }
    ]);
    
    let history = past_history[0];
    if(!history) return null;
    else return history.price[router][pair].history;
}
async function findPrice( contract, router, pair ){
    if( !router || !pair ) return null;
    let history = await TokenHistory.findOne(
        { contract: contract }, 
        { 
            [`price.${router}.${pair}.history`]: { $slice: -1 },
            contract: 1 // needed to make mongodb return only the sliced history instead than all the price histories of the other pairs
        } 
    ).lean().exec();

    if( !history || !history.price[router][pair].records ) { return null }
    return history.price[router][pair].history[0].value;
}
async function findPairs( contract ){
    let document = await TokenHistory.findOne(
        { contract: contract }, 
        { pairs: 1 } 
    ).lean().exec();
    if(!document) return null
    return document.pairs;
}
module.exports = {
    findLastHistory,
    findHistory,
    findPrice,
    findPairs
}