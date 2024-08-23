console.log("script.js is loaded");
let map;
let selectedFile = null;
let uploadedImages = [];
let uploadedImageLayerId = 'uploadedImageLayer';
let uploadedImageCounter = 0;
let imagePath, imageBounds, tiffPath;
let userLng, userLat;
let uuid = null; // Global variable to store UUID
let draw;
 // Declare draw in a higher scope to make it accessible

 document.addEventListener('DOMContentLoaded', function() {
    // Initialize the map immediately after the page loads
    initializeMap();

    const mapContainer = document.getElementById('map'); // Get the map container element

    const sidebar = document.getElementById('sidebar');
    const toggleBtn = document.getElementById('toggleSidebar');
    const arrow = toggleBtn.querySelector('.arrow');

    toggleBtn.addEventListener('click', function() {
        sidebar.classList.toggle('collapsed');

        if (map) {
        map.resize();
        }
    });

    const chooseFileBtn = document.getElementById('chooseFileBtn');
    const fileInput = document.getElementById('fileInput');
    const urlInput = document.getElementById('urlInput');
    const loadUrlBtn = document.getElementById('loadUrlBtn');
    const dropZone = document.getElementById('dropZone');
    const fileInfo = document.getElementById('fileInfo');
    const fileName = document.getElementById('fileName');
    const uploadBtn = document.getElementById('uploadBtn');
    const classifyBtn = document.getElementById('classifyBtn');
    const colorPicker = document.getElementById('colorPicker');

    // Draw Buttons
    const drawPointButton = document.getElementById('draw-point');
    const drawLineButton = document.getElementById('draw-line');
    const drawPolygonButton = document.getElementById('draw-polygon');
    const exportButton = document.getElementById('export-features');
    const deleteButton = document.getElementById('delete-features');

    let activeTool = null;
    let selectedColor = '#000000'; // Default color

    chooseFileBtn.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', handleFileSelect);

    loadUrlBtn.addEventListener('click', () => {
        const url = urlInput.value.trim();
        if (url) {
            handleUrlInput(url);
        }
    });

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('drag-over');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        const file = e.dataTransfer.files[0];
        if (file && (file.type === 'image/tiff' || file.name.toLowerCase().endsWith('.tif') || file.name.toLowerCase().endsWith('.tiff'))) {
            handleFileSelect({ target: { files: [file] } });
        }
    });

    uploadBtn.addEventListener('click', () => uploadFile(userLng, userLat));
    classifyBtn.addEventListener('click', () => classifyImage());

    // Event listener for color picker
    colorPicker.addEventListener('input', function(event) {
        selectedColor = event.target.value;
    });

    // Event listeners for draw buttons
    drawPointButton.addEventListener('click', () => startDrawing('draw_point'));
    drawLineButton.addEventListener('click', () => startDrawing('draw_line_string'));
    drawPolygonButton.addEventListener('click', () => startDrawing('draw_polygon'));

    document.getElementById('import-features').addEventListener('click', function() {
        document.getElementById('import-geojson').click(); // Trigger file input when button is clicked
    });

    document.getElementById('import-geojson').addEventListener('change', function(event) {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                const geojson = JSON.parse(e.target.result);

                // Check and transform to EPSG:4326 if necessary
                if (geojson.crs && geojson.crs.properties && geojson.crs.properties.name !== "urn:ogc:def:crs:OGC:1.3:CRS84") {
                    geojson = transformTo4326(geojson);
                }

                // Add GeoJSON to the map
                map.addSource('imported-geojson', {
                    type: 'geojson',
                    data: geojson
                });

                map.addLayer({
                    id: 'imported-geojson-layer',
                    type: 'fill',
                    source: 'imported-geojson',
                    layout: {},
                    paint: {
                        'fill-color': '#088',
                        'fill-opacity': 0.5
                    }
                });

                // Fit map to the GeoJSON bounds
                const bounds = turf.bbox(geojson);
                map.fitBounds(bounds, { padding: 20 });

                // Reset file input
                event.target.value = '';
            };
            reader.readAsText(file);
        }
    });

    // Function to transform GeoJSON to EPSG:4326
    function transformTo4326(geojson) {
        return turf.transformRotate(geojson, 0, { mutate: true }); // Assuming the input is in some other CRS
    }

    exportButton.addEventListener('click', function() {
        const data = draw.getAll();
        if (data.features.length > 0) {
            const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'features.geojson';
            a.click();
            URL.revokeObjectURL(url);
        } else {
            alert('No features to export');
        }
    });

    deleteButton.addEventListener('click', function() {
        // Delete all features from the map
        draw.deleteAll();
    });

    // Define the finishDrawing function
    function finishDrawing(e) {
        map.getCanvas().style.cursor = ''; // Reset the cursor back to default
        activeTool = null;

        const feature = e.features[0];
        if (feature && feature.properties) {
            feature.properties.color = selectedColor; // Set the color property
        }

        // Apply the color to the drawn feature directly
        applyColorToFeature(feature);

        // Unsubscribe from the event listener to avoid memory leaks
        map.off('draw.create', finishDrawing);
    }

    function startDrawing(mode) {
        activeTool = mode;
        map.getCanvas().style.cursor = 'crosshair'; // Correctly reference the map container element

        draw.changeMode(mode, {
            properties: { color: selectedColor }
        });

        map.on('draw.create', finishDrawing);
    }

    function applyColorToFeature(feature) {
        const featureId = feature.id;

        // Ensure that the required layers exist
        const polygonFillLayer = map.getLayer('gl-draw-polygon-fill');
        const polygonStrokeLayer = map.getLayer('gl-draw-polygon-stroke');

        if (polygonFillLayer && polygonStrokeLayer) {
            // Apply color to the fill layer
            map.setPaintProperty('gl-draw-polygon-fill', 'fill-color', [
                'case',
                ['==', ['get', 'id'], featureId],
                feature.properties.color,
                '#000000' // Fallback color
            ]);

            // Apply color to the stroke layer
            map.setPaintProperty('gl-draw-polygon-stroke', 'line-color', [
                'case',
                ['==', ['get', 'id'], featureId],
                feature.properties.color,
                '#000000' // Fallback color
            ]);
        } else {
            console.error('Required layers are not available.');
        }
    }
});

