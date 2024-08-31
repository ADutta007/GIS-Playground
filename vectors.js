let selectedFillColor = '#ff0000';
let selectedStrokeColor = '#000000';
let selectedFillOpacity = 0.5;
let selectedStrokeWidth = 2;
let currentPopup = null;

MapboxDraw.constants.classes.CONTROL_BASE  = 'maplibregl-ctrl';
MapboxDraw.constants.classes.CONTROL_PREFIX = 'maplibregl-ctrl-';
MapboxDraw.constants.classes.CONTROL_GROUP = 'maplibregl-ctrl-group';

function initializeMapboxDraw() {
    const features = draw ? draw.getAll() : { features: [] };
    if (!draw) {
        draw = new MapboxDraw({
            displayControlsDefault: false,
            controls: {
                polygon: true,
                line_string: true,
                point: true,
                trash: true
            },
            userProperties: true
        });
        const drawControlsContainer = document.getElementById('draw-controls');
        drawControlsContainer.appendChild(draw.onAdd(map));

        setTimeout(() => {
            const controlButtonsContainer = drawControlsContainer.querySelector('.maplibregl-ctrl-group.maplibregl-ctrl');
            if (!controlButtonsContainer) {
                console.log("Draw control buttons container not found, retrying...");
                addCustomDrawButtons();
            } else {
                console.log("Adding custom buttons to the Draw controls");
                addCustomDrawButtons(controlButtonsContainer);
            }
        }, 500);

    }
    addCustomLayers();
    // Wait for the draw.create event to ensure the draw layers are added
    map.once('draw.create', () => {
        
        restoreDrawFeatures(features);
    });

    // If there are no features, we still need to add custom layers
    if (draw.getAll().features.length === 0) {
        // Use a timeout to ensure draw layers are added
        setTimeout(addCustomLayers, 100);
    }
}

function applyColorToFeature(featureId) {
    if (!map || !draw) {
        console.error('Map or draw not initialized');
        return;
    }

    const allFeatures  = draw.getAll().features;
    const featureStyles = {};

    allFeatures.forEach(feature => {
        if (feature.geometry.type === 'Polygon'||feature.geometry.type === 'LineString'||feature.geometry.type === 'Point') {
            featureStyles[feature.id] = {
                fillColor: feature.properties.fillColor || selectedFillColor,
                strokeColor: feature.properties.strokeColor || selectedStrokeColor,
                fillOpacity: feature.properties.fillOpacity || selectedFillOpacity,
                strokeWidth: feature.properties.strokeWidth || selectedStrokeWidth
            };
        }
    });

   

    const lineLayerIds = ['gl-draw-line-inactive', 'gl-draw-line-active', 'gl-draw-polygon-stroke-inactive', 'gl-draw-polygon-stroke-active'];
    const fillLayerIds = ['gl-draw-polygon-fill-inactive', 'gl-draw-polygon-fill-active'];
    const pointLayerIds = ['gl-draw-point-active','gl-draw-point-inactive'];

    pointLayerIds.forEach(layerId => {
        if (map.getLayer(layerId)) {
            map.setPaintProperty(layerId, 'circle-color', [
                'match',
                ['get', 'id'],
                ...Object.entries(featureStyles).flatMap(([id, style]) => [id, style.strokeColor]),
                selectedStrokeColor
            ]);
            map.setPaintProperty(layerId, 'circle-radius', [
                'match',
                ['get', 'id'],
                ...Object.entries(featureStyles).flatMap(([id, style]) => [id, style.strokeWidth]),
                selectedStrokeWidth
                
            ]);
        }
    });

    lineLayerIds.forEach(layerId => {
        if (map.getLayer(layerId)) {
            map.setPaintProperty(layerId, 'line-color', [
                'match',
                ['get', 'id'],
                ...Object.entries(featureStyles).flatMap(([id, style]) => [id, style.strokeColor]),
                selectedStrokeColor
            ]);
            map.setPaintProperty(layerId, 'line-width', [
                'match',
                ['get', 'id'],
                ...Object.entries(featureStyles).flatMap(([id, style]) => [id, style.strokeWidth]),
                selectedStrokeWidth
                
            ]);
        }
    });

    fillLayerIds.forEach(layerId => {
        if (map.getLayer(layerId)) {
            map.setPaintProperty(layerId, 'fill-color', [
                'match',
                ['get', 'id'],
                ...Object.entries(featureStyles).flatMap(([id, style]) => [id, style.fillColor]),
                selectedFillColor
            ]);
            map.setPaintProperty(layerId, 'fill-opacity', [
                'match',
                ['get', 'id'],
                ...Object.entries(featureStyles).flatMap(([id, style]) => [id, style.fillOpacity]),
                selectedFillOpacity
            ]);
        }
    });
}




