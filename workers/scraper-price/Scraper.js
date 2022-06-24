const EnumChainId = require("../../enum/chain.id");
const EnumContracts = require("../../enum/contracts");
const Bulk = require("./bulk/Bulk");
const Cache = require("./Cache");
const Token = require("./entity/Token");

const EnumAbi = require("../../enum/abi");
const EnumMainTokens = require("../../enum/mainTokens");
const EnumBulkTypes = require("../../enum/bulk.records.type");
const TokenHistory = require("./entity/TokenHistory");
const HistoryPirce = require("./entity/HistoryPirce");

const abiDecoder = require('abi-decoder');
const Router = require("./entity/Routers");
const BigNumber = require("bignumber.js");
const UtilsAddresses = require("../../utils/addresses");

const scraperConfig = require("../../config.js");

abiDecoder.addABI(EnumAbi[EnumChainId.BSC].TOKEN);
abiDecoder.addABI(EnumAbi[EnumChainId.BSC].ROUTERS.PANCAKE);


function relDiff( today, yesterday ) {
    return  100 * ( ( today - yesterday ) /  yesterday  );
}
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
function todayDateUnix(){
    return Math.ceil(Date.now()/1000 - ((Date.now()/1000)%(60*60*24)));
}

class Scraper {
    constructor ( web3 ) {
        this.web3 = web3;
        this.UPDATE_PRICE_INTERVAL = process.env.WRITE_TO_DB_SECONDS ; // create a new record for the prices every x seconds
        this.CHAIN_MAIN_TOKEN_PRICE = 0;
        
        this.cache = new Cache();
        this.bulk = new Bulk( this.cache );

        this.routers = new Router( this.cache, this.web3, this.bulk );
        this.tokens = new Token( this.cache, this.web3, this.bulk  );
        this.tokenHistories = new TokenHistory( this.cache );
        this.historyPrices = new HistoryPirce( this.cache );
        
        this.loopUpdateMainTokenPrice();
    }

    areEqualAdd( add1, add2 ){
        return add1.toLowerCase() == add2.toLowerCase();
    }
    isMainToken( contract ){
        return this.areEqualAdd(contract, EnumMainTokens[EnumChainId.BSC].MAIN);
    }
    

    async calculatePriceFromReserves( hash, pair, pairDatas ) {

        /*
        pairDatas = {
            swap: {
                router: '0x10ED43C718714eb63d5aA57B78B54704E256024E',
                sender: '0xbA26c7Acd343459f99f4DF130D0aa12320DD9f3e',
                pair: '0x7942d6f0F92797e78d87A57F28B38AD1Bfbb3Af2',
                params: [ '0', '600000000000000000', '888644757878653721073', '0' ],
                transfer: { sold: { token: token0Add, amount: 1 }, bought: { token: token1Add, amount: 10 } }
            },
            sync: {
                pair: '0x7942d6f0F92797e78d87A57F28B38AD1Bfbb3Af2',
                params: [ '50494653753892947974242', '34608021769967697551' ] -> [reserve0, reserve1]
            }
        }
        */
        
        await this.updatePairPriceWithReserves(
            hash,
            pair,
            pairDatas.swap,
            pairDatas.sync
        );

    }

    // returns an array [ mainToken, dependantToken ];
    async tokenHierarchy( first_token, latest_token, history ){ 
        // to have consistency in data collection keep using the same mainToken and dependantToken if present in history
        if( history ){ 
            let mainTokenContract = history.mainToken;
            if( first_token.contract == mainTokenContract ) return [ first_token, latest_token ]
            else return [ latest_token, first_token ];
        }
       // compare wich of the tokens is used more frequently to create pairs. This means that the one with more pairs is the more common used

       let pairs_comparison; // true if first token is the main one, else false
        // cross chain
        if(
            this.areEqualAdd(EnumMainTokens[EnumChainId.BSC].MAIN, first_token.contract) &&
            EnumMainTokens[EnumChainId.BSC].STABLECOINS.includes(latest_token.contract)
        ) {
            pairs_comparison = false;
        } else if(
            this.areEqualAdd(EnumMainTokens[EnumChainId.BSC].MAIN, latest_token.contract) &&
            EnumMainTokens[EnumChainId.BSC].STABLECOINS.includes(first_token.contract)
        ){
            pairs_comparison = true;
        }
        else if( first_token.pairs_count == latest_token.pairs_count ){
            if( EnumMainTokens[EnumChainId.BSC].STABLECOINS.includes(first_token.contract) ) pairs_comparison = true;
            else if( EnumMainTokens[EnumChainId.BSC].STABLECOINS.includes(latest_token.contract) ) pairs_comparison = false;
            else if ( this.areEqualAdd(EnumMainTokens[EnumChainId.BSC].MAIN, first_token.contract) ) pairs_comparison = true;
            else if ( this.areEqualAdd(EnumMainTokens[EnumChainId.BSC].MAIN, latest_token.contract) ) pairs_comparison = false;
        } else {
            pairs_comparison = first_token.pairs_count > latest_token.pairs_count; // here pairs_count
        }
       
       let main_token = pairs_comparison ? first_token : latest_token;
       let dependant_token = pairs_comparison ? latest_token : first_token;
       return [ main_token, dependant_token ];
    }

