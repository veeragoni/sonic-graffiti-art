const audioUtils        = require('./audioUtils');  // for encoding audio data as PCM
const crypto            = require('crypto'); // tot sign our pre-signed URL
const v4                = require('./aws-signature-v4'); // to generate our pre-signed URL
const marshaller        = require("@aws-sdk/eventstream-marshaller"); // for converting binary event stream messages to and from JSON
const util_utf8_node    = require("@aws-sdk/util-utf8-node"); // utilities for encoding and decoding UTF8
const mic               = require('microphone-stream'); // collect microphone input as a stream of raw bytes
const axios = require('axios').default;
var AWS = require('aws-sdk');
var QRCode = require('qrcode');
var htmlToImage = require('html-to-image');
import Amplify, { Auth } from 'aws-amplify';
import awsconfig from '../amplify/src/aws-exports';
import {v4 as uuidv4} from 'uuid';

Amplify.configure(awsconfig);
// our converter between binary event streams messages and JSON
const eventStreamMarshaller = new marshaller.EventStreamMarshaller(util_utf8_node.toUtf8, util_utf8_node.fromUtf8);

// our global variables for managing state
let languageCode;
let region;
let sampleRate;
let inputSampleRate;
let transcription = "";
let socket;
let micStream;
let socketError = false;
let transcribeException = false;
let accessKeyId;
let secretAccessKey;
let sessionToken;
var idToken;
var s3;

const shortUrlHeaders = {
    'Content-Type': 'application/json'
}

var csss =[
    'flux',
    'neon'
  ];

var fonts = [
    'SOUPER3',
    'Road Rage',
    'gang bang crime',
    'Forty Script',
    'DJ Gross',
    // 'Smasher 312 Custom',
    'PaintCans',
    'RaseBasic',
    'WildStyle'
];

// check to see if the browser allows mic access
if (!window.navigator.mediaDevices.getUserMedia) {
    // Use our helper method to show an error on the page
    showError('We support the latest versions of Chrome, Firefox, Safari, and Edge. Update your browser and try your request again.');

    // maintain enabled/distabled state for the start and stop buttons
    toggleStartStop();
}

$('#start-button').click(function () {

    $('#error').hide(); // hide any existing errors
    toggleStartStop(true); // disable start and enable stop button

    // set the language and region from the dropdowns
    setLanguage();
    setRegion();

    // first we get the microphone input from the browser (as a promise)...
    window.navigator.mediaDevices.getUserMedia({
            video: false,
            audio: true
        })
        // ...then we convert the mic stream to binary event stream messages when the promise resolves 
        .then(streamAudioToWebSocket) 
        .catch(function (error) {
            showError('There was an error streaming your audio to Amazon Transcribe. Please try again.');
            toggleStartStop();
        });
});

let streamAudioToWebSocket = function (userMediaStream) {
    //let's get the mic input from the browser, via the microphone-stream module
    micStream = new mic();

    micStream.on("format", function(data) {
        inputSampleRate = data.sampleRate;
    });

    micStream.setStream(userMediaStream);

    // Pre-signed URLs are a way to authenticate a request (or WebSocket connection, in this case)
    // via Query Parameters. Learn more: https://docs.aws.amazon.com/AmazonS3/latest/API/sigv4-query-string-auth.html
    let url = createPresignedUrl();
    
    //open up our WebSocket connection
    socket = new WebSocket(url);
    socket.binaryType = "arraybuffer";

    let sampleRate = 0;

    // when we get audio data from the mic, send it to the WebSocket if possible
    socket.onopen = function() {
        micStream.on('data', function(rawAudioChunk) {            // the audio stream is raw audio bytes. Transcribe expects PCM with additional metadata, encoded as binary
             let binary = convertAudioToBinaryMessage(rawAudioChunk);
             if (socket.readyState === socket.OPEN)
             {
               
                socket.send(binary);
             }
        }
    )};

    // handle messages, errors, and close events
    wireSocketEvents();
}

function setLanguage() {
    languageCode = $('#language').find(':selected').val();
    if (languageCode == "en-US" || languageCode == "es-US")
        sampleRate = 44100;
    else
        sampleRate = 8000;
}

function setRegion() {
    region = $('#region').find(':selected').val();
}

