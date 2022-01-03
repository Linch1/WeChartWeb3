const mongoose = require('mongoose');
const TokenBasic = require('../../server/models/token_basic');
const TokenHistory = require('../../server/models/token_history');


class Bulk {
    constructor() {
        this.BulkWriteOperations = {
            tokenHistory: {
            /*  
                tokenAddress: { 
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
            }
        } 
    }


    getHistories(){
        return this.BulkWriteOperations.tokenHistory;
    }
    getHistory( contract ){
        return this.BulkWriteOperations.tokenHistory[contract];
    }
    intializeBulkForContract( tokenAddress ){
        if(!this.BulkWriteOperations.tokenHistory[tokenAddress])
            this.BulkWriteOperations.tokenHistory[tokenAddress] = {};
    }
    intializeBulkUpdate( tokenAddress ){
        if(!this.BulkWriteOperations.tokenHistory[tokenAddress].update) {
            console.log(`[BULK ADD UPDATE] ${Object.keys(this.BulkWriteOperations.tokenHistory).length} ${tokenAddress}`);
            this.BulkWriteOperations.tokenHistory[tokenAddress].update = {
                updateOne: {
                    filter: { contract: tokenAddress },
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
     * @param {*} contract address
     * @param {*} historyToInsert object
     */
    setNewHistory( tokenAddress, historyToInsert ){
        this.BulkWriteOperations.tokenHistory[tokenAddress].insert = historyToInsert;
    }

    setTokenBulkPush( tokenAddress, path, toPush ){
        this.intializeBulkForContract( tokenAddress );
        this.intializeBulkUpdate( tokenAddress );
        let pushObj = this.BulkWriteOperations.tokenHistory[tokenAddress].update.updateOne.update['$push'];
        if( !pushObj[path] ) pushObj[path] = { $each: [] };
        pushObj[path]['$each'].push(toPush);
    }
    setTokenBulkAddToSet( tokenAddress, path, toPush ){
        this.intializeBulkForContract( tokenAddress );
        this.intializeBulkUpdate( tokenAddress );
        let addToSetObj = this.BulkWriteOperations.tokenHistory[tokenAddress].update.updateOne.update['$addToSet'];
        if( !addToSetObj[path] ) addToSetObj[path] = { $each: [] };
        addToSetObj[path]['$each'].push(toPush);
    }
    getTokenBulkPush( tokenAddress, path ){
        if( this.BulkWriteOperations.tokenHistory[tokenAddress] )
            if( this.BulkWriteOperations.tokenHistory[tokenAddress].update ){
                return this.BulkWriteOperations.tokenHistory[tokenAddress].update.updateOne.update['$push'][path] || { $each: [] };
            }
        return { $each: [] };
    }
    setTokenBulkInc( tokenAddress, path, amoutToInc ){
        this.intializeBulkForContract( tokenAddress );
        this.intializeBulkUpdate( tokenAddress );
        let incObj = this.BulkWriteOperations.tokenHistory[tokenAddress].update.updateOne.update['$inc'];
        if( !incObj[path] ) incObj[path] = 0;
        incObj[path] += amoutToInc;
    }
    setTokenBulkSet( tokenAddress, path, toSet ){
        this.intializeBulkForContract( tokenAddress );
        this.intializeBulkUpdate( tokenAddress );
        let setObj = this.BulkWriteOperations.tokenHistory[tokenAddress].update.updateOne.update['$set'];
        setObj[path] = toSet;
    }
    getTokenBulkSet( tokenAddress, path ){
        if( this.BulkWriteOperations.tokenHistory[tokenAddress] )
            if( this.BulkWriteOperations.tokenHistory[tokenAddress].update )
                return this.BulkWriteOperations.tokenHistory[tokenAddress].update.updateOne.update['$set'][path];
        return null;
    }

    async execute(){
        let toExecuteInsert = [];
        let toExecutePush = [];
        let toExecuteSet = [];

        let tokenContracts = Object.keys(this.BulkWriteOperations.tokenHistory); // get contracts to update
        let BulkWriteOperationsClone = JSON.parse(JSON.stringify(this.BulkWriteOperations));
        
        // reset bulk object
        delete this.BulkWriteOperations.tokenHistory;
        this.BulkWriteOperations.tokenHistory = {};

        for( let contract of tokenContracts ){ // populate (insert, push and set) arrays

            let toInsert = BulkWriteOperationsClone.tokenHistory[contract].insert;
            if(toInsert) toExecuteInsert.push(toInsert);

            let toUpdate = BulkWriteOperationsClone.tokenHistory[contract].update;

            if(toUpdate) {
                let clonedPush = JSON.parse(JSON.stringify(toUpdate));
                let clonedSet = JSON.parse(JSON.stringify(toUpdate));

                delete clonedPush.updateOne.update['$set'];
                delete clonedPush.updateOne.update['$inc'];
                delete clonedPush.updateOne.update['$addToSet'];
                toExecutePush.push( clonedPush );

                delete clonedSet.updateOne.update['$push'];
                toExecuteSet.push( clonedSet );
            }
        }

        // console.log("toExecuteInsert: ", JSON.stringify(toExecuteInsert));
        // console.log("\n\ntoExecutePush: ", JSON.stringify(toExecutePush));
        // console.log("\n\ntoExecuteSet: ", JSON.stringify(toExecuteSet));
       
        await TokenHistory.insertMany(toExecuteInsert);
        console.log("EXECUTED INSERT");
        await TokenHistory.bulkWrite(toExecutePush);
        console.log("EXECUTED PUSH");
        await TokenHistory.bulkWrite(toExecuteSet);
        console.log("EXECUTED SET");
        return tokenContracts;
    }
}

module.exports = Bulk;