    async getTokens(pairAddress, cachedPair){
        let token0 = 0;
        let token1 = 0;
        try {
            let pairWeb3Contract =  await new this.web3.eth.Contract( EnumAbi[EnumChainId.BSC].PAIR.PANCAKE, pairAddress );
            if( !cachedPair ){ 
                console.log('[PAIR] Not cached')
                token0 = await pairWeb3Contract.methods.token0().call();
                token1 = await pairWeb3Contract.methods.token1().call();
                // some lines below the pair is setted in the cache
            } else {
                token0 = cachedPair.tokens[0];
                token1 = cachedPair.tokens[1];
            }
        } catch (error) {
            console.log( '[ERROR] CANNOT RETRIVE RESERVES', error );
            return [null, null] ;
        }
        return [token0, token1];
    }

    isWhitelisted( token ){
        if( !scraperConfig.whitelist_enabled ) return true;
        return scraperConfig.whitelist.includes(token);
    }

    /**
     * @description Add the token price inside the Bulk history
     * @param {*} token0 address
     * @param {*} token1 address
     */
    async updatePairPriceWithReserves( 
        /* txSender, router, txHash, pairAddress, params */
        hash, pairAdd, swapInfo, syncInfo
    ){
        
        if ( !syncInfo ) return; // if there is no a sync event, skip this;

        let [reserve0, reserve1] = syncInfo.params;
        let cachedPair = this.cache.getPair(pairAdd);

        if( !swapInfo && !cachedPair ) return; // if the pair do not exists on the db, and this is not a swap then skip. ( to avoid making any web3 call to populate the unexistant pair )
        if( swapInfo && (!swapInfo.transfer.bought || !swapInfo.transfer.sold) ) return; // if this is a swap, and some infos miss, skip it;

        let [token0, token1] = await this.getTokens(pairAdd, cachedPair);

        if( !this.isWhitelisted(token0) && !this.isWhitelisted(token1) ) return;
        
        if(!token0 || !token1 ) return;
        let tokenHistory = await this.tokenHistories.getTokenHistory( pairAdd );
        let token0Infos = await this.tokens.getToken( UtilsAddresses.toCheckSum(token0) );
        let token1Infos = await this.tokens.getToken( UtilsAddresses.toCheckSum(token1) );
        if( !token0Infos || !token0Infos.contract || !token1Infos || !token1Infos.contract ) return; // skip if some token infos is missing;

        reserve0 = reserve0/10**token0Infos.decimals;
        reserve1 = reserve1/10**token1Infos.decimals;

        if( !swapInfo && cachedPair ){
            this.bulk.bulk_normal.setTokenBulkSet( pairAdd, EnumBulkTypes.TOKEN_HISTORY ,'reserve0', reserve0);
            this.bulk.bulk_normal.setTokenBulkSet( pairAdd, EnumBulkTypes.TOKEN_HISTORY ,'reserve1', reserve1);
            return; // just update the reserves and skip
        }
        
        let sender = swapInfo.sender;
        let router = swapInfo.router;
       

        let pairInfos =  { 
            pair: pairAdd,
            router: router,
            tokens: [token0, token1],
            reserves: [reserve0, reserve1],
            decimals: [token0Infos.decimals, token1Infos.decimals],
        };
        this.cache.setPair(pairAdd, pairInfos); // create or update the pair inside the cache and arbitrage store

        let routerInfos = await this.routers.getRouter( router, token0, token1, token0Infos.decimals );
   

        let [ mainToken, dependantToken ] = await this.tokenHierarchy(token0Infos, token1Infos, tokenHistory); // get who is the main token in the pair
        
        // cross chain
        let mainTokenIsBNB = this.isMainToken( mainToken.contract );

        let dependantTokenPrice = null; // calculate the dependant token price
        if( mainToken.contract == token0 ) dependantTokenPrice = reserve0/reserve1; // here decimals
        else dependantTokenPrice = reserve1/reserve0; 

        if( mainTokenIsBNB ){ // if the main token was BNB then multiply for get the token usd value
            if(this.CHAIN_MAIN_TOKEN_PRICE){
                dependantTokenPrice = dependantTokenPrice * this.CHAIN_MAIN_TOKEN_PRICE;
            }
        } 

        if( !tokenHistory ){
            tokenHistory = {
                records_transactions: 0,
                records_price: 0,
                records_date: todayDateUnix(),
                chain: EnumChainId.BSC, // cross chain
                token0: {
                    contract: token0Infos.contract,
                    name: token0Infos.name,
                    symbol: token0Infos.symbol,
                    decimals: token0Infos.decimals,
                },
                token1: {
                    contract: token1Infos.contract,
                    name: token1Infos.name,
                    symbol: token1Infos.symbol,
                    decimals: token1Infos.decimals,
                },
                router: router,
                pair: pairAdd,
                mainToken: mainToken.contract,
                dependantToken: dependantToken.contract,
                
            };
            console.log(`[BULK ADD CREATE] ${Object.keys(this.bulk.bulk_normal.getHistories(EnumBulkTypes.TOKEN_HISTORY)).length} ${dependantToken.contract}`);
            this.bulk.bulk_normal.setNewDocument( pairAdd, EnumBulkTypes.TOKEN_HISTORY, tokenHistory );
            this.cache.setHistory(pairAdd, tokenHistory);
        } 
        
        console.log(`[INFO] MAIN: ${mainToken.contract} | DEPENDANT: ${dependantToken.contract} | ${pairAdd}`); 
        console.log(`[INFO] DEPENDANT PRICE: ${dependantTokenPrice}$ | ${pairAdd} `);


        let pairHistory = await this.historyPrices.getHistory(pairAdd);
        await this.updatePrice( 
            router, pairAdd, dependantToken.contract, mainToken.contract,
            pairHistory.latest, dependantTokenPrice, 
            reserve0, reserve1 
        );

        // console.log(`[TIME] Updating price: ${(Date.now()-START)/1000}`);
        // START = Date.now();

        // increase the token score
        let todayUnix = todayDateUnix();
        this.bulk.bulk_normal.setTokenBulkInc( token0, EnumBulkTypes.TOKEN_BASIC ,`score.${todayUnix}`, 1 );  
        if(!token0Infos.score) token0Infos.score = {};
        token0Infos.score[todayUnix] = token0Infos.score[todayUnix] ? token0Infos.score[todayUnix] + 1 : 1;
        this.cache.setToken(token0, {...token0Infos});

        if(!token1Infos.score) token1Infos.score = {};
        this.bulk.bulk_normal.setTokenBulkInc( token1, EnumBulkTypes.TOKEN_BASIC ,`score.${todayUnix}`, 1 );
        token1Infos.score[todayUnix] = token1Infos.score[todayUnix] ? token1Infos.score[todayUnix] + 1 : 1;
        this.cache.setToken(token1, {...token1Infos});

        console.log(`[SCORE]`, token1Infos.score, token0Infos.score)

        // update the pair records
        this.bulk.bulk_normal.setTokenBulkInc( pairAdd, EnumBulkTypes.TOKEN_HISTORY ,`records_transactions`, 1 );
        this.bulk.bulk_normal.setTokenBulkSet( pairAdd, EnumBulkTypes.TOKEN_HISTORY ,'reserve0', reserve0);
        this.bulk.bulk_normal.setTokenBulkSet( pairAdd, EnumBulkTypes.TOKEN_HISTORY ,'reserve1', reserve1);
        this.bulk.bulk_normal.setTokenBulkSet( pairAdd, EnumBulkTypes.TOKEN_HISTORY ,'price', dependantTokenPrice);

        // detect the main reseve and the dependant token reserve in the pair
        let mainReserve;
        let dependantReserve;
        if( mainToken.contract == token0 ) {
            mainReserve = reserve0;
            dependantReserve = reserve1;
        } else {
            mainReserve = reserve1;
            dependantReserve = reserve0;
        }

        let mainReserveValue = mainReserve; 
        if( mainTokenIsBNB ) mainReserveValue = mainReserve * this.CHAIN_MAIN_TOKEN_PRICE; // if the main token of the pair is BNB then multiply the tokens in the pair reserver * bnb price
        this.bulk.bulk_normal.setTokenBulkSet( pairAdd, EnumBulkTypes.TOKEN_HISTORY, 'mainReserveValue', mainReserveValue);

        // update daily variation percentage
        let dayAgoHistoryPrice = pairHistory.day;
        console.log( dayAgoHistoryPrice )
        if( dayAgoHistoryPrice ){ 
            let dailyVariation = relDiff(dependantTokenPrice, dayAgoHistoryPrice.value).toFixed(2);
            this.bulk.bulk_normal.setTokenBulkSet( pairAdd, EnumBulkTypes.TOKEN_HISTORY, 'variation.day', dailyVariation );
            console.log(`[UPDATING PERCENTAGE DAILY] ${pairAdd} ${dailyVariation}`)
        }

        // console.log(`[TIME] Update other minor infos: ${(Date.now()-START)/1000}`);
        // START = Date.now();

        let amountInNoDecimals = swapInfo.transfer.sold.token == token0 ? swapInfo.transfer.sold.amount/(10**token0Infos.decimals)
            : swapInfo.transfer.sold.amount/(10**token1Infos.decimals);

        let amountOutNoDecimals = swapInfo.transfer.bought.token == token0 ? swapInfo.transfer.bought.amount/(10**token0Infos.decimals)
            : swapInfo.transfer.bought.amount/(10**token1Infos.decimals);

        let time = Date.now()/1000;
        console.log('[SETTING TRANSACTION] ', pairAdd, time);
        this.bulk.bulk_time.setNewDocument( pairAdd, EnumBulkTypes.HISOTRY_TRANSACTION, time, {
            time: time, // unix timestamp
            hash: hash,
            from: sender,
            
            amountIn: amountInNoDecimals,
            amountOut: amountOutNoDecimals,

            tokenIn: swapInfo.transfer.sold.token ,
            tokenOut: swapInfo.transfer.bought.token,

            pair: pairAdd,
            router: router,

            dependantToken: dependantToken.contract,
            mainToken: mainToken.contract
        }, false, 0.0001, true);

    }

