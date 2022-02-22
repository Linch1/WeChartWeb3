var mongoose = require('mongoose');

var tokenHistorySchema = mongoose.Schema({

    records_transactions: Number,
    records_price: Number,

    chain: Number,
    
    router: String,
    pair: String,

    token0: {
        contract: String,
        name: String
    },
    token1: {
        contract: String,
        name: String
    },

    mainToken: String,
    dependantToken: String,

    burned: Number,
    mcap: Number,
    value: Number,
    price: Number,
    reserve0: Number,
    reserve1: Number,
    mainReserveValue: Number,

    variation: {
        hour: Number,
        day: Number,
        week: Number,
        month: Number
    }
    
}, { timestamps: { createdAt: 'created_at' } });
tokenHistorySchema.index({ 
    'token0.contract': 1, 'token1.contract': 1, 
    'variation.daily': 1, pair: 1, router: 1,
    chain: 1
});
module.exports = mongoose.model('TokenHistory', tokenHistorySchema);
