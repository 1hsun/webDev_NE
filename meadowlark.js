var express = require('express'),
	http = require('http'),
	app = express();
var bodyParser  = require('body-parser');
var formidable = require('formidable');
var jqupload = require('jquery-file-upload-middleware');
var nodemailer = require('nodemailer');
var loadtest = require('loadtest');
var expect = require('chai').expect;

//=====lib connected.=====
var credentials = require('./credentials.js');
var emailService = require('./lib/email.js')(credentials);
var cartValidation = require('./lib/cartValidation.js');
var fortune = require('./lib/fortune.js');//fortune wards.
var getWeatherData = require('./lib/weatherdata.js');

//=====partials online.=====
var handlebars = require('express3-handlebars').create({
        defaultLayout:'main',
        helpers: {
            section: function(name, options){
                if(!this._sections){
                    this._sections = {};
                }
                this._sections[name] = options.fn(this);
                return null;
            }
        }
    });

var VALID_EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
//=====nodemailer config=====
var mailTransport = nodemailer.createTransport({
	service:'Gmail',
	auth:{
		user:credentials.gmail.user,
		pass:credentials.gmail.password,
	}
});

//=====ch12 Morgan/express-logger=====
switch(app.get('env')){
	case 'development':
		app.use(require('morgan')('dev'));
		break;
	case 'production':
		app.use(require('express-logger')({path:__dirname + '/log/requests.log'}));
		break;
}

app.disable('x-powered-by'); //hide Express Server header info
app.engine('handlebars',handlebars.engine);//layout default main.
app.set('view engine','handlebars');
app.set('port',process.env.PORT || 9527);

app.use(function(req,res,next){//domain for every request.
	var domain = require('domain').create();
	domain.on('error',function(err){
		console.error('Domain Error Caught\n',err.stack);
		try {
			setTimeout(function(){
				console.error('Failsafe shutdown.');
				process.exit(1);//reboot after disconnect in 5 secs as safe switch.
			},5000);

			var worker = require('cluster').worker;
			if(worker) worker.disconnect();//kickout the connection
			server.close();//shut all connections.

			try {
				next(err);
			}catch(err){
				console.error('Express error mechanism failed. \n', err.stack);
				res.statusCode = 500;
				res.setHeader('content-type','text/plain');
				res.end('Server error');
			}
		}catch(err){
			console.error('Unable to send 500 response. \n',err.stack);
		}
	});
	domain.add(req);//add req and res objects to domain.
	domain.add(res);
	domain.run(next);//execute the rest of 
});

app.use(express.static(__dirname+'/public'));
app.use(require('serve-favicon')('./public/img/favicon.ico'));
// request parsing middleware. replacing 'app.use(require('body-parser')());')
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

//cookie credentializing through cookie parser.
app.use(require('cookie-parser')(credentials.cookieSecret));
app.use(require('express-session')({
	resave: false,
	saveUninitialized:false,
	secret: credentials.cookieSecret,
}));
app.use(require('csurf')());//cross-site request forgery using express-session.
app.use(function (req, res, next) {//Keep your server alive, cluster assingment logging.
	var cluster = require('cluster');
	if (cluster.isWorker) 
		console.log('Worker %d received request',cluster.worker.id);
	next();
});
app.use(function(req,res,next){//flash msg through session.
	res.locals.flash = req.session.flash;
	delete req.session.flash;
	next();
});
//=====Testing=====
app.use(function(req,res,next){
	res.locals.showTests = app.get('env') !== 'production' && req.query.test === '1';
	next();
});
//=====weather data collecting=====
app.use(function(req,res,next){
	if(!res.locals.partials) res.locals.partials = {};
	res.locals.partials.weather = getWeatherData();
	next();
});
//=====ch09 middleware testing=====
app.use(cartValidation.checkWaivers);
app.use(cartValidation.checkGuestCounts);

//=====MongoDB=====
var mongoose = require('mongoose');
var opts = {//optional, simply make sure keepAlive.
		server:{ socketOptions:{ keepAlive:1 } }
	};
