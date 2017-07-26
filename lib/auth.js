var User = require('../models/user.js'),
  passport = require('passport'),
  GoogleStrategy = require('passport-google-oauth').OAuth2Strategy,
  FacebookStrategy = require('passport-facebook').Strategy;

passport.serializeUser(function(user, done) {
  done(null, user._id);
});

passport.deserializeUser(function(id, done) {
  User.findById(id, function(err, user) {
    if (err || !user) return done(err, null);
    done(null, user);
  });
});
//login redirect.
module.exports = function(app, options) {
  if (!options.successRedirect)
    options.successRedirect = '/account';
  if (!options.failureRedirect)
    options.failureRedirect = '/login';

  return { //init & registerRoutes
    init: function() {
      var env = app.get('env');
      var config = options.providers; //authProviders defined at mdlk.

      //configure Facebook strategy
      passport.use(new FacebookStrategy({
          clientID: config.facebook[env].appId,
          clientSecret: config.facebook[env].appSecret,
//           callbackURL: (options.baseURL || '') + '/auth/facebook/callback',
        callbackURL: 'http://port-9527.testcon-chenesing10629.codeanyapp.com/auth/facebook/callback',
        },
        function(accessToken, refreshToken, profile, done) {
          var authId = 'facebook:' + profile.id; //prefix it for avoiding collide with twitterID||GoogleID       
          User.findOne({
            authId: authId
          }, function(err, user) { //DB searching.
            if (err) return done(err, null);
            if (user) return done(null, user); //if exist.
            //if not exist; new one and save it.
            user = new User({
              authId: authId,
              name: profile.displayName,
              created: Date.now(),
              role: 'customer',
            });
            user.save(function(err) {
              if (err) return done(err, null);
              done(null, user);
            });
          });
        }));
      //configure Google strategy.
      //        passport.use(new GoogleStrategy({
      // //          returnURL:'https://'+ host + '/auth/google/return',
      // //          realm: 'https://'+ host +'/',
      //          clientID: config.google[env].clientID,
      //          clientSecret: config.google[env].clientSecret,
      //          callbackURL: (options.baseUrl || '') + '/auth/google/callback',
      //        },function(token, tokenSecret, profile, done){
      //          var authId = 'google:' + profile.id;
      //          User.findOne({ authId: authId }, function(err, user){
      //            if(err) return done(err, null);
      //            if(user) return done(null, user);
      //            user = new User({
      //              authId: authId,
      //              name: profile.displayName,
      //              created: Date.now(),
      //              role: 'customer',
      //            });
      //            user.save(function(err){
      //              if(err) return done(err, null);
      //              done(null, user);
      //            });
      //          });
      //        }));
      // //          function(identifier, profile, done){
      // //          var authId = 'google:'+ identifier;
      // //          User.findOne({authId:authId},function(err,user){
      // //            if(err) return done(err,null);
      // //            if(user)return done(null, user);//if exist.
      // //            //if not, new one and save it.
      // //            user = new User({
      // //              authId: authId,
      // //              name: profile.displayName,
      // //              created: Date.now(),
      // //              role:'customer',
      // //            });
      // //            user.save(function(err){
      // //              if(err) return done(err, null);
      // //              done(null, user);
      // //            });
      // //          });
      // //        }));
      app.use(passport.initialize());
      app.use(passport.session());
    },

    registerRoutes: function() {
      //register Facebook routes
      app.get('/auth/facebook', function(req, res, next) {
        console.log('baseURL: '+options.baseURL);
        if(req.query.redirect) req.session.authRedirect = req.query.redirect;
                 passport.authenticate('facebook')(req,res,next);
//         passport.authenticate('facebook', {
//           callbackURL: '/auth/facebook/callback?redirect=' + encodeURLComponent(req.query.redirect),
//         })(req, res, next);
      });
      app.get('/auth/facebook/callback',passport.authenticate('facebook', 
              { failureRedirect: options.failureRedirect }), 
              function(req, res) {
               var redirect = req.session.authRedirect;
               if (redirect) delete req.sessoin.authRedirect;
               res.redirect(303, redirect || options.successRedirect);
               //p.a('target','failure','success') //set function to cover next() as default.
               }
             );
      //register Google routes.
      //        app.get('/auth/google',function(req,res,next){
      //            if(req.query.redirect) req.session.authRedirect = req.query.redirect;
      //            passport.authenticate('google',{ scope:'profile' })(req,res,next);
      //        });
      //        app.get('/auth/google/callback',passport.authenticate('google',{ failuerRedirect: options.failureRedirect },
      //         function(req,res){
      //          var redirect = req.session.authRedirect;
      //          if(redirect) delete req.session.authRedirect;
      //          res.redirect(303, req.query.redirect || options.successRedirect); 
      //         }
      //        ));
    },
  };
};