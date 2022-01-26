

const HistoryPirceModel = require('../../../server/models/history_prices');
class HistoryPirce {
    constructor( cache ){
        this.cache = cache;
    }
    async getHistory( pair ){
        let unix_day = 60 * 60 * 24;
        let now_unix = Date.now()/1000;
        let one_day_ago = now_unix - unix_day;
        let two_days_ago = now_unix - ( 2 * unix_day );

        let history = this.cache.getHistoryPrice( pair );

        if(!history) history = {latest: null, day: null};

        if(!history.latest){
            let latestPrice = await HistoryPirceModel
            .findOne( { pair: pair,  time: { $lte: now_unix } } )
            .lean()
            .exec();
            history.latest = latestPrice;
            this.cache.setHistoryPrice( pair, history );
        }

        if(!history.day){
            let dayAgoPrice = await HistoryPirceModel
            .find( { pair: pair,  time: { $lte: one_day_ago, $gt: two_days_ago } } )
            .sort({ time: -1 })
            .limit(1)
            .lean()
            .exec();
            history.day = dayAgoPrice[0];
            this.cache.setHistoryPrice( pair, history );
        }
        
        if(!history.day) console.log(`[HISTORY FAIL DAY] Cannot retrive last day history for ${pair}`);
        if(!history.latest) console.log(`[HISTORY FAIL LATEST] Cannot retrive latest history for ${pair}`);
        return history;
    }
    async getLastHistoryTime( pair, time ){
        let latestPrice = await HistoryPirceModel
        .findOne( { pair: pair,  time: { $lte: time } } )
        .lean()
        .select({ time: 1 })
        .exec();
        return latestPrice ? latestPrice.time : null;
    }

}
module.exports = HistoryPirce;