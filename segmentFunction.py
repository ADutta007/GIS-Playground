import json
import boto3
import numpy as np
from PIL import Image
import tflite_runtime.interpreter as tflite
import io
import pandas as pd
import os

# Define class names and colors
CLASS_INFO = {
    0: ('Building', (255, 0, 0)),    # Red
    1: ('Land', (0, 255, 0)),        # Green
    2: ('Road', (128, 128, 128)),    # Gray
    3: ('Vegetation', (0, 128, 0)),  # Dark Green
    4: ('Water', (0, 0, 255)),       # Blue
    5: ('Unlabeled', (255, 255, 255))# White
}

def download_from_s3(bucket, key):
    s3 = boto3.client('s3')
    response = s3.get_object(Bucket=bucket, Key=key)
    return response['Body'].read()

def load_tflite_model(model_content):
    interpreter = tflite.Interpreter(model_content=model_content)
    interpreter.allocate_tensors()
    return interpreter

def preprocess_image(image):
    return np.array(image).astype(np.float32) / 255.0

def pad_image(image, patch_size=(256, 256)):
    h, w, _ = image.shape
    ph, pw = patch_size
    new_h = ((h // ph) + 1) * ph if h % ph != 0 else h
    new_w = ((w // pw) + 1) * pw if w % pw != 0 else w
    padded_image = np.zeros((new_h, new_w, 3), dtype=np.float32)
    padded_image[:h, :w, :] = image
    return padded_image

def create_patches(image, patch_size=(256, 256)):
    patches = []
    h, w, _ = image.shape
    ph, pw = patch_size
    for i in range(0, h, ph):
        for j in range(0, w, pw):
            patch = image[i:i+ph, j:j+pw, :]
            patches.append(patch)
    return patches, h, w

def stitch_patches(patches, padded_shape, original_shape, patch_size=(256, 256)):
    ph, pw = patch_size
    padded_h, padded_w, _ = padded_shape
    full_segmentation = np.zeros((padded_h, padded_w), dtype=np.int32)
    idx = 0
    for i in range(0, padded_h, ph):
        for j in range(0, padded_w, pw):
            if idx < len(patches):
                patch = patches[idx]
                print(f"Stitching patch {idx} at position ({i}, {j}) with shape {patch.shape}")
                full_segmentation[i:i+ph, j:j+pw] = patch
                idx += 1
    return full_segmentation[:original_shape[0], :original_shape[1]]

def predict(image, interpreter):
    input_details = interpreter.get_input_details()
    output_details = interpreter.get_output_details()
    
    interpreter.set_tensor(input_details[0]['index'], image.astype(np.float32))
    interpreter.invoke()
    output_data = interpreter.get_tensor(output_details[0]['index'])
    
    return np.argmax(output_data, axis=-1)

def clean_segmentation(segmentation, min_area=100):
    h, w = segmentation.shape
    cleaned = np.zeros_like(segmentation)
    label_id = 1
    for class_id in np.unique(segmentation):
        if class_id == 5:  # Skip the Unlabeled class
            continue
        mask = (segmentation == class_id).astype(np.uint8)
        components = get_connected_components(mask)
        for component in components:
            if component.size >= min_area:
                cleaned[component.coords[:, 0], component.coords[:, 1]] = class_id
    return cleaned

def get_connected_components(mask):
    components = []
    visited = np.zeros_like(mask, dtype=bool)
    h, w = mask.shape

    def dfs(x, y):
        stack = [(x, y)]
        component = []
        while stack:
            cx, cy = stack.pop()
            if visited[cx, cy] or mask[cx, cy] == 0:
                continue
            visited[cx, cy] = True
            component.append((cx, cy))
            for nx, ny in [(cx-1, cy), (cx+1, cy), (cx, cy-1), (cx, cy+1)]:
                if 0 <= nx < h and 0 <= ny < w and not visited[nx, ny] and mask[nx, ny] == 1:
                    stack.append((nx, ny))
        return component

    for i in range(h):
        for j in range(w):
            if mask[i, j] == 1 and not visited[i, j]:
                component_coords = dfs(i, j)
                if component_coords:
                    components.append(ConnectedComponent(component_coords))
    return components

class ConnectedComponent:
    def __init__(self, coords):
        self.coords = np.array(coords)
        self.size = len(coords)

def colorize_segmentation(segmentation):
    colored_seg = np.zeros((segmentation.shape[0], segmentation.shape[1], 3), dtype=np.uint8)
    for class_id, (_, color) in CLASS_INFO.items():
        colored_seg[segmentation == class_id] = color
    return colored_seg

def save_to_s3(content, bucket, key, content_type):
    s3 = boto3.client('s3')
    s3.put_object(Bucket=bucket, Key=key, Body=content, ContentType=content_type)

def lambda_handler(event, context):
    try:
        # Configuration
        model_bucket = 'dutta007bucket'
        model_key = 'model.tflite'
        input_bucket = event['bucket']
        input_key = event['key']
        output_bucket = event['output_bucket']
        output_key_prefix = event['output_key']

        # Download and load the model
        model_content = download_from_s3(model_bucket, model_key)
        interpreter = load_tflite_model(model_content)

        # Download and preprocess the image
        image_content = download_from_s3(input_bucket, input_key)
        image = Image.open(io.BytesIO(image_content))
        full_image = preprocess_image(image)

        # Pad the image and create patches
        padded_image = pad_image(full_image)
        patches, original_height, original_width = create_patches(padded_image)

        # Debug statements
        print(f"Original height: {original_height}, Original width: {original_width}")
        print(f"Padded shape: {padded_image.shape}")
        print(f"Number of patches: {len(patches)}")

        # Predict segmentation mask for each patch
        segmented_patches = []
        for i, patch in enumerate(patches):
            prediction = predict(np.expand_dims(patch, axis=0), interpreter)
            segmented_patches.append(prediction)
            print(f"Patch {i}: Prediction shape: {prediction.shape}")

        # Stitch the segmented patches back together
        full_segmentation = stitch_patches(segmented_patches, padded_image.shape, full_image.shape)
        print(f"Full segmentation shape: {full_segmentation.shape}")

        # Clean up the segmentation
        cleaned_segmentation = clean_segmentation(full_segmentation)

        # Colorize the cleaned segmentation
        colored_segmentation = colorize_segmentation(cleaned_segmentation)

        # Define the new filename
        file_base = os.path.basename(input_key)
        file_name, file_ext = os.path.splitext(file_base)
        output_key = f"{output_key_prefix}{file_name}_classified.png"

        # Save the colored segmentation to S3
        colored_seg_image = Image.fromarray(colored_segmentation)
        colored_seg_buffer = io.BytesIO()
        colored_seg_image.save(colored_seg_buffer, format="PNG")
        colored_seg_buffer.seek(0)
        save_to_s3(colored_seg_buffer.getvalue(), output_bucket, output_key, 'image/png')

        # Fetch bounds from png-export
        bounds_key = f"png-export/{file_name}_bounds.json"
        bounds_content = download_from_s3(input_bucket, bounds_key)
        bounds = json.loads(bounds_content)

        # Save the bounds JSON file to segment-upload folder
        save_to_s3(json.dumps(bounds), output_bucket, f"{output_key_prefix}{file_name}_bounds.json", 'application/json')

        # Create a simple CSV with class statistics
        class_stats = pd.DataFrame([
            {'class': CLASS_INFO[i][0], 'pixel_count': np.sum(cleaned_segmentation == i)}
            for i in range(len(CLASS_INFO))
        ])
        csv_buffer = io.StringIO()
        class_stats.to_csv(csv_buffer, index=False)
        save_to_s3(csv_buffer.getvalue(), output_bucket, f"{output_key_prefix}{file_name}_stats.csv", 'text/csv')

        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': 'Segmentation completed, colored image and statistics saved to S3',
                'output_bucket': output_bucket,
                'colored_image_key': output_key,
                'bounds_key': f"{output_key_prefix}{file_name}_classified_bounds.json",
                'stats_key': f"{output_key_prefix}{file_name}_stats.csv"
            })
        }
    except Exception as e:
        print(f"Error: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)})
        }
