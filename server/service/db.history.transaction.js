var HistoryTransactions = require('../models/history_transactions');
let TRANSACTIONS_PER_PAGE_LIMIT = 100;

async function findTransactions( pair, page ){
    if(!pair) return null;
    if(!page) page = 1;

    let documents = await HistoryTransactions.find(
        { pair: pair.toLowerCase() }
    )
    .sort({ time: -1 }).limit(page * TRANSACTIONS_PER_PAGE_LIMIT).lean().exec();
    return documents;
}
async function findAllTransactionsBySimpleFilter(filters){
    let documents = await HistoryTransactions.find(filters)
    .sort({ time: -1 }).lean().exec();
    return documents;
}
async function findTransactionsGteTime( time ){
    let documents = await HistoryTransactions.aggregate([
        { $match: { time: { $gte: time }} },
        { $sort: { time: -1 } },
        { $group: { _id: "$dependantToken" , docs: { $push: "$$ROOT" } }},
        {
            $project: {
                token: "$_id",
                _id: 0,
                docs: 1
            }
        }
    ]).exec();
    return documents;
}
module.exports = {
    findTransactions,
    findAllTransactionsBySimpleFilter,
    findTransactionsGteTime
}