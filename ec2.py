from flask import Flask, request, jsonify
import boto3
import os
import rasterio
from rasterio.warp import calculate_default_transform, reproject, Resampling, transform_bounds
from rasterio.transform import from_bounds
import traceback
import json
from PIL import Image
import uuid
import numpy as np

app = Flask(__name__)

S3_BUCKET = "dutta007bucket"
AWS_REGION = "eu-west-2"
s3_client = boto3.client('s3', region_name=AWS_REGION)

def download_file(s3_client, bucket, s3_key, local_path):
    s3_client.download_file(bucket, s3_key, local_path)

def upload_file(s3_client, local_path, bucket, s3_key, content_type=None):
    extra_args = {'ContentType': content_type} if content_type else {}
    s3_client.upload_file(local_path, bucket, s3_key, ExtraArgs=extra_args)

def convert_tiff_to_png(local_tiff_path, local_png_path):
    with rasterio.open(local_tiff_path) as src:
        bounds = transform_bounds(src.crs, 'EPSG:4326', *src.bounds)
        bounds_dict = {'left': bounds[0], 'bottom': bounds[1], 'right': bounds[2], 'top': bounds[3]}
        transform, width, height = calculate_default_transform(src.crs, 'EPSG:4326', src.width, src.height, *src.bounds)
        kwargs = src.meta.copy()
        kwargs.update({
            'crs': 'EPSG:4326',
            'transform': transform,
            'width': width,
            'height': height,
            'driver': 'PNG',
            'compress': 'DEFLATE',  # Use DEFLATE compression
            'zlevel': 9  # Maximum compression level
        })
        with rasterio.open(local_png_path, 'w', **kwargs) as dst:
            for i in range(1, src.count + 1):
                reproject(
                    source=rasterio.band(src, i),
                    destination=rasterio.band(dst, i),
                    src_transform=src.transform,
                    src_crs=src.crs,
                    dst_transform=transform,
                    dst_crs='EPSG:4326',
                    resampling=Resampling.nearest
                )
    return bounds_dict




def verify_png(local_png_path):
    try:
        with Image.open(local_png_path) as img:
            img.verify()
        print("PNG file is valid")
    except Exception as e:
        print(f"PNG file is invalid: {str(e)}")
        raise

def clean_up(files):
    for file in files:
        try:
            os.remove(file)
        except Exception as e:
            print(f"Error removing file {file}: {str(e)}")


@app.route('/process-image', methods=['POST'])
def process_image():
    data = request.json
    s3_key = data.get('s3_key')  # The S3 key includes the UUID
    if not s3_key:
        return jsonify({'error': 'Missing s3_key in request'}), 400

    try:
        file_name = os.path.basename(s3_key)

        # No need to extract the UUID again; use the existing base name
        base_file_name = file_name.rsplit('.', 1)[0]  # This includes the UUID

        local_tiff_path = f'/tmp/{file_name}'
        png_filename = f"{base_file_name}.png"  # No need to append the UUID again
        local_png_path = f'/tmp/{png_filename}'

        # Ensure the /tmp directory is used correctly without subdirectories
        if not os.path.exists('/tmp'):
            os.makedirs('/tmp')

        # Download the TIFF file from S3
        download_file(s3_client, S3_BUCKET, s3_key, local_tiff_path)

        # Convert TIFF to PNG
        bounds_dict = convert_tiff_to_png(local_tiff_path, local_png_path)

        # Verify PNG integrity
        verify_png(local_png_path)

        # Upload PNG to S3
        png_s3_key = f'png-export/{png_filename}'
        upload_file(s3_client, local_png_path, S3_BUCKET, png_s3_key, 'image/png')

        # Verify S3 upload
        s3_client.head_object(Bucket=S3_BUCKET, Key=png_s3_key)
        print(f"File {png_s3_key} uploaded successfully to S3")

        # Generate a URL that doesn't require signing
        png_url = f"https://{S3_BUCKET}.s3.{AWS_REGION}.amazonaws.com/{png_s3_key}"

        # Save bounds to S3 as JSON, with the same UUID
        bounds_key = f'png-export/{base_file_name}_bounds.json'
        s3_client.put_object(Bucket=S3_BUCKET, Key=bounds_key, Body=json.dumps(bounds_dict))

        clean_up([local_tiff_path, local_png_path])
        print(bounds_dict)

        return jsonify({'png_url': png_url, 'bounds': bounds_dict})

    except Exception as e:
        error_message = str(e)
        stack_trace = traceback.format_exc()
        print(f"Error: {error_message}")
        print(f"Stack trace: {stack_trace}")
        return jsonify({'error': error_message, 'stack_trace': stack_trace}), 500



@app.route('/convert-png-to-tif', methods=['POST'])
def convert_png_to_tif():
    data = request.json
    png_s3_key = data.get('s3_key')
    if not png_s3_key:
        return jsonify({'error': 'Missing s3_key in request'}), 400

    try:
        png_file_name = os.path.basename(png_s3_key)
        tiff_file_name = png_file_name.rsplit('.', 1)[0] + '.tif'
        local_png_path = f'/tmp/{png_file_name}'
        local_tiff_path = f'/tmp/{tiff_file_name}'

        # Download the PNG file from S3
        download_file(s3_client, S3_BUCKET, png_s3_key, local_png_path)

        # Fetch bounds from corresponding JSON file
        bounds_key = png_s3_key.replace('classified.png', 'bounds.json')
        bounds_obj = s3_client.get_object(Bucket=S3_BUCKET, Key=bounds_key)
        bounds = json.loads(bounds_obj['Body'].read().decode('utf-8'))

        # Convert PNG to TIFF with geospatial metadata
        with Image.open(local_png_path) as img:
            img = img.convert('RGBA')
            transform = from_bounds(bounds['left'], bounds['bottom'], bounds['right'], bounds['top'], img.width, img.height)
            meta = {
                'driver': 'GTiff',
                'dtype': 'uint8',
                'count': 4,
                'height': img.height,
                'width': img.width,
                'crs': 'EPSG:4326',
                'transform': transform,
                'compress': 'LZW'
            }
            with rasterio.open(local_tiff_path, 'w', **meta) as dst:
                for i, band in enumerate(img.split(), start=1):
                    dst.write(np.array(band), i)

        # Upload TIFF to S3
        tiff_s3_key = f'tif-export/{tiff_file_name}'
        upload_file(s3_client, local_tiff_path, S3_BUCKET, tiff_s3_key, 'image/tiff')

        # Generate a URL for the TIFF file
        tiff_url = f"https://{S3_BUCKET}.s3.{AWS_REGION}.amazonaws.com/{tiff_s3_key}"

        clean_up([local_png_path, local_tiff_path])

        return jsonify({'tiff_url': tiff_url})

    except Exception as e:
        error_message = str(e)
        stack_trace = traceback.format_exc()
        print(f"Error: {error_message}")
        print(f"Stack trace: {stack_trace}")
        return jsonify({'error': error_message, 'stack_trace': stack_trace}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
