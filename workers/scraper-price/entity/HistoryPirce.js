

const HistoryPirceModel = require('../../../server/models/history_prices');
class HistoryPirce {
    constructor( cache ){
        this.cache = cache;
    }
    async getHistory( pair ){
        let latestPrice = this.cache.getHistoryPrice( pair );
        if(!latestPrice){
            latestPrice = await HistoryPirceModel
            .findOne( { pair: pair,  time: { $lte: Date.now()/1000 } } )
            .lean()
            .exec();
            this.cache.setHistoryPrice( pair, latestPrice );
        }
        return latestPrice;
    }

}
module.exports = HistoryPirce;