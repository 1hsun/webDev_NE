var main = require('./handlers/main.js');
var dealers = require('./handlers/dealers.js');

module.exports = function(app){
  app.get('/',main.home);
  app.get('/about',main.about);
  app.get('/login',main.login);
  app.get('/dealers',dealers.home);
};