function addCustomLayers() {
    const layers = [       

        {
            'id': 'gl-draw-point-active',
            'type': 'circle',
            source: 'mapbox-gl-draw-hot',
            'filter': ['all',
              ['==', '$type', 'Point'],
              ['==', 'meta', 'feature'],
              ['==', 'active', 'true']],
            'paint': {
              'circle-radius': ["coalesce", ["get", "strokeWidth"], 7],
              'circle-color': ["coalesce", ["get", "strokeColor"], "#000000"]
            }
        },

        {
            'id': 'gl-draw-point-inactive',
            'type': 'circle',
            source: 'mapbox-gl-draw-cold',
            "filter": ["all", ["==", "active", "false"], ["==", "$type", "Point"], ['==', 'meta', 'feature']],
            'paint': {
              'circle-radius': ["coalesce", ["get", "strokeWidth"], 5],
              'circle-color': ["coalesce", ["get", "strokeColor"], "#000088"]
            }
        },

        {
            "id": "gl-draw-line-inactive",
            "type": "line",
            "filter": ["all", ["==", "active", "false"], ["==", "$type", "LineString"], ["!=", "mode", "static"]],
            layout: {
                "line-cap": "round",
                "line-join": "round"
            },
            paint: {
                'line-color': ['get', 'strokeColor'],
                'line-width': ['get', 'strokeWidth']
            },
            "source": "mapbox-gl-draw-cold"
        },
        {
            "id": "gl-draw-line-active",
            "type": "line",
            "filter": ["all", ["==", "active", "true"], ["==", "$type", "LineString"]],
            layout: {
                "line-cap": "round",
                "line-join": "round"
            },
            paint: {
                'line-color': ['get', 'strokeColor'],
                'line-width': ['get', 'strokeWidth']
            },
            "source": "mapbox-gl-draw-hot"
        },

        {
            "id": "gl-draw-polygon-and-line-vertex-halo-active",
            "type": "circle",
            "filter": ["all", ["==", "meta", "vertex"], ["==", "$type", "Point"]],
            "paint": {
              "circle-radius": 7,
              "circle-color": "#1a1a2e"
            },
            "source": "mapbox-gl-draw-hot"
          },
        {
            "id": "gl-draw-polygon-fill-inactive",
            "type": "fill",
            "source": "mapbox-gl-draw-cold",
            "filter": ["all", ["==", "active", "false"], ["==", "$type", "Polygon"], ["!=", "mode", "static"]],
            paint: {
                'fill-color': ["coalesce", ["get", "fillColor"], "#3bb2d0"],
                'fill-opacity': ["coalesce",['get', 'fillOpacity'],0.2]
            },
        },
        {
            "id": "gl-draw-polygon-fill-active",
            "type": "fill",
            "source": "mapbox-gl-draw-hot",
            "filter": ["all", ["==", "active", "true"], ["==", "$type", "Polygon"]],
            paint: {
                'fill-color': ["coalesce", ["get", "fillColor"], "#3bb2d0"],
                'fill-opacity': ["coalesce",0.3]
            },
        },
        {
            "id": "gl-draw-polygon-stroke-active",
            "type": "line",
            "source": "mapbox-gl-draw-hot",
            layout: {
                "line-cap": "round",
                "line-join": "round"
            },
            paint: {
                'line-color': ["coalesce", ["get", "strokeColor"], "#000000"],
                'line-width': ["coalesce", ["get", "strokeWidth"], 2],
            },
            "filter": ["all", ["==", "active", "true"], ["==", "$type", "Polygon"], ["!=", "mode", "static"]]
        },
        {
            "id": "gl-draw-polygon-stroke-inactive",
            "type": "line",
            "source": "mapbox-gl-draw-cold",
            layout: {
                "line-cap": "round",
                "line-join": "round"
            },
            paint: {
                'line-color': ["coalesce", ["get", "strokeColor"], "#000000"],
                'line-width': ["coalesce", ["get", "strokeWidth"], 2],
            },
            "filter": ["all", ["==", "$type", "Polygon"], ["!=", "mode", "static"]]
        }
    ];

    layers.forEach(layer => {
        if (!map.getLayer(layer.id)) {
            map.addLayer(layer);
            console.log(`Layer "${layer.id}"`)
        }
    });
}