function initializeMap() {
    map = new maplibregl.Map({
        container: 'map',
        style: baseMaps.HYBRID.style, // Ensure your style supports 3D
        center: [12, 12], // Initial center of the map [lng, lat]
        zoom: 0, // Start at a global zoom level
        pitch: 0, // Initial pitch
        bearing: 0, // Initial bearing
        antialias: true,
        attributionControl: false, // Enable anti-aliasing for smoother edges
        localIdeographFontFamily: '"Apple LiSung", serif',
        rotate: false
    });

    map.on('load', () => {
        console.log("Map style is fully loaded.");

        draw = new MapboxDraw({
            displayControlsDefault: false,
            controls: {},
            userProperties: true // Enable user-defined properties to store color
        });

        // Add draw control to the map
        map.addControl(draw);

        // Attach the event listener now that the map is loaded
        map.on('draw.create', finishDrawing);
    });

    // Handle cursor changes
    map.on('draw.modechange', (e) => {
        if (e.mode.startsWith('draw_')) {
            map.getCanvas().style.cursor = 'crosshair';
        } else {
            map.getCanvas().style.cursor = '';
        }
    });

    // When hovering over any drawn feature, change the cursor to pointer
    map.on('mouseenter', 'gl-draw-polygon-fill-inactive', () => {
        map.getCanvas().style.cursor = 'pointer';
    });

    map.on('mouseleave', 'gl-draw-polygon-fill-inactive', () => {
        map.getCanvas().style.cursor = '';
    });

    // Add additional controls to the map
    map.addControl(new maplibregl.NavigationControl(), 'bottom-right');
    map.addControl(new maplibregl.FullscreenControl(), 'top-right');
    map.addControl(new maplibregl.ScaleControl({ maxWidth: 100, unit: 'metric' }), 'bottom-right');
    //map.addControl(new OpacityControl(), 'top-right');
    map.addControl(new SimpleLayerControl(), 'top-right');

    map.addControl(new MaplibreGeocoder(geocoderApi, { maplibregl }), 'top-left');
    map.addControl(new LayerSwitcherControl({ basemaps: baseMaps, initialBasemap: { id: "STREETS" } }), 'bottom-left');

    // Geolocate control without triggering on load
    const geolocateControl = new maplibregl.GeolocateControl({
        positionOptions: {
            enableHighAccuracy: true
        },
        trackUserLocation: true,
        showAccuracyCircle: false
    });

    map.addControl(geolocateControl, 'top-left');

    geolocateControl.on('geolocate', (position) => {
        const { latitude, longitude } = position.coords;
        fetchWeatherData(latitude, longitude);
    });

    document.getElementById('logo-link').addEventListener('click', function(e) {
        e.preventDefault(); // Prevent default anchor behavior
        window.location.href = window.location.href; // Refresh the current page
    });

    map.on('styledata', function() {
        uploadedImages.forEach(image => {
            addImageLayer(image.imagePath, image.bounds, image.layerId);
        });
    });

    map.on('moveend', () => {
        const center = map.getCenter();
        fetchWeatherData(center.lat, center.lng);
    });

    map.on('mousemove', (e) => {
        document.getElementById('info').innerHTML =
            `X: ${e.point.x.toFixed(0)}, Y: ${e.point.y.toFixed(0)} | Long: ${e.lngLat.lng.toFixed(6)}, Lat: ${e.lngLat.lat.toFixed(6)}`;
    });
}




