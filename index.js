var express = require('express');
var bodyParser = require('body-parser');
var request = require('request');
var fs = require('fs');
var CronJob = require('cron').CronJob;
var app = express();
var pg = require('pg');
var moment = require('moment');
var cron = require('node-cron');
var classes;


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
            const connectionString = process.env.DATABASE_URL;
	    
	       	const client = new pg.Client(connectionString);
 		
			client.connect();
			
			var checkquery = client.query("select exists(select 1 from items where senderid = '" + event.sender.id + "')")
			if (!checkquery){
				var query = client.query("insert into items (senderid) values ('" + event.sender.id + "')");    
        		query.on("end", function (result) {          
            		client.end(); 
            		console.log('SenderID inserted');
        		});
            	sendMessage(event.sender.id, {text: "Great to have you on board! I'll message you daily at around 8am GMT with some upcoming live classes, namaste!"});
            } else {
            	console.log("value already in database");
            	sendMessage(event.sender.id, {text: "I'm sorry, I don't quite understand..."});
            }
            checkquery.on("end", function (result) {          
            		client.end(); 
        		});
        } else if (event.message && event.message.text) {
        	console.log("Message received: " + event.message.text);
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

//send class data
function classdatasend(recipientId) {
	
	var classelements = [];
	
	for(var i=0; i<classes.length; i++){
		if (classes[i].language == "en" && classelements.length < 10){
			var date = moment(classes[i].start_time, moment.ISO_8601).format("ddd, h:mm A");
			var classtile = {
				"title": classes[i].name + " - " + classes[i].instructor_name + " - " + date,
				"subtitle": classes[i].description,
				"image_url": "https://yogaia.com/" + classes[i].instructor_img,
				"buttons":[{
					"type": "web_url",
					"url": "https://yogaia.com/view/" + classes[i].id,
					"title": "Book"
				}, {
					"type": "element_share"
				}]
			};
			classelements.push(classtile);
		}
	}

            
    var message = {
        "attachment": {
            "type": "template",
            "payload": {
                "template_type": "generic",
                "elements": classelements,
            }
        }
    };
    
    sendMessage(recipientId, {text: "Good morning! Here's what we have coming up."});
    sendMessage(recipientId, message);

}

var cronIsAllowed = true;

function cronJob(){
	//url for classes JSON
	var url = 'https://yogaia.com/api/lessons?upcoming=1&limit=30';
	//get JSON, parse it and store it in classes variable
	request(url, (error, response, body)=> {
  		if (!error && response.statusCode === 200) {
  			console.log('Yogaia query successful... storing classes variable');
    		classes = JSON.parse(body);
    		console.log('CONNECTING to database');
   			const connectionString = process.env.DATABASE_URL;
    		const client = new pg.Client(connectionString);
    		client.connect();
    		console.log('sending classes to users...');
    		var query = client.query("SELECT senderid from items");
    		query.on("row", function (row){
    			classdatasend(row.senderid);
    			console.log("sent to..." + JSON.stringify(row.senderid));
    		});
    		query.on("end", function (result) {          
        		client.end(); 
    		});

  	} else {
    	console.log("Got an error: ", error, ", status code: ", response.statusCode)
  	}
	})
}

var dailyjob = new cron.schedule('* 30 10 * * *', function() {
  	if(cronIsAllowed){
  		cronJob();
  		cronIsAllowed = false;
  		console.log("cronIsAllowed set to false");
  		setTimeout(function(){
  			cronIsAllowed = true;
  			console.log("cronIsAllowed set to true");
  		}, 1000*60);
  	}
  
});

dailyjob.start();
