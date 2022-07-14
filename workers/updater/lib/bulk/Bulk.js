const Router = require('../../../../server/models/routers');
const TokenBasic = require('../../../../server/models/token_basic');
const TokenHistory = require('../../../../server/models/token_history');
const HistoryPrices = require('../../../../server/models/history_prices');
const HistoryTransactions = require('../../../../server/models/history_transactions');
const EnumBulkTypes = require('../../../../enum/bulk.records.type');

let modelsMapping = {
    [EnumBulkTypes.TOKEN_HISTORY]: TokenHistory,
    [EnumBulkTypes.HISTORY_PRICE]: HistoryPrices,
    [EnumBulkTypes.HISOTRY_TRANSACTION]: HistoryTransactions,
    [EnumBulkTypes.TOKEN_BASIC]: TokenBasic,
    [EnumBulkTypes.ROUTERS]: Router,
}


const BulkNormal = require("./BulkNormal");
const BulkTime = require("./BulkTime");


/**
 * To optimize the write operations to the db, mostly intra-minute price changes are made inside this Bulk strcutures.
 * Every minute change ( for example from 16:04pm to 16:05pm ) the datas inside this structures are pushed to the database.
 */
class Bulk {
    constructor( cache ){
        this.bulk_normal = new BulkNormal( modelsMapping );
        this.bulk_time = new BulkTime( cache, modelsMapping );
    }
    async execute(){
        let contracts = await this.bulk_normal.execute();
        contracts = [ ...(await this.bulk_time.execute()), ...contracts ];
        return contracts;
    }
}

module.exports = Bulk;