const {web3, web3ws, account} = require('../lib/web3');
const {setInBloom, setTopicInBloom} = require('./bloomfilter');
const getDataFromLog = require('./logs');

const BLOCKS_BUFFER_SIZE = 10;


class BlockInfo {

    constructor(blockNumber){
        this._number = blockNumber;
        this._completeOnceChecks = 0;
        this._transactions = {};
        this._logsBloom = '0x';
        this._pairs = {};
        for (let i=0; i<512; i++) {
            this._logsBloom = this._logsBloom + '0';
        }
    }

    setBlock(block) {
        this._block = block;
    }

    addLog(log, cb) {
        //this._logs.push(log);
        this._logsBloom = setInBloom(this._logsBloom, log.address);
        for (let topic of log.topics) {
            this._logsBloom = setTopicInBloom(this._logsBloom, topic);
        }
        //console.log('[STREAM]', log.transactionHash, log.name, log.transactionIndex);
        if (log.name) {
            if (!this._pairs[log.address]) this._pairs[log.address] = { events: {}, hash: log.transactionHash };
            if (log.name == 'swap') {
                //router address
                //console.log(log.transactionHash, '[STREAM]', log.returnValues)
                this._pairs[log.address].events.swap = { ...log.returnValues  }; 
            } else if (
                log.name == 'sync' && 
                (
                    //set this sync as latest if not other sync was set
                    !this._pairs[log.address].events.sync || 
                    //or it is in a more recent transaction with respect to the current sync
                    log.transactionIndex > this._pairs[log.address].events.sync.transactionIndex ||
                    //or it is in the same transaction as the current sync and it has a higher logIndex
                    (log.transactionIndex == this._pairs[log.address].events.sync.transactionIndex && log.logIndex > this._pairs[log.address].events.sync.logIndex)
                )
            ) {
                if (!this._pairs[log.address].sync) this._pairs[log.address].events.sync = {};
                //console.log('[STREAM SYNC]', log.transactionHash, log.address, log.transactionIndex );
                this._pairs[log.address].events.sync.reserve0 = log.returnValues.reserve0;
                this._pairs[log.address].events.sync.reserve1 = log.returnValues.reserve1;
                this._pairs[log.address].events.sync.transactionIndex = log.transactionIndex;
                this._pairs[log.address].events.sync.logIndex = log.logIndex;
                this._pairs[log.address].hash = log.transactionHash;
                cb(log.address, [log.returnValues.reserve0, log.returnValues.reserve1], log.transactionHash, log.blockNumber); // ON_NEW_RESERVE_FOUND
            }    
        }
    }
    
    get isCompleteOnce(){ return this.isComplete && this._completeOnceChecks++ == 0 }
    get isComplete(){ return this._block && (this._logsBloom == this._block.logsBloom) }
    get pairs() { return this._pairs;}
    get block() { return this._block;}
    get number() { return this._number;}
}

class BlockListener {
    constructor( onNewReserveFound, onNewBlockComplete ){
        this._blockInfoBuffer = [];
        this.ON_NEW_RESERVE_FOUND = onNewReserveFound; // when a new sync event is detected
        this.ON_BLOCK_RESERVES_UPDATE = onNewBlockComplete; // when a new block is fully scraped
    }

    start(){
        this._subLogs = web3ws.eth.subscribe('logs', {topics: []}, this._processLog.bind(this));            
        this._subBlockHeaders = web3ws.eth.subscribe('newBlockHeaders', this._processBlock.bind(this));
    }

    _getBlockInfo(blockNumber) {
        let blockInfo = this._blockInfoBuffer.find((bi)=> bi.number == blockNumber);
        if (!blockInfo) {
            //add it...
            blockInfo = new BlockInfo(blockNumber);
            this._blockInfoBuffer.push(blockInfo);
            if (this._blockInfoBuffer.length > BLOCKS_BUFFER_SIZE) {
                this._blockInfoBuffer.splice(0, this._blockInfoBuffer.length - BLOCKS_BUFFER_SIZE);
            }
        }
        return blockInfo;
    }

    _checkBlockCompletion(blockInfo){
        if (blockInfo.isCompleteOnce){
            this.ON_BLOCK_RESERVES_UPDATE( blockInfo.number, blockInfo.pairs );
        }
    }

    async _processLog(error, log) {

        let blockInfo = this._getBlockInfo(log.blockNumber);
        let logInfo = getDataFromLog(log);
        if (logInfo) {
            log.returnValues = logInfo;
            log.name = logInfo.name;
        }

        blockInfo.addLog(log, this.ON_NEW_RESERVE_FOUND);

        //console.log(JSON.stringify(log))
        this._checkBlockCompletion(blockInfo);
    }

    async _processBlock(error, data) {
        let blockInfo = this._getBlockInfo(data.number);
        if (!blockInfo.block) {
            blockInfo.setBlock(await web3.eth.getBlock(data.number));
            console.log("GOT NEW BLOCK " + data.number);
            this._checkBlockCompletion(blockInfo);
        }
    }
}

module.exports = BlockListener;

