const { getParams } = require("./utils");
const TokensWss = require("./sockets/Tokens");

// define all socket types and handling functions here
function setupSocketHandlers() {
  return {
    token: TokensWss(),
  };
}

// setup websocket server
function setupWebSocket(server) {
  // setup socket handlers
  const wssHandler = setupSocketHandlers();

  // upgrade will check if we have a way to handle this type of socket
  // authenticate user using the same jwt
  server.on("upgrade", async function upgrade(request, socket, head) {
    try {
      let { path } = getParams(request);
      path = path.trim();
      if (!(path in wssHandler)) {
        throw `Unknow conneciton path ${path}`;
      }
      
      // authenticate client
      // allow upgrade
      const wss = wssHandler[path];
      wss.handleUpgrade(request, socket, head, function done(ws) {
        wss.emit("connection", ws, request);
      });
    } catch (err) {
      console.log("upgrade exception", err);
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }
  });
}

module.exports = {
  setupSocketHandlers,
  setupWebSocket,
};
