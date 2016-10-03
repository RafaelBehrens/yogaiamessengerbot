var express = require('express');
var bodyParser = require('body-parser');
var request = require('request');
var fs = require('fs');
var CronJob = require('cron').CronJob;
var app = express();
var pg = require('pg');


app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());
app.listen((process.env.PORT || 3000));

// Server frontpage
app.get('/', function (req, res) {
    res.send('This is a Messenger Bot Server, you can not access this here! :(');
});

// Facebook Webhook
app.get('/webhook', function (req, res) {
    if (req.query['hub.verify_token'] === 'testbot_verify_token') {
        res.send(req.query['hub.challenge']);
    } else {
        res.send('Invalid verify token');
    }
});

// handler receiving messages
app.post('/webhook', function (req, res) {
    var events = req.body.entry[0].messaging;
    for (i = 0; i < events.length; i++) {
        var event = events[i];
  		if (event.postback) {
            console.log("Postback received: " + JSON.stringify(event.postback));
            console.log(event.sender.id);
            sendMessage(event.sender.id, {text: "You just got started"});
        }
    }
    res.sendStatus(200);
});

// generic function sending messages
function sendMessage(recipientId, message) {
    request({
        url: 'https://graph.facebook.com/v2.6/me/messages',
        qs: {access_token: process.env.PAGE_ACCESS_TOKEN},
        method: 'POST',
        json: {
            recipient: {id: recipientId},
            message: message,
        }
    }, function(error, response, body) {
        if (error) {
            console.log('Error sending message: ', error);
        } else if (response.body.error) {
            console.log('Error: ', response.body.error);
        }
    });
};

//url for classes JSON
var url = 'https://yogaia.com/api/lessons?upcoming=0&limit=10';

//get JSON, parse it and store it in classes variable
request(url, (error, response, body)=> {
  if (!error && response.statusCode === 200) {
    classes = JSON.parse(body)
    console.log("Got a response")
  } else {
    console.log("Got an error: ", error, ", status code: ", response.statusCode)
  }
})