function handleDrawCreate(e) {
    if (draw && map) {
        e.features.forEach((feature) => {
            if (feature.geometry.type === 'Polygon' ) {
                draw.setFeatureProperty(feature.id, 'fillColor', selectedFillColor);
                draw.setFeatureProperty(feature.id, 'strokeColor', selectedStrokeColor);
                draw.setFeatureProperty(feature.id, 'fillOpacity', selectedFillOpacity);
                draw.setFeatureProperty(feature.id, 'strokeWidth', selectedStrokeWidth);
                applyColorToFeature(feature.id);
            }

            else if (feature.geometry.type === 'LineString'){
                draw.setFeatureProperty(feature.id, 'strokeColor', selectedStrokeColor);
                //draw.setFeatureProperty(feature.id, 'fillOpacity', selectedFillOpacity);
                draw.setFeatureProperty(feature.id, 'strokeWidth', selectedStrokeWidth);
                applyColorToFeature(feature.id);


            }
        });
    }
}


function handleDrawUpdate(e) {
    e.features.forEach((feature) => {
        if (feature.geometry.type === 'Polygon' || feature.geometry.type === 'LineString') {
            draw.setFeatureProperty(feature.id, 'fillColor', selectedFillColor);
            draw.setFeatureProperty(feature.id, 'strokeColor', selectedStrokeColor);
            draw.setFeatureProperty(feature.id, 'fillOpacity', selectedFillOpacity);
            draw.setFeatureProperty(feature.id, 'strokeWidth', selectedStrokeWidth);
            applyColorToFeature(feature.id);
        }
    });
}
function restoreDrawFeatures(features) {
    if (features && features.features.length > 0) {
        draw.set(features);
    }
}

function setupCursorChange(layerId) {
    map.on('mouseenter', layerId, () => {
        map.getCanvas().style.cursor = 'pointer';
    });

    map.on('mouseleave', layerId, () => {
        map.getCanvas().style.cursor = '';
    });
}

function initializeCursorChanges() {
    const layers = [
        'gl-draw-polygon-fill-inactive',
        'gl-draw-polygon-fill-active',
        'gl-draw-line-inactive',
        'gl-draw-line-active'
    ];

    layers.forEach(layerId => {
        setupCursorChange(layerId);
    });

}

