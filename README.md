                                                                              WebGIS-TIFF-Viewer

WebGIS-TIFF-Viewer is an interactive web application that allows users to upload and visualize geospatial TIFF images on a MapLibre map. The application supports switching between different basemaps, adjusting the opacity of the uploaded images, and provides information about the image location and weather conditions.

Features
Upload geospatial TIFF images and display them on a MapLibre map.
Switch between different basemaps (Streets, Winter, Hybrid).
Adjust the opacity of the uploaded images.
Display the distance from the user's location to the image location.
Show weather information for the image location.
Toggle visibility of the uploaded image layer.
Technologies Used
HTML, CSS, JavaScript
MapLibre GL JS
Flask (Python)
OpenWeatherMap API
OpenCageData Geocoding API
Installation
Clone the repository:

sh
Copy code
git clone https://github.com/your-username/GeoMapVisualizer.git
cd GeoMapVisualizer
Install the required Python packages:

sh
Copy code
pip install flask flask-cors rasterio maplibre-gl pyproj
Set up your API keys:

OpenWeatherMap API key
OpenCageData Geocoding API key
Update the API keys in the script.js file:

javascript
Copy code
const weatherApiKey = 'YOUR_OPENWEATHERMAP_API_KEY';
const geocodingApiKey = 'YOUR_OPENCAGE_API_KEY';
Run the Flask application:

sh
Copy code
python app.py
Usage
Open the web application in your browser at http://localhost:5000.
Upload a geospatial TIFF image using the upload button.
The image will be displayed on the map, and you can switch between different basemaps.
Adjust the image opacity using the slider.
View distance and weather information related to the image location.
Toggle the visibility of the uploaded image layer using the layer control.
File Structure
php
Copy code
GeoMapVisualizer/
│
├── app.py                   # Flask backend for handling uploads and processing images
├── static/
│   ├── index.html           # Main HTML file
│   ├── css/
│   │   └── styles.css       # CSS styles
│   ├── js/
│   │   ├── script.js        # Main JavaScript file
│   │   └── basemap.js       # JavaScript for handling basemap switching
└── uploads/                 # Directory to store uploaded images
Contributing
Contributions are welcome! Please fork the repository and create a pull request with your changes.

License
This project is licensed under the MIT License.
