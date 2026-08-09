import { useEffect, useRef, useState } from "react";
import {
  Map,
  Marker,
  NavigationControl,
  setWorkerUrl,
  type MapMouseEvent,
} from "maplibre-gl";

import "maplibre-gl/dist/maplibre-gl.css";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import "./App.css";

setWorkerUrl(workerUrl);

type DraftStick = {
  lng: number;
  lat: number;
};

function App() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const markerRef = useRef<Marker | null>(null);

  const [addMode, setAddMode] = useState(false);
  const [draftStick, setDraftStick] = useState<DraftStick | null>(null);

  const [description, setDescription] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);

  useEffect(() => {
    if (!mapContainer.current) return;

    const map = new Map({
      container: mapContainer.current,
      style: "https://tiles.openfreemap.org/styles/liberty",
      center: [3.57, 47.8],
      zoom: 10,
    });

    mapRef.current = map;
    map.addControl(new NavigationControl(), "top-right");

    return () => {
      markerRef.current?.remove();
      map.remove();
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;

    if (!map) return;

    if (!addMode) {
      map.dragPan.enable();
      map.getCanvas().style.cursor = "";
      return;
    }

    map.dragPan.disable();
    map.getCanvas().style.cursor = "crosshair";

    const handleClick = (event: MapMouseEvent) => {
      const { lng, lat } = event.lngLat;

      if (markerRef.current) {
        markerRef.current.setLngLat([lng, lat]);
      } else {
        markerRef.current = new Marker()
          .setLngLat([lng, lat])
          .addTo(map);
      }

      setDraftStick({
        lng,
        lat,
      });

      setAddMode(false);
    };

    map.once("click", handleClick);

    return () => {
      map.off("click", handleClick);
    };
  }, [addMode]);

  function cancelStick() {
    markerRef.current?.remove();
    markerRef.current = null;

    setDraftStick(null);
    setDescription("");
    setPhoto(null);
  }

  function saveStick() {
    if (!draftStick) return;

    const stick = {
      latitude: draftStick.lat,
      longitude: draftStick.lng,
      description,
      photo,
    };

    console.log("Stick sauvegardé :", stick);

    setDraftStick(null);
    setDescription("");
    setPhoto(null);

    markerRef.current = null;
  }

  return (
    <>
      <button
        className="add-stick-button"
        onClick={() => setAddMode(true)}
      >
        + Ajouter un stick
      </button>

      {draftStick && (
        <div className="stick-form">
          <h2>Ajouter un stick</h2>

          <p>
            📍 {draftStick.lat.toFixed(6)}, {draftStick.lng.toFixed(6)}
          </p>

          <label>
            Photo
            <input
              type="file"
              accept="image/*"
              onChange={(event) => {
                const file = event.target.files?.[0];

                if (file) {
                  setPhoto(file);
                }
              }}
            />
          </label>

          <label>
            Description
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Décris le stick..."
            />
          </label>

          <div className="form-buttons">
            <button onClick={cancelStick}>
              Annuler
            </button>

            <button onClick={saveStick}>
              Ajouter
            </button>
          </div>
        </div>
      )}

      <div ref={mapContainer} className="map" />
    </>
  );
}

export default App;