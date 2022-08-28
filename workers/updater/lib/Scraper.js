require('dotenv').config();

const EnumChainId = require("../../../enum/chain.id");
const EnumContracts = require("../../../enum/contracts");
const Bulk = require("./bulk/Bulk");
const Cache = require("./Cache");
const Token = require("./entity/Token");

const fs = require('fs');

const EnumAbi = require("../../../enum/abi");
const EnumMainTokens = require("../../../enum/mainTokens");
const EnumBulkTypes = require("../../../enum/bulk.records.type");
const TokenHistory = require("./entity/TokenHistory");
const HistoryPirce = require("./entity/HistoryPirce");

const abiDecoder = require('abi-decoder');
const Router = require("./entity/Routers");

const UtilsAddresses = require("../../../utils/addresses");
const TokenFees = require("./entity/TokenFees");
abiDecoder.addABI(EnumAbi[process.env.CHAIN_ID].TOKEN);
abiDecoder.addABI(EnumAbi[process.env.CHAIN_ID].ROUTERS.PANCAKE);

const scraperConfig = require("../../../config.js");
const sleep = require('../../../utils/sleep');



function todayDateUnix(){
    return Math.ceil(Date.now()/1000 - ((Date.now()/1000)%(60*60*24)));
}

class Scraper {

    static lastScrapedBlockPath = __dirname + '/not-delete.scraped-block.checkpoint.txt';
    static allScrapedBlocksPath = __dirname + '/not-delete.scraped-blocks.txt';
    static logPath = __dirname + '/log.txt';

    static logger = ( text ) => {
        fs.appendFileSync(Scraper.allScrapedBlocksPath, text , 'utf-8');
    }

    constructor ( web3 ) {
        this.web3 = web3;
        
        this.cache = new Cache();
        this.bulk = new Bulk( this.cache );

        this.routers = new Router( this.cache, this.web3, this.bulk );
        this.tokens = new Token( this.cache, this.web3, this.bulk  );
        this.tokensFees = new TokenFees( this.web3 );
        this.tokenHistories = new TokenHistory( this.cache );
        this.historyPrices = new HistoryPirce( this.cache );

        this.allScrapedBlocksTemp = '';

        this.bulkUpdateGap = process.env.WRITE_TO_DB_SECONDS * 1000;
        this.lastUpdate = 0;

        this.CHAIN_MAIN_TOKEN_PRICE = 0;
        this.loopUpdateMainTokenPrice();
    }

