// RUN APP ON MULTIPLE CORES IF NEEDED
require('dotenv').config();
const os = require("os");
const cluster = require("cluster");
const http = require('http');
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
  app.listen(PORT, () => {
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