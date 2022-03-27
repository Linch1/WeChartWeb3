function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
/**
 * Instead of running an async function fo each scan trasactions, that's cause a system overload,
 * this class help managin the transactions scan between a fixed amount of workers ( childs ).
 */
 class Queue {
    constructor( childs, callback ){
        this.childs = childs;
        this.callback = callback;
        this.queue = {};
        for( let i = 0; i < childs; i ++){
            this.queue[i] = {};
            this.queue[i].length = 0;
            this.queue[i].array = [];
        };
        this.child_index = 0;
        this.start();
    }
    add(){
        if( this.child_index >= this.childs ) {
            this.child_index = 0; // reset index when overflow the childs amount
        }
        this.queue[this.child_index].array.push( [...arguments] );
        this.queue[this.child_index].length ++;
        this.child_index ++;
    }
    async process( child ){
        while( true ){
            let toScan = this.queue[child].array;
            let count = 0;
            while( count <= toScan.length - 1){
                let start = Date.now();
                let scan = toScan[0];
                
                await this.callback(...scan);
                this.queue[child].array.splice(0, 1);
                this.queue[child].length --;

                let end = (Date.now()-start)/1000;
                if( !(end <= 0.01) ) console.log('[QUEUE] Processed tx in: ',  end, this.callback.name );
                count ++;
            }
            await sleep(10);
        }
    }
    getPending(){
        let pending = 0;
        for( let child = 0; child < this.childs; child++ ){
            pending += this.queue[child].length
        }
        return pending;
    }
    start(){
        for( let child = 0; child < this.childs; child++ ){
            this.process( child );
        }
        setInterval(() => {
            let pending = this.getPending();
            if( pending > 0 ) console.log('[AWAITING TX] ', this.getPending(), this.callback.name);
        }, 500);
    }
}
module.exports = Queue;