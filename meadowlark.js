var express = require('express'),
		http = require('http'),
		app = express(),
		vhost = require('vhost'),
		fs = require('fs'),
		Q = require('q');//promise
var bodyParser = require('body-parser');
var csrf = require('csurf');
var formidable = require('formidable');
var jqupload = require('jquery-file-upload-middleware');
var nodemailer = require('nodemailer');
var loadtest = require('loadtest');
var expect = require('chai').expect;
//=====lib connected.=====
var credentials = require('./credentials.js');
var emailService = require('./lib/email.js')(credentials);
var cartValidation = require('./lib/cartValidation.js');
// var fortune = require('./lib/fortune.js');//in route.js
// var getWeatherData = require('./lib/weatherdata.js');
var anyArray = require('./lib/anyArray.js');
//=====partials online.=====
var handlebars = require('express3-handlebars').create({
	defaultLayout: 'main',
	helpers: {
		section: function(name, options) {
			if (!this._sections) {
				this._sections = {};
			}
			this._sections[name] = options.fn(this);
			return null;
		},
		static: function(name) {
			return require('./lib/static.js').map(name);
		}
	}
});
var static = require('./lib/static.js').map;
app.use(function(req,res,next){
	var now = new Date();
	res.locals.logoImage = now.getMonth()==7 && now.getDate()==10 ?
	static('/img/logo_bud_clark.png') : 
	static('/img/logo.png');
	next();
});

//=====nodemailer config=====
var mailTransport = nodemailer.createTransport({
	service: 'Gmail',
	auth: {
		user: credentials.gmail.user,
		pass: credentials.gmail.password,
	}
});

//=====Morgan/express-logger(ch12)=====
switch (app.get('env')) {
	case 'development':
		app.use(require('morgan')('dev'));
		break;
	case 'production':
		app.use(require('express-logger')({
			path: __dirname + '/log/requests.log'
		}));
		break;
}

app.disable('x-powered-by'); //hide Express Server header info
app.engine('handlebars', handlebars.engine); //layout default main.
app.set('view engine', 'handlebars');
app.set('port', process.env.PORT || 9527);

app.use(function(req, res, next) { //domain for every request.
	var domain = require('domain').create();
	domain.on('error', function(err) {
		console.error('Domain Error Caught\n', err.stack);
		try {
			setTimeout(function() {
				console.error('Failsafe shutdown.');
				process.exit(1); //reboot after disconnect in 5 secs as safe switch.
			}, 5000);

			var worker = require('cluster').worker;
			if (worker) worker.disconnect(); //kickout the connection
			server.close(); //shut all connections.

			try {
				next(err);
			} catch (err) {
				console.error('Express error mechanism failed. \n', err.stack);
				res.statusCode = 500;
				res.setHeader('content-type', 'text/plain');
				res.end('Server error');
			}
		} catch (err) {
			console.error('Unable to send 500 response. \n', err.stack);
		}
	});
	domain.add(req); //add req and res objects to domain.
	domain.add(res);
	domain.run(next); //execute the rest of 
});

app.use(express.static(__dirname + '/public'));
app.use(require('serve-favicon')('./public/img/favicon.ico'));
// request parsing middleware. replacing 'app.use(require('body-parser')());')
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
	extended: true
}));
//cookie credentializing through cookie parser.
app.use(require('cookie-parser')(credentials.cookieSecret));
app.use(require('express-session')({
	resave: false,
	saveUninitialized: false,
	secret: credentials.cookieSecret,
}));
//cross-site request forgery using express-session, must go after cookie&session.
app.use(require('csurf')());
app.use(function(req, res, next){
	res.locals._csrfToken = req.csrfToken();
	next();
});

