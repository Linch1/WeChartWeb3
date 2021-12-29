var mongoose = require('mongoose');

var pairSchema = mongoose.Schema({
    token0: {
        contract: String,
        token: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'TokenBasic',
            index: true
        },
    },
    token1: {
        contract: String,
        token: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'TokenBasic',
            index: true
        },
    },
    contract: String,
    index: Number
}, { timestamps: { createdAt: 'created_at' } });

pairSchema.index({chain: 1, 'token0.contract': 1, 'token1.contract': 1, index: 1}, {unique: true});

module.exports = mongoose.model('Pair', pairSchema);

