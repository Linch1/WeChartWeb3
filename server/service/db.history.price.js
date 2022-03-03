const HistoryPrice = require('../models/history_prices');
const UtilsAddresses = require('../../utils/addresses');

async function findPrices( pair, from, to, recordsCount ){

    if( recordsCount > 350 ) recordsCount = 350;
    if( !pair || !from || !to ) return [];

    let records = await HistoryPrice.find(
      { 
        pair: UtilsAddresses.toCheckSum(pair), 
        time: { $lt: parseInt(to) } 
      }
    ).sort({time: -1}).lean().limit(recordsCount).select({ value: 1, low: 1, high: 1, open: 1, close: 1, time: 1 }).exec();

    return records;
}
async function findLastPrice( pair, from, to ){
    if( !pair || !from ) return null;

    let record = await HistoryPrice.findOne(
        { 
          pair: UtilsAddresses.toCheckSum(pair), 
          time: { $lt: parseInt(from) } 
        }
    ).lean().select({ value: 1, low: 1, high: 1, open: 1, close: 1, time: 1 }).sort({ time: -1 }).exec();
        
    return record;
}

async function findPrice( pair ){
    if( !pair ) return null;
    let record = await HistoryPrice.findOne(
        { 
          pair: UtilsAddresses.toCheckSum(pair), 
          time: { $lte: parseInt(Date.now()/1000) } 
        }
    ).lean().select({ value: 1 }).exec();
    if( !record ) { return null }
    return record.value;
}

async function findPriceMultiple( pairs ){
    if( !pairs || !pairs.length ) return null;
    for( let i in pairs ){ pairs[i] = UtilsAddresses.toCheckSum(pairs[i]) }
    
    let records = HistoryPrice.aggregate([
        {
          $match: {
            pair: {
              $in: pairs
            }
          }
        },
        {
            $project: {
                time: 1,
                value: 1,
                pair: 1
            }
        },
        {
          $sort: {
            time: -1
          }
        },
        {
          $group: {
            _id: "$pair",
            record: {
              $first: "$$ROOT"
            }
          }
        }
    ]).exec();

    if( !records ) { return null }
    return records;
}

module.exports = {
    findPrice,
    findPrices,
    findLastPrice,
    findPriceMultiple
}