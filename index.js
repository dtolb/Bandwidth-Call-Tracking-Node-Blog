var express = require('express');
var Promise = require('bluebird');
var app = express();
var config = require('./bandwidth.json');
var http = require('http').Server(app);
var io = require('socket.io')(http);
var tn;
var bandwidth = require("node-bandwidth");
var xml = bandwidth.xml;
var Application = Promise.promisifyAll(bandwidth.Application);
var PhoneNumber = Promise.promisifyAll(bandwidth.PhoneNumber);
var AvailableNumber = Promise.promisifyAll(bandwidth.AvailableNumber);

var appName = "Bandwidth-Call-Tracking-Blog";
var client = new bandwidth.Client(
	config.userId,
	config.apiToken,
	config.apiSecret);
var cdr = {
	numCalls: 0
};

/// Start the XML response
var response = new xml.Response();
// Create the sentence
var speakSentence = new xml.SpeakSentence({sentence: "Thank you for calling Tom's Tire Shop, please wait while we connect you.", voice: "paul", gender: "male", locale: "en_US"});
//Push all the XML to the response
response.push(speakSentence);
// Create the xml to send
var bxml = response.toXml();

//Checks the current Applications to see if we have one.
var configureApplication = function () {
	return Application.listAsync(client, {
		size: 1000
	})
	.then(function (applications) {
		var applicationId = searchForApplication(applications, appName);
		if(applicationId !== false) {
			return fetchTNByAppId(applicationId);
		}
		else {
			return newApplication();
		}
	});
};

// Searches through application names and returns ID if matched
var searchForApplication = function (applications, name) {
	for (var i = 0; i < applications.length; i++) {
			if ( applications[i].name === name) {
				return applications[i].id;
			}
		}
	return false;
};

// Gets the first number associated with an application
var fetchTNByAppId = function (applicationId) {
	return PhoneNumber.listAsync(client, {
		applicationId: applicationId
	})
	.then(function (numbers) {
		tn = numbers[0].number;
	});
};

// Creates a new application then orders a number and assigns it to application
var newApplication =function () {
	var applicationId;
	return Application.createAsync(client, {
			name: appName,
			incomingCallUrl: config.baseUrl + "/incomingCall/",
			callbackHttpMethod: "get",
			autoAnswer: true
		})
		.then(function(application) {
			//search an available number
			applicationId = application.id;
			return AvailableNumber.searchLocalAsync(client, {
				areaCode: "415",
				quantity: 1
			});
		})
		.then(function(numbers) {
			// and reserve it
			tn = numbers[0].number;
			return PhoneNumber.createAsync(client, {
				number: tn,
				applicationId: applicationId
			});
		});
};

app.set('port', (process.env.PORT || 5000));
app.use(express.static('static'));
app.get('/', function(req, res){
	res.sendFile(__dirname + '/index.html');
});

//three sets of each number
app.get('/incomingCall', function(req, res) {
	if(req.query && req.query.eventType && req.query.eventType === 'answer') {
		if(req.query.to === tn) {
			cdr.numCalls += 1;
			io.emit('numCalls1', cdr.numCalls);
			cdr.callStart = new Date();
			io.emit('caller1', req.query.from);
		}
		res.send(bxml);
	}
	else if(req.query && req.query.eventType && req.query.eventType === 'hangup'){
		if(req.query.to === tn) {
			cdr.callEnd = new Date();
			cdr.duration = (cdr.callEnd - cdr.callStart) / 1000;
			io.emit('duration1', cdr.duration);

		}
		res.send({status: 200});
	}
	else {
		res.send({status: 200});
	}
});

configureApplication()
.then(function () {
	io.on('connection', function(socket){
		socket.emit('connected', 'Connected!');
		io.emit('numCalls1', cdr.numCalls);
		io.emit('tn', tn);
	});

	http.listen(app.get('port'), function(){
		console.log('listening on *:' + app.get('port'));
	});
});