function handleFileSelect(event) {
    const file = event.target.files[0];
    if (file) {

        const maxSize = 100 * 512 * 512; // 50 MB
        if (file.size > maxSize) {
            alert("File size exceeds 50 MB limit. Please upload a smaller file.");
            return;
        }
        selectedFile = file;
        document.getElementById('fileName').textContent = file.name;
        document.getElementById('fileInfo').style.display = 'flex';
    }
}

function handleUrlInput(url) {
    selectedFile = { name: url, isUrl: true };
    document.getElementById('fileName').textContent = url;
    document.getElementById('fileInfo').style.display = 'flex';
}

function uploadFile(userLng, userLat) {
    if (!selectedFile) {
        console.error('No file or URL selected for upload.');
        document.getElementById('results').innerText = 'Please select a file or enter a URL to upload.';
        return;
    }

    let file, tiffKey, pngExportKey, segmentUploadKey;
    uuid = generateUUID();  // Generate a unique identifier

    if (selectedFile.isUrl) {
        // Handle URL upload
        const originalName = new URL(selectedFile.name).pathname.split('/').pop();
        tiffKey = `tiff-uploads/${uuid}_${originalName}`;
        pngExportKey = `png-export/${uuid}_${originalName.replace(/\.[^.]+$/, '.png')}`;
        segmentUploadKey = `segment-upload/${uuid}_${originalName.replace(/\.[^.]+$/, '_classified.png')}`;
    } else {
        // Handle file upload
        file = selectedFile;
        tiffKey = `tiff-uploads/${uuid}_${selectedFile.name}`;
        pngExportKey = `png-export/${uuid}_${selectedFile.name.replace(/\.[^.]+$/, '.png')}`;
        segmentUploadKey = `segment-upload/${uuid}_${selectedFile.name.replace(/\.[^.]+$/, '_classified.png')}`;
    }

    uploadedImages.push({
        tiffKey: tiffKey,
        pngExportKey: pngExportKey,
        segmentUploadKey: segmentUploadKey,
        fileName: selectedFile.name,
        uuid: uuid
    });

    console.log("PNG Object Name:", pngExportKey);

    console.log("Requesting pre-signed URL for upload...");
    fetch(`https://dutta007.pythonanywhere.com/generate-presigned-url?object_name=${encodeURIComponent(tiffKey)}`)
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                console.error('Error generating pre-signed URL:', data.error);
                document.getElementById('results').innerText = 'Error generating upload URL: ' + data.error;
            } else {
                const presignedUrl = data.url;
                console.log("Uploading file...");

                let uploadPromise;

                if (selectedFile.isUrl) {
                    // Fetch the file from the URL and then upload it
                    uploadPromise = fetch(selectedFile.name)
                        .then(response => response.blob())
                        .then(blob => {
                            return fetch(presignedUrl, {
                                method: 'PUT',
                                headers: {
                                    'Content-Type': 'image/tiff'
                                },
                                body: blob
                            });
                        });
                } else {
                    // Upload the file directly
                    uploadPromise = fetch(presignedUrl, {
                        method: 'PUT',
                        headers: {
                            'Content-Type': file.type
                        },
                        body: file
                    });
                }

                uploadPromise
                    .then(response => {
                        if (response.ok) {
                            console.log("File uploaded successfully.");
                            document.getElementById('results').innerText = 'File uploaded successfully. Processing...';
                            checkProcessedImage(pngExportKey, tiffKey.split('/').pop(), userLng, userLat, `uploadedImageLayer_${uploadedImages.length}`);
                        } else {
                            throw new Error('File upload failed: ' + response.statusText);
                        }
                    })
                    .catch(error => {
                        console.error('Error:', error);
                        document.getElementById('results').innerText = 'An error occurred: ' + error.message;
                    });
            }
        })
        .catch(error => {
            console.error('Error fetching pre-signed URL:', error);
            document.getElementById('results').innerText = 'An error occurred: ' + error.message;
        });
}

