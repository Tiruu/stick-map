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
import { supabase } from "./supabase";
import type { User } from "@supabase/supabase-js";
import Auth from "./Auth";

setWorkerUrl(workerUrl);

type DraftStick = {
  lng: number;
  lat: number;
};

type Stick = {
  id: string;
  latitude: number;
  longitude: number;
  description: string;
  photo_path: string | null;
  user_id: string | null;
};

type Profile = {
  id: string;
  username: string;
};

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [selectedAuthor, setSelectedAuthor] = useState<Profile | null>(null);

  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const markerRef = useRef<Marker | null>(null);

  const [addMode, setAddMode] = useState(false);
  const [draftStick, setDraftStick] = useState<DraftStick | null>(null);
  const [sticks, setSticks] = useState<Stick[]>([]);

  const [selectedStick, setSelectedStick] = useState<Stick | null>(null);

  const [description, setDescription] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  
  async function loadProfile(userId: string) {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, username")
      .eq("id", userId)
      .single();

    if (error) {
      console.error("Erreur chargement profil :", error);
      return;
    }

    setProfile(data);
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const currentUser = data.user;

      setUser(currentUser);

      if (currentUser) {
        loadProfile(currentUser.id);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        const currentUser = session?.user ?? null;

        setUser(currentUser);

        if (currentUser) {
          loadProfile(currentUser.id);
        } else {
          setProfile(null);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!mapContainer.current) return;

    const map = new Map({
      container: mapContainer.current,
      style: "https://tiles.openfreemap.org/styles/liberty",
      center: [3.57, 47.8],
      zoom: 10,

      dragRotate: false,
    });

    mapRef.current = map;
    map.addControl(new NavigationControl(), "top-right");
    map.touchZoomRotate.disableRotation();

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

  async function saveStick() {
    if (!draftStick || !user) return;

    let filePath: string | null = null;

    // 1. Upload de la photo
    if (photo) {
      const extension = photo.name.split(".").pop();

      filePath = `sticks/${crypto.randomUUID()}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from("stick-photos")
        .upload(filePath, photo);

      if (uploadError) {
        console.error("Erreur upload photo :", uploadError);
        return;
      }
    }

    // 2. Sauvegarde du stick en BDD
    const { data, error } = await supabase
      .from("sticks")
      .insert({
        latitude: draftStick.lat,
        longitude: draftStick.lng,
        description,
        photo_path: filePath,
        user_id: user.id,
      })
    .select()
    .single();

    if (error) {
      console.error("Erreur sauvegarde stick :", error);
      return;
    }

    // 3. Ajout du stick côté React
    setSticks((currentSticks) => [
      ...currentSticks,
      data,
    ]);

    // 4. Nettoyage
    markerRef.current?.remove();
    markerRef.current = null;

    setDraftStick(null);
    setDescription("");
    setPhoto(null);
  }

  async function loadSticks() {
    const { data, error } = await supabase
      .from("sticks")
      .select("*");

    if (error) {
      console.error("Erreur chargement :", error);
      return;
    }

    setSticks(data);
  }

  useEffect(() => {
    loadSticks();
  }, []);

  useEffect(() => {
    const map = mapRef.current;

    if (!map) return;

    const markers = sticks.map((stick) => {
      const marker = new Marker()
        .setLngLat([
          stick.longitude,
          stick.latitude,
        ])
        .addTo(map);

      marker.getElement().addEventListener("click", (event) => {
        event.stopPropagation();
        setSelectedStick(stick);
      });

      return marker;
    });

    return () => {
      markers.forEach((marker) => marker.remove());
    };
  }, [sticks]);

  function getStickPhotoUrl(path: string) {
    const { data } = supabase.storage
      .from("stick-photos")
      .getPublicUrl(path);

    return data.publicUrl;
  }

  return (
    <>
      {!user && (
        <div className="auth-overlay">
          <Auth />
        </div>
      )}
      {user && (
        <div className="user-panel">
          <span>
            👤 {profile?.username ?? "Chargement..."}
          </span>

          <button
            onClick={() => supabase.auth.signOut()}
          >
            Déconnexion
          </button>
        </div>
      )}
      <button
        className="add-stick-button"
        onClick={() => setAddMode(true)}
        disabled={!user}
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
      {selectedStick && (
        <aside className="stick-details">
          <button
            className="close-stick-details"
            onClick={() => setSelectedStick(null)}
          >
            ✕
          </button>

          <h2>Stick</h2>

          {selectedStick.photo_path && (
            <img
              src={getStickPhotoUrl(selectedStick.photo_path)}
              alt="Stick"
              className="stick-photo"
            />
          )}

          <p>
            {selectedStick.description || "Aucune description"}
          </p>

          <p className="stick-coordinates">
            📍 {selectedStick.latitude.toFixed(5)},{" "}
            {selectedStick.longitude.toFixed(5)}
          </p>

          <div className="stick-actions">
            <button>
              ✅ Toujours présent
            </button>

            <button>
              🚩 Signaler disparu
            </button>
          </div>
        </aside>
      )}
      <div ref={mapContainer} className="map" />
    </>
  );
}

export default App;