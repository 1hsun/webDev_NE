var express = require('express')
var app = express();
var handlebars = require('express3-handlebars').create({defaultLayout:'main'});

app.engine('handlebars',handlebars.engine);
app.set('view engine','handlebars');
app.set('port',process.env.PORT || 9527);
app.use(express.static(__dirname+'/public'));

var fortunes = [
	"Winter is Coming.",
	"Hear Me Roar.",
	"Fire and Blood.",
	"Our Blades Are Sharp.",
	];

//Routing
app.get('/',function(req,res){
	res.render('home')
});
app.get('/about',function(req,res){
	var randomFortune = fortunes[Math.floor(Math.random()*fortunes.length)];
	res.render('about',{fortune:randomFortune});
})
//Custom 404
app.use(function(req,res,next){
	res.status(404);
	res.render('404')
});
//Custom 500
app.use(function(err,req,res,next){
	console.error(err.stack);
	res.status(500);
	res.render('500')
})

app.listen(app.get('port'),function(){
	console.log('Express is working on http://localhost:' +
app.get('port') + '; press Ctrl-C to terminate.' );
})