app.use(function(req, res, next) { //Keep your server alive, cluster assingment logging.
	var cluster = require('cluster');
	if (cluster.isWorker)
		console.log('Worker %d received request', cluster.worker.id);
	next();
});
app.use(function(req, res, next) { //flash msg through session.
	res.locals.flash = req.session.flash;
	delete req.session.flash;
	next();
});
//=====Testing=====
app.use(function(req, res, next) {
	res.locals.showTests = app.get('env') !== 'production' && req.query.test === '1';
	next();
});

//=====ch09 middleware testing=====
app.use(cartValidation.checkWaivers);
app.use(cartValidation.checkGuestCounts);

//=====subDomain(ch14)=====
var admin = express.Router();
app.use(require('vhost')('admin.*', admin));
admin.get('/', function(req, res) {
	res.render('admin/home');
});
admin.get('/users', function(req, res) {
	res.render('admin/users');
});

//=====MongoDB=====
var mongoose = require('mongoose');
var opts = { //optional, simply make sure keepAlive.
	server: {
		socketOptions: {
			keepAlive: 1
		}
	}
};
switch (app.get('env')) {
	case 'development':
		mongoose.connect(credentials.mongo.development.connectionString, opts);
		break;
	case 'production':
		mongoose.connect(credentials.mongo.production.connectionString, opts);
		break;
	default:
		throw new Error('Execution Environment Unsettled: ' + app.get('env'));
}
var Vacation = require('./models/vacation.js');

