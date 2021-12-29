var mongoose = require('mongoose');

var tokenHistorySchema = mongoose.Schema({
    price: {
        history: [{
            _id: false,
            time: Number, // unix timestamp
            open: Number,
            close: Number,
            high: Number,
            low: Number,
            value: Number
        }],
        records: {
            type: Number,
            default: 0
        }
    },

    chain: String,
    contract: String,
    name: String

}, { timestamps: { createdAt: 'created_at' } });
tokenHistorySchema.index({ contract: 1 }, {unique: true});
module.exports = mongoose.model('TokenHistory', tokenHistorySchema);
