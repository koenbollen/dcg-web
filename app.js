
var express = require('express');
var routes = require('./routes');
var http = require('http');
var path = require('path');
var redis = require('redis');
var fs = require('fs');
var exec = require('child_process').exec;
var spawn = require('child_process').spawn;

var config = require('./config');

// Redis conncetions:
pubsub = redis.createClient()
db = redis.createClient()

var app = express();

// all environments
if(config.trustproxy) {
  app.enable('trust proxy');
}
app.set('port', process.env.PORT || config.port);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');
app.use(express.json());
app.use(express.urlencoded());
app.use(express.methodOverride());

// development only
if ('development' == app.get('env')) {
  app.use('/static', express.static(path.join(__dirname, 'public')));
  app.use(express.errorHandler());
  app.use(express.logger('dev'));
}

app.log = function( req, msg, err ) {
  var info = {
    date: new Date(),
    message: msg,
  };
  if(req !== undefined && req !== null) {
    info.ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  }
  if(err !== undefined && err !== null) {
    info.err = err;
  }
  if( 'development' == app.get('env') ) {
    console.log('log event:', info);
  }
  db.lpush('dcg:events', JSON.stringify( info ));
}

app.use(function(req, res, next) {
  req.app = app;
  req.log = app.log.bind(app, req);
  res.locals.title = "Dutch Craft Garden";
  res.locals.subtitle = "Community Minecraft";
  res.locals.base = config.base;
  res.locals.config = config;
  next();
});

app.use(app.router);

app.all('/', routes.index);
app.all('/register/:token', routes.register);

http.createServer(app).listen(app.get('port'), function(){
  console.log('dcg-web server listening on port ' + app.get('port'));
});


// log tailer:
var path = config.logpath;
var tail = spawn('tail', ['-F'].concat(path));
tail.stdout.on('data', function (data) {

  var lines = data.toString('utf-8');
  lines = lines.split('\n');
  lines.pop();
  lines.forEach(function (line) {
    var now = new Date();

    var result = /: ([^ ]+) joined the game/.exec(line);
    if( result ) {
      var nickname = result[1];
      console.log(line);
      console.log(nickname, "joined the game");
      db.multi()
        .lrem('dcg:online', 0, nickname)
        .lrem('dcg:latest', 0, nickname)
        .lpush('dcg:online', nickname)
        .exec(function(err, results) {
          if(err) throw err;
        });
    }

    result = /: ([^ ]+) left the game/.exec(line);
    if( result ) {
      var nickname = result[1];
      console.log(nickname, "left");
      db.multi()
        .lrem('dcg:online', 0, nickname)
        .lrem('dcg:latest', 0, nickname)
        .lpush('dcg:latest', nickname)
        .exec(function(err, results) {
          if(err) throw err;
        });
    }

  });
});

process.on('exit', function () {
  tail.kill();
});

// Update listener:

pubsub.subscribe('dcg:update');
pubsub.on('message', function(channel, message) {
  console.log(channel, message);
  if(message == 'dcg:whitelist') {
    db.smembers('dcg:whitelist', function(err, members) {
      if(err) throw err;
      fs.writeFile( config.whitelist, members.join('\n')+'\n', {
        encoding: 'utf8',
        mode: 0640,
      }, function(err) {
        exec('/usr/local/bin/msm dcg cmd whitelist reload', function(err2, stdout, stderr) {
          app.log(undefined, 'whitelist updated: ' + members.length, err);
        });
        //console.log(config.whitelist+' updated!');
      });
    });
  }
});


