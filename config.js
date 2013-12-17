module.exports = {
  port: 3000,
  base: 'http://localhost:3000',
  secret: 'please override in localconfig.js',

  mchost: 'localhost',

  whitelist: './whitelist.txt',

  token_expiration: 3600,//an hour

  email_from: 'DCG System <system@dcg>',
  email_subject: 'DCG: Minecraft Registration ✔',
};

var localconfig = undefined;
try {
  localconfig = require('./localconfig');
} catch( err ) {
  localconfig = {};
}
for( var prop in localconfig ) {
  module.exports[prop] = localconfig[prop];
}