function sentimentAnalysis(text, sentiment){
    if (text.includes("*")){
        sentiment = "curse";
    }

    switch(sentiment.toLowerCase()){
        case "positive":
            $('#sentiment').attr("src","../images/positive.png");
            break;
        case "neutral":
            $('#sentiment').attr("src","../images/neutral.png");
            break;
        case "negative":
            $('#sentiment').attr("src","../images/negative.png");
            break;
        case "curse":
            $('#sentiment').attr("src","../images/curse.png");
        
    }
    $('#sentiment').show();

}

function wireSocketEvents() {
    // handle inbound messages from Amazon Transcribe
    socket.onmessage = function (message) {
        //convert the binary event stream message to JSON
        let messageWrapper = eventStreamMarshaller.unmarshall(Buffer(message.data));
        let messageBody = JSON.parse(String.fromCharCode.apply(String, messageWrapper.body));
        if (messageWrapper.headers[":message-type"].value === "event") {
            handleEventStreamMessage(messageBody);
        }
        else {
            transcribeException = true;
            showError(messageBody.Message);
            toggleStartStop();
        }
    };

    socket.onerror = function () {
        socketError = true;
        showError('WebSocket connection error. Try again.');
        toggleStartStop();
    };
    
    socket.onclose = function (closeEvent) {
        micStream.stop();
        
        // the close event immediately follows the error event; only handle one.
        if (!socketError && !transcribeException) {
            if (closeEvent.code != 1000) {
                showError('</i><strong>Streaming Exception</strong><br>' + closeEvent.reason);
            }
            toggleStartStop();
        }
    };
}

let handleEventStreamMessage = function (messageJson) {
    let results = messageJson.Transcript.Results;
    
    if (results.length > 0) {
        if (results[0].Alternatives.length > 0) {
            let transcript = results[0].Alternatives[0].Transcript;
            // fix encoding for accented characters
            transcript = decodeURIComponent(escape(transcript));
            var randomFont = Math.floor(Math.random()*fonts.length);
            var randomCSS = Math.floor(Math.random()*csss.length);
            // $("#voicetext").attr("class", csss[randomCSS])
            $("#voicetext").css("font-family", fonts[randomFont])


            $('#voicetext').text(transcript);
            
            getGiphyUrl(transcript);
            generateQRCode();
            // generateQRCode();
            // update the textarea with the latest result
            // $('#transcript').val(transcription + transcript + "\n");
         

            // if this transcript segment is final, add it to the overall transcription
            if (!results[0].IsPartial) {
                //scroll the textarea down
                // $('#transcript').scrollTop($('#transcript')[0].scrollHeight);

                transcript += transcript + "\n";
            }
        }
    }
}

let closeSocket = function () {
    if (socket.readyState === socket.OPEN) {
        micStream.stop();

        // Send an empty frame so that Transcribe initiates a closure of the WebSocket after submitting all transcripts
        let emptyMessage = getAudioEventMessage(Buffer.from(new Buffer([])));
        let emptyBuffer = eventStreamMarshaller.marshall(emptyMessage);
        socket.send(emptyBuffer);
    }
}

$('#stop-button').click(function () {
    closeSocket();
    toggleStartStop();
});

$('#reset-button').click(function (){
    $('#transcript').val('');
    transcription = '';
});

$('#voicetext').click(function (){
    var bgArray = ['blue-medium.jpg', 'blue-large.jpg', 'brick-large.jpg','brick-medium.jpg', 'cement-large.jpg', 'cement-medium.jpg', 'light-large.jpg', 'light-medium.jpg', 'white-large.jpg', 'white-medium.jpg', 'remars-wall.png', 'plank-wall.jpg'];
    var bg = bgArray[Math.floor(Math.random() * bgArray.length)];
    var path = 'url(./images/';
    $('body').css('background-image', path+bg+")");
    // document.body.style.backgroundRepeat = "repeat";// Background repeat

});
function toggleStartStop(disableStart = false) {
    $('#start-button').prop('disabled', disableStart);
    $('#stop-button').attr("disabled", !disableStart);
}

function showError(message) {
    $('#error').html('<i class="fa fa-times-circle"></i> ' + message);
    $('#error').show();
}

function convertAudioToBinaryMessage(audioChunk) {
    let raw = mic.toRaw(audioChunk);

    if (raw == null)
        return;

    // downsample and convert the raw audio bytes to PCM
    let downsampledBuffer = audioUtils.downsampleBuffer(raw, inputSampleRate, sampleRate);
    let pcmEncodedBuffer = audioUtils.pcmEncode(downsampledBuffer);

    // add the right JSON headers and structure to the message
    let audioEventMessage = getAudioEventMessage(Buffer.from(pcmEncodedBuffer));
    //convert the JSON object + headers into a binary event stream message
    let binary = eventStreamMarshaller.marshall(audioEventMessage);

    return binary;
}