Vacation.find(function(err, vacations) {
	if (vacations.length) return;

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

var MongoSessionStore = require('session-mongoose')(require('connect'));
var sessionStore = new MongoSessionStore({
	url: credentials.mongo[app.get('env')].connectionString
});

app.use(require('cookie-parser')(credentials.cookieSecret));
app.use(require('express-session')({
	secret: credentials.cookieSecret,
	resave: false,
	saveUninitialized: true,
	store: sessionStore,
}));

//due to API restriction, apply CORS to allow cross-site request
app.use('/api', require('cors')());
//=====(API providing through Express, ch15)=====
var Attraction = require('./models/attraction.js');
app.get('/api/attractions', function(req, res) {
	Attraction.find({
		approved: true
	}, function(err, attractions) {
		if (err) return res.send(500, 'Error Occurred: DB is in trouble.');
		res.json(attractions.map(function(a) {
			return {
				name: a.name,
				id: a._id,
				description: a.description,
				location: a.location
			}
		}));
	});
});
app.post('/api/attraction', function(req, res) {
	var a = new Attraction({
		name: req.body.name,
		description: req.body.description,
		location: {
			lat: req.body.lat,
			lng: req.body.lng
		},
		history: {
			event: 'created',
			email: req.body.email,
			data: new Date(),
		},
		approved: false,
	});
	a.save(function(err, a) {
		if (err) return res.send(500, 'Error Occurred: DB is in trouble.');
		res.json({
			id: a._id
		});
	});
});
app.get('/api/attraction/:id', function(req, res) {
	Attraction.findById(req.params.id, function(err, a) {
		if (err) return res.send(500, 'Error Occurred: DB is in trouble.');
		res.json({
			name: a.name,
			id: a._id,
			description: a.description,
			location: a.location,
		});
	});
});

//=====(authentication through PassPort, ch18,19)=====
var auth = require('./lib/auth.js')(app,{
// 	baseUrl:process.env.BASE_URL,
	providers:credentials.authProviders,
	successRedirect:'/account',
	failureRedirect:'/unauthorized',
});
auth.init(); //links in Passport middleware.
auth.registerRoutes();//specify auth routes.
//role-specifying function.
function customerOnly(req,res,next){
// 	var user = req.session.passport.user;
	if(req.user && req.user.role === 'customer')
		return next();
	res.redirect(303,'/unauthorized');
}
//specific page access only.
function employeeOnly(req,res,next){
	var user = req.session.passport.user;
	if(user && req.role === 'employee') 
		return next()
	next('route');//skip all routing, include 404.
}
function allow(roles){
// 	var user = req.session.passport.user;
	return function(req,res,next){
		console.log('Req.User: '+req.user);
		if(req.user && roles.split(',').indexOf(req.user.role)!==-1) 
			return next();
		res.redirect(303,'/unauthorized');
	};
}
app.get('/unauthorized',function(req,res){
	res.status(403).render('unauthorized');
});
//customer routes.
app.get('/account', allow('customer,employee'),function(req,res){
	res.render('account',{ username:req.user.name });
})
// app.get('/account', customerOnly, function(req,res){
// 	res.render('account');
// });
app.get('/account/order-history', customerOnly, function(req,res){
	res.render('account/order-history');
});
app.get('/account/email-prefs',customerOnly,function(req,res){
	res.render('account/email-prefs');
});
//employer routes.
app.get('/sales',employeeOnly, function(req,res){
	res.render('sales');
});
//if there is more roles.	
app.get('/sales', allow('customer,employee'), function(req,res){
		res.render('account');
});
//=====(twitter app)======
var twitter = require('./lib/twitter')({
	consumerKey:credentials.twitter.consumerKey,
	consumerSecret:credentials.twitter.consumerSecret,
});

var topTweets = {
	count:10,
	lastRefreshed:0,
	refreshInterval: 15 * 60 * 1000,
	tweets:[],
}

function getTopTweets(cb){
	if(Date.now() < topTweets.lastRefreshed + topTweets.refreshInterval)
		return cb(topTweets.tweets);
	
	twitter.search('#pokemongo', topTweets.count, function(result){
		var fomattedTweets = [];
		var promises = [];//promise storing.
		var embedOpts = { omit_script:1 };
		
		result.statuses.forEach(function(status){//statuses from twitter.
			var deferred = Q.defer();			
			twitter.embed(status.id_str, embedOpts, function(embed){
				formattedTweets.push(embed.html);
				deferred.resolve();//promise named.
			});			
			promises.push(deferred.promise);//pouring in promise pool.
		});
		
		Q.all(promises).then(function(){//do all named promises then.
			topTweets.lastRefreshed = Date.now();
			cb(topTweets.tweets = formattedTweets);
		})
	})
}

app.get('/toptwitter', function(req,res){
	res.render('toptwitter',{toptwitter:topTweets.tweets});
});
//=====(Geocode / Twitter)=====
var dealerCache = {
	lastRefreshed:0,
	refreshInterval: 60 * 60 * 1000,
	jsonUrl:'dealers.json',
	geocodelimit: 2000,
	geocodeCount: 0,
	geocodeBegin: 0,
};
dealerCache.jsonFile = __dirname +'/public'+ dealerCache.jsonUrl;//being cache here.
dealerCache.refresh = function(cb){
	if(Date.now() > dealerCache.lastRefresher + dealerCache.refreshInterval){
		//it's time to refresh.
		Dealer.find({ active: true }, function(err, dealers){
			if(err) return  console.log('Error fetching dealers: '+ err);
			dealers.forEach(geocodeDealer);// if coordinates are not up-to-date
			fs.writeFileSync(dealerCache.jsonFile, JSON.stringify(dealers));//cache refreshing.
			cb();//donw
		});
	}
}

function geocodeDealer(dealer){
	var addr = dealer.getAddress(' ');
	if(addr === dealer.getcodeAddress) return;//if already geocoded.
	if(dealerCache.geocodeCount >= dealerCache.goecodeLimit){
		//geocoding 24hr limitation.
		if(Date.now() > dealerCache.geocodeCount + 24*60*60*1000){
			dealerCache.geocodeBegin = Date.now();
			dealerCache.geocodeCount = 0;
		}else {
			//if reached usage limit, pass.
			return;
		}
	}
	geocode(addr, function(err, coords){
		if(err) return console.log('Geocoding failure for '+ addr);
		dealer.lat = coords.lat;
		dealer.lng = coords.lng;
		dealer.save();
	});
}

function refreshDealerCacheForever(){
	dealerCache.refresh(function(){//call itself after interval.
		setTimeout(refreshDealerCacheForever, dealerCache.refreshInterval);
	});
}
//improve server performance.優化伺服器表現
function dealersToGoogleMaps(dealers){
	var js = 'function addMarkers(map){\n'+
			'var markers = [];\n' +
			'var Marker = googel.maps.Marker;\n' +
			'var LatLng = google.maps.LatLng;\n';
	dealers.forEach(function(d){
		var name = d.name.replace(/'/,'\\\'').replace(/\\/,'\\\\');
		js += 'markers.push(new Marker({\n' +
			'\tposition: new LatLng(' +
			d.lat +', '+ d.lng + '),\n' +
			'\tmap: map,\n' +
			'\ttitle: \'' + name.replace(/'/, '\\') + '\',\n' +
			'}));\n';
	});
	js += '}';
	return js;
}

if(!fs.existsSync(dealerCache.jsonFile)) fs.writeFileSync(JSON.stringify([]));//create empty cache to prevent 404.
refreshDealerCacheForever();//start refreshing cache.

dealerCache.jsonFile = __dirname +'/public'+ dealerCache.jsonUrl;//being cache here.
dealerCache.refresh = function(cb){
	if(Date.now() > dealerCache.lastRefresher + dealerCache.refreshInterval){
		//it's time to refresh.
		Dealer.find({ active: true }, function(err, dealers){
			if(err) return  console.log('Error fetching dealers: '+ err);
			dealers.forEach(geocodeDealer);// if coordinates are not up-to-date
			fs.writeFileSync(dealerCache.jsonFile, JSON.stringify(dealers));//cache refreshing.
			cb();//donw
		});
	}
}

// var getWeatherData = (function(){
// 	//weather cahce
// 	var c = {
// 		refreshed: 0,
// 		refreshing: false,
// 		updateFrequency: 360000,//60*60*1000
// 		locations:[
// 			{name:'Portland'},
// 			{name:'Bend'},
// 			{name:'Manzanita'},
// 		]	,	
// 	};
// 	return function(){
// 		if(!c.refreshing && Date.now() > c.refreshed + c.updateFrequency){
// 			c.refreshing = true;
// 			var promises = c.locations.map(function(loc){
// 				return Q.Promise(function(resolve){
// 					var url = 'http://api.wunderground.com/api/'+ credentials.WeatherUnderground.ApiKey +'/conditions/q/OR/' + loc.name + '.json';
// 					http.get(url, function(res){
// 						var body = '';
// 						res.on('data', function(chunk){
// 							body += chunk;
// 						});
// 						res.on('end', function(){
// 							body = JSON.parse(body);
// 							loc.forecastUrl = body.current_observation.forecast_url;
// 							loc.iconUrl = body.current_observation.icon_url;
// 							loc.weather = body.current_observation.weather;
// 							loc.temp = body.current_observation.temperature_string;
// 							resolve();
// 						});
// 					});
// 				});
// 			})
// 			Q.all(promises).then(function(){
// 				c.refreshing = false;
// 				c.refreshed = Date.now();
// 			})
// 		}
// 		return {locations:c.locations};
// 	}
// })();
// //=====weather data collecting=====
// app.use(function(req, res, next) {
// 	if (!res.locals.partials) res.locals.partials = {};
// 	res.locals.partials.weather = getWeatherData();
// 	next();
// });

// var routes = require('./routes.js');
// routes.forEach(function(route){
// 	app[route.method](route.handler);
// });//app customization.
require('./routes.js')(app); //router, handler solidify.

//#########################basic Routing##############################
//=====(ch14)======
var staff = anyArray.staff;
var staff02 = anyArray.staff02;
app.get('/staff/:name', function(req, res, next) {
	console.log('Staff:' + staff[req.params.name].bio);
	var info = staff[req.params.name]; //:name throw in parameters
	if (!info) return next(); //ends in 404
	res.render('staffer', {
		info: info
	});
});
app.get('/staff/:city/:name', function(req, res, next) {
	console.log('Staff:' + staff02[req.params.city][req.params.name].bio)
	var info = staff02[req.params.city][req.params.name];
	if (!info) return next();
	res.render('staffer', {
		info: JSON.stringify(info.bio)
	});
});
function authorize(req, res, next) {
	if (req.session.authorized) return next();
	res.render('Not-authorized');
}
app.get('/secret', authorize, function() {
	res.render('secret')
});
app.get('/sub-rosa', authorize, function() {
	res.render('sub-rosa');
})

function specials(req, res, next) {
	res.locals.specials = getSpecialsFromDatabase();
	next();
}
app.get('/page-with-specials', specials, function(req, res) {
	res.render('page-with-specials');
});

//DB data retrieving
app.get('/set-currency/:currency', function(req, res) {
	req.session.currency = req.params.currency;
	return res.redirect(303, '/vacations');
});

function convertFromUSD(value, currency) {
	switch (currency) {
		case 'USD':
			return value * 1;
		case 'GBP':
			return value * 0.6;
		case 'BTC':
			return value * 0.0023707918444761;
		case 'TWD':
			return value * 0.032;
	}
}
app.get('/vacations', function(req, res) {
	Vacation.find({
		available: true
	}, function(err, vacations) {
		var currency = req.session.currency || 'USD';
		var context = {
			vacations: vacations.map(function(vacation) {
				return {
					sku: vacation.sku,
					name: vacation.name,
					description: vacation.description,
					inSeason: vacation.inSeason,
					price: convertFromUSD(vacation.priceInCents / 100, currency),
					qty: vacation.qty,
				}
			})
		};
		switch (currency) {
			case 'USD':
				context.currencyUSD = 'selected';
				break;
			case 'GBP':
				context.currencyGBP = 'selected';
				break;
			case 'BTC':
				context.currencyBTC = 'selected';
				break;
			case 'TWD':
				context.currencyTWD = 'selected';
				break;
		}
		res.render('vacations', context);
	});
});
app.get('/notify-me-when-in-season', function(req, res) {
	res.render('notify-me-when-in-season', {
		sku: req.query.sku
	});
});
app.post('/notify-me-when-in-season', function(req, res) {
	VacationInSeasonListener.update({
			email: req.body.email
		}, {
			$push: {
				skus: req.body.sku
			}
		}, {
			upsert: true
		},
		function(err) {
			if (err) {
				console.error(err.stack);
				req.session.flash = {
					type: 'danger',
					intro: 'Oops :(',
					message: 'Error occurred at processing.',
				};
			}
			req.session.flash = {
				type: 'success',
				intro: 'Thanks',
				message: 'You will be notified.',
			};
			return res.redirect(303, '/vacations');
		}
	);
});

// app.get('/',function(req,res){
// 	res.render('home');
// });
// app.get('/about',function(req,res){
// 	res.render('about',{
// 		fortune:fortune.getFortune(), 
// 		pageTestScript:'/qa/tests-about.js'
// 	});
// });
app.get('/thank-you', function(req, res) {
	res.render('thank-you');
	console.log('baseURL: '+process.env.BASE_URL);
});
//ch08 example
app.use('/upload', function(req, res, next) {
	var now = Date.now();
	jqupload.fileHandler({
		uploadDir: function() {
			return __dirname + '/public/uploads/' + now;
		},
		uploadUrl: function() {
			return '/uploads/' + now;
		},
	})(req, res, next);
});

var VALID_EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;


app.get('/email/cart/thank-you', function(req, res) {
	res.render('email/cart-thank-you', {
		cart: req.session.cart,
		layout: null
	});
});
app.get('/contest/vacation-photo', function(req, res) {
	var now = new Date();
	res.render('contest/vacation-photo', {
		year: now.getFullYear(),
		month: now.getMonth()
	});
});
app.get('/tours/hood-river', function(req, res) {
	res.render('tours/hood-river');
});
app.get('/tours/request-group-rate', function(req, res) {
	res.render('tours/request-group-rate');
});
app.get('/headers', function(req, res) {
	res.set('Content-Type', 'text/plain');
	var s = '';
	for (var name in req.headers) s += name + ': ' + req.headers[name] + '\n';
	res.send(s);
});
app.get('/jquery-test', function(req, res) {
	res.render('jquery-test');
});
app.get('/nursery-rhyme', function(req, res) {
	res.render('nursery-rhyme');
});
app.get('/data/nursery-rhyme', function(req, res) {
	res.json({
		animal: 'squirrel',
		bodyPart: 'tail',
		adjective: 'fluffy',
		noun: 'heck',
	});
});
app.get('/newsletter', function(req, res) {
	res.render('newsletter');
});
app.get('/newsletter/archive', function(req, res) {
	res.render('newletter/archive');
})

function NewslettereSignup() {
	//not yet.
}
NewslettereSignup.prototype.save = function(cb) {
	cb();
};
app.post('/newsletter', function(req, res) {
	var name = req.body.name || '',
		email = req.body.email || '';
	if (email.match(VALID_EMAIL_REGEX)) {
		if (req.xhr) return res.json({
			error: 'Invalid email address.'
		});
		res.session.flash = {
			type: 'danger',
			intro: 'Validation Error',
			message: 'The email address you entered was not valid',
		};
		return res.redirect(303, 'newletter/archive');
	}
	new NewsletterSignup({
		name: name,
		email: email
	}).save(function(err) {
		if (err) {
			if (req.xhr) return res.json({
				error: 'Database Error.'
			});
			req.session.flash = {
				type: 'danger',
				intro: 'Database Error',
				message: 'There was a database error.',
			}
			return res.redirect(303, 'newsletter/archieve');
		}
	});
});

app.post('/process', function(req, res) {
	console.log('Form (from querystring): ' + req.query.form);
	console.log('CSRF token (from hidden form field): ' + req.body._csrf);
	console.log('Name (from visible form field): ' + req.body.name);
	console.log('Email (from visible form field): ' + req.body.email);

	if (req.xhr || req.accepts('json,hmtl') === 'json') {
		res.send({
			success: true
		});
		console.log('XHR works');
	} else {
		res.redirect(303, '/thank-you');
		console.log('not JSON anyway.');
	}
});
app.post('/cart/checkout', function(req, res) {
	var cart = req.session.cart;
	if (!cart) next(new Error('No cart.'));
	var name = req.body.name || '',
		email = req.body.email || ''; //validation
	if (!email.match(VALID_EMAIL_REGEX))
		return res.next(new Error('Invalid email address'));
	cart.number = Math.random().toString().replace(/^0\.0*/, '');
	cart.billing = {
		name: name,
		email: email,
	};
	res.render('email/cart-thank-you', {
		layout: null,
		cart: cart
	}, function(err, html) {
		if (err) console.log('err in email tmeplate');
		emailService.send(
			cart.billing.email,
			'Thanks from Meadowlark',
			html);
	});
	res.render('cart-thank-you', {
		cart: cart
	});
});

app.get('/fail', function(req, res) {
	throw new Error('Nope ;)');
});
app.get('/epic-fail', function(req, res) {
	process.nextTick(function() {
		throw new Error('\{ Bazinga \}')
	});
});
//=====binary data sorting=====
var fs = require('fs');
var dataDir = __dirname + '/data';
var vacationPhotoDir = dataDir + '/vacation-photo';
fs.existsSync(dataDir) || fs.mkdirSync(dataDir); //create a directory for files uploading.
fs.existsSync(vacationPhotoDir) || fs.mkdirSync(vacationPhotoDir);

function saveContestEntry(contestName, email, year, month, photoPath) {

}

app.post('/contest/vacation-photo/:year/:month', function(req, res) {
	var form = new formidable.IncomingForm();
	form.parse(req, function(err, fields, files) {
		if (err) return res.redirect(303, '/error');
		if (err) {
			res.session.flash = {
				type: 'danger',
				intro: 'Oops:(',
				message: 'Error occurred on your submission. Do try again.'
			};
			return res.redirect(303, '/contest/vacation-photo');
		}
		var photo = files.phoro;
		var dir = vacationPhotoDir + '/' + Date.now(); //__dirname +'/data'+'/vacation-photo'+'/'+ Date.now()
		var path = dir + '/' + photo.name;
		fs.mkdirSync(dir);
		fs.renameSync(photo.path, dir + '/' + photo.name);
		saveContestEntry('vacation-photo', fields.email, req.params.year, req.params.month, path);
		req.session.flash = {
			type: 'success',
			intro: 'Good luck',
			message: 'You have been entered into the contest.',
		};
		return res.redirect(303, '/contest/vacation-photo/entries');
	});
});

// //=====(ch15, RESTful plugin)=====
// var Attraction = require('./models/attraction.js');
// var apiOptions = {
// 	context:'/',
// 	domain:require('domain').create(),
// };
// var rest = require('connect-rest').create(apiOptions);
// app.use(rest.processRequest());//API pipeline linking

// rest.get('/attraction',function(req,content,cb){
// 	Attraction.find({approved:true},function(err,attractions){
// 		if(err) return cb({ error:'Internal error' });
// 		cb(null,attractions.map(function(a){
// 			return {
// 				name:a.name,
// 				description:a.description,
// 				location:a.location,
// 			};
// 		}));
// 	});
// });
// rest.post('/attraction',function(req,content,cb){
// 	var a = new Attraction({
// 		name:req.body.name,
// 		description:req.body.description,
// 		location:{ lat:req.body.lat, lng:req.body.lng },
// 		history:{
// 			event:'created',
// 			email:req.body.email,
// 			date:new Date(),
// 		},
// 		approved:false,
// 	});
// 	a.save(function(err,a){
// 		if(err) return cb({error:'Unable to add attraction.'});
// 		cb(null, {id:a._id});
// 	});
// });
// rest.get('/attraction/:id',function(req,content,cb){
// 	Attraction.findById(req.params.id, function(err,a){
// 		if(err) return cb({error:'Unable to retrieve attraction.'});
// 		cb(null,{
// 			name:attraction.name,
// 			description:attraction.description,
// 			location:attraction.location,
// 		});
// 	});
// });
// apiOptions.domain.on('error',function(err){
// 	console.log('API domain error.\n', err.stack);
// 	setTimeout(function(){
// 		console.log('Server shutting down after API domain error.');
// 		process.exit(1);
// 	},5000);
// 	server.close();
// 	var worker = require('cluster').worker;
// 	if(worker) worker.disconnect();
// });
// app.use(vhost('api.*',rest.processRequest()))

//Automatically rendering Views, staically.
var autoViews = {};
var fs = require('fs');
app.use(function(req, res, next) {
	var path = req.path.toLowerCase();
	if (autoViews[path]) return res.render(autoViews[path]); //check render
	if (fs.existsSync(__dirname + '/views' + path + '.handlebars')) {
		//check existance of handlebars file
		autoViews[path] = path.replace(/^\//, ''); //means ^/
		return res.render(autoViews[path]);
	}
	next();
})

//Custom 404
app.use(function(req, res, next) {
	// res.status(404);
	// res.render('404')
	res.status(404).render('404');
});
//Custom 500
app.use(function(err, req, res, next) {
	console.error(err.stack);
	res.status(500).render('500');
});

function startServer() {
	http.createServer(app).listen(app.get('port'), function() {
		console.log('Express works in ' + app.get('env') + ' on http://localhost:' +
			app.get('port') + '; press Ctrl-C to terminate.');
	});
}
if (require.main === module) {
	startServer(); //require.main means app runs directly.
} else {
	module.exports = startServer; //been imported as a module via 'require', export startServer directly.
}