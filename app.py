from flask import Flask, request, jsonify, send_file, make_response
from flask_cors import CORS
import os
from werkzeug.utils import secure_filename
import rasterio
from pyproj import Transformer
import logging
from PIL import Image

app = Flask(__name__, static_url_path='/assets', static_folder='assets')
CORS(app, resources={r"/*": {"origins": "*"}})

# Local upload folder path (relative to PythonAnywhere environment)
LOCAL_UPLOAD_FOLDER = '/home/dutta007/mysite/uploads'

# Create local uploads folder if not exists
os.makedirs(LOCAL_UPLOAD_FOLDER, exist_ok=True)

# Configure logging
logging.basicConfig(level=logging.DEBUG)

@app.route('/')
def index():
    return send_file(os.path.join('assets', 'index.html'))

@app.route('/upload', methods=['POST'])
def upload_file():
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file part in the request'})
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'No selected file'})
        
        if file:
            filename = secure_filename(file.filename)
            filepath = os.path.join(LOCAL_UPLOAD_FOLDER, filename)
            file.save(filepath)
            
            # Process the image to get its bounds and convert to PNG
            bounds = process_image(filepath)
            png_filepath = convert_to_png(filepath)
            png_filename = os.path.basename(png_filepath)
            png_file_url = f'/uploads/{png_filename}'
            
            logging.debug(f'Filepath: {filepath}')
            logging.debug(f'Bounds: {bounds}')
            logging.debug(f'PNG File URL: {png_file_url}')
            
            return jsonify({'filepath': png_file_url, 'bounds': bounds})
    except Exception as e:
        logging.error(f'Error: {e}')
        return jsonify({'error': str(e)})

@app.route('/uploads/<filename>', methods=['GET'])
def download_file(filename):
    try:
        local_filepath = os.path.join(LOCAL_UPLOAD_FOLDER, filename)
        return send_file(local_filepath, as_attachment=True)
    except Exception as e:
        logging.error(f'File download error: {e}')
        return jsonify({'error': 'File not found'})

@app.route('/public/satellite.tif', methods=['GET'])
def serve_tif():
    try:
        return send_file(os.path.join(LOCAL_UPLOAD_FOLDER, 'satellite.tif'), as_attachment=False)
    except Exception as e:
        logging.error(f'File download error: {e}')
        return jsonify({'error': 'File not found'})

def process_image(image_path):
    try:
        # Read the TIFF file to get its bounds
        with rasterio.open(image_path) as src:
            bounds = src.bounds
            
            # Convert coordinates from the source CRS to EPSG:4326
            transformer = Transformer.from_crs(src.crs, "EPSG:4326", always_xy=True)
            bottom_left = transformer.transform(bounds.left, bounds.bottom)
            top_right = transformer.transform(bounds.right, bounds.top)
            
            # Return bounds in [lng, lat] format
            bounds_4326 = {
                "left": bottom_left[0],
                "bottom": bottom_left[1],
                "right": top_right[0],
                "top": top_right[1]
            }
            return bounds_4326
    except Exception as e:
        logging.error(f'Error processing image: {e}')
        raise

def convert_to_png(tiff_path):
    try:
        with rasterio.open(tiff_path) as src:
            data = src.read()
            profile = src.profile
            
            png_path = tiff_path.replace('.tif', '.png')
            with rasterio.open(png_path, 'w', driver='PNG', width=profile['width'], height=profile['height'], count=profile['count'], dtype=data.dtype) as dst:
                dst.write(data)
        
        # Rotate image if needed and save it
        img = Image.open(png_path)
        img = img.rotate(0, expand=True)  # Adjust rotation as needed
        img.save(png_path)
        
        return png_path
    except Exception as e:
        logging.error(f'Error converting to PNG: {e}')
        raise

# Note: Do not include app.run() as it is not needed in PythonAnywhere
