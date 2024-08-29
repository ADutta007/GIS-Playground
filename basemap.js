const baseMaps = {
  "STREETS": {
    img: "https://cloud.maptiler.com/static/img/maps/streets.png",
    style: 'https://api.maptiler.com/maps/streets/style.json?key=Use your Own API Key'
  },
  "WINTER": {
    img: "https://cloud.maptiler.com/static/img/maps/winter.png",
    style: 'https://api.maptiler.com/maps/winter/style.json?key=Use your Own API Key'
  },
  "HYBRID": {
    img: "https://cloud.maptiler.com/static/img/maps/hybrid.png",
    style: 'https://api.maptiler.com/maps/hybrid/style.json?key=Use your Own API Key'
  }
};

class LayerSwitcherControl {
  constructor(options) {
    this._options = { ...options };
    this._container = document.createElement("div");
    this._container.classList.add("maplibregl-ctrl");
    this._container.classList.add("maplibregl-ctrl-basemaps");
    this._container.classList.add("closed");
    switch (this._options.expandDirection || "right") {
      case "top":
        this._container.classList.add("reverse");
      case "down":
        this._container.classList.add("column");
        break;
      case "left":
        this._container.classList.add("reverse");
      case "right":
        this._container.classList.add("row");
    }
    this._container.addEventListener("mouseenter", () => {
      this._container.classList.remove("closed");
    });
    this._container.addEventListener("mouseleave", () => {
      this._container.classList.add("closed");
    });
  }

  onAdd(map) {
    this._map = map;
    const basemaps = this._options.basemaps;
    Object.keys(basemaps).forEach((layerId) => {
      const base = basemaps[layerId];
      const basemapContainer = document.createElement("img");
      basemapContainer.src = base.img;
      basemapContainer.classList.add("basemap");
      basemapContainer.dataset.id = layerId;
      basemapContainer.addEventListener("click", () => {
        const activeElement = this._container.querySelector(".active");
        if (activeElement) {
          activeElement.classList.remove("active");
        }
        basemapContainer.classList.add("active");
        map.setStyle(base.style);
      });
      this._container.appendChild(basemapContainer);
      if (this._options.initialBasemap.id === layerId) {
        basemapContainer.classList.add("active");
      }
    });
    return this._container;
  }

  onRemove() {
    this._container.parentNode?.removeChild(this._container);
    delete this._map;
  }
}

// Export the necessary components for script.js to use
window.baseMaps = baseMaps;
window.LayerSwitcherControl = LayerSwitcherControl;