// Function to generate a UUID
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}


function checkProcessedImage(pngExportKey, originalFileName, userLng, userLat) {
    const checkInterval = 2000; // Check every 2 seconds
    const maxAttempts = 30; // Maximum number of attempts (1 minute total)
    let attempts = 0;

    const checkImage = () => {
        fetch(`https://dutta007.pythonanywhere.com/get-processed-image-info?object_name=${encodeURIComponent(pngExportKey)}`)
            .then(response => response.json())
            .then(data => {
                if (data.error) {
                    attempts++;
                    if (attempts < maxAttempts) {
                        setTimeout(checkImage, checkInterval);
                    } else {
                        document.getElementById('results').innerText = 'Processing timed out. Please try again.';
                    }
                } else {
                    console.log("Response from /get-processed-image-info:", data);
                    const imagePath = data.png_url;
                    const imageBounds = data.bounds;
                    console.log("Displaying image on map:", imagePath);
                    // Display the image on the map using the original file name (without UUID)
                    displayImageOnMap(imagePath, imageBounds, originalFileName, userLng, userLat);
                }
            })
            .catch(error => {
                console.error('Error fetching processed image info:', error);
                document.getElementById('results').innerText = 'An error occurred: ' + error.message;
            });
    };

    checkImage();
}



function classifyImage() {
    if (!selectedFile) {
        console.error('No file or URL selected for classification.');
        document.getElementById('results').innerText = 'Please select a file or enter a URL to classify.';
        return;
    }

    if (!uuid) {
        console.error('UUID is missing. Please upload a file first.');
        document.getElementById('results').innerText = 'UUID is missing. Please upload a file first.';
        return;
    }

    const imageDetails = uploadedImages.find(img => img.fileName === selectedFile.name);
    if (!imageDetails) {
        console.error('Image details not found in uploaded images.');
        document.getElementById('results').innerText = 'Image details not found. Please upload the image again.';
        return;
    }


    console.log("Classifying image...");
    fetch(`https://dutta007.pythonanywhere.com/invoke-segmentation`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ image_key: imageDetails.tiffKey })
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) {
            console.error('Error invoking segmentation:', data.error);
            document.getElementById('results').innerText = 'Error invoking segmentation: ' + data.error;
        } else {
            console.log('Segmentation started:', data);
            document.getElementById('results').innerText = 'Segmentation started. Please wait...';
            checkSegmentedImage(imageDetails.segmentUploadKey, imageDetails.fileName, userLng, userLat);
        }
    })
    .catch(error => {
        console.error('Error:', error);
        document.getElementById('results').innerText = 'An error occurred: ' + error.message;
    });
}