function getAudioEventMessage(buffer) {
    // wrap the audio data in a JSON envelope
    return {
        headers: {
            ':message-type': {
                type: 'string',
                value: 'event'
            },
            ':event-type': {
                type: 'string',
                value: 'AudioEvent'
            }
        },
        body: buffer
    };
}

function createPresignedUrl() {
    let endpoint = "transcribestreaming." + region + ".amazonaws.com:8443";
    // get a preauthenticated URL that we can use to establish our WebSocket
    return v4.createPresignedURL(
        'GET',
        endpoint,
        '/stream-transcription-websocket',
        'transcribe',
        crypto.createHash('sha256').update('', 'utf8').digest('hex'), {
            'key': accessKeyId,
            'secret': secretAccessKey,
            'sessionToken': sessionToken,
            'protocol': 'wss',
            'expires': 15,
            'region': region,
            'query': "language-code=" + languageCode + "&media-encoding=pcm&sample-rate=" + sampleRate + "&vocabulary-filter-name=profanity-filter-words&vocabulary-filter-method=mask"
        }
    );
}
function getGiphyUrl(transcript) {  
    var xhr = new XMLHttpRequest();
    xhr.open("POST", "https://ppa4i5rqod.execute-api.us-east-2.amazonaws.com/prod/search-giphy", true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.setRequestHeader('Authorization', idToken);
    xhr.send(JSON.stringify(transcript));
    xhr.onload = function() {
        var data = JSON.parse(this.responseText);
        // $('#giphy-image').attr("src", data.url);
        $('#giphy-image').html('<object width="600" height="400" data='+ data.url +"/>'");
        sentimentAnalysis(transcript, data.sentiment);
        // console.log(data.sentiment);
    };

}


$('#memeswitch').click( function () {
    $('#giphy-image').toggle();
});

$('#login-button').click( function () {
    try {
        let username = $('#email_id').val();
        let password = $('#password').val()
        const user =  Auth.signIn(username, password).then(function(value) {
            // Get temp credentials
            Auth.currentUserCredentials().then(function(value){
                accessKeyId = value.accessKeyId;
                secretAccessKey = value.secretAccessKey;
                sessionToken = value.sessionToken;
            }, function(error) {
                console.log("Error while getting user credentials:", error);
            });

            //Enable transcribe div if user is authenticated
            Auth.currentAuthenticatedUser().then(function(value){
                $('#transcribeDiv').show();
                $('#loginDiv').hide();
            }, function(error) {
                console.log("Error while checking if user is authenticated:", error);
            });

            Auth.currentSession().then(function(value){
                idToken = value.getIdToken().getJwtToken();
            }, function(error) {
                console.log("Error while getting id token:", error);
            });


        }, function(error){
            console.log("Unsuccessful login:", error);
        });
        
        
    } catch (error) {
        console.log('error signing in', error);
    }
});

$('#signout-button').click( function () {
    try {
        closeSocket();
        Auth.signOut({global: true}).then(function(value){
            $('#transcribeDiv').hide();
            $('#loginDiv').show();
        });
    } catch (error) {
        console.log('error signing out:', error);
    }
});


async function generateQRCode() {
    htmlToImage.toBlob(document.body)
    .then(function (blob) {

        s3 = new AWS.S3({
            accessKeyId: accessKeyId,
            secretAccessKey: secretAccessKey,
            sessionToken: sessionToken
        });
          
        let file = new File([blob], "test.png", {type: "image/png"})
        let fileName = uuidv4()+".png";

        const params = {
            Bucket: "sonicgraffiti",
            Key: fileName,
            Body: file,
            ContentType: 'image/png'
        };
        
        s3.putObject(params,function(err, data){
            if (err) {
                console.log("Error uploading: "+err);
            }
            
            let fileObjectUrl = "https://d82qytnc9ta5w.cloudfront.net/"+fileName;
            let tweetMessage = "https://twitter.com/intent/tweet?text=Check%20this%20out%20%23sonicgraffiti%20%23reMARS2022%20%23amazontranscribe%20"+fileObjectUrl;

            QRCode.toCanvas(document.getElementById("qrcode"), 
            tweetMessage,
            { version: 10 }, 
            function(error) {
                if(error) console.error("Error in QR gen:"+error);
            }); 
            
        });
    //   window.saveAs(blob, 'my-node.png');
    });
}
