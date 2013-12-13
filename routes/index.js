
var nodemailer = require('nodemailer');
var redis = require('redis');
var jade = require('jade');
var crypto = require('crypto');

var config = require('../config');


var server = nodemailer.createTransport();
var client = redis.createClient();


var forms = require('forms'),
    fields = forms.fields,
    validators = forms.validators;

var bootstrap_field = function (name, object) {
    var label = object.labelHTML(name);
    var error = object.error ? '<p class="form-error-tooltip">' + object.error + '</p>' : '';
    var widget = object.widget.toHTML(name, object).replace('input', 'input class="form-control"') + error;
    return '<div class="form-group ' + (error !== '' ? 'has-error' : '')  + '">' + label + widget + '</div>';
};

var subscribeForm = forms.create({
  mail: fields.email({required: true, label: 'Email Address:'}),
});

var registerForm = forms.create({
  user: fields.string({required: true, label: ' '}),
});

exports.index = function(req, res){

  subscribeForm.handle(req, {
    success: function(form) {
      var mail = form.data.mail;

      var domain = mail.substr(mail.indexOf("@")+1);
      //console.log('domain', domain);

      client.sismember('dcg:domains', domain, function(err, result) { 
        if(err || !result) {
          res.render('error', {code: 'no-dgg-mail', message: 'your e-mail address doesn\'t belong to a company in the DutchGameGarden'});
        } else {

          crypto.randomBytes(16, function(err, buf) {
            if(err) throw err;
            var token = buf.toString('hex');

            client.setex('dcg:token:'+token, config.token_expiration, mail, function(err, result) {
              if(err) throw err;

              var url = config.base+'/register/'+token;

              server.sendMail({
                from: "DCG System <system@dcg>",
                to: mail,
                subject: "DCG: Minecraft Registration ✔",
                text: jade.renderFile('views/mail/confirm-text.jade', {url: url, mail: mail}),
                html: jade.renderFile('views/mail/confirm-html.jade', {url: url, mail: mail}),
              }, function(err, result) {
                if(err)throw err;
                res.render('mailed');
              });
            });
          });

        }
      });
    },
    other: function(form) {
      client.smembers('dcg:whitelist', function(err, members) {
        res.render('index', {form:form.toHTML(function (name, object) { return bootstrap_field(name, object); }), members:members});
      });
    }
  });
};

exports.register = function(req, res) {
  var key = 'dcg:token:'+req.params.token;
  client.get(key, function(err, mail) {
    if(err) throw err;
    if( !mail ) {
      res.render('error', {code: 'invalid-token', message: 'invalid token'});
    } else {
      registerForm.handle(req, {
        success: function(form) {
          var user = form.data.user;
          //console.log( mail, 'plays with', user );
          client.hget('dcg:bymail', mail, function(err, previous) {

            client.multi()
              .del(key)
              .srem('dcg:whitelist', previous)
              .sadd('dcg:whitelist', user)
              .hdel('dcg:byuser', user)
              .hset('dcg:byuser', user, mail)
              .hset('dcg:bymail', mail, user)
              .publish('dcg:update', 'dcg:whitelist')
              .exec(function(err, results) {
                if(err) throw err;
                res.render('thanks', {mail:mail, user:user, previous: previous});
              });
            });
        },
        other: function(form) {
          res.render('register', {mail:mail, form:form.toHTML(function (name, object) { return bootstrap_field(name, object); })});
        }
      });
    }
  });
};