    getTime() { return Math.floor((Date.now()/1000)/this.UPDATE_PRICE_INTERVAL) * this.UPDATE_PRICE_INTERVAL }
    async updatePrice( router, pair, tokenAddress, mainTokenAddress, latestHistoryPirce, newPrice, reserve0, reserve1 ) {
    
        let time = this.getTime();
        let tokenInfo = this.cache.getToken(UtilsAddresses.toCheckSum(tokenAddress));
        if( !newPrice ) return;
        

        let latestHistory = latestHistoryPirce;
        let latestHistoryTime = latestHistory ? latestHistory.time: 0;

        let latestHigh = latestHistory ? latestHistory.high : 0;
        let latestLow = latestHistory ? latestHistory.low : 0 ;

        console.log(`[UPDATING PRICE]`, pair)

        if( ( time - latestHistoryTime ) < this.UPDATE_PRICE_INTERVAL ){ // update latest record
            
            if( newPrice > latestHigh ){
                this.bulk.bulk_time.setTokenBulkSet( pair, EnumBulkTypes.HISTORY_PRICE, time, 'high', newPrice );
            }
            if( newPrice < latestLow ){
                this.bulk.bulk_time.setTokenBulkSet( pair, EnumBulkTypes.HISTORY_PRICE, time, 'low', newPrice );
            }
            // update the value anyway also if it is not higher that the high or lower than the low 
            this.bulk.bulk_time.setTokenBulkSet( pair, EnumBulkTypes.HISTORY_PRICE, time, 'value', newPrice );
            this.bulk.bulk_time.setTokenBulkSet( pair, EnumBulkTypes.HISTORY_PRICE, time, 'reserve0', reserve0 );
            this.bulk.bulk_time.setTokenBulkSet( pair, EnumBulkTypes.HISTORY_PRICE, time, 'reserve1', reserve1 );
            
            
        } else { // create new record  
            
            if( !latestHistoryTime || typeof latestHistoryTime != 'number' ){  // load the time of the last time that this price was updated so that we can change the 'close' parameter
                console.log(`[CLOSE RETRIVE] RETRIVING LAST HISTORY ${pair}. ${latestHistoryTime}`);
                latestHistoryTime = await this.historyPrices.getLastHistoryTime(pair, time);
                console.log(`[CLOSE RETRIVE] RETRIVED ${latestHistoryTime} ${pair}`)
            }
            if( latestHistoryTime ){ // update the close parameter
                console.log(`[CLOSE] UPDATING ${latestHistoryTime} WITH ${newPrice}. ${pair}`)
                this.bulk.bulk_time.setTokenBulkSet( pair, EnumBulkTypes.HISTORY_PRICE, latestHistoryTime, 'close', newPrice );
            } else {
                console.log(`[CLOSE FAIL] CANNOT UPDATE ${latestHistoryTime} WITH ${newPrice}. ${pair}`)
            }
            
            console.log(`[CREATING RECORD] ${pair}. LAST RECORD: ${latestHistoryTime}`);
            this.bulk.bulk_time.setNewDocument( pair, EnumBulkTypes.HISTORY_PRICE, time, {
                time: time, // to have standard intervals, for example the exact minutes on the time. 9:01, 9:02, 9:03
                open: newPrice,
                close: newPrice,
                high: newPrice,
                low: newPrice,
                value: newPrice,
                burned: tokenInfo ? tokenInfo.burned : null,
                mcap: tokenInfo ? (tokenInfo.total_supply - tokenInfo.burned) * newPrice : 0,
      
                pair: pair,
                router: router,
                mainToken: mainTokenAddress,
                dependantToken: tokenAddress
            } );

            if( tokenInfo ) {
                this.bulk.bulk_normal.setTokenBulkSet(pair, EnumBulkTypes.TOKEN_HISTORY, 'burned', tokenInfo.burned )
                this.bulk.bulk_normal.setTokenBulkSet(pair, EnumBulkTypes.TOKEN_HISTORY, 'mcap', (tokenInfo.total_supply - tokenInfo.burned) * newPrice )
            }
                
            this.bulk.bulk_normal.setTokenBulkSet(pair, EnumBulkTypes.TOKEN_HISTORY, 'value', newPrice );
            this.bulk.bulk_normal.setTokenBulkInc(pair, EnumBulkTypes.TOKEN_HISTORY, 'records_price', 1);
        }
    }