function checkSegmentedImage(pngExportKey, originalFileName, userLng, userLat) {
    const checkInterval = 2000; // Check every 2 seconds
    const maxAttempts = 120; // Maximum number of attempts (4 minutes total)
    let attempts = 0;

    const checkImage = () => {
        fetch(`https://dutta007.pythonanywhere.com/get-segmented-image-info?object_name=${encodeURIComponent(pngExportKey)}`)
            .then(response => response.json())
            .then(data => {
                if (data.error) {
                    attempts++;
                    if (attempts < maxAttempts) {
                        setTimeout(checkImage, checkInterval);
                    } else {
                        document.getElementById('results').innerText = 'Processing timed out. Please try again.';
                    }
                } else {
                    console.log("Response from /get-segmented-image-info:", data);
                    const imagePath = data.png_url;
                    const imageBounds = data.bounds;
                    console.log("Displaying segmented image on map:", imagePath);

                    // Extract the base name without UUID and extension
                    const baseName = originalFileName.replace(/^[^_]+_/, '').replace(/\.[^.]+$/, '');
                    const cleanImageName = `${baseName}_classified.tif`;

                    // Display the segmented image on the map
                    displayImageOnMap(imagePath, imageBounds, cleanImageName, userLng, userLat);
                }
            })
            .catch(error => {
                console.error('Error fetching segmented image info:', error);
                document.getElementById('results').innerText = 'An error occurred: ' + error.message;
            });
    };

    checkImage();
}



function displayImageOnMap(imagePath, bounds, imageName, userLng, userLat) {
    console.log("Displaying image on map with path:", imagePath);
    console.log("Bounds:", bounds);

    const layerId = `${uploadedImageLayerId}_${uploadedImageCounter}`;
    uploadedImageCounter++;

    // Find the corresponding image details by matching the PNG path or image name
    const uuidMatch = imageName.match(/^[0-9a-fA-F-]+/);
    const uuid = uuidMatch ? uuidMatch[0] : null;

    let tiffKey = null;
    if (uuid) {
        tiffKey = `tiff-uploads/${imageName}`;
    }

    console.log('Constructed tiffKey:', tiffKey);

    if (!tiffKey) {
        console.error('tiffKey is null for image:', imageName);
    }
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

    // Add the image layer to the map
    addImageLayer(imagePath, bounds, layerId);

    // Extract the clean image name (without UUID) for display in the layer control
    const cleanImageName = imageName.replace(/^[0-9a-fA-F-]+_/, '');

    // Add layer control for the uploaded image using the clean name
    updateLayerControl(cleanImageName, layerId, bounds, imagePath);

    // Store the uploaded image info
    const previousEntry = uploadedImages.find(img => img.fileName === imageName.replace('_classified.tif', '.tif'));

    uploadedImages.push({
        ...previousEntry,
        layerId, // New Layer ID
        imageName: cleanImageName,
        bounds,
        imagePath,
        tiffKey : tiffKey
    });

    // Fit the map to the bounds of the last uploaded image
    map.fitBounds([
        [bounds.left, bounds.bottom],
        [bounds.right, bounds.top]
    ]);
}