    areEqualAdd( add1, add2 ){
        return add1.toLowerCase() == add2.toLowerCase();
    }
    isMainToken( contract ){
        return this.areEqualAdd(contract, EnumMainTokens[process.env.CHAIN_ID].MAIN.address);
    }
    isWhitelisted( token ){
        if( !scraperConfig[process.env.CHAIN_ID].whitelist_enabled ) return true;
        return scraperConfig[process.env.CHAIN_ID].whitelist.includes(token);
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
            this.areEqualAdd(EnumMainTokens[process.env.CHAIN_ID].MAIN.address, first_token.contract) &&
            EnumMainTokens[process.env.CHAIN_ID].STABLECOINS.includes(latest_token.contract)
        ) {
            pairs_comparison = false;
        } else if(
            this.areEqualAdd(EnumMainTokens[process.env.CHAIN_ID].MAIN.address, latest_token.contract) &&
            EnumMainTokens[process.env.CHAIN_ID].STABLECOINS.includes(first_token.contract)
        ){
            pairs_comparison = true;
        }
        else if( first_token.pairs_count == latest_token.pairs_count ){
            if( EnumMainTokens[process.env.CHAIN_ID].STABLECOINS.includes(first_token.contract) ) pairs_comparison = true;
            else if( EnumMainTokens[process.env.CHAIN_ID].STABLECOINS.includes(latest_token.contract) ) pairs_comparison = false;
            else if ( this.areEqualAdd(EnumMainTokens[process.env.CHAIN_ID].MAIN.address, first_token.contract) ) pairs_comparison = true;
            else if ( this.areEqualAdd(EnumMainTokens[process.env.CHAIN_ID].MAIN.address, latest_token.contract) ) pairs_comparison = false;
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
            let pairWeb3Contract =  await new this.web3.eth.Contract( EnumAbi[process.env.CHAIN_ID].PAIR.PANCAKE, pairAddress );
            if( !cachedPair ){ 
                console.log('\t\t[PAIR] Not cached')
                token0 = await pairWeb3Contract.methods.token0().call();
                token1 = await pairWeb3Contract.methods.token1().call();
                // some lines below the pair is setted in the cache
            } else {
                token0 = cachedPair.tokens[0];
                token1 = cachedPair.tokens[1];
            }
        } catch (error) {
            console.log( '\t[\tERROR] CANNOT RETRIVE RESERVES', error );
            return [null, null] ;
        }
        return [token0, token1];
    }
    async calculateTokenFees(token, pairInfos, routerInfos){

        let feesKey = pairInfos.tokens[0] == token ? 'fees.token0': 'fees.token1';
        let otherToken = pairInfos.tokens[0] == token ? pairInfos.tokens[1]: pairInfos.tokens[0];
        let fees = { buy: null, sell: null, checked: false }
        
        let customCalc = false;

        if( // checked token is not bnb, and the other paired token is bnb
            !this.areEqualAdd(token, EnumMainTokens[process.env.CHAIN_ID].MAIN.address) && 
            this.areEqualAdd(otherToken, EnumMainTokens[process.env.CHAIN_ID].MAIN.address) 
        ){
            console.log('[CALCULATING FEES MAIN]', token);
            let fee = 10000 - (routerInfos.fee * 10000);
            let buyFee = await this.tokensFees.buyFees( token, pairInfos.pair, fee, this.web3.utils.toWei('0.01', 'ether') );
            let sellFee = await this.tokensFees.sellFees( token, pairInfos.pair, fee, this.web3.utils.toWei('0.01', 'ether') );
            fees.buy = buyFee;
            fees.sell = sellFee;
            fees.checked = true;
        } else {
            customCalc = true;
            console.log('[CALCULATING FEES CUSTOM]', token);
            let pairForBuyOtherToken = await this.tokenHistories.getPairWithMainToken(otherToken);
            if( !pairForBuyOtherToken ){
                console.log(`\t\t[TOKEN FEES ERR]\n\t\t\t> TOKENS: ${token} - ${otherToken}\n\t\t\t> PAIR: ${pairInfos.pair}\n\t\t\t> FEES: ${JSON.stringify(fees)}`,  )
                return fees;
            }
            let fee1 = 10000 - (pairForBuyOtherToken.router_fee * 10000);
            let fee2 = 10000 - (routerInfos.fee * 10000);

            fees.buy = await this.tokensFees.buyFeesCustom( otherToken, pairForBuyOtherToken.pair, fee1, token, pairInfos.pair, fee2, this.web3.utils.toWei('0.1', 'ether') );
            fees.sell = await this.tokensFees.sellFeesCustom( otherToken, pairForBuyOtherToken.pair, fee1, token, pairInfos.pair, fee2, this.web3.utils.toWei('0.1', 'ether') );
            fees.checked = true;
        }

        if( fees.buy != null && fees.sell == null ){
            console.log('\t\tHONEYPOT', token, fees);
            fees.buy = 0;
            fees.sell = 100;
            fees.checked = true;
            this.bulk.bulk_normal.setTokenBulkSet( pairInfos.pair, EnumBulkTypes.TOKEN_HISTORY , feesKey, fees );  
            this.bulk.bulk_normal.setTokenBulkSet( pairInfos.pair, EnumBulkTypes.TOKEN_HISTORY , 'hasFees', true );  
            return fees;
        }

        console.log('\t\t[TOKEN FEES] ', token, JSON.stringify(fees), fees.buy == 0 && fees.sell == 0, 'CUSTOM: ', customCalc);
        if( fees.buy != null && fees.sell != null ){
            this.bulk.bulk_normal.setTokenBulkSet( pairInfos.pair, EnumBulkTypes.TOKEN_HISTORY , feesKey, fees );
            if( fees.buy == 0 && fees.sell == 0 ){
                this.bulk.bulk_normal.setTokenBulkSet( pairInfos.pair, EnumBulkTypes.TOKEN_HISTORY , 'hasFees', false );
            }  
        }
        return fees;
    }

    /**
     * @description Add the token price inside the Bulk history
     * @param {*} token0 address
     * @param {*} token1 address
     */
    async updatePairPriceWithReserves( 
        /* txSender, router, txHash, pairAddress, params */
        hash, pairAdd, swapInfo, syncInfo, blockNumber
    ){
        
        pairAdd = UtilsAddresses.toCheckSum(pairAdd);

        console.log('\t[STARTED]', pairAdd, hash, blockNumber);
        console.log('\t[SYNC]', JSON.stringify(syncInfo));
        console.log('\t[SWAP]', JSON.stringify(swapInfo));

        let time = Date.now();

        let reserve0 = syncInfo.reserve0;
        let reserve1 = syncInfo.reserve1;
        
        let cachedPair = this.cache.getPair(pairAdd);

        let [token0, token1] = await this.getTokens(pairAdd, cachedPair);

        if( !this.isWhitelisted(token0) && !this.isWhitelisted(token1) ) return;

        console.log(`[TIME][${blockNumber}][RETRIVED TOKENS]`, token0, token1, (Date.now()-time)/1000 );
        time = Date.now();

        if(!token0 || !token1 ) return console.log('\t[MISSING TOKENS]', pairAdd, hash);

        let tokenHistory = await this.tokenHistories.getTokenHistory( pairAdd );

        console.log(`[TIME][${blockNumber}][RETRIVED TOKENS HISTORIES]`, pairAdd, (Date.now()-time)/1000 );
        time = Date.now();

        let token0Infos = await this.tokens.getToken( UtilsAddresses.toCheckSum(token0) );
        let token1Infos = await this.tokens.getToken( UtilsAddresses.toCheckSum(token1) );
        
        
        if( !token0Infos || !token0Infos.contract || !token1Infos || !token1Infos.contract ) return; // skip if some token infos is missing;

        reserve0 = reserve0/10**token0Infos.decimals;
        reserve1 = reserve1/10**token1Infos.decimals;

        let router = swapInfo?.router;
        if( router ) router = UtilsAddresses.toCheckSum(router);
        console.log(hash, '[ROUTER]', router);

        let pairInfos =  { 
            pair: pairAdd,
            router: tokenHistory ? tokenHistory.router : router,
            tokens: [token0, token1],
            reserves: [reserve0, reserve1],
            decimals: [token0Infos.decimals, token1Infos.decimals],
            fees: {
                token0: tokenHistory ? tokenHistory.fees?.token0 : null,
                token1: tokenHistory ? tokenHistory.fees?.token1 : null,
            }
        };

        let oldRouterInfos = tokenHistory ? await this.routers.getRouter( tokenHistory.router, pairAdd ) : {};
        let detectedRouterInfos = router ? await this.routers.getRouter( router, pairAdd ) : {};
        console.log(`[TIME][${blockNumber}][RETRIVED ROUTERS]`, (Date.now()-time)/1000 );
        time = Date.now();

        let [ mainToken, dependantToken ] = await this.tokenHierarchy(token0Infos, token1Infos, tokenHistory); // get who is the main token in the pair
        console.log(`[TIME][${blockNumber}][RETRIVED HIERARCHY]`, (Date.now()-time)/1000 );
        time = Date.now();
        // cross chain

        if( scraperConfig[process.env.CHAIN_ID].calculate_pair_fees ){
            console.log(`[GOING TO CHECK FEES] ${token0} ${JSON.stringify(pairInfos.fees.token0)}`)
            console.log(`[GOING TO CHECK FEES] ${token1} ${JSON.stringify(pairInfos.fees.token1)}`)
            if( !pairInfos.fees.token0 || !pairInfos.fees.token0.checked ) {
                let start = Date.now();
                let tokenFees = await this.calculateTokenFees(token0, pairInfos, detectedRouterInfos);
                pairInfos.fees.token0 = tokenFees;
                console.log(`[TIME][${blockNumber}][CALCULATE FEES] 0:`, token0, pairAdd, (Date.now()-start)/1000 );
            } 
            if( !pairInfos.fees.token1 || !pairInfos.fees.token1.checked ) {
                let start = Date.now();
                let tokenFees = await this.calculateTokenFees(token1, pairInfos, detectedRouterInfos);
                pairInfos.fees.token1 = tokenFees;
                console.log(`[TIME][${blockNumber}][CALCULATE FEES] 1:`, token1, pairAdd, (Date.now()-start)/1000 );
            }
        }

        this.cache.setPair(pairAdd, pairInfos);

       
        
        time = Date.now();

        if( !tokenHistory ){
            if(!router) return ;
            tokenHistory = {
                records_date: todayDateUnix(),
                chain: process.env.CHAIN_ID, // cross chain
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

                dependantToken: dependantToken.contract,
                mainToken: mainToken.contract,

                router: router,
                router_fee: detectedRouterInfos.fee,
                pair: pairAdd,
            };
            console.log(`\t\t[BULK ADD CREATE] ${Object.keys(this.bulk.bulk_normal.getHistories(EnumBulkTypes.TOKEN_HISTORY)).length} ${dependantToken.contract}`);
            this.bulk.bulk_normal.setNewDocument( pairAdd, EnumBulkTypes.TOKEN_HISTORY, tokenHistory );
            this.cache.setHistory(pairAdd, tokenHistory);
            console.log(`[TIME][${blockNumber}][CREATED NEW DOCUMENT]`, (Date.now()-time)/1000 );
            time = Date.now();
        } else {
            console.log(`[ROUTER] ${blockNumber} ${pairAdd}`, tokenHistory?.router, router, oldRouterInfos.valid, detectedRouterInfos.valid );
            if( ( !oldRouterInfos.valid || oldRouterInfos.fee == undefined) && detectedRouterInfos.valid  ){ 
                console.log('\t\t[UPDATING ROUTER] ', tokenHistory?.router, router, JSON.stringify(oldRouterInfos));
                // if the pair was previously detected from an invalid router, update it with the current one if it is valid
                this.bulk.bulk_normal.setTokenBulkSet( pairAdd, EnumBulkTypes.TOKEN_HISTORY ,`router`, router );
                this.bulk.bulk_normal.setTokenBulkSet( pairAdd, EnumBulkTypes.TOKEN_HISTORY ,`router_fee`, detectedRouterInfos.fee );
            } 
            else if ( (!tokenHistory.router_fee || tokenHistory.router_fee == -1) && oldRouterInfos.valid ){ // just for update the old toke histories that do not have this parameter
                this.bulk.bulk_normal.setTokenBulkSet( pairAdd, EnumBulkTypes.TOKEN_HISTORY ,`router_fee`, oldRouterInfos.fee );
            }
            console.log(`[TIME][${blockNumber}][UPDATED ROUTER]`, (Date.now()-time)/1000 );
            time = Date.now();
        }

        // increase the token score
        let todayUnix = todayDateUnix();
        this.bulk.bulk_normal.setTokenBulkInc( token0, EnumBulkTypes.TOKEN_BASIC ,`score.${todayUnix}`, 1 );  
        this.bulk.bulk_normal.setTokenBulkInc( token0, EnumBulkTypes.TOKEN_BASIC ,`score_points`, 1 );  
        if(!token0Infos.score) token0Infos.score = {};
        token0Infos.score[todayUnix] = token0Infos.score[todayUnix] ? token0Infos.score[todayUnix] + 1 : 1;
        this.cache.setToken(token0, {...token0Infos});

        if(!token1Infos.score) token1Infos.score = {};
        this.bulk.bulk_normal.setTokenBulkInc( token1, EnumBulkTypes.TOKEN_BASIC ,`score.${todayUnix}`, 1 );
        this.bulk.bulk_normal.setTokenBulkInc( token1, EnumBulkTypes.TOKEN_BASIC ,`score_points`, 1 );  
        token1Infos.score[todayUnix] = token1Infos.score[todayUnix] ? token1Infos.score[todayUnix] + 1 : 1;
        this.cache.setToken(token1, {...token1Infos});

        // update the pair records
        this.bulk.bulk_normal.setTokenBulkSet( pairAdd, EnumBulkTypes.TOKEN_HISTORY ,'reserve0', reserve0);
        this.bulk.bulk_normal.setTokenBulkSet( pairAdd, EnumBulkTypes.TOKEN_HISTORY ,'reserve1', reserve1);
        this.bulk.bulk_normal.setTokenBulkSet( pairAdd, EnumBulkTypes.TOKEN_HISTORY ,'updated_at_block', blockNumber);
        console.log(`[TIME][${blockNumber}][SET BULK OP]`, (Date.now()-time)/1000 );

        if( !swapInfo || !swapInfo.router || !swapInfo.params || !Object.keys(swapInfo.params).length ) return;
        
        if( scraperConfig[process.env.CHAIN_ID].save_transactions ){
            let swapInfoIn = {
                amount: parseInt(swapInfo.params.amount0In) ? 
                swapInfo.params.amount0In/(10**token0Infos.decimals) 
                : swapInfo.params.amount1In/(10**token1Infos.decimals),
                token: parseInt(swapInfo.params.amount0In) ? token0: token1
            }
    
            let swapInfoOut = {
                amount: parseInt(swapInfo.params.amount0Out) ? 
                swapInfo.params.amount0Out/(10**token0Infos.decimals) 
                : swapInfo.params.amount1Out/(10**token1Infos.decimals),
                token: parseInt(swapInfo.params.amount0Out) ? token0: token1
            }
    
            let time_unix = time/1000;
            console.log('[SETTING TRANSACTION] ', pairAdd, time_unix);
            this.bulk.bulk_time.setNewDocument( pairAdd, EnumBulkTypes.HISOTRY_TRANSACTION, time_unix, {
                time: time_unix, // unix timestamp
                hash: hash,
                from: swapInfo.sender,
                
                amountIn: swapInfoIn.amount,
                amountOut: swapInfoOut.amount,
    
                tokenIn: swapInfoIn.token,
                tokenOut: swapInfoOut.token,
    
                pair: pairAdd,
                router: router,
    
                dependantToken: dependantToken.contract,
                mainToken: mainToken.contract
            }, false, 0.0001, true);
        }


        // update price record
        // cross chain
        let mainTokenIsBNB = this.isMainToken( mainToken.contract );
        let mainReserve = mainToken.contract == token0 ? reserve0 : reserve1;
        let mainReserveValue = mainReserve;
        if( mainTokenIsBNB ) mainReserveValue = mainReserve * this.CHAIN_MAIN_TOKEN_PRICE; // if the main token of the pair is BNB then multiply the tokens in the pair reserver * bnb price
        this.bulk.bulk_normal.setTokenBulkSet( pairAdd, EnumBulkTypes.TOKEN_HISTORY, 'mainReserveValue', mainReserveValue);

        if( scraperConfig[process.env.CHAIN_ID].save_price ){
            let dependantTokenPrice = null; // calculate the dependant token price
            if( mainToken.contract == token0 ) dependantTokenPrice = reserve0/reserve1; // here decimals
            else dependantTokenPrice = reserve1/reserve0; 
            if( mainTokenIsBNB ){ // if the main token was BNB then multiply for get the token usd value
                if(this.CHAIN_MAIN_TOKEN_PRICE){
                    dependantTokenPrice = dependantTokenPrice * this.CHAIN_MAIN_TOKEN_PRICE;
                }
            }

            let pairHistory = await this.historyPrices.getHistory(pairAdd);
            await this.updatePrice( 
                router, pairAdd, dependantToken.contract, mainToken.contract,
                pairHistory.latest, dependantTokenPrice, 
                reserve0, reserve1 
            );
        }   
        
    }

    async executeBulk(){
        if( Date.now() < this.bulkUpdateGap + this.lastUpdate ) return;
        this.lastUpdate = Date.now();

        console.log('[BULK] ', this.allScrapedBlocksTemp);
        let start = Date.now();
        await this.bulk.execute();
        console.log('[BULK UPDATED]', (Date.now()-start)/1000 );
    }

    getTime() { return (Date.now()/ (1000)) - (Date.now()/ (1000)) % 60 } // get current minete as unix timestamp
    
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
        let FACTORY = await new this.web3.eth.Contract( EnumAbi[process.env.CHAIN_ID].MAIN_FACTORY, EnumContracts[process.env.CHAIN_ID].MAIN_FACTORY );
        while( true ){
            try {
                let mainTokenPairAddress = await FACTORY.methods.getPair( EnumMainTokens[process.env.CHAIN_ID].MAIN.address, EnumMainTokens[process.env.CHAIN_ID].USDT.address ).call();
                let mainTokenPair = await new this.web3.eth.Contract( EnumAbi[process.env.CHAIN_ID].PAIR.PANCAKE, mainTokenPairAddress );
                let reserves = await mainTokenPair.methods.getReserves().call();
                let WBNB_RESERVE = reserves[1]/10**EnumMainTokens[process.env.CHAIN_ID].MAIN.decimals;
                let USDT_RESERVE = reserves[0]/10**EnumMainTokens[process.env.CHAIN_ID].USDT.decimals;
                let WBNB_PRICE = USDT_RESERVE/WBNB_RESERVE;
                this.CHAIN_MAIN_TOKEN_PRICE = WBNB_PRICE;
                console.log('MAIN_PRICE: ', WBNB_PRICE);
            } catch (error) {
                console.log(`[ERR UPDATING MAIN PRICE] ${error}`);
            }
            await sleep(5000);
        }
    }

    

}

module.exports = Scraper;
