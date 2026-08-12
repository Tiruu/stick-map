import { useEffect, useRef, useState } from "react";
import {
  Map,
  Marker,
  setWorkerUrl,
  type MapMouseEvent,
  type GeoJSONSource,
} from "maplibre-gl";

import "maplibre-gl/dist/maplibre-gl.css";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import "./App.css";
import { supabase } from "./supabase";
import type { User } from "@supabase/supabase-js";
import Auth from "./Auth";

setWorkerUrl(workerUrl);

import type {
  DraftStick,
  Stick,
  Profile,
  RankingEntry,
  StickConfirmation,
  StickReport,
  StickStatus,
} from "./types";

import Ranking from "./components/Ranking";
import UserPanel from "./components/UserPanel";
import StickForm from "./components/StickForm";
import StickDetails from "./components/StickDetails";

import {
  getSticks,
  createStick,
  getConfirmations,
  confirmStickPresence,
  getReports,
  reportStickMissing,
  getStickStatuses,
  deleteStick,
} from "./services/sticks";

import { getProfile } from "./services/profiles";
import { getRanking } from "./services/ranking";

import {
  uploadStickPhoto,
  getStickPhotoUrl,
} from "./services/storage";

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  
  const isAdmin = profile?.role === "admin";

  const [selectedAuthor, setSelectedAuthor] = useState<Profile | null>(null);
  const [ranking, setRanking] = useState<RankingEntry[]>([]);
  const [confirmations, setConfirmations] = useState<StickConfirmation[]>([]);
  const [reports, setReports] = useState<StickReport[]>([]);
  const [stickStatuses, setStickStatuses] = useState<Record<string, StickStatus>>({});
  const sticksRef = useRef<Stick[]>([]);

  const addModeRef = useRef(false);

  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const markerRef = useRef<Marker | null>(null);

  const [addMode, setAddMode] = useState(false);
  const [draftStick, setDraftStick] = useState<DraftStick | null>(null);
  const [sticks, setSticks] = useState<Stick[]>([]);

  const [selectedStick, setSelectedStick] = useState<Stick | null>(null);

  const [description, setDescription] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);

  const [showRanking, setShowRanking] = useState(false);

  function sticksToGeoJSON(
    sticks: Stick[],
    statuses: Record<string, StickStatus>
  ) {
    return {
      type: "FeatureCollection" as const,

      features: sticks.map((stick) => ({
        type: "Feature" as const,

        geometry: {
          type: "Point" as const,
          coordinates: [
            stick.longitude,
            stick.latitude,
          ],
        },

        properties: {
          id: stick.id,
          status: statuses[stick.id] ?? "unknown",
        },
      })),
    };
  }
  
  async function loadProfile(userId: string) {
    try {
      const data = await getProfile(userId);
      setProfile(data);
    } catch (error) {
      console.error("Erreur chargement profil :", error);
    }
  }

  async function loadSticks() {
    try {
      const data = await getSticks();

      setSticks(data);
    } catch (error) {
      console.error("Erreur chargement :", error);
    }
  }

  async function loadStickAuthor(userId: string | null) {
    if (!userId) {
      setSelectedAuthor(null);
      return;
    }

    try {
      const data = await getProfile(userId);
      setSelectedAuthor(data);
    } catch (error) {
      console.error("Erreur chargement auteur :", error);
      setSelectedAuthor(null);
    }
  }

  async function loadRanking() {
    try {
      const data = await getRanking();
      setRanking(data);
    } catch (error) {
      console.error("Erreur classement :", error);
    }
  }

  async function loadConfirmations(stickId: string) {
    try {
      const data = await getConfirmations(stickId);

      setConfirmations(data);
    } catch (error) {
      console.error(
        "Erreur chargement confirmations :",
        error
      );
    }
  }

  async function loadReports(stickId: string) {
    try {
      const data = await getReports(stickId);

      setReports(data);
    } catch (error) {
      console.error(
        "Erreur chargement signalements :",
        error
      );
    }
  }

  async function loadStickStatuses() {
    try {
      const data = await getStickStatuses();

      setStickStatuses(data);
    } catch (error) {
      console.error(
        "Erreur chargement statuts :",
        error
      );
    }
  }

  useEffect(() => {
    loadSticks();
    loadStickStatuses();
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const currentUser = data.user;

      setUser(currentUser);

      if (currentUser) {
        loadProfile(currentUser.id);
      }
      loadRanking();
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
    sticksRef.current = sticks;
  }, [sticks]);

  useEffect(() => {
    addModeRef.current = addMode;
  }, [addMode]);

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
    map.on("load", () => {
    map.addSource("sticks", {
      type: "geojson",
      data: sticksToGeoJSON([], {}),

      cluster: true,
      clusterMaxZoom: 14,
      clusterRadius: 50,
    });

    map.addLayer({
      id: "stick-clusters",
      type: "circle",
      source: "sticks",

      filter: ["has", "point_count"],

      paint: {
        "circle-color": "#2563eb",

        "circle-radius": [
          "step",
          ["get", "point_count"],

          18,

          10,
          23,

          50,
          30,
        ],

        "circle-stroke-width": 2,
        "circle-stroke-color": "#ffffff",
      },
    });

    map.addLayer({
      id: "stick-cluster-count",
      type: "symbol",
      source: "sticks",

      filter: ["has", "point_count"],

      layout: {
        "text-field": "{point_count_abbreviated}",
        "text-size": 13,
      },

      paint: {
        "text-color": "#ffffff",
      },
    });

    map.addLayer({
      id: "stick-points",
      type: "circle",
      source: "sticks",

      filter: ["!", ["has", "point_count"]],

      paint: {
        "circle-color": [
          "match",
          ["get", "status"],

          "present",
          "#22c55e",

          "missing",
          "#ef4444",

          "#9ca3af",
        ],
        "circle-radius": 9,

        "circle-stroke-width": 2,
        "circle-stroke-color": "#ffffff",
      },
    });
    map.on("click", "stick-points", (event) => {
      if (addModeRef.current) return;

      const feature = event.features?.[0];

      if (!feature) return;

      const stickId = feature.properties?.id;

      if (!stickId) return;

      const stick = sticksRef.current.find(
        (item) => item.id === stickId
      );

      if (!stick) return;

      setSelectedStick(stick);

      loadStickAuthor(stick.user_id);
      loadConfirmations(stick.id);
      loadReports(stick.id);
    });
    map.on("click", "stick-clusters", async (event) => {
      if (addModeRef.current) return;

      const features = map.queryRenderedFeatures(
        event.point,
        {
          layers: ["stick-clusters"],
        }
      );

      const feature = features[0];

      if (!feature) return;

      const clusterId =
        feature.properties?.cluster_id;

      if (clusterId === undefined) return;

      const source = map.getSource(
        "sticks"
      ) as GeoJSONSource;

      const zoom =
        await source.getClusterExpansionZoom(
          clusterId
        );

      if (feature.geometry.type !== "Point") {
        return;
      }

      map.easeTo({
        center: feature.geometry.coordinates as [
          number,
          number
        ],

        zoom,
      });
    });
    map.on("mouseenter", "stick-clusters", () => {
      map.getCanvas().style.cursor = "pointer";
    });

    map.on("mouseleave", "stick-clusters", () => {
      map.getCanvas().style.cursor = "";
    });

    map.on("mouseenter", "stick-points", () => {
      map.getCanvas().style.cursor = "pointer";
    });

    map.on("mouseleave", "stick-points", () => {
      map.getCanvas().style.cursor = "";
    });
  });
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

    try {
      let filePath: string | null = null;

      if (photo) {
        filePath = await uploadStickPhoto(photo);
      }

      const newStick = await createStick({
        latitude: draftStick.lat,
        longitude: draftStick.lng,
        description,
        photoPath: filePath,
        userId: user.id,
      });

      setSticks((current) => [
        ...current,
        newStick,
      ]);

      await loadRanking();

      markerRef.current?.remove();
      markerRef.current = null;

      setDraftStick(null);
      setDescription("");
      setPhoto(null);
    } catch (error) {
      console.error(
        "Erreur sauvegarde stick :",
        error
      );
    }
  }

  useEffect(() => {
    const map = mapRef.current;

    if (!map) return;

    const updateSource = () => {
      const source = map.getSource(
        "sticks"
      ) as GeoJSONSource | undefined;

      if (!source) return;

      source.setData(
        sticksToGeoJSON(sticks, stickStatuses)
      );
    };

    if (map.isStyleLoaded()) {
      updateSource();
    } else {
      map.once("load", updateSource);
    }
  }, [sticks, stickStatuses]);

  async function confirmStick() {
    if (!selectedStick || !user) return;

    try {
      await confirmStickPresence(
        selectedStick.id,
        user.id
      );

      await loadConfirmations(selectedStick.id);
      await loadStickStatuses();
    } catch (error) {
      console.error(
        "Erreur confirmation :",
        error
      );
    }
  }

  async function reportMissingStick() {
    if (!selectedStick || !user) return;

    try {
      await reportStickMissing(
        selectedStick.id,
        user.id
      );

      await loadReports(selectedStick.id);
      await loadStickStatuses();
    } catch (error) {
      console.error(
        "Erreur signalement :",
        error
      );
    }
  }

  async function deleteSelectedStick() {
    if (!selectedStick || !isAdmin) return;

    try {
      await deleteStick(
        selectedStick.id,
        selectedStick.photo_path
      );

      setSticks((current) =>
        current.filter(
          (stick) => stick.id !== selectedStick.id
        )
      );

      setSelectedStick(null);
      setSelectedAuthor(null);
      setConfirmations([]);
      setReports([]);

      await loadRanking();
      await loadStickStatuses();
    } catch (error) {
      console.error(
        "Erreur suppression stick :",
        error
      );
    }
  }

  return (
    <>
      {!user && (
        <div className="auth-overlay">
          <Auth />
        </div>
      )}
      {user && (
        <UserPanel
          profile={profile}
          onLogout={() => supabase.auth.signOut()}
        />
      )}
      <button
        className="add-stick-button"
        onClick={() => setAddMode(true)}
        disabled={!user}
      >
        + Ajouter un stick
      </button>

      <button
        className="ranking-button"
        onClick={() => setShowRanking(true)}
      >
        🏆 Classement
      </button>

      {showRanking && (
        <div className="ranking-overlay">
          <div className="ranking-modal">
            <button
              className="close-ranking"
              onClick={() => setShowRanking(false)}
            >
              ✕
            </button>

            <Ranking ranking={ranking} />
          </div>
        </div>
      )}

      {draftStick && (
        <StickForm
          draftStick={draftStick}
          description={description}
          onDescriptionChange={setDescription}
          onPhotoChange={setPhoto}
          onSave={saveStick}
          onCancel={cancelStick}
        />
      )}

      {selectedStick && (
        <StickDetails
          stick={selectedStick}
          author={selectedAuthor}
          confirmations={confirmations}
          reports={reports}
          currentUserId={user?.id ?? null}
          photoUrl={
            selectedStick.photo_path
              ? getStickPhotoUrl(selectedStick.photo_path)
              : null
          }
          onClose={() => {
            setSelectedStick(null);
            setSelectedAuthor(null);
          }}
          onConfirm={confirmStick}
          onReportMissing={reportMissingStick}
          isAdmin={isAdmin}
          onDelete={deleteSelectedStick}
        />
      )}
      {isAdmin && (
        <div className="admin-panel">
          <strong>Mode développeur</strong>
        </div>
      )}
      <div ref={mapContainer} className="map" />
    </>
  );
}

export default App;