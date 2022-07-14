const EnumAbi = require('../../../../enum/abi');
const EnumBulkTypes = require('../../../../enum/bulk.records.type');
const EnumChainId = require('../../../../enum/chain.id');
const Routers = require('../../../../server/models/routers');

class Router {
    constructor( cache, web3, bulk ){
        this.cache = cache;
        this.web3 = web3;
        this.bulk = bulk;
    }
    async getRouter( routerAdd, pairAdd ){
        let routerInfos = null;

        let routerCached = this.cache.getRouter( routerAdd );
        if( !routerCached ){
            let s = Date.now();
            let router = await Routers.findOne({contract: routerAdd}).lean().exec();
            //console.log(`\t\t[LOADED ROUTER] ${routerAdd} [${(Date.now() - s)/1000}]`);
            if(!router){
                let fee = await this.getFee( routerAdd, pairAdd );
                if( fee != -1 ) fee = parseInt(fee/10**3)/10**4;

                let isValid = fee != -1 ? true : false;
                routerInfos = {valid: isValid, contract: routerAdd, fee: fee } ;
                this.cache.setRouter(routerAdd, routerInfos);
                this.bulk.bulk_normal.setNewDocument(routerAdd, EnumBulkTypes.ROUTERS, routerInfos );
                //console.log(`\t\t[ROUTER] ${routerAdd} -> Fee ${fee}`);
            } else if( !router.fee ) { // if somehow the router was saved without the fee
                let fee = await this.getFee( routerAdd, pairAdd );
                fee = parseInt(fee/10**3)/10**4;
                this.bulk.bulk_normal.setTokenBulkSet( routerAdd, EnumBulkTypes.ROUTERS ,'fee', fee);
                //console.log(`\t\t[UPDATING ROUTER FEE] ${routerAdd} -> Fee ${fee} `);
                router.fee = fee;
                routerInfos = router;
                this.cache.setRouter(routerAdd, router);
            } else {
                routerInfos = router;
                this.cache.setRouter(routerAdd, router);
            }
            //console.log(`\t\t[ROUTER] Loaded in cache ${routerAdd} `);  
        } else {
            routerInfos = routerCached;
        }

        return routerInfos;
    }
    async getFee( routerAdd, pairAdd ){
        
        let fee = -1;
        try{
            fee = await this.getFeePancakeSimilar(routerAdd)
            //console.log(`\t\t[ROUTER] Valid ${routerAdd}.`);
            return fee;
        } catch( err ){
            try{
                fee = await this.getFeeBiswapSimilar(routerAdd, pairAdd)
                //console.log(`\t\t[ROUTER] Valid ${routerAdd}.`);
                return fee;
            } catch( err ){
                //console.log(`\t\t[ROUTER] Not valid ${routerAdd} `, err.message);
                return -1;
            }
        }
        
    }

    async getFeePancakeSimilar(routerAdd){
        let routerContract = await new this.web3.eth.Contract( EnumAbi[EnumChainId.BSC].ROUTERS.PANCAKE, routerAdd );
        let factory = await routerContract.methods.factory().call();
        let fee = await routerContract.methods.getAmountOut(10000000, 100000000000, 100000000000).call();
        return parseInt(fee);
    }
    async getFeeBiswapSimilar(routerAdd, pairAdd){
        //console.log('\t\t[BISWAP SIMILAR]', routerAdd, pairAdd)
        if( !pairAdd ) return -1;
        let routerContractBiswap = await new this.web3.eth.Contract( EnumAbi[EnumChainId.BSC].ROUTERS.BISWAP, routerAdd );
        let factory = await routerContractBiswap.methods.factory().call();
        let pairContract = await new this.web3.eth.Contract( EnumAbi[EnumChainId.BSC].PAIR.BISWAP, pairAdd );
        let pairFee = parseInt(await pairContract.methods.swapFee().call());
        let fee = await routerContractBiswap.methods.getAmountOut(10000000, 100000000000, 100000000000, pairFee).call();
        return parseInt(fee);
    }
    async getRouters(){
        let routers = await Routers.find().lean().exec();
        for( let router of routers ){
            this.cache.setRouter(router.contract, router);
        }
        
    }
}

module.exports = Router;