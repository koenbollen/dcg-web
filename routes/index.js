
var nodemailer = require('nodemailer');
var redis = require("redis");
var crypto = require('crypto');

var forms = require('forms'),
    fields = forms.fields,
    validators = forms.validators;

var server = nodemailer.createTransport();

var client = redis.createClient();

var subscribeForm = forms.create({
  mail: fields.email({required: true, label: 'Email Address'}),
});
var registerForm = forms.create({
  user: fields.string({required: true, label: 'Minecraft Username'}),
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

            client.setex('dcg:token:'+token, 3600, mail, function(err, result) {
              if(err) throw err;

              var url = 'http://localhost:3000/register/'+token;

              server.sendMail({
                from: "DCG System <system@dcg>",
                to: mail,
                subject: "DCG Subscription ✔",
                text: "Please open your browser to the following location: " + url,
                html: "Click the following link to register your minecraft username: <a href=\""+url+"\">"+url+"</a>"
              }, function(err, result) {
                if(err)throw err;
                res.render('checkmail');
              });
            });
          });

        }
      });
    },
    other: function(form) {
      res.render('index', {form:form});
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
          client.multi()
            .del(key)
            .sadd('dcg:whitelist', user)
            .hset('dcg:mail', user, mail)
            .publish('dcg:update', 'dcg:whitelist')
            .exec(function(err, results) {
              if(err) throw err;
              res.render('thanks', {mail:mail, user:user});
            });
        },
        other: function(form) {
          res.render('register', {mail:mail, form:form});
        }
      });
    }
  });
};




