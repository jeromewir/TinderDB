var sys = require('sys');
var http = require('http');
var jade = require('jade');
var tinder = require('tinderjs').TinderClient;
var express = require('express');
var io = require('socket.io')(server);
var bodyParser = require('body-parser');
var request = require('request');
var _ = require('underscore');
var mongoose = require('mongoose');

var port = 1337;
var client = new tinder();
var app = express();
var server = app.listen(port, function() {
	mongoose.connect("mongodb://localhost/tinder", function(err) {
		if (err) {
			console.error(err);
			process.exit(-1);
		}
	});
	mongoose.connection.on('error', function(err) {
		console.error(err);
		process.exit(-1);
	});
});

/* Express init */
app.use(bodyParser());
app.use(express.static(__dirname + '/public'))
app.set('views', __dirname + '/views');
app.set('view engine', 'jade');

/* Model for a person */
var TinderUser = mongoose.model('TinderUser', {
	distance: Number,
	common_like_count: Number,
  	common_friend_count: Number,
  	common_likes: [],
	common_friends: [],
	_id: String,
	bio: String,
  	birth_date: String,
  	gender: Number,
  	name: String,
  	ping_time: String,
  	photos: [],
  	birth_date_info: String,
  	liked: Number
});

/* App Id */
FBClientId = '715063671881288';
/* App Secret */
FBClientSecret = '5ce54a2e4883f520ca030b1f2cd484be';
/* Tinder token
 * Get it here before redirect : 
 https://www.facebook.com/dialog/oauth?client_id=464891386855067&redirect_uri=https://www.facebook.com/connect/login_success.html&scope=basic_info,email,public_profile,user_about_me,user_activities,user_birthday,user_education_history,user_friends,user_interests,user_likes,user_location,user_photos,user_relationship_details&response_type=token
 */
tinderToken = 'CAAGm0PX4ZCpsBADtxZBR5v8NZBNZBt6xuenZC9ZC1aGIlqg9Kld4ZAtbTQjsI40cU3GdQ44taIF4IoVsnUqFmn22cuSSgTtLlK4u4lPaPlV1CwxNeytg2v4uZBiNXSpsZCcIe2YP3AnOrMkJ8FBjiLvLd2fxjGtCFbR3ZBG033BSDkV0gkABg4oC9lSeLxBcciMKgVimHxBUi9imeDqnRKNXolGc8dgeppzwcZD';

app.get('/', function(req, res) {
	var skip = 0;
	if (req.query.page && req.query.page > 0) {
		skip = req.query.page * 10;
	}
	TinderUser.find().sort({'liked': 'descending', 'ping_time': -1}).limit(10).skip(skip).exec(function(err, matchedPersons) {
		TinderUser.find({liked: 1}).count().exec(function(err, nbMatch) {
			TinderUser.find().count().exec(function(err, nb) {
				res.render('index', {persons: matchedPersons, nbMatch: nbMatch, nbPages: nb / 10, actualPage: req.query.page});
			});
		});
	});
});

app.get('/token', function(req, res) {
	res.render('authentification');
});

app.post('/token', function(req, res) {
	var hash = req.body.hash;
    var tokenField = "access_token=";
    var expiresField = "&expires_in=";
    var access_token = hash.substring(hash.indexOf(tokenField) + tokenField.length, hash.indexOf(expiresField));

    /* Get the id of the user */
    request({
		url: 'https://graph.facebook.com/debug_token?input_token=' + access_token + '&access_token=' + FBClientId + '|' + FBClientSecret,
      	method: 'GET'
    }, function(err, response, body) {  
		if (err) {
			throw new "Failed to get user id: " + err;
		} 
		else {
			body = JSON.parse(body);

			if (!body.data.user_id) {
				throw new "Failed to get user id.";
        	}

        	console.log(getDate() + "Authenticate with TinderAPI");
			client.authorize(tinderToken, body.data.user_id, function() {
				if (err) {
					console.error(getDate() + "Authentification failure");
					res.end(getDate() + "Authentification failure");
				}
				else {
					console.log(getDate() + "Authentification success");
					res.end(getDate() + "Authentification success");
				}
			});
       	}
	});
});

app.get('/like', function(req, res) {
	if (!client.isAuthorized()) {
		res.send('You need to authenticate : <a href="login?redirect=like">Login page</a>');
		res.end();
		return;
	}
	setInterval(function() {
			client.getRecommendations(10, getRecommentationsAndLike)
		}, 5000);
	res.end("Liking started !");
});

app.get('/update', function(req, res) {
	client.getHistory(function(err, data) {
		_.chain(data.matches)
		.each(function(person) {
			person = person.person;
			TinderUser.find({_id: person._id}).count().exec(function(err, result) {
				if (result == 0) {
					var per = new TinderUser({
					distance: person.distance_mi,
					common_like_count: person.common_like_count,
				  	common_friend_count: person.common_friend_count,
				  	common_likes: person.common_likes,
					common_friends: person.common_friends,
					_id: person._id,
					bio: person.bio,
				  	birth_date: person.birth_date,
				  	gender: person.gender,
				  	name: person.name,
				  	ping_time: person.ping_time,
				  	photos: person.photos,
				  	birth_date_info: person.birth_date_info,
				  	liked: 1
				});
					per.save();
				}
				else {
					TinderUser.update({_id: person._id}, {liked: 1});
				}
			});
		});
		res.end("All your matched have been updated");
	});
})

var getRecommentationsAndLike = function(error, data) {
	if (error) {
		console.error(error);
	}
	_.chain(data.results)
	.each(function(person) {
		var actual = new TinderUser({
			distance: person.distance_mi,
			common_like_count: person.common_like_count,
		  	common_friend_count: person.common_friend_count,
		  	common_likes: person.common_likes,
			common_friends: person.common_friends,
			_id: person._id,
			bio: person.bio,
		  	birth_date: person.birth_date,
		  	gender: person.gender,
		  	name: person.name,
		  	ping_time: person.ping_time,
		  	photos: person.photos,
		  	birth_date_info: person.birth_date_info,
		  	liked: 0
		});
		actual.save(function(err, fluffly) {
			if (err) {
				var date = new Date();
				console.error(getDate() + "Can't save " + person.name + "(" + person._id + ")");
				fluffly.speak();
			}
		});

		client.like(person._id, function(error, data) {
			if (error) {
				console.error(error);
				return;
			}

			if (data != null && data.match) {
				actual.liked = 1;
				updateHtmlView(actual);
				actual.save(function(err) {
					if (err)
						console.log("Update failed");
				});
			}
		});
	});
};

var updateHtmlView = function(person) {
	io.sockets.emit("newMatch", person);
};

app.get('/login', function(req, res) {
    res.redirect('https://www.facebook.com/dialog/oauth?client_id=' + FBClientId + '&response_type=token&redirect_uri=http://localhost:' + port + '/token');
  });

sys.puts('Server is listening on port ' + port);

var getDate = function(date) {
	return "[" + new Date() + "] ";
}