// Function to add custom buttons for Import/Export GeoJSON
function addCustomDrawButtons(container) {
    console.log('Adding custom buttons...');

    if (!container) {
        console.error('No valid container found for custom buttons');
        return;
    }

    // Create Toggle Button for Style Controls
    const styleToggleButton = document.createElement('button');
    styleToggleButton.className = 'mapbox-gl-draw_ctrl-draw-btn mapbox-gl-draw_style_toggle';
    styleToggleButton.title = 'Style Controls';
    styleToggleButton.innerHTML = `<svg class="icon" fill="#000000" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 3v12m0 0l3.5-3.5m-7 0L12 15m7 0v4a2 2 0 01-2 2H7a2 2 0 01-2-2v-4m14-5V5a2 2 0 00-2-2H7a2 2 0 00-2 2v5" stroke="#000000" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    container.appendChild(styleToggleButton);

    // Create Import GeoJSON Button
    const importButton = document.createElement('button');
    importButton.className = 'mapbox-gl-draw_ctrl-draw-btn mapbox-gl-draw_import';
    importButton.title = 'Import GeoJSON';
    importButton.innerHTML = `<svg class="icon" fill="#000000" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 21V9m0 0l-3.5 3.5m7 0L12 9m-7 5v4a2 2 0 002 2h10a2 2 0 002-2v-4m-14-5V5a2 2 0 012-2h10a2 2 0 012 2v5" stroke="#000000" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    container.appendChild(importButton);

    // Create Export GeoJSON Button
    const exportButton = document.createElement('button');
    exportButton.className = 'mapbox-gl-draw_ctrl-draw-btn mapbox-gl-draw_export';
    exportButton.title = 'Export GeoJSON';
    exportButton.innerHTML = `<svg class="icon" fill="#000000" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 3v12m0 0l3.5-3.5m-7 0L12 15m7 0v4a2 2 0 01-2 2H7a2 2 0 01-2-2v-4m14-5V5a2 2 0 00-2-2H7a2 2 0 00-2 2v5" stroke="#000000" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    container.appendChild(exportButton);

    // Add functionality to the Import button
    importButton.addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.geojson,.json';
        input.onchange = handleGeoJSONImport;
        input.click();
    });

    // Add functionality to the Export button
    exportButton.addEventListener('click', () => {
        const data = draw.getAll();
        if (data.features.length > 0) {
            const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'exported_features.geojson';
            link.click();
            URL.revokeObjectURL(url);
        } else {
            alert('No features to export');
        }
    });

    const styleControlsContainer = document.createElement('div');
    styleControlsContainer.id = 'style-controls';
    styleControlsContainer.style.display = 'none'; // Hidden by default
    styleControlsContainer.style.padding = '10px';
    styleControlsContainer.innerHTML = `
        <label>Fill</label>
        <input type="color" id="fillColorPicker" value="#ff0000">
        <label>Stroke</label>
        <input type="color" id="strokeColorPicker" value="#000000">
        <label>Opacity:</label>
        <input type="range" id="fillOpacity" min="0" max="1" step="0.1" value="0.5">
        <label>Width:</label>
        <input type="range" id="strokeWidth" min="1" max="10" step="1" value="2">
    `;
    container.appendChild(styleControlsContainer);

    // Step 3: Toggle Logic
    styleToggleButton.addEventListener('click', function () {
        if (styleControlsContainer.style.display === 'none') {
            styleControlsContainer.style.display = 'block';
        } else {
            styleControlsContainer.style.display = 'none';
        }
    });

    // Apply style changes as you had before
    const fillColorPicker = document.getElementById('fillColorPicker');
    const strokeColorPicker = document.getElementById('strokeColorPicker');
    const fillOpacitySlider = document.getElementById('fillOpacity');
    const strokeWidthSlider = document.getElementById('strokeWidth');

    fillColorPicker.addEventListener('input', function(event) {
        selectedFillColor = event.target.value;
        applyStyleToSelectedFeatures();
    });

    strokeColorPicker.addEventListener('input', function(event) {
        selectedStrokeColor = event.target.value;
        applyStyleToSelectedFeatures();
    });

    fillOpacitySlider.addEventListener('input', function(event) {
        selectedFillOpacity = parseFloat(event.target.value);
        applyStyleToSelectedFeatures();
    });

    strokeWidthSlider.addEventListener('input', function(event) {
        selectedStrokeWidth = parseInt(event.target.value);
        applyStyleToSelectedFeatures();
    });

    function applyStyleToSelectedFeatures() {
        const selectedFeatures = draw.getSelected().features;
        selectedFeatures.forEach(feature => {
            draw.setFeatureProperty(feature.id, 'fillColor', selectedFillColor);
            draw.setFeatureProperty(feature.id, 'strokeColor', selectedStrokeColor);
            draw.setFeatureProperty(feature.id, 'fillOpacity', selectedFillOpacity);
            draw.setFeatureProperty(feature.id, 'strokeWidth', selectedStrokeWidth);
        });
        applyColorToFeature();
    }
}

function handleGeoJSONImport(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            let geojson = JSON.parse(e.target.result);

            // Check and transform to EPSG:4326 if necessary
            if (geojson.crs && geojson.crs.properties && geojson.crs.properties.name !== "urn:ogc:def:crs:OGC:1.3:CRS84") {
                geojson = transformTo4326(geojson);
            }

            // Add GeoJSON to the map
            const sourceId = 'imported-geojson-' + Date.now();
            const layerId = sourceId + '-layer';

            console.log(`Adding source with ID: ${sourceId}`);
            map.addSource(sourceId, {
                type: 'geojson',
                data: geojson
            });

            console.log(`Adding layer with ID: ${layerId}`);
            map.addLayer({
                id: layerId,
                type: 'fill',
                source: sourceId,
                layout: {},
                paint: {
                    'fill-color': ['get', 'strokeColor'],
                    'fill-opacity': 0.5
                }
            });

            // Fit map to the GeoJSON bounds
            const bounds = turf.bbox(geojson);
            map.fitBounds(bounds, { padding: 20 });

            // Make layer interactive (click to edit styles)
            map.on('click', layerId, (e) => {
                const feature = e.features[0];
                console.log('Clicked on feature:', feature);

                // You could open a style editor here, or change styles programmatically
                map.setPaintProperty(layerId, 'fill-color', '#f00');  // Example change
            });

            // Reset file input
            event.target.value = '';
        };
        reader.readAsText(file);
    }
}

function setupEventListeners() {
    map.on('draw.create', (e) => {
        handleDrawCreate(e);
        //handlePolygonInteraction(e);
    });
    map.on('draw.update', handleDrawUpdate);
    map.on('draw.selectionchange', (e) => {
        if (e.features.length > 0 && e.features[0].geometry.type === 'Polygon') {
            applyColorToFeature(e.features[0].id);
        }
    });
    map.on('click', handlePolygonInteraction);
}

function handlePolygonInteraction(e) {
    const features = map.queryRenderedFeatures(e.point, {
        layers: ['gl-draw-polygon-fill-inactive']
    });
    if (features.length === 0) return;
    const feature = features[0];
    if (feature.geometry.type !== 'Polygon') return;

    if (currentPopup) {
        currentPopup.remove();
    }

    const featureId = feature.properties.id;
    const area = turf.area(feature);

    function renderPopupContent() {
        const popupContent = document.createElement('div');
        popupContent.style.color = 'black';
        popupContent.innerHTML = `
            <div><strong>Feature ID:</strong> ${featureId}</div>
            <div><strong>Area:</strong> ${area.toFixed(2)} sq. meters</div>
            <div id="customProperties"></div>
            <div>
                <input type="text" id="newKey" placeholder="Key">
                <input type="text" id="newValue" placeholder="Value">
                <button id="addProperty">Add Property</button>
            </div>
            <div><button id="saveButton">Save</button></div>
        `;

        const customPropertiesDiv = popupContent.querySelector('#customProperties');
        
        function updateCustomProperties() {
            customPropertiesDiv.innerHTML = '';
            const reservedKeys = ['id', 'meta', 'meta:type', 'active', 'mode', 'fillColor', 'strokeColor', 'fillOpacity', 'strokeWidth'];
            
            for (const [key, value] of Object.entries(feature.properties)) {
                let displayKey = key.replace(/^(user_)+/, '');
                if (!reservedKeys.includes(displayKey) && !reservedKeys.includes(key)) {
                    customPropertiesDiv.innerHTML += `
                        <div>
                            <strong>${displayKey}:</strong> ${value}
                            <button class="removeProperty" data-key="${key}">Remove</button>
                        </div>
                    `;
                }
            }
            
            customPropertiesDiv.querySelectorAll('.removeProperty').forEach(button => {
                button.addEventListener('click', (event) => {
                    const keyToRemove = event.target.getAttribute('data-key');
                    delete feature.properties[keyToRemove];
                    updateCustomProperties();
                });
            });
        }

        updateCustomProperties();

        const addPropertyButton = popupContent.querySelector('#addProperty');
        addPropertyButton.addEventListener('click', () => {
            let key = popupContent.querySelector('#newKey').value.trim();
            const value = popupContent.querySelector('#newValue').value.trim();
            if (key && value) {
                // Remove any existing "user_" prefix
                key = key.replace(/^(user_)+/, '');
                // Add the property without "user_" prefix
                feature.properties[key] = value;
                updateCustomProperties();
                popupContent.querySelector('#newKey').value = '';
                popupContent.querySelector('#newValue').value = '';
            }
        });

        const saveButton = popupContent.querySelector('#saveButton');
        saveButton.addEventListener('click', () => {
            const featureCollection = draw.getAll();
            const featureIndex = featureCollection.features.findIndex(f => f.id === featureId);
            if (featureIndex !== -1) {
                // Remove any properties with "user_" prefix before saving
                const cleanedProperties = {};
                for (const [key, value] of Object.entries(feature.properties)) {
                    const cleanKey = key.replace(/^(user_)+/, '');
                    cleanedProperties[cleanKey] = value;
                }
                feature.properties = cleanedProperties;
                featureCollection.features[featureIndex] = feature;
                draw.set(featureCollection);
            }
            console.log('Updated feature:', feature);
            currentPopup.remove();
            currentPopup = null;
        });

        return popupContent;
    }

    currentPopup = new maplibregl.Popup({
        closeOnClick: false,
        closeButton: true
    })
    .setLngLat(e.lngLat)
    .setDOMContent(renderPopupContent())
    .addTo(map);

    currentPopup.on('close', () => {
        console.log('Popup closed. Feature:', feature);
        currentPopup = null;
    });
}

function refreshDrawLayers() {
    const featureCollection = draw.getAll();
    draw.set(featureCollection);
}
