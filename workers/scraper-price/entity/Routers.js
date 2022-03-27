const EnumAbi = require('../../../enum/abi');
const EnumBulkTypes = require('../../../enum/bulk.records.type');
const EnumChainId = require('../../../enum/chain.id');
const Routers = require('../../../server/models/routers');

class Router {
    constructor( cache, web3, bulk ){
        this.cache = cache;
        this.web3 = web3;
        this.bulk = bulk;
    }
    async getRouter( routerAdd ){
        let routerInfos = null;

        let routerCached = this.cache.getRouter( routerAdd );
        if( !routerCached ){
            let router = await Routers.findOne({ contract: routerAdd}).lean().exec();
            if(!router){
                let fee = await this.getFee( routerAdd );
                fee = parseInt(fee/10**3)/10**4;

                let isValid = fee != 0 ? true : false;
                routerInfos = {valid: isValid, contract: routerAdd, fee: fee } ;
                this.cache.setRouter(routerAdd, routerInfos);
                this.bulk.bulk_normal.setNewDocument(routerAdd, EnumBulkTypes.ROUTERS, routerInfos );

                console.log(`[ROUTER] ${routerAdd} -> Fee ${fee}`)
            } else {
                routerInfos = router;
                this.cache.setRouter(routerAdd, router);
            }
            console.log(`[ROUTER] Loaded in cache ${routerAdd} `);  
        } else {
            routerInfos = routerCached;
        }

        return routerInfos;
    }
    async getFee( routerAdd ){
        let routerContract = await new this.web3.eth.Contract( EnumAbi[EnumChainId.BSC].ROUTERS.PANCAKE, routerAdd );
        try{
            let factory = await routerContract.methods.factory().call();
            let fee = await routerContract.methods.getAmountOut(10000000, 100000000000, 100000000000).call();
            console.log(`[ROUTER] Valid ${routerAdd}. Factory: ${factory} `);
            return parseInt(fee);
        } catch( err ){
            console.log(`[ROUTER] Not valid ${routerAdd} `, err.message);
            return 0;
        }
        
    }
}

module.exports = Router;