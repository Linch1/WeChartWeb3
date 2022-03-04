
var Routers = require('../models/routers');
async function findRouters( filter ){
    let documents = await Routers.find(filter).lean().exec();
    if(!documents.length) return [];
    return documents;
}
async function findRoutersValid(){
    return await findRouters({valid: true});
}
module.exports = {
    findRouters,
    findRoutersValid
}