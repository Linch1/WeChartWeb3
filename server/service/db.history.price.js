const HistoryPrice = require('../models/history_prices');

async function findPrices( pair, from, to ){

    if( !pair || !from || !to ) return [];

    let records = await HistoryPrice.find(
        { pair: pair.toLowerCase(), time: { $lt: parseInt(to), $gte: parseInt(from) } }
    ).lean().limit(350).select({ value: 1, low: 1, high: 1, open: 1, close: 1, time: 1 }).exec();

    return records;
}
async function findLastPrice( pair, from, to ){
    console.log('SEARCHING LAST PRICE: ', pair, from )
    if( !pair || !from ) return null;

    let record = await HistoryPrice.findOne(
        { pair: pair.toLowerCase(), time: { $lt: parseInt(from) } }
    ).lean().sort({ time: -1 }).select({ value: 1, low: 1, high: 1, open: 1, close: 1, time: 1 }).exec();
        
    console.log( record )
    return record;
}

async function findPrice( pair ){
    if( !pair ) return null;
    let record = await HistoryPrice.findOne(
        { pair: pair.toLowerCase(), time: { $lte: parseInt(Date.now()/1000) } }
    ).lean().select({ value: 1 }).exec();
    if( !record ) { return null }
    return record.value;
}

module.exports = {
    findPrice,
    findPrices,
    findLastPrice
}