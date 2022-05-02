# python
import json
from urllib import parse, request
import boto3
from datetime import datetime
import uuid

url = "http://api.giphy.com/v1/gifs/search"
# url = "http://api.giphy.com/v1/clips/search"

dynamoDB = boto3.resource('dynamodb')
table = dynamoDB.Table('SonicGraffitiTable')

comprehend = boto3.client('comprehend')

def lambda_handler(event, context):
    
    print(event["body"])
    voice_text=event["body"]
    
    params = parse.urlencode({
        "q": event["body"],
        "api_key": "FICE9M95ebcgyArRZiVsNUCDYkH5PU8S",
        "limit": "1",
        "rating": "g"
    })
    
    with request.urlopen("".join((url, "?", params))) as response:
        data = json.loads(response.read())
        
    giphyUrl = data["data"][0]["images"]["downsized"]["url"]    

    print(giphyUrl)
    
    # Store in dynamoDB
    date=str(datetime.now()) 
    try:
        response = table.put_item(
            Item= {
                'uuid': uuid.uuid1().hex,
                'voice-search': voice_text,
                'gif-image': giphyUrl,
                'timestamp': date
            }
            )
    except Exception as e:
        raise Exception('Error adding text', e)
    
    # AWS Comprehend sentiment analysis
    comprehend_response = comprehend.detect_sentiment(Text=voice_text, LanguageCode='en')
    print(comprehend_response['Sentiment'])
    
    
    return {
        "statusCode": 200,
        "headers": {
            "Access-Control-Allow-Headers" : "Content-Type, Origin, X-Requested-With, Accept, Authorization, Access-Control-Allow-Methods, Access-Control-Allow-Headers, Access-Control-Allow-Origin",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "OPTIONS,POST,GET,PUT"
        },
        "body": json.dumps({
            "url": giphyUrl
        })
    }