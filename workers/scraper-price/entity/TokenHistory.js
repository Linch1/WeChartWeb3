
const TokenHistory = require('../../../server/models/token_history');
class TokenHistory {
    constructor( cache ){
        this.cache = cache;
    }
    async getTokenHistory( token, router, pair ){
        let tokenHistory = this.cache.getTokenHistory( token, router, pair );
        if(!tokenHistory){
            tokenHistory = await TokenHistory
            .findOne(
                { contract: token } ,
                { [`price.${router}.${pair}`]: { $slice: -1 } } 
            )
            .select({ contract: 1, decimals: 1, pair: 1, [`price.${router}.${pair}`]: 1 })
            .lean()
            .exec();
            if(!tokenHistory) return null;

            let relevantHistory = tokenHistory.price[router][pair];
            this.cache.setHistory( token, router, pair, relevantHistory );
        }
        return tokenHistory;
    }
    async updateTokenHistories(contracts){
        let start = Date.now();
        // [tokenAddress] => { [routerAddress]: { [pairAddress]:  TokenHistory object of this pair }}
        let prjections = {};
        prjections[`contract`] = 1; // needed to prevent retuning all the transactions
        for( let contract of contracts ){
            let cachedRouters = Object.keys(this.cache.CACHE.tokenHistory[contract]);
            for( let router of cachedRouters ){
                let cachedPairs = Object.keys(this.cache.CACHE.tokenHistory[contract][router]);
                for( let pair of cachedPairs ) {
                    prjections[`price.${router}.${pair}.history`] = { $slice: -1 };
                }
            }
        }
        
        let tokenHistories = await TokenHistory.find({
            contract: { $in: contracts }
        } , prjections ).select({ contract: 1, decimals: 1, name: 1 }).lean().exec();

        for( let tokenHistory of tokenHistories ) {
            let tokenAddress = tokenHistory.contract
            let priceObj = tokenHistory.price;
            for(let router of priceObj ){
                for( let pair of priceObj[router] ){
                    this.cache.setHistory( tokenAddress, router, pair, priceObj[router][pair] );
                }
            }
        }
        console.log(`[RETRIVED HISTORIES] ${tokenHistories.length}`, prjections, tokenHistories);
        console.log(`[LOAD UPDATE] HISTORIES: UPDATED ${tokenHistories.length}, TIME ${ (Date.now()-start)/1000} - TOTAL ${Object.keys(CACHE.tokenHistory).length}`);
        console.log(`[MEMORY]`, process.memoryUsage())
        console.log(`[MEMORY] USAGE INCREASE: ${relDiff(INITAL_MEMORY_USAGE, process.memoryUsage().heapUsed) }`)
    }
}
module.exports = TokenHistory;