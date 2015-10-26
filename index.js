var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var xml = require('node-bandwidth').xml;
var tn = "+14154292562";
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

app.set('port', (process.env.PORT || 5000));
app.use(express.static('static'));
app.get('/', function(req, res){
	res.sendFile(__dirname + '/index.html');
});

//three sets of each number
app.get('/incomingCall', function(req, res) {
	if(req.query && req.query.eventType && req.query.eventType === 'answer') {
		if(req.query.to === tn) {
			cdr.tn1.numCalls += 1;
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

io.on('connection', function(socket){
	socket.emit('connected', 'Connected!');
	io.emit('numCalls1', cdr.numCalls);

});

http.listen(app.get('port'), function(){
	console.log('listening on *:' + app.get('port'));
});