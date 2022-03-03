function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
/**
 * Instead of running an async function fo each scan trasactions, that's cause a system overload,
 * this class help managin the transactions scan between a fixed amount of workers ( childs ).
 */
 class Queue {
    constructor( childs, scanTransactionCallback ){
        this.childs = childs;
        this.scanTransactionCallback = scanTransactionCallback;
        this.queue = {};
        for( let i = 0; i < childs; i ++){
            this.queue[i] = [];
        };
        this.child_index = 0;
        console.log( this.childs, childs );

        this.start();
    }
    add( hash, router, sender, params, pair ){
        if( this.child_index >= this.childs ) {
            this.child_index = 0; // reset index when overflow the childs amount
        }
        this.queue[this.child_index].push( [hash, router, sender, params, pair] );
        this.child_index ++;
    }
    async process( child ){
        while( true ){
            let toScan = this.queue[child];
            for( let scan of toScan ){
                
                await this.scanTransactionCallback(...scan);
            }
            await sleep(100);
        }
    }
    getPending(){
        let pending = 0;
        for( let child of Object.keys(this.queue) ){
            pending += this.queue[child].length
        }
        return pending;
    }
    start(){
        for( let child of Object.keys(this.queue) ){
            this.process( child );
        }
        setInterval(() => {
            console.log('[AWAINTG TX] ', this.getPending())
        }, 500);
    }
}
module.exports = Queue;