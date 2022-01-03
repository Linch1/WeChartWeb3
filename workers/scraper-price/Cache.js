const EnumChainId = require("../../enum/chain.id");
const EnumMainTokens = require("../../enum/mainTokens");

function checkIfArrayIsUnique(myArray) {
    return myArray.length === new Set(myArray).size;
}
class Cache {
    constructor () {
        this.TOKENS_CACHE_MAX_SIZE = 2000;
        this.TOKENS_CACHE_SIZE = 0;
        this.HISTORIES_CACHE_SIZE = 0;

        this.TOKENS_CACHE_ORDER = [];
        this.HISTORIES_CACHE_ORDER = [];

        this.CACHE = {
            token: {}, // [tokenAddress] => TokenBasic object
            tokenHistory: {} // [tokenAddress] => { [routerAddress]: { [pairAddress]:  TokenHistory object of this pair }}
        };

    }
    getTokenHistory( token, router, pair ){
        let tokenHistory = this.CACHE.tokenHistory[token];
        let routerHistory = tokenHistory ? tokenHistory[router] : null;
        let pairHistory = routerHistory ? routerHistory[pair] : null;
        return pairHistory;
    }
    getToken( contract ){
        return this.CACHE.token[contract];
    }
    getSizeTokens(){
        return this.TOKENS_CACHE_SIZE;
    }
    getSizeHistories(){
        return this.HISTORIES_CACHE_SIZE;
    }
    setToken( tokenAddress, tokenInfos ){
        let cacheSize = this.getSizeTokens();
        if( this.TOKENS_CACHE_ORDER.includes(tokenAddress) ) return;

        console.log(`[CACHE SIZE TOKEN] ${cacheSize}`);
        if( cacheSize > this.TOKENS_CACHE_MAX_SIZE ){ // keeps the tokens cache with a fixed size
            let toRemove = this.TOKENS_CACHE_ORDER.shift();
            if( toRemove === EnumMainTokens[EnumChainId.BSC].WBNB.address ) { // PICK ANOTHER ONE TO REMOVE IF IT WAS BNB ADDRESS
                this.TOKENS_CACHE_ORDER.push(EnumMainTokens[EnumChainId.BSC].WBNB);
                toRemove = this.TOKENS_CACHE_ORDER.shift();
            }
            delete this.CACHE.token[toRemove];
            this.TOKENS_CACHE_SIZE --;
        }
        if(tokenInfos) {
            this.TOKENS_CACHE_ORDER.push( tokenAddress );
            this.CACHE.token[tokenAddress] = tokenInfos;
        }
        else {
            this.CACHE.token[tokenAddress] = { notFound: true, date: Date.now() };
        }
        this.TOKENS_CACHE_SIZE ++;
    }
    // HANDLE TOKEN HISTORY CACHE
    setHistory( token, router, pair, history ){
        let cacheSize = this.getSizeHistories();
        if( cacheSize > this.TOKENS_CACHE_MAX_SIZE ){ // keeps the tokens cache with a fixed size
            let toRemove = this.HISTORIES_CACHE_ORDER.shift();
            if( toRemove === EnumMainTokens[EnumChainId.BSC].WBNB.address ) { // PICK ANOTHER ONE TO REMOVE IF IT WAS BNB ADDRESS
                this.HISTORIES_CACHE_ORDER.push(EnumMainTokens[EnumChainId.BSC].WBNB);
                toRemove = this.HISTORIES_CACHE_ORDER.shift();
            }
            delete this.CACHE.tokenHistory[toRemove.token][toRemove.router][toRemove.pair];
        }
        this.HISTORIES_CACHE_ORDER.push( { token: token, router: router, pair: pair } );
        if(!this.CACHE.tokenHistory[token]) this.CACHE.tokenHistory[token] = {} ;
        if(!this.CACHE.tokenHistory[token][router]) this.CACHE.tokenHistory[token][router] = {} ;
        this.CACHE.tokenHistory[token][router][pair] = history;
    }
    
    
    
}

module.exports = Cache;