function updateLayerControl(imageName, layerId, bounds, imagePath) {
    const layerControl = document.getElementById('layerControl');
    const layerItem = document.createElement('div');
    layerItem.className = 'layer-item';
    layerItem.innerHTML = `
        <label>
            <input type="checkbox" checked id="${layerId}Toggle">
            <span class="layer-name">${imageName}</span>
        </label>
        <div class="menu-container">
            <div class="menu-button">&#8942;</div>
            <div class="menu-content">
                <a href="#" class="zoom-link"> Zoom to </a>
                <div class="opacity-control">
                    <label for="${layerId}OpacitySlider">Opacity:</label>
                    <input type="range" id="${layerId}OpacitySlider" min="0" max="1" step="0.01" value="0.85">
                </div>
                <a href="#" class="export-link">Export TIFF</a>
            </div>
        </div>
    `;

    layerControl.appendChild(layerItem);

    const checkbox = layerItem.querySelector('input[type="checkbox"]');
    const menuButton = layerItem.querySelector('.menu-button');
    const menuContent = layerItem.querySelector('.menu-content');
    const zoomLink = layerItem.querySelector('.zoom-link');
    const opacitySlider = layerItem.querySelector(`#${layerId}OpacitySlider`);
    const exportLink = layerItem.querySelector('.export-link');

    function updateLayerVisibility() {
        if (map.getLayer(layerId)) {
            // Toggle layer visibility based on checkbox state
            const visibility = checkbox.checked ? 'visible' : 'none';
            map.setLayoutProperty(layerId, 'visibility', visibility);
        } else if (checkbox.checked) {
            // If the layer doesn't exist and checkbox is checked, add the layer
            addImageLayer(imagePath, bounds, layerId);
        }
    }

    // Set initial visibility state
    updateLayerVisibility();

    // Add event listener for checkbox state change
    checkbox.addEventListener('change', updateLayerVisibility);

    // Toggle menu visibility on three-dot button click
    menuButton.addEventListener('click', function() {
        menuContent.classList.toggle('visible');
    });

    // Add event listener for zoom link
    zoomLink.addEventListener('click', function(e) {
        e.preventDefault();
        map.fitBounds([
            [bounds.left, bounds.bottom],
            [bounds.right, bounds.top]
        ]);
        menuContent.classList.remove('visible'); // Hide menu after clicking an option
    });

    opacitySlider.addEventListener('input', function(event) {
        const opacity = parseFloat(event.target.value);
        if (map.getLayer(layerId)) {
            map.setPaintProperty(layerId, 'raster-opacity', opacity);
        }
    });

    exportLink.addEventListener('click', function (e) {
        e.preventDefault();
        console.log(uploadedImages);

        // Find the image details based on the layerId
        const imageDetails = uploadedImages.find(img => img.layerId === layerId);

        if (imageDetails) {
            // Determine which key to use based on the presence of tiffKey or segmentUploadKey
            const s3KeyToUse = imageDetails.segmentUploadKey ? imageDetails.segmentUploadKey : imageDetails.tiffKey;

            console.log("S3 Key to use:", s3KeyToUse);

            if (s3KeyToUse) {
                exportTiff(s3KeyToUse);
            } else {
                alert('Unable to find the correct S3 key for export.');
            }
        } else {
            alert('Unable to find the correct image details for export.');
        }
    });



}


function exportTiff(s3Key) {
    console.log(s3Key);
    fetch('https://dutta007.pythonanywhere.com/export-tiff', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ s3_key: s3Key }), // Use the classified PNG key for exporting
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) {
            alert('Error exporting TIFF: ' + data.error);
        } else {
            const tiffUrl = data.tiff_url;
            window.location.href = tiffUrl; // This will start the download of the TIFF file
        }
    })
    .catch(error => {
        console.error('Error:', error);
        alert('Error exporting TIFF');
    });
}




function addImageLayer(imagePath, bounds, layerId) {
    // Check if the source exists, if not, add it
    if (!map.getSource(layerId)) {
        map.addSource(layerId, {
            'type': 'image',
            'url': imagePath,
            'coordinates': [
                [bounds.left, bounds.top],
                [bounds.right, bounds.top],
                [bounds.right, bounds.bottom],
                [bounds.left, bounds.bottom]
            ]
        });
    }

    // Check if the layer exists, if not, add it
    if (!map.getLayer(layerId)) {
        map.addLayer({
            'id': layerId,
            'type': 'raster',
            'source': layerId,
            'paint': {
                'raster-opacity': 0.85
            }
        });
    }
}


function SimpleLayerControl() {
    this.onAdd = function(map) {
        this._map = map;
        this._container = document.createElement('div');
        this._container.className = 'mapboxgl-ctrl layer-control';
        this._container.id = 'layerControl';
        this._container.innerHTML = '<strong>Layers</strong>'; // Initial content
        return this._container;
    };
    this.onRemove = function() {
        this._container.parentNode.removeChild(this._container);
        this._map = undefined;
    };
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
    const apiKey = 'Replace with your API key'; // Replace with your API key
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


