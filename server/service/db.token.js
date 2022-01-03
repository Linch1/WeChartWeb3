require('dotenv').config();
var TokenBasic = require('../models/token_basic');

async function findByContract( contract ){
    let tokenInfos = await TokenBasic.findOne({ contract: contract }).lean().exec();
    if( !tokenInfos || tokenInfos.name == "$NULL" ) { return null }
    return tokenInfos;
}
async function getSymbolFromContract( contract ){
    let tokenInfos = await TokenBasic.findOne({ contract: contract }).select({ symbol: 1 }).lean().exec();
    if( !tokenInfos || tokenInfos.name == "$NULL" ) { return null }
    return tokenInfos.symbol;
}
module.exports = {
    findByContract,
    getSymbolFromContract
}