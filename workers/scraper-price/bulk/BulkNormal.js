const mongoose = require('mongoose');

const TokenHistory = require('../../../server/models/token_history');
const HistoryPrice = require('../../../server/models/history_prices');
const HistoryTransaction = require('../../../server/models/history_transactions');
const EnumBulkTypes = require('../../../enum/bulk.records.type');

let modelsMapping = {
    [EnumBulkTypes.TOKEN_HISTORY]: TokenHistory,
    [EnumBulkTypes.HISTORY_PRICE]: HistoryPrice,
    [EnumBulkTypes.HISOTRY_TRANSACTION]: HistoryTransaction
}

class BulkNormal {
    constructor() {
        this.BulkWriteOperations = {
            tokenHistory: {
            /*  
                pair: { 
                    insert: {
                        name: 'Eddard Stark',
                        title: 'Warden of the North'
                    }, 
                    update: {
                        updateOne: {
                        filter: { name: 'Eddard Stark' },
                        // If you were using the MongoDB driver directly, you'd need to do
                        // `update: { $set: { title: ... } }` but mongoose adds $set for
                        // you.
                        update: { title: 'Hand of the King' }
                        }
                    },
                    delete:  {
                        deleteOne: {
                            {
                                filter: { name: 'Eddard Stark' }
                            }
                        }
                    }
                } 
            */
            },
            historyPrice: {},
            historyTransacton: {}
        } 
    }


    getHistories(type){
        return this.BulkWriteOperations[type];
    }
    getHistory( pair, type ){
        return this.BulkWriteOperations[type][pair];
    }
    intializeBulkForContract( pair, type ){
        if(!this.BulkWriteOperations[type][pair])
            this.BulkWriteOperations[type][pair] = {};
    }
    intializeBulkUpdate( pair, type ){
        if(!this.BulkWriteOperations[type][pair].update) {
            console.log(`[BULK ADD UPDATE ${type}] ${Object.keys(this.BulkWriteOperations[type]).length} ${pair}`);
            this.BulkWriteOperations[type][pair].update = {
                updateOne: {
                    filter: { pair: pair },
                    update: { 
                        $push: { }, 
                        $addToSet: { },
                        $inc: { },
                        $set: { },
                    }
                }
            };
        }
    }
   
    /**
     * @description Add inside the bulk operations an insert 
     * @param {*} pair address
     * @param {*} historyToInsert object
     */
    setNewDocument( pair, type, record ){
        this.intializeBulkForContract( pair, type );
        this.BulkWriteOperations[type][pair].insert = record;
    }

    setTokenBulkPush( pair, type, path, toPush ){
        this.intializeBulkForContract( pair, type );
        this.intializeBulkUpdate( pair, type );
        let pushObj = this.BulkWriteOperations[type][pair].update.updateOne.update['$push'];
        if( !pushObj[path] ) pushObj[path] = { $each: [] };
        pushObj[path]['$each'].push(toPush);
    }
    setTokenBulkAddToSet( pair, type, path, toPush ){
        this.intializeBulkForContract( pair, type );
        this.intializeBulkUpdate( pair, type );
        let addToSetObj = this.BulkWriteOperations[type][pair].update.updateOne.update['$addToSet'];
        if( !addToSetObj[path] ) addToSetObj[path] = { $each: [] };
        addToSetObj[path]['$each'].push(toPush);
    }
    getTokenBulkPush( pair, type, path ){
        if( this.BulkWriteOperations[type][pair] )
            if( this.BulkWriteOperations[type][pair].update ){
                return this.BulkWriteOperations[type][pair].update.updateOne.update['$push'][path] || { $each: [] };
            }
        return { $each: [] };
    }
    setTokenBulkInc( pair, type, path, amoutToInc ){
        this.intializeBulkForContract( pair, type );
        this.intializeBulkUpdate( pair, type );
        let incObj = this.BulkWriteOperations[type][pair].update.updateOne.update['$inc'];
        if( !incObj[path] ) incObj[path] = 0;
        incObj[path] += amoutToInc;
    }
    setTokenBulkSet( pair, type, path, toSet ){
        this.intializeBulkForContract( pair, type );
        this.intializeBulkUpdate( pair, type );
        let setObj = this.BulkWriteOperations[type][pair].update.updateOne.update['$set'];
        setObj[path] = toSet;
    }
    getTokenBulkSet( pair, type, path ){
        if( this.BulkWriteOperations[type][pair] )
            if( this.BulkWriteOperations[type][pair].update )
                return this.BulkWriteOperations[type][pair].update.updateOne.update['$set'][path];
        return null;
    }
    getTokenBulkInsert( pair, type ){
        if( this.BulkWriteOperations[type][pair] )
            return this.BulkWriteOperations[type][pair].insert;
        return null;
    }
    

    async execute(){
        let updatedContracts = [];
        for( let typeKey in EnumBulkTypes ){
            let type = EnumBulkTypes[typeKey];
            updatedContracts = [ ...( await this.executeUtil( type, modelsMapping[type] ) ), ...updatedContracts ];
        }
        return updatedContracts;
    }

    async executeUtil( type, model ){

        if(!type || !model) console.log(`[ERROR EXECUTING BUL UPDATES] `, type, model );

        let toExecuteInsert = [];
        let toExecutePush = [];
        let toExecuteSet = [];

        let tokenContracts = Object.keys(this.BulkWriteOperations[type]); // get contracts to update
        let BulkWriteOperationsClone = JSON.parse(JSON.stringify(this.BulkWriteOperations[type]));
        
        // reset bulk object
        delete this.BulkWriteOperations[type];
        this.BulkWriteOperations[type]= {};

        for( let contract of tokenContracts ){ // populate (insert, push and set) arrays

            let toInsert = BulkWriteOperationsClone[contract].insert;
            if(toInsert) toExecuteInsert.push(toInsert);

            let toUpdate = BulkWriteOperationsClone[contract].update;

            if(toUpdate) {
                // clear empty update fields
                if( !Object.keys(toUpdate.updateOne.update['$set']).length ) delete toUpdate.updateOne.update['$set'];
                if( !Object.keys(toUpdate.updateOne.update['$inc']).length ) delete toUpdate.updateOne.update['$inc'];
                if( !Object.keys(toUpdate.updateOne.update['$push']).length ) delete toUpdate.updateOne.update['$push'];
                if( !Object.keys(toUpdate.updateOne.update['$addToSet']).length ) delete toUpdate.updateOne.update['$addToSet'];

                let clonedPush = JSON.parse(JSON.stringify(toUpdate));
                let clonedSet = JSON.parse(JSON.stringify(toUpdate));

                if( clonedPush.updateOne.update['$push']  ){
                    delete clonedPush.updateOne.update['$set'];
                    delete clonedPush.updateOne.update['$inc'];
                    delete clonedPush.updateOne.update['$addToSet'];
                    toExecutePush.push( clonedPush );
                }

                if( clonedPush.updateOne.update['$inc'] || clonedPush.updateOne.update['$set'] ||  clonedPush.updateOne.update['$addToSet'] ){
                    delete clonedSet.updateOne.update['$push'];
                    toExecuteSet.push( clonedSet );
                }
            }
        }

        console.log( type, "toExecuteInsert: ", JSON.stringify(toExecuteInsert));
        console.log( type, "\n\ntoExecutePush: ", JSON.stringify(toExecutePush));
        console.log( type, "\n\ntoExecuteSet: ", JSON.stringify(toExecuteSet));
       
        await model.insertMany(toExecuteInsert);
        console.log("EXECUTED INSERT");
        await model.bulkWrite(toExecutePush);
        console.log("EXECUTED PUSH");
        await model.bulkWrite(toExecuteSet);
        console.log("EXECUTED SET");
        return tokenContracts;
    }
}

module.exports = BulkNormal;