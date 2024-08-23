import json
import requests

def lambda_handler(event, context):
    # Extract the S3 object information from the event
    bucket_name = event['Records'][0]['s3']['bucket']['name']
    object_key = event['Records'][0]['s3']['object']['key']
    
    # Construct the file processing URL
    processing_url = "https://ec2-13-40-143-127.eu-west-2.compute.amazonaws.com/process-image"
    
    try:
        # Trigger the processing on the EC2 instance
        response = requests.post(
            processing_url,
            json={'s3_key': object_key},
            headers={'Content-Type': 'application/json'},
            verify=False  # Disable SSL verification
        )
        
        # Log the response or handle errors
        print(f"Processing response: {response.status_code} - {response.text}")

        return {
            'statusCode': 200,
            'body': json.dumps('Process initiated successfully')
        }
    except requests.exceptions.RequestException as e:
        # Handle the error
        print(f"Error: {e}")
        return {
            'statusCode': 500,
            'body': json.dumps(f'Error: {str(e)}')
        }
