require('dotenv').config();
const Web3 = require('web3');
const scraperConfig = require('../../config');

let web3_wss = new Web3(); 
web3_wss.setProvider(new Web3.providers.WebsocketProvider( scraperConfig[process.env.CHAIN_ID].ws_provider ));

let web3_https = new Web3();
web3_https.setProvider(new Web3.providers.HttpProvider( scraperConfig[process.env.CHAIN_ID].http_provider ));



module.exports = {
    web3: web3_https,
    web3ws: web3_wss,
}