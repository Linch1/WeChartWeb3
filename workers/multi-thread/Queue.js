const { Worker } = require('worker_threads');
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
/**
 * Instead of running an async function fo each scan trasactions, that's cause a system overload,
 * this class help managin the transactions scan between a fixed amount of workers ( childs ).
 */
 class Queue {
    constructor( childs, scraper ){
        this.childs = childs;
        this.scraper = scraper;
        this.queue = {};
        for( let i = 0; i < childs; i ++){
            
            this.queue[i] = {
                worker: new Worker( process.cwd() + '/workers/scraper-worker.js', { workerData: { scraper: scraper }}),
                pending: 0
            };
            this.queue[i].worker.on('message', (value) => {
                console.log(`received from ${i}:`, value);
                if( value.scanned == true ) this.queue[i].pending --;
            });
        };
        this.child_index = 0;
        console.log( this.childs, childs );

        this.start();
    }
    add( tx, pair ){
        if( this.child_index >= this.childs ) {
            this.child_index = 0; // reset index when overflow the childs amount
        }
        this.queue[this.child_index].worker.postMessage({newTx: [tx, pair]});
        this.queue[this.child_index].pending ++;
        this.child_index ++;
    }
 
    getPending(){
        let pending = 0;
        for( let child of Object.keys(this.queue) ){
            pending += this.queue[child].pending
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