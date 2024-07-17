console.log("script.js is loaded");

let map;
let uploadedImageLayerId = 'uploadedImageLayer';
let imageSource = null;
let imageLayer = null;

function initializeMap(lng, lat) {
    var map = new maplibregl.Map({
        container: 'map', // container ID
        style: baseMaps.STREETS.style, // street basemap style URL
        center: [lng, lat], // starting position [lng, lat]
        zoom: 13 // starting zoom
    });

    map.addControl(new maplibregl.NavigationControl(), 'top-left');
    map.addControl(new LayerSwitcherControl({ basemaps: baseMaps, initialBasemap: { id: "STREETS" } }), 'bottom-left');
    map.addControl(new OpacityControl(), 'top-right');
    map.addControl(new SimpleLayerControl(), 'top-right');

    document.getElementById('uploadBtn').addEventListener('click', function(event) {
        event.preventDefault();
        uploadFile(lng, lat);
    });

    map.on('styledata', () => {
        if (imageSource && imageLayer) {
            map.addSource('uploadedImage', imageSource);
            map.addLayer(imageLayer);
        }
    });



    function uploadFile(userLng, userLat) {
        var input = document.getElementById('fileInput');
        var file = input.files[0];
        var formData = new FormData();
        formData.append('file', file);

        console.log("Uploading file...");
        fetch('/upload', {  // Updated URL to point to the Flask server's upload route
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            console.log("Response from server:", data);
            if (data.error) {
                document.getElementById('results').innerText = data.error;
            } else {
                var resultsDiv = document.getElementById('results');
                resultsDiv.innerHTML = `
                    <h2>Image Uploaded Successfully</h2>
                `;
                displayImageOnMap(data.filepath, data.bounds, userLng, userLat);

                // Fetch weather data for the image location
                const { top, left, bottom, right } = data.bounds;
                const imageLat = (top + bottom) / 2;
                const imageLng = (left + right) / 2;
                fetchWeatherData(imageLat, imageLng);


            }

        })
        .catch(error => {
            console.error('Error:', error);
            document.getElementById('results').innerText = 'An error occurred: ' + error.message;
        });
    }


    function displayImageOnMap(imagePath, bounds, userLng, userLat) {
        console.log("Displaying image on map with path:", imagePath);
        console.log("Bounds:", bounds);

        // Calculate the centroid of the image
        const centroidLng = (bounds.left + bounds.right) / 2;
        const centroidLat = (bounds.top + bounds.bottom) / 2;

        // Calculate the distance from the user's location to the image centroid
        const distance = calculateDistance(userLat, userLng, centroidLat, centroidLng);
        document.getElementById('results').innerHTML += `<p>You are ${distance.toFixed(2)} km from the image location.</p>`;

        // Reverse geocode the image centroid to find the nearest place
        reverseGeocode(centroidLat, centroidLng, function(location) {
            document.getElementById('results').innerHTML += `<p>The image is located near ${location}.</p>`;
        });

        // Check if the image can be loaded
        const img = new Image();
        img.onload = function() {
            console.log("Image loaded successfully.");
            // Remove the existing 'uploadedImageLayer' if it exists
            if (map.getLayer('uploadedImageLayer')) {
                console.log("Removing existing uploadedImageLayer");
                map.removeLayer('uploadedImageLayer');
            }

            // Remove the existing 'uploadedImage' source if it exists
            if (map.getSource('uploadedImage')) {
                console.log("Removing existing uploadedImage source");
                map.removeSource('uploadedImage');
            }

            // Add the new image source
            console.log("Adding new image source");
            imageSource = {
                'type': 'image',
                'url': imagePath,
                'coordinates': [
                    [bounds.left, bounds.top],
                    [bounds.right, bounds.top],
                    [bounds.right, bounds.bottom],
                    [bounds.left, bounds.bottom]
                ]
            };
            map.addSource('uploadedImage', imageSource);

            // Add the new image layer
            console.log("Adding new image layer");
            imageLayer = {
                'id': uploadedImageLayerId,
                'type': 'raster',
                'source': 'uploadedImage',
                'paint': {
                    'raster-opacity': 0.85
                }
            };
            map.addLayer(imageLayer);

            // Fit the map to the bounds of the image
            console.log("Fitting map to bounds");
            map.fitBounds([
                [bounds.left, bounds.bottom],
                [bounds.right, bounds.top]
            ]);

            console.log("Image layer added to the map.");

            // Add layer control for the uploaded image
            addLayerControl(imageName);
        };


        img.onerror = function() {
            console.error("Image could not be loaded. Please check the URL.");
        };

        img.src = imagePath;
    }
}

function updateLayerControl(imageName) {
    const layerControl = document.getElementById('layerControl');
    layerControl.innerHTML = '<strong>Layers</strong>';
    const layerItem = document.createElement('div');
    layerItem.innerHTML = `
        <label>
            <input type="checkbox" checked id="layerToggle">${imageName}
        </label>
    `;
    layerControl.appendChild(layerItem);

    document.getElementById('layerToggle').addEventListener('change', function(event) {
        const visibility = event.target.checked ? 'visible' : 'none';
        map.setLayoutProperty(uploadedImageLayerId, 'visibility', visibility);
    });
}

function OpacityControl() {
    this.onAdd = function(map) {
        this._map = map;
        this._container = document.createElement('div');
        this._container.className = 'mapboxgl-ctrl opacity-control';
        this._container.innerHTML = `
            <label for="opacitySlider">Image Opacity:</label>
            <input type="range" id="opacitySlider" min="0" max="1" step="0.01" value="1">
        `;
        this._container.querySelector('#opacitySlider').addEventListener('input', function(event) {
            const opacity = event.target.value;
            if (map.getLayer(uploadedImageLayerId)) {
                map.setPaintProperty(uploadedImageLayerId, 'raster-opacity', parseFloat(opacity));
            }
        });
        return this._container;
    };
    this.onRemove = function() {
        this._container.parentNode.removeChild(this._container);
        this._map = undefined;
    };
}

function LayerControl() {
    this.onAdd = function(map) {
        this._map = map;
        this._container = document.createElement('div');
        this._container.className = 'mapboxgl-ctrl layer-control';
        this._container.id = 'layerControl';
        return this._container;
    };
    this.onRemove = function() {
        this._container.parentNode.removeChild(this._container);
        this._map = undefined;
    };
}
// Use the Geolocation API to get the user's location
if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
        (position) => {
            const { latitude, longitude } = position.coords;
            initializeMap(longitude, latitude);
            fetchWeatherData(latitude, longitude);
        },
        (error) => {
            console.error('Error getting user location:', error);
            // Fallback to a default location (e.g., New York City)
            initializeMap(-74.006, 40.7128);
            fetchWeatherData(-74.006, 40.7128);
        }
    );
} else {
    console.error('Geolocation is not supported by this browser.');
    // Fallback to a default location (e.g., New York City)
    initializeMap(-74.006, 40.7128);
    fetchWeatherData(-74.006, 40.7128)
}

function fetchWeatherData(lat, lon) {
    const apiKey = '2104d9d37c8a23ad320028a54d513d8a'; // Replace with your OpenWeatherMap API key
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`;

    fetch(url)
        .then(response => response.json())
        .then(data => {
            displayWeatherData(data);
        })
        .catch(error => console.error('Error fetching weather data:', error));
}

// Display weather data on the webpage
function displayWeatherData(data) {
    const weatherDiv = document.createElement('div');
    weatherDiv.innerHTML = `
        <h2>Weather Information</h2>
        <p>Location: ${data.name}</p>
        <p>Temperature: ${data.main.temp} °C</p>
        <p>Weather: ${data.weather[0].description}</p>
    `;
    document.getElementById('results').appendChild(weatherDiv);
}

function fetchWeatherDataForImageLocation(bounds) {
    const centroidLng = (bounds.left + bounds.right) / 2;
    const centroidLat = (bounds.top + bounds.bottom) / 2;
    fetchWeatherData(centroidLat, centroidLng);
}


// Calculate distance using the Haversine formula
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radius of the Earth in km
    const dLat = degreesToRadians(lat2 - lat1);
    const dLon = degreesToRadians(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(degreesToRadians(lat1)) * Math.cos(degreesToRadians(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c; // Distance in km
    return distance;
}

function degreesToRadians(degrees) {
    return degrees * (Math.PI / 180);
}

// Reverse geocode to get the nearest place
function reverseGeocode(lat, lon, callback) {
    const apiKey = '8df8749b3182478ca587a2d2b7f2660d'; // Replace with your API key
    const url = `https://api.opencagedata.com/geocode/v1/json?q=${lat}+${lon}&key=${apiKey}`;

    fetch(url)
        .then(response => response.json())
        .then(data => {
            if (data.results && data.results.length > 0) {
                const location = data.results[0].formatted;
                callback(location);
            } else {
                callback('an unknown location');
            }
        })
        .catch(error => {
            console.error('Error reverse geocoding:', error);
            callback('an unknown location');
        });
}