    async loopUpdateMainTokenPrice(){
        // cross chain
        let FACTORY = await new this.web3.eth.Contract( EnumAbi[EnumChainId.BSC].FACTORIES.PANCAKE, EnumContracts[EnumChainId.BSC].FACTORIES.PANCAKE );
        while( true ){
            try {
                let mainTokenPairAddress = await FACTORY.methods.getPair( EnumMainTokens[EnumChainId.BSC].WBNB.address, EnumMainTokens[EnumChainId.BSC].USDT.address ).call();
                let mainTokenPair = await new this.web3.eth.Contract( EnumAbi[EnumChainId.BSC].PAIR.PANCAKE, mainTokenPairAddress );
                let reserves = await mainTokenPair.methods.getReserves().call();
                let WBNB_RESERVE = reserves[1]/10**EnumMainTokens[EnumChainId.BSC].WBNB.decimals;
                let USDT_RESERVE = reserves[0]/10**EnumMainTokens[EnumChainId.BSC].USDT.decimals;
                let WBNB_PRICE = USDT_RESERVE/WBNB_RESERVE;
                this.CHAIN_MAIN_TOKEN_PRICE = WBNB_PRICE;
            } catch (error) {
                console.log(`[ERR UPDATING MAIN PRICE] ${error}`);
            }
            await sleep(5000);
        }
    }
    
}

module.exports = Scraper;