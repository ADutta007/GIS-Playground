from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import boto3
import os
import requests
import urllib3
import json
import uuid

# Disable warnings about insecure requests
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

app = Flask(__name__)
CORS(app)  # This will enable CORS for all routes

# AWS S3 and Lambda Configuration
S3_BUCKET = "dutta007bucket"
AWS_REGION = "eu-west-2"
LAMBDA_FUNCTION_NAME = "segmentFunction"
LAMBDA_EXPORT_FUNCTION = 'convertPNGtoTIFF'
s3_client = boto3.client('s3', region_name=AWS_REGION)
lambda_client = boto3.client('lambda', region_name=AWS_REGION)

# Serve static files (e.g., index.html, script.js, styles.css)
@app.route('/')
def serve_index():
    return send_from_directory('assets', 'index.html')

@app.route('/assets/<path:filename>')
def serve_assets(filename):
    return send_from_directory('assets', filename)


@app.route('/generate-presigned-url', methods=['GET'])
def generate_presigned_url():
    object_name = request.args.get('object_name')
    if not object_name:
        return jsonify({'error': 'Missing object_name in request'}), 400

    # No need to generate another UUID; use the object_name as received
    try:
        presigned_url = s3_client.generate_presigned_url(
            'put_object',
            Params={'Bucket': S3_BUCKET, 'Key': object_name, 'ContentType': 'image/tiff'},
            ExpiresIn=3600  # URL expires in 1 hour
        )
        return jsonify({'url': presigned_url, 'object_name': object_name})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# Endpoint to get processed image info from png-export folder
@app.route('/get-processed-image-info', methods=['GET'])
def get_processed_image_info():
    object_name = request.args.get('object_name')
    if not object_name:
        return jsonify({'error': 'Missing object_name in request'}), 400
    try:
        # Generate a pre-signed URL for the processed PNG image
        presigned_url = s3_client.generate_presigned_url(
            'get_object',
            Params={'Bucket': S3_BUCKET, 'Key': object_name},
            ExpiresIn=3600  # URL expires in 1 hour
        )

        # Retrieve the bounds information from the JSON file
        bounds_key = object_name.replace('.png', '_bounds.json')
        bounds_object = s3_client.get_object(Bucket=S3_BUCKET, Key=bounds_key)
        bounds = json.loads(bounds_object['Body'].read().decode('utf-8'))
        return jsonify({'png_url': presigned_url, 'bounds': bounds})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# Endpoint to invoke Lambda function to process the image
@app.route('/invoke-segmentation', methods=['POST'])
def invoke_segmentation():
    data = request.get_json()
    image_key = data.get('image_key')
    if not image_key:
        return jsonify({'error': 'Missing image_key in request'}), 400
    try:
        response = lambda_client.invoke(
            FunctionName=LAMBDA_FUNCTION_NAME,
            InvocationType='Event',
            Payload=json.dumps({'bucket': S3_BUCKET, 'key': image_key, 'output_bucket': S3_BUCKET, 'output_key': 'segment-upload/'})
        )
        return jsonify({'message': 'Segmentation invoked', 'statusCode': response['StatusCode']})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# Endpoint to get processed image info from segment-upload folder
@app.route('/get-segmented-image-info', methods=['GET'])
def get_segmented_image_info():
    object_name = request.args.get('object_name')
    if not object_name:
        return jsonify({'error': 'Missing object_name in request'}), 400
    try:
        # Generate a pre-signed URL for the processed PNG image
        presigned_url = s3_client.generate_presigned_url(
            'get_object',
            Params={'Bucket': S3_BUCKET, 'Key': object_name},
            ExpiresIn=3600  # URL expires in 1 hour
        )

        # Modify the logic to fetch the correct bounds JSON file
        base_name = object_name.rsplit('_', 1)[0]  # Extract base name before the suffix
        bounds_key = f"{base_name}_bounds.json"

        bounds_object = s3_client.get_object(Bucket=S3_BUCKET, Key=bounds_key)
        bounds = json.loads(bounds_object['Body'].read().decode('utf-8'))
        return jsonify({'png_url': presigned_url, 'bounds': bounds})
    except s3_client.exceptions.NoSuchKey:
        error_message = f"Object {object_name} or {bounds_key} not found in bucket {S3_BUCKET}."
        return jsonify({'error': error_message}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/export-tiff', methods=['POST'])
def export_tiff():
    data = request.json
    png_s3_key = data.get('s3_key')

    if not png_s3_key:
        return jsonify({'error': 'Missing s3_key in request'}), 400

    try:
        # Check if the file is already in the TIFF format (not classified)
        if png_s3_key.endswith('.tif') and '_classified' not in png_s3_key:
            # File is already a TIFF, no need to invoke Lambda
            presigned_url = s3_client.generate_presigned_url(
                'get_object',
                Params={'Bucket': S3_BUCKET, 'Key': png_s3_key},
                ExpiresIn=3600  # URL expires in 1 hour
            )
            return jsonify({'tiff_url': presigned_url})
        else:
            # Invoke the Lambda function to convert the PNG to TIFF
            response = lambda_client.invoke(
                FunctionName=LAMBDA_EXPORT_FUNCTION,
                InvocationType='RequestResponse',  # Synchronous call
                Payload=json.dumps({'s3_key': png_s3_key})
            )

            # Read the response payload
            response_payload = json.loads(response['Payload'].read())

            # Check if the Lambda function returned an error
            if response_payload.get('statusCode') != 200:
                return jsonify({'error': response_payload.get('body')}), 500

            # Parse the body of the Lambda response (ensure it's a JSON object)
            response_body = json.loads(response_payload['body'])

             # Get the TIFF key from the Lambda response
            # Get the TIFF S3 key from the Lambda response
            tiff_s3_key = response_body.get('tiff_url').split(f"https://{S3_BUCKET}.s3.{AWS_REGION}.amazonaws.com/")[-1]
            if not tiff_s3_key:
                raise ValueError("TIFF S3 key not found in response")

            # Generate a presigned URL for the TIFF file
            tiff_presigned_url = s3_client.generate_presigned_url(
                'get_object',
                Params={'Bucket': S3_BUCKET, 'Key': tiff_s3_key},
                ExpiresIn=3600  # URL expires in 1 hour
            )

            # Return the presigned URL to the client
            return jsonify({'tiff_url': tiff_presigned_url})

    except Exception as e:
        return jsonify({'error': str(e)}), 500



