class Cache {
    constructor () {
        this.TOKENS_CACHE_MAX_SIZE = 5000;
        this.TOKENS_CACHE_SIZE = 0;
        this.HISTORIES_CACHE_SIZE = 0;
        this.PRICES_CACHE_SIZE = 0;

        this.TOKENS_CACHE_ORDER = [];
        this.HISTORIES_CACHE_ORDER = [];
        this.PRICES_CACHE_ORDER = [];

        this.CACHE = {
            token: {}, // [tokenAddress] => TokenBasic object
            tokenHistory: {}, // [pairAddress] => TokenHistory object of this pair
            historyPrice: {} // [pairAddress] => Latest History Price object of this pair
        };

    }
    getTokenHistory( pair ){
        return this.CACHE.tokenHistory[pair];
    }
    getHistoryPrice( pair ){
        return this.CACHE.historyPrice[pair];
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
    getSizePirceHistory(){
        return this.PRICES_CACHE_SIZE;
    }
    setToken( tokenAddress, tokenInfos ){
        let cacheSize = this.getSizeTokens();
        if( this.TOKENS_CACHE_ORDER.includes(tokenAddress) ) return;

        console.log(`[CACHE SIZE TOKEN] ${cacheSize}`);
        if( cacheSize > this.TOKENS_CACHE_MAX_SIZE ){ // keeps the tokens cache with a fixed size
            let toRemove = this.TOKENS_CACHE_ORDER.shift();
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
    setHistory( pair, history ){
        let cacheSize = this.getSizeHistories();
        if( cacheSize > this.TOKENS_CACHE_MAX_SIZE ){ // keeps the tokens cache with a fixed size
            let toRemove = this.HISTORIES_CACHE_ORDER.shift();
            delete this.CACHE.tokenHistory[toRemove];
        }
        this.HISTORIES_CACHE_ORDER.push( pair );
        this.CACHE.tokenHistory[pair] = history ;
    }

    setHistoryPrice( pair, history ){
        let cacheSize = this.getSizePirceHistory();
        if( cacheSize > this.TOKENS_CACHE_MAX_SIZE ){ // keeps the tokens cache with a fixed size
            let toRemove = this.PRICES_CACHE_ORDER.shift();
            delete this.CACHE.historyPrice[toRemove];
        }
        this.PRICES_CACHE_ORDER.push( pair );
        this.CACHE.historyPrice[pair] = history ;
    }
}

module.exports = Cache;