switch(app.get('env')){
	case 'development':
		mongoose.connect(credentials.mongo.development.connectionString,opts);
		break;
	case 'production':
		mongoose.connect(credentials.mongo.production.connectionString,opts);
		break;
	default:
		throw new Error('Execution Environment Unsettled: '+ app.get('env'));
}
var Vacation = require('./models/vacation.js');

Vacation.find(function(err,vacations){
	if(vacations.length) return;

	new Vacation({
		name: 'Hood River Day Trip',
		slug: 'hood-river-day-trip',
		category: 'Day Trip',
		sku: 'HR199',
		description: 'Spend a day sailing on the Columbia and ' +
		'enjoying craft beers in Hood River!',
		priceInCents: 9995,
		tags: ['day trip', 'hood river', 'sailing', 'windsurfing', 'breweries'],
		inSeason: true,
		maximumGuests: 16,
		available: true,
		packagesSold: 0,
	}).save();
	new Vacation({
		name: 'Oregon Coast Getaway',
		slug: 'oregon-coast-getaway',
		category: 'Weekend Getaway',
		sku: 'OC39',
		description: 'Enjoy the ocean air and quaint coastal towns!',
		priceInCents: 269995,
		tags: ['weekend getaway', 'oregon coast', 'beachcombing'],
		inSeason: false,
		maximumGuests: 8,
		available: true,
		packagesSold: 0,
	}).save();
	new Vacation({
		name: 'Rock Climbing in Bend',
		slug: 'rock-climbing-in-bend',
		category: 'Adventure',
		sku: 'B99',
		description: 'Experience the thrill of climbing in the high desert.',
		priceInCents: 289995,
		tags: ['weekend getaway', 'bend', 'high desert', 'rock climbing'],
		inSeason: true,
		requiresWaiver: true,
		maximumGuests: 4,
		available: false,
		packagesSold: 0,
		notes: 'The tour guide is currently recovering from a skiing accident.',
	}).save();
});

var VacationInSeasonListener = require('./models/vacationInSeasonListener.js');


//=====Routing=====
//DB data retrieve
app.get('/vacations',function(req,res){
	Vacation.find({ available:true }, function(err,vacations){
		var context = {
			vacations:vacations.map(function(vacation){
				return {
					sku: vacation.sku,
					name: vacation.name,
					description: vacation.description,
					price: vacation.getDisplayPrice(),
					inSeason: vacation.inSeason,
				}
			})
		};
		res.render('vacation',context);
	});
});
app.get('/notify-me-when-in-season',function(req,res){
	res.render('notify-me-when-in-season',{ sku:req.query.sku });
})
app.post('/notify-me-when-in-season',function(req,res){
	VacationInSeasonListener.update(
		{ email:req.body.email },
		{ $push: { skus:req.body.sku } },
		{ upsert: true },
		function(err){
			if(err){
				console.error(err.stack);
				req.session.flash = {
					type:'danger',
					intro:'Oops :(',
					message:'Error occurred at processing.',
				};
			}
			req.session.flash = {
				type:'success',
				intro:'Thanks',
				message:'You will be notified.',
			};
			return res.redirect(303,'/vacations');
		}
	);
});

app.get('/',function(req,res){
	res.render('home');
});
app.get('/about',function(req,res){
	res.render('about',{
		fortune:fortune.getFortune(), 
		pageTestScript:'/qa/tests-about.js'
	});
});
app.get('/thank-you', function(req, res){
	res.render('thank-you');
});
//ch08 example
app.use('/upload',function(req,res,next){
	var now = Date.now();
	jqupload.fileHandler({
		uploadDir:function(){
			return __dirname + '/public/uploads/' +now;
		},
		uploadUrl: function(){
			return '/uploads/' +now;
		},
	})(req,res,next);
});
app.get('/newsletter',function(req,res){
	res.render('newsletter',{ csrf:'CSRF token goes here' });
});
app.get('/email/cart/thank-you',function(req,res){
	res.render('email/cart-thank-you',{cart:req.session.cart, layout:null});
});
app.get('/contest/vacation-photo',function(req,res){
	var now = new Date();
	res.render('contest/vacation-photo',{
		year: now.getFullYear(),month: now.getMonth()
	});
});
app.get('/tours/hood-river',function(req,res){
	res.render('tours/hood-river');
});
app.get('/tours/request-group-rate',function(req,res){
	res.render('tours/request-group-rate');
});
app.get('/headers',function(req,res){
	res.set('Content-Type','text/plain');
	var s = '';
	for(var name in req.headers) s += name +': '+ req.headers[name] +'\n';
	res.send(s);
});
app.get('/jquery-test',function(req,res){
    res.render('jquery-test');
});
app.get('/nursery-rhyme', function(req,res){
    res.render('nursery-rhyme');
});
app.get('/data/nursery-rhyme',function(req,res){
    res.json({
        animal:'squirrel',
        bodyPart:'tail',
        adjective:'fluffy',
        noun:'heck',
    });
});
app.get('/fail',function(req,res){
	throw new Error('Nope ;)');
});
app.get('/epic-fail',function(req,res){
	process.nextTick(function(){
		throw new Error('\{ Bazinga \}')
	});
});

