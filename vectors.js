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
        map.addControl(draw);
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

    const allFeatures = draw.getAll().features;
    const featureStyles = {};

    allFeatures.forEach(feature => {
        if (feature.geometry.type === 'Polygon'||feature.geometry.type === 'LineString') {
            featureStyles[feature.id] = {
                fillColor: feature.properties.fillColor || selectedFillColor,
                strokeColor: feature.properties.strokeColor || selectedStrokeColor,
                fillOpacity: feature.properties.fillOpacity || selectedFillOpacity,
                strokeWidth: feature.properties.strokeWidth || selectedStrokeWidth
            };
        }
        else{
            featureStyles[feature.id] = {
                //fillColor: feature.properties.fillColor || selectedFillColor,
                strokeColor: feature.properties.strokeColor || selectedStrokeColor,
                //fillOpacity: feature.properties.fillOpacity || selectedFillOpacity,
                strokeWidth: feature.properties.strokeWidth || selectedStrokeWidth
            };
        }

    });

    const lineLayerIds = ['gl-draw-line-inactive', 'gl-draw-line-active', 'gl-draw-polygon-stroke-inactive', 'gl-draw-polygon-stroke-active'];
    const fillLayerIds = ['gl-draw-polygon-fill-inactive', 'gl-draw-polygon-fill-active'];

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
            'id': 'highlight-active-points',
            'type': 'circle',
            source: 'mapbox-gl-draw-hot',
            'filter': ['all',
              ['==', '$type', 'Point'],
              ['==', 'meta', 'feature'],
              ['==', 'active', 'true']],
            'paint': {
              'circle-radius': 7,
              'circle-color': '#000000'
            }
        },
          {
            'id': 'points-are-blue',
            'type': 'circle',
            source: 'mapbox-gl-draw-cold',
            'filter': ['all',
              ['==', '$type', 'Point'],
              ['==', 'meta', 'feature'],
              ['==', 'active', 'false']],
            'paint': {
              'circle-radius': 7,
              'circle-color': '#000088'
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
                'fill-color': ['get', 'fillColor'],
                'fill-opacity': ['get', 'fillOpacity']
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
                'line-color': ['get', 'strokeColor'],
                'line-width': ['get', 'strokeWidth']
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
                'line-color': ['get', 'strokeColor'],
                'line-width': ['get', 'strokeWidth']
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

function setupEventListeners() {
    map.on('draw.create', handleDrawCreate);
    map.on('draw.update', handleDrawUpdate);
    map.on('draw.selectionchange', (e) => {
        if (e.features.length > 0 && e.features[0].geometry.type === 'Polygon') {
            applyColorToFeature(e.features[0].id);
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
