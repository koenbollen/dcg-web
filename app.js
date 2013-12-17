
var express = require('express');
var routes = require('./routes');
var http = require('http');
var path = require('path');
var redis = require('redis');
var fs = require('fs');

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
    ip: req.connection.remoteAddress,
    message: msg,
  };
  if(err !== undefined) {
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
        if(err) throw err;
        //console.log(config.whitelist+' updated!');
      });
    });
  }
});


