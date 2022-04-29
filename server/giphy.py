# python
import json
from urllib import parse, request

url = "http://api.giphy.com/v1/gifs/search"


def lambda_handler(event, context):
    
    print(event["body"])
    
    params = parse.urlencode({
        "q": event["body"],
        "api_key": "FICE9M95ebcgyArRZiVsNUCDYkH5PU8S",
        "limit": "1"
    })
    
    with request.urlopen("".join((url, "?", params))) as response:
        data = json.loads(response.read())
        
    giphyUrl = data["data"][0]["images"]["downsized"]["url"]    

    print(giphyUrl)
    
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