const BulkNormal = require("./BulkNormal");
const BulkTime = require("./BulkTime");

/**
 * To optimize the write operations to the db, mostly intra-minute price changes are made inside this Bulk strcutures.
 * Every minute change ( for example from 16:04pm to 16:05pm ) the datas inside this structures are pushed to the database.
 */
class Bulk {
    constructor( cache ){
        this.bulk_normal = new BulkNormal();
        this.bulk_time = new BulkTime( cache );
    }
    async execute(){
        let contracts = await this.bulk_normal.execute();
        contracts = [ ...(await this.bulk_time.execute()), ...contracts ];
        return contracts;
    }
}

module.exports = Bulk;