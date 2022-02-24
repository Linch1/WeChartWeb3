// RUN APP ON MULTIPLE CORES IF NEEDED
require('dotenv').config();
const os = require("os");
const cluster = require("cluster");
const http = require('http');
const { setupWebSocket } = require('./websocket');
const PORT = process.env.PORT || 4060;
const clusterWorkerSize = os.cpus().length ;
console.log("PORT: " + PORT)
console.log("WORKERS: " + clusterWorkerSize)

if (cluster.isMaster) {
  
  // Create a worker for each CPU
  for (var i = 0; i < clusterWorkerSize; i += 1) {
      cluster.fork();
  }

  // Listen for dying workers
  cluster.on('exit', function (worker) {
      // Replace the dead worker, we're not sentimental
      console.log('Worker ' + worker.id + ' died :(');
      cluster.fork();
  });

} else {
  const app = require('./server');


  // app should be your express app
  const server = http.createServer(app);

  // pass the same server to our websocket setup function
  // the websocket server will the run on the same port
  // accepting ws:// connections
  setupWebSocket(server);

  server.listen(PORT, () => {
    console.log("Express server listening on port " + PORT);
    console.log('Worker ' + cluster.worker.id + ' running!');
  });

}


/*
const app = require('./server');
app.listen(PORT, () => {
  console.log("Express server listening on port " + PORT);
});
*/