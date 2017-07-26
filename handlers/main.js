var fortune = require('../lib/fortune.js');
exports.home = function(req,res){
  console.log('Home being called.');
  res.render('home');
};
exports.about = function(req,res){
  res.render('about',{
    fortune:fortune.getFortune(),
    pageTestScript:'/qa/tests-about.js'
  });
};
exports.login = function(req,res){
  res.render('login');
}