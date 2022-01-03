require('dotenv').config();
var express = require('express');
var path = require('path');
var logger = require('morgan');
var helmet = require('helmet');
var compression = require('compression'); // speed emprovement

var cookieParser = require('cookie-parser');
var cors = require('cors');

const cluster = require("cluster");

// import routes handlers
const routesTokens = require('./routes/tokens');

var configDB = require('./config/database.js');
const mongoose = require('mongoose');
mongoose.connect(configDB.url, {
  autoIndex: false,
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => { console.log('MongoDB is connected') })
.catch(err => {
  console.log('MongoDB connection unsuccessful');
  console.log(err)
});

var app = express();



//API RATE LIMIT
app.set('trust proxy', 1); // if you are under reverse proxy

// app.use(logger('combined'));
app.use(logger(`CLUSTER ${cluster.worker.id} - :remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent"`));
//app.use(logger('dev'));


app.use(express.json({limit: '50mb'}));
app.use(express.urlencoded({ extended: false, limit: '50mb' }));
app.use(compression({ level: 6, threshold: 0 }));
app.use(cors({
  origin: ['https://coinhunters.cc', 'http://localhost:3000', 'http://localhost:3001']
}));

app.use(helmet());
app.use(cookieParser());

// Mount REST on /api

// TOKENS ROUTES
app.use( '/token', routesTokens.token );
app.use( '/token/price', routesTokens.price );
app.use( '/token/history', routesTokens.history );

app.use('*', (req, res) => { res.status(500).send({status: 'ok'}) });

app.use(function(err, req, res, next) {
  res.status(500).send({
    message: err.message,
    error: {},
    meta_tags: {}
  });
});

app.get('*', function(req, res){ res.send({ status: 'Not Found'}); });

module.exports = app;