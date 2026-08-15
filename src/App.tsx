import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  Map,
  Marker,
  GeolocateControl,
  setWorkerUrl,
  type MapMouseEvent,
  type GeoJSONSource,
} from "maplibre-gl";

import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import type { User } from "@supabase/supabase-js";

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
import Auth from "./Auth";

import type {
  DraftStick,
  Stick,
  Profile,
  RankingEntry,
  StickStatus,
  Friendship,
} from "./types";

import Ranking from "./components/Ranking";
import UserPanel from "./components/UserPanel";
import ProfilePanel from "./components/ProfilePanel";
import PublicProfilePanel from "./components/PublicProfilePanel";
import StickForm from "./components/StickForm";
import StickDetails from "./components/StickDetails";
import ValidationPanel from "./components/ValidationPanel";
import AdminModerationPanel from "./components/AdminModerationPanel";


import {
  getUserSticks,
} from "./services/sticks";

import {
  getProfile,
} from "./services/profiles";

import {
  getRanking,
} from "./services/ranking";

import {
  getStickPhotoUrl,
} from "./services/storage";

import FriendsPanel from "./components/FriendsPanel";

import {
  getFriendshipBetween,
  sendFriendRequest,
  findUserByEmail,
} from "./services/friends";

import { useFriends } from "./hooks/useFriends";
import { useModeration } from "./hooks/useModeration";
import { useSticks } from "./hooks/useSticks";

setWorkerUrl(workerUrl);