app.post('/process',function(req,res){
	console.log('Form (from querystring): ' + req.query.form);
	console.log('CSRF token (from hidden form field): ' + req.body._csrf);
	console.log('Name (from visible form field): ' + req.body.name);
	console.log('Email (from visible form field): ' + req.body.email);

	if(req.xhr || req.accepts('json,hmtl') === 'json'){
		res.send({ success:true });
		console.log('XHR works');
	}else{
		res.redirect(303, '/thank-you');
		console.log('not JSON anyway.');
	} 
});
app.post('/cart/checkout',function(req,res){
	var cart = req.session.cart;
	if(!cart) next(new Error('No cart.'));
	var name = req.body.name || '', email = req.body.email || '';//validation
	if(!email.match(VALID_EMAIL_REGEX))
		return res.next(new Error('Invalid email address'));
	cart.number = Math.random().toString().replace(/^0\.0*/, '');
	cart.billing = {
		name: name,
		email: email,
	};
	res.render('email/cart-thank-you',{layout:null, cart:cart}, function(err,html){
		if(err) console.log('err in email tmeplate');
		emailService.send(
			cart.billing.email,
			'Thanks from Meadowlark',
			html);
	});
	res.render('cart-thank-you', { cart: cart });
});

//=====binary data sorting=====
var fs = require('fs');
var dataDir = __dirname +'/data';
var vacationPhotoDir = dataDir +'/vacation-photo';
fs.existsSync(dataDir) || fs.mkdirSync(dataDir);//create a directory for files uploading.
fs.existsSync(vacationPhotoDir) || fs.mkdirSync(vacationPhotoDir);

function saveContestEntry(contestName, email, year, month, photoPath){

}

app.post('/contest/vacation-photo/:year/:month',function(req,res){
	var form = new formidable.IncomingForm();
	form.parse(req,function(err,fields,files){
		if(err) return res.redirect(303,'/error');
		if(err){
			res.session.flash = {
				type:'danger',
				intro:'Oops:(',
				message:'Error occurred on your submission. Do try again.'
			};
			return res.redirect(303,'/contest/vacation-photo');
		}
		var photo = files.phoro;
		var dir = vacationPhotoDir +'/'+ Date.now();//__dirname +'/data'+'/vacation-photo'+'/'+ Date.now()
		var path = dir +'/'+ photo.name;
		fs.mkdirSync(dir);
		fs.renameSync(photo.path, dir +'/'+ photo.name);
		saveContestEntry('vacation-photo', fields.email, req.params.year, req.params.month, path);
		req.session.flash = {
			type:'success',
			intro:'Good luck',
			message:'You have been entered into the contest.',
		};
		return res.redirect(303,'/contest/vacation-photo/entries');
	});
});

//Custom 404
app.use(function(req,res,next){
	// res.status(404);
	// res.render('404')
	res.status(404).render('404');
});
//Custom 500
app.use(function(err,req,res,next){
	console.error(err.stack);
	res.status(500).render('500');
});

function startServer() {
	http.createServer(app).listen(app.get('port'), function () {
		console.log('Express works in ' + app.get('env') + ' on http://localhost:' +
			app.get('port') + '; press Ctrl-C to terminate.');
	});
}
if(require.main === module){
	startServer();//require.main means app runs directly.
}else{
	module.exports = startServer; //been imported as a module via 'require', export startServer directly.
}