var mongoose = require('mongoose');

var tokenHistorySchema = mongoose.Schema({

    transactions: {
        _id: false,
        type: Map, // router address
        of: {
            _id: false,
            type: Map, // pair address
            of: {
                history: [{
                    _id: false,
                    time: Number,
                    hash: String,
                    from: String,
                    sold: Number,
                    bought: Number,
                    value: Number // estimated buy or sell price
                }],
                records: {
                    type: Number,
                    default: 0
                }
            }
        }
    },

    price: {
        type: Map, // router address
        of: {
            _id: false,
            type: Map, // pair address
            of: {
                _id: false,
                history: [{
                    _id: false,
                    time: Number, // unix timestamp
                    open: Number,
                    close: Number,
                    high: Number,
                    low: Number,
                    value: Number,
                    dependantValue: Number, // the value based on the token with which it is in pair
                    burned: Number,
                    mcap: Number,
                    reserve0: Number,
                    reserve1: Number
                }],
                records: {
                    type: Number,
                    default: 0
                }
            }
        }
    },

    pairs: {
        type: Map, // router address
        of: {
            _id: false,
            type: Map, // pair address
            of: String // paired token
        } // list of router's pairs
    },

    chain: String,
    contract: String,
    name: String
    
}, { timestamps: { createdAt: 'created_at' } });
tokenHistorySchema.index({ contract: 1 }, {unique: true});
module.exports = mongoose.model('TokenHistory', tokenHistorySchema);