function App() {
  const [showAuth, setShowAuth] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [userSticks, setUserSticks] = useState<Stick[]>([]);
  
  const isAdmin = profile?.role === "admin";

  const [selectedAuthor, setSelectedAuthor] = useState<Profile | null>(null);
  const [ranking, setRanking] = useState<RankingEntry[]>([]);
  const sticksRef = useRef<Stick[]>([]);

  const addModeRef = useRef(false);
  const [showValidation, setShowValidation] =
  useState(false);

  const [showAdminModeration, setShowAdminModeration] =
    useState(false);

  const {
    pendingSticks,
    reviewSticks,

    validationIndex,
    setValidationIndex,

    adminModerationIndex,
    setAdminModerationIndex,

    loadPendingSticks,

    handleValidationVote,
    handleAdminApproveStick,
    handleAdminRejectStick,
  } = useModeration({
    user,
    isAdmin,
  });

  const {
    sticks,

    stickStatuses,

    confirmations,
    reports,

    loadConfirmations,
    loadReports,

    saveStick,
    confirmStick,
    reportMissingStick,
    deleteStickById,
  } = useSticks({
    user,
    isAdmin,
  });

  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const markerRef = useRef<Marker | null>(null);

  const [addMode, setAddMode] = useState(false);
  const [draftStick, setDraftStick] = useState<DraftStick | null>(null);

  const [selectedStick, setSelectedStick] = useState<Stick | null>(null);

  const [description, setDescription] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);

  const [showRanking, setShowRanking] = useState(false);

  const [publicProfile, setPublicProfile] = useState<Profile | null>(null);
  const [publicProfileFriendship, setPublicProfileFriendship] = useState<Friendship | null>(null);
  const [showFriends, setShowFriends] = useState(false);

  const {
    friendships,
    friendProfiles,
    requesterProfiles,
    pendingFriendRequests,
    loadFriends,
    acceptFriend,
    rejectFriend,
  } = useFriends(user);

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

  async function openPublicProfile(
    profileId: string
  ) {
    if (!user) return;

    try {
      const profile = await getProfile(profileId);

      const friendship =
        await getFriendshipBetween(
          user.id,
          profileId
        );

      setPublicProfile(profile);
      setPublicProfileFriendship(friendship);
    } catch (error) {
      console.error(
        "Erreur chargement profil public :",
        error
      );
    }
  }

  async function handleSendFriendRequest() {
    if (!user || !publicProfile) return;

    try {
      const friendship =
        await sendFriendRequest(
          user.id,
          publicProfile.id
        );

      setPublicProfileFriendship(friendship);
    } catch (error) {
      console.error(
        "Erreur demande d'ami :",
        error
      );
    }
  }

  async function handleFriendSearch(
    email: string
  ) {
    if (!user) return;

    try {
      const result =
        await findUserByEmail(email);

      if (!result) {
        alert(
          "Aucun utilisateur trouvé avec cet email."
        );
        return;
      }

      if (result.id === user.id) {
        alert(
          "Tu ne peux pas t'ajouter toi-même."
        );
        return;
      }

      await openPublicProfile(result.id);

      setShowFriends(false);
    } catch (error) {
      console.error(
        "Erreur recherche utilisateur :",
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


  useEffect(() => {
    let cancelled = false;

    async function handleUser(
      currentUser: User | null
    ) {
      if (cancelled) {
        return;
      }

      setUser(currentUser);

      if (!currentUser) {
        setProfile(null);
        await loadRanking();
        return;
      }

      try {
        const profileData =
          await getProfile(currentUser.id);

        if (cancelled) {
          return;
        }

        setProfile(profileData);

        await loadFriends();
        await loadPendingSticks(
          currentUser.id
        );
        await loadRanking();
      } catch (error) {
        console.error(
          "Erreur chargement utilisateur :",
          error
        );
      }
    }

    async function initializeAuth() {
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();

      await handleUser(currentUser);
    }

    initializeAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        void handleUser(
          session?.user ?? null
        );
      }
    );

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [loadFriends]);

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
        },

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
        "circle-color": "#0057a8",

        "circle-radius": [
          "step",
          ["get", "point_count"],

          18,

          10,
          23,

          50,
          30,
        ],

        "circle-stroke-width": 3,
        "circle-stroke-color": "#ffffff",
        "circle-opacity": 0.95,
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

            [
              "==",
              ["get", "moderation_status"],
              "pending",
            ],
            "#f59e0b",

            [
              "==",
              ["get", "moderation_status"],
              "review",
            ],
            "#7c3aed",

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
            "#16a34a",

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
            "#dc2626",

            "#94a3b8",
          ],
        "circle-radius": 10,
        "circle-stroke-width": 3,
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


  async function handleDeleteSelectedStick() {
    if (!selectedStick || !isAdmin) {
      return;
    }

    const deleted = await deleteStickById(
      selectedStick.id,
      selectedStick.photo_path
    );

    if (!deleted) {
      return;
    }

    setSelectedStick(null);
    setSelectedAuthor(null);

    await loadRanking();
  }

  async function logout() {
    await supabase.auth.signOut();

    setShowAuth(false);
    setShowProfile(false);
  }

  async function handleSaveStick() {
    if (!draftStick || !photo) {
      return;
    }

    const newStick = await saveStick({
      latitude: draftStick.lat,
      longitude: draftStick.lng,
      description,
      photo,
    });

    if (!newStick) {
      return;
    }

    markerRef.current?.remove();
    markerRef.current = null;

    setDraftStick(null);
    setDescription("");
    setPhoto(null);
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
          friendships={friendships}

          onClose={() =>
            setShowProfile(false)
          }

          onOpenFriends={() => {
            setShowProfile(false);
            setShowFriends(true);
          }}

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

          onAcceptFriend={acceptFriend}
          onRejectFriend={rejectFriend}
        />
      )}
      {publicProfile && user && (
        <PublicProfilePanel
          profile={publicProfile}
          currentUserId={user.id}
          friendship={publicProfileFriendship}
          stickCount={
            ranking.find(
              (entry) =>
                entry.user_id === publicProfile.id
            )?.stick_count ?? 0
          }
          onClose={() =>
            setPublicProfile(null)
          }
          onSendRequest={
            handleSendFriendRequest
          }
        />
      )}
      {showFriends && user && (
        <FriendsPanel
          friends={friendProfiles}
          pendingRequests={pendingFriendRequests}
          requesterProfiles={requesterProfiles}
          onClose={() =>
            setShowFriends(false)
          }
          onSelectUser={(userId) => {
            setShowFriends(false);
            openPublicProfile(userId);
          }}
          onAcceptFriend={acceptFriend}
          onRejectFriend={rejectFriend}
          onSearch={handleFriendSearch}
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

            <Ranking
              ranking={ranking}
              onSelectUser={openPublicProfile}
            />
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
          onSave={handleSaveStick}
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
          onConfirm={() =>
            confirmStick(selectedStick.id)
          }
          onReportMissing={() =>
            reportMissingStick(selectedStick.id)
          }
          isAdmin={isAdmin}
          onDelete={handleDeleteSelectedStick}
          onOpenAuthor={(userId) => {
            setSelectedStick(null);
            openPublicProfile(userId);
          }}
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
