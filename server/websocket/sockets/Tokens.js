const WebSocket = require("ws");
const { findTransactionsGteTime } = require("../../service/db.history.transaction");

const {
  individualPipeline,
  broadcastPipeline,
  authHandler,
  setupPing,
  getParams,
  getUniqueID
} = require("../utils");

let clients = {};
let tokens = {}; // ctx.id: [token, index];
let retriveTime = Date.now()/1000;
let retrivedTx = {};

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
function broadcastTransactions(){
  let tokensTx = Object.keys(retrivedTx);
  for( let token of tokensTx ){
    // console.log(` ${token} with ${clients[token] ? clients[token].length : 0} CLIENTS `);
    if(!clients[token]) continue;
    if( clients[token].length ){
      for( let c of clients[token]){
        if (c.is_authenticated) { 
          c.send( 
            JSON.stringify({
              transactions: retrivedTx[token] 
            })
          );
        }
      }
    }
  }
}

// websocket handling functions
function TokensWss() {
  const wss = new WebSocket.Server({ noServer: true });

  async function retriveTransactions() {
    let retriveTime = Date.now()/1000;
    while( true ){
      
      let transactions = await findTransactionsGteTime(retriveTime);
      retrivedTx = {}; // reset the object
      for( let tokenTx of transactions ) retrivedTx[tokenTx.token] = tokenTx.docs; // populate it with new transactions
      console.log(`Broadcasting to ${wss.clients.size} clients ${Object.keys(retrivedTx).length}`)
      broadcastTransactions(); // send all the new transactions in broadcast
      
      if(Object.keys(retrivedTx).length) // increase the time ONLY if some transaction si found
        retriveTime = Date.now()/1000;
        
      await sleep( 1000 * process.env.WRITE_TO_DB_SECONDS );
    }
  }
  retriveTransactions();

  // establish connection
  wss.on("connection", (ctx, request) => {
    console.log("connected", wss.clients.size);

    ctx.id = getUniqueID();

    // setup authentication
    authHandler(ctx, () => {
      let { token } = getParams(request);
      token = token;
      if( !clients[token] ) clients[token] = [];
      clients[token].push(ctx);
      tokens[ctx.id] = [token, clients[token].length - 1];
      registerActions(ctx)
    });

    ctx.send("connection established");

    ctx.on("pong", () => {
      ctx.isAlive = true;
    });
    
  });

  // handle stalled connections
  setupPing(wss.clients);

  return wss;
}

// this function is invoked after successfull auth
function registerActions(ctx) {

  // setup individual pipeline
  // const interval = individualPipeline(ctx);

  ctx.on("close", () => {
    let [token, index] = tokens[ctx.id];

    clients[token].splice(index, 1);
    delete tokens[ctx.id];

    console.log('Killing connection');
    // clearInterval(interval); // individual pipeline interval
  });

  // register new message handler
  ctx.on("message", (message) => {
    console.log('Recived message: ', message)
    ctx.send(`echo: ${message}`);
  });
}




module.exports = TokensWss;