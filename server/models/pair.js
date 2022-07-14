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


pairSchema.index({'token0.contract': 1});
pairSchema.index({'token1.contract': 1});
pairSchema.index({contract: 1});
pairSchema.index({router: 1});
pairSchema.index({chain: 1});
/*
db.pairs.ensureIndex({'token0.contract': 1});
db.pairs.ensureIndex({'token1.contract': 1});
db.pairs.ensureIndex({contract: 1});
db.pairs.ensureIndex({router: 1});
db.pairs.ensureIndex({chain: 1});
*/


module.exports = mongoose.model('Pair', pairSchema);

