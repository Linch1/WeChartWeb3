const url = require("url");

// extract connection type from url
// we'll only consider one param for type of socket
const getParams = (request) => {
    try {
      const parsed = url.parse(request.url);
      const res = { path: parsed.pathname };
      parsed.query.split("&").forEach((param) => {
        const [k, v] = param.split("=");
        res[k] = v;
      });
      return res;
    } catch (err) {
      return "na";
    }
};

const getUniqueID = function () {
    function s4() {
        return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
    }
    return s4() + s4() + '-' + s4();
};


// initiate a ping with client
// stalled or unauthenticated clients are terminated
function setupPing(clients) {
    const interval = setInterval(() => {
      for (let client of clients.values()) {
        // terminate stalled clients
        if (client.isAlive === false || client.is_authenticated === false) {
          client.terminate();
        }
  
        // initiate ping
        client.isAlive = false;
        client.ping(() => {});
      }
    }, 15000);
  
    return interval;
  }
  
  // --- demo ---
  
  // use for client specific messages
  // each client gets an individual instance
  function individualPipeline(ctx) {
    let idx = 0;
    const interval = setInterval(() => {
      ctx.send(`client message ${idx}`);
      idx++;
    }, 5000);
    return interval;
  }
  
  // use for braodcasting messages
  // one instance for all clients
  // usage example
  function broadcastPipeline(clients) {
    let idx = 0;
    const interval = setInterval(() => {
      for (let c of clients.values()) {
        if (c.is_authenticated) {
          c.send(`broadcast message ${idx}`);
        }
      }
      idx++;
    }, 3000);
    return interval;
  }

// handle client jwt authentication
function authHandler(ctx, next) {
    ctx.is_authenticated = false; // init
    ctx.is_authenticated = true;
    console.log('Authenticating client');
    next( ctx );
}

module.exports = {
    getParams,
    setupPing,
    individualPipeline,
    broadcastPipeline,
    authHandler,
    getUniqueID
}