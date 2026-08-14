import { useEffect, useRef, useState } from "react";
import {
  Map,
  Marker,
  GeolocateControl,
  setWorkerUrl,
  type MapMouseEvent,
  type GeoJSONSource,
} from "maplibre-gl";
import { Analytics } from "@vercel/analytics/react";

import "maplibre-gl/dist/maplibre-gl.css";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";

import MaplibreGeocoder, {
  type MaplibreGeocoderApi,
  type MaplibreGeocoderApiConfig,
  type MaplibreGeocoderFeatureResults,
} from "@maplibre/maplibre-gl-geocoder";

import "@maplibre/maplibre-gl-geocoder/dist/maplibre-gl-geocoder.css";
import "./App.css";
import { supabase } from "./supabase";
import type { User } from "@supabase/supabase-js";
import Auth from "./Auth";
import { SpeedInsights } from "@vercel/speed-insights/react";

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
import ProfilePanel from "./components/ProfilePanel";
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

import {
  getUserSticks,
} from "./services/sticks";

import ValidationPanel from "./components/ValidationPanel";
import AdminModerationPanel from "./components/AdminModerationPanel";

import {
  getPendingSticks,
  voteOnStick,
} from "./services/sticks";
import {
  getReviewSticks,
  approveReviewedStick,
  rejectReviewedStick,
} from "./services/sticks";

function App() {
  const [showAuth, setShowAuth] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [userSticks, setUserSticks] = useState<Stick[]>([]);

  const [pendingSticks, setPendingSticks] =
    useState<Stick[]>([]);

  const [showValidation, setShowValidation] =
    useState(false);

  const [validationIndex, setValidationIndex] =
    useState(0);
  
  const isAdmin = profile?.role === "admin";
  const [reviewSticks, setReviewSticks] = useState<Stick[]>([]);
  const [showAdminModeration, setShowAdminModeration] = useState(false);
  const [adminModerationIndex, setAdminModerationIndex] = useState(0);

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

  const geocoderApi: MaplibreGeocoderApi = {
    forwardGeocode: async (
      config: MaplibreGeocoderApiConfig
    ): Promise<MaplibreGeocoderFeatureResults> => {
      const features: MaplibreGeocoderFeatureResults["features"] = [];

      if (typeof config.query !== "string") {
        return {
          type: "FeatureCollection",
          features,
        };
      }

      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?` +
            new URLSearchParams({
              q: config.query,
              format: "geojson",
              addressdetails: "1",
              limit: "5",
            })
        );

        const geojson = await response.json();

        const seen = new Set<string>();

        for (const feature of geojson.features) {
          const displayName = feature.properties.display_name;

          if (seen.has(displayName)) {
            continue;
          }

          seen.add(displayName);

          features.push({
            type: "Feature",
            geometry: feature.geometry,
            place_name: displayName,
            properties: feature.properties,
            text: displayName,
            place_type: ["place"],
            center: feature.geometry.coordinates,
          });
        }
      } catch (error) {
        console.error(
          "Erreur recherche adresse :",
          error
        );
      }

      return {
        type: "FeatureCollection",
        features,
      };
    },
  };

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

          status:
            statuses[stick.id] ?? "unknown",

          moderation_status:
            stick.moderation_status,
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

  async function openProfile() {
    console.log("Ouverture profil");

    if (!user) {
      console.log("Pas d'utilisateur connecté");
      return;
    }

    try {
      const data = await getUserSticks(user.id);

      console.log("Sticks utilisateur :", data);

      setUserSticks(data);
      setShowProfile(true);
    } catch (error) {
      console.error(
        "Erreur chargement profil :",
        error
      );
    }
  }

  async function loadSticks() {
    try {
      const data = await getSticks(
        user?.id ?? null,
        isAdmin
      );

      setSticks(data);
    } catch (error) {
      console.error(
        "Erreur chargement sticks :",
        error
      );
    }
  }

  async function loadPendingSticks() {
    if (!user) {
      setPendingSticks([]);
      return;
    }

    try {
      const data = await getPendingSticks();

      const { data: votes, error } = await supabase
        .from("stick_validation_votes")
        .select("stick_id")
        .eq("user_id", user.id);

      if (error) {
        throw error;
      }

      const votedStickIds = new Set(
        votes.map((vote) => vote.stick_id)
      );

      const availableSticks = data.filter(
        (stick) =>
          stick.user_id !== user.id &&
          !votedStickIds.has(stick.id)
      );

      setPendingSticks(availableSticks);
    } catch (error) {
      console.error(
        "Erreur sticks à valider :",
        error
      );
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

  async function loadReviewSticks() {
    if (!isAdmin) {
      setReviewSticks([]);
      return;
    }

    try {
      const data = await getReviewSticks();

      setReviewSticks(data);
    } catch (error) {
      console.error(
        "Erreur chargement modération :",
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
  }, [user, isAdmin]);

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
      async (_event, session) => {
        const currentUser = session?.user ?? null;

        setUser(currentUser);

        if (currentUser) {
          loadProfile(currentUser.id);
        } else {
          setProfile(null);
        }
        await loadSticks();
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
      center: [3.57, 47.80],
      zoom: 12,

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
    map.addControl(
      new GeolocateControl({
        positionOptions: {
          enableHighAccuracy: true,
        },
        trackUserLocation: true,
        showUserLocation: true,
        showAccuracyCircle: true,
      }),
      "top-right"
    );

    const geocoder = new MaplibreGeocoder(
      geocoderApi,
      {
        maplibregl: {
          Map,
          Marker,
        } as any,

        placeholder: "Rechercher une ville ou une adresse",
        showResultsWhileTyping: true,
        marker: false,

        flyTo: {
          duration: 2000,
          zoom: 14,
        },
      }
    );

    map.addControl(geocoder, "top-left");

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
          "case",

          // Pending
          [
            "==",
            ["get", "moderation_status"],
            "pending",
          ],
          "#f59e0b",

          // Review admin
          [
            "==",
            ["get", "moderation_status"],
            "review",
          ],
          "#8b5cf6",

          // Approved + présent
          [
            "all",
            [
              "==",
              ["get", "moderation_status"],
              "approved",
            ],
            [
              "==",
              ["get", "status"],
              "present",
            ],
          ],
          "#22c55e",

          // Approved + disparu
          [
            "all",
            [
              "==",
              ["get", "moderation_status"],
              "approved",
            ],
            [
              "==",
              ["get", "status"],
              "missing",
            ],
          ],
          "#ef4444",

          // Par défaut : approved mais non vérifié
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

      const isMobile = window.innerWidth <= 700;

      map.easeTo({
        center: [
          stick.longitude,
          stick.latitude,
        ],
        zoom: Math.max(map.getZoom(), 18),
        offset: isMobile
          ? [0, -140]
          : [-180, 0],
        duration: 2000,
      });
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
        duration: 350,
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
     if (!draftStick || !user || !photo) return;

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

  async function logout() {
    await supabase.auth.signOut();

    setShowAuth(false);
    setShowProfile(false);
  }

  useEffect(() => {
    if (!user) {
      setPendingSticks([]);
      return;
    }

    loadPendingSticks();
  }, [user]);

  useEffect(() => {
    if (isAdmin) {
      loadReviewSticks();
    } else {
      setReviewSticks([]);
    }
  }, [isAdmin]);

  async function handleAdminApproveStick(
    stick: Stick
  ) {
    try {
      await approveReviewedStick(stick.id);

      await loadReviewSticks();
      await loadSticks();
      await loadStickStatuses();

      setAdminModerationIndex(0);
    } catch (error) {
      console.error(
        "Erreur validation admin :",
        error
      );
    }
  }

  async function handleAdminRejectStick(
    stick: Stick
  ) {
    try {
      await rejectReviewedStick(stick.id);

      await loadReviewSticks();
      await loadSticks();
      await loadStickStatuses();

      setAdminModerationIndex(0);
    } catch (error) {
      console.error(
        "Erreur refus admin :",
        error
      );
    }
  }

  async function handleValidationVote(
    stick: Stick,
    vote: "approve" | "reject"
  ) {
    if (!user) return;

    try {
      await voteOnStick(
        stick.id,
        user.id,
        vote
      );

      await loadPendingSticks();
      await loadSticks();
      await loadStickStatuses();

      setValidationIndex(0);
    } catch (error) {
      console.error(
        "Erreur vote validation :",
        error
      );
    }
  }

  return (
    <>
    {!user && (
      <button
        className="login-button"
        onClick={() => setShowAuth(true)}
      >
        Se connecter
      </button>
    )}
      {showAuth && !user && (
        <div className="auth-overlay">
          <Auth />
        </div>
      )}
      {user && (
        <UserPanel
          profile={profile}
          onLogout={logout}
          onOpenProfile={openProfile}
        />
      )}
      <button
        className="add-stick-button"
        onClick={() => setAddMode(true)}
        disabled={!user}
      >
        + Ajouter un stick
      </button>
      {showProfile && profile && (
        <ProfilePanel
          profile={profile}
          sticks={userSticks}
          ranking={ranking}
          onClose={() => setShowProfile(false)}
          onSelectStick={(stick) => {
            setShowProfile(false);
            setSelectedStick(stick);

            loadStickAuthor(stick.user_id);
            loadConfirmations(stick.id);
            loadReports(stick.id);
          }}
          onUsernameUpdated={(username) => {
            setProfile((current) =>
              current
                ? {
                    ...current,
                    username,
                  }
                : current
            );

            loadRanking();
          }}
        />
      )}
      {user && pendingSticks.length > 0 && (
        <button
          className="validation-button"
          onClick={() => {
            setValidationIndex(0);
            setShowValidation(true);
          }}
        >
          🔔 {pendingSticks.length} stick
          {pendingSticks.length > 1 ? "s" : ""} à valider
        </button>
      )}
      {showValidation && (
        <ValidationPanel
          sticks={pendingSticks}
          currentIndex={validationIndex}
          getPhotoUrl={getStickPhotoUrl}

          onClose={() =>
            setShowValidation(false)
          }

          onApprove={(stick) =>
            handleValidationVote(
              stick,
              "approve"
            )
          }

          onReject={(stick) =>
            handleValidationVote(
              stick,
              "reject"
            )
          }

          onPrevious={() =>
            setValidationIndex((current) =>
              Math.max(0, current - 1)
            )
          }

          onNext={() =>
            setValidationIndex((current) =>
              Math.min(
                pendingSticks.length - 1,
                current + 1
              )
            )
          }
        />
      )}
      {isAdmin && reviewSticks.length > 0 && (
        <button
          className="admin-moderation-button"
          onClick={() => {
            setAdminModerationIndex(0);
            setShowAdminModeration(true);
          }}
        >
          🛡️ Modération ({reviewSticks.length})
        </button>
      )}
      {showAdminModeration && isAdmin && (
        <AdminModerationPanel
          sticks={reviewSticks}
          currentIndex={adminModerationIndex}
          getPhotoUrl={getStickPhotoUrl}

          onClose={() =>
            setShowAdminModeration(false)
          }

          onApprove={handleAdminApproveStick}
          onReject={handleAdminRejectStick}

          onPrevious={() =>
            setAdminModerationIndex((current) =>
              Math.max(0, current - 1)
            )
          }

          onNext={() =>
            setAdminModerationIndex((current) =>
              Math.min(
                reviewSticks.length - 1,
                current + 1
              )
            )
          }
        />
      )}

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
          photo={photo}
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
          user={user}
        />
      )}
      {isAdmin && (
        <div className="admin-panel">
          <strong>Mode développeur</strong>
        </div>
      )}
      <div ref={mapContainer} className="map" />
      <SpeedInsights />
      <Analytics />
    </>
  );
}

export default App;
