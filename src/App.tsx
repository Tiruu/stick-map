import { useEffect, useRef, useState } from "react";
import { setWorkerUrl } from "maplibre-gl";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import type { User } from "@supabase/supabase-js";
import "maplibre-gl/dist/maplibre-gl.css";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import "@maplibre/maplibre-gl-geocoder/dist/maplibre-gl-geocoder.css";
import "./App.css";
import { supabase } from "./supabase";
import Auth from "./Auth";
import type {
  DraftStick,
  Stick,
  Profile,
  StickOrigin,
  StickConfirmation,
  StickReport,
  DraftLocation,
} from "./types";
import Ranking from "./components/Ranking";
import UserPanel from "./components/UserPanel";
import ProfilePanel from "./components/ProfilePanel";
import PublicProfilePanel from "./components/PublicProfilePanel";
import StickForm from "./components/StickForm";
import StickDetails from "./components/StickDetails";
import ValidationPanel from "./components/ValidationPanel";
import AdminModerationPanel from "./components/AdminModerationPanel";
import { getUserSticks, getConfirmations, getReports } from "./services/sticks";
import { getProfile } from "./services/profiles";
import { getStickPhotoUrl } from "./services/storage";
import FriendsPanel from "./components/FriendsPanel";
import { findUserByEmail } from "./services/friends";
import { useFriends } from "./hooks/useFriends";
import { useModeration } from "./hooks/useModeration";
import { useSticks } from "./hooks/useSticks";
import { useRanking } from "./hooks/useRanking";
import { usePublicProfile } from "./hooks/usePublicProfile";
import { useMap } from "./hooks/useMap";
import { watchUserLocation, type UserLocation } from "./utils/geolocation";
import Toast from "./components/Toast";
setWorkerUrl(workerUrl);

function App() {
  const [showAuth, setShowAuth] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [userSticks, setUserSticks] = useState<Stick[]>([]);
  const isAdmin = profile?.role === "admin";
  const [selectedAuthor, setSelectedAuthor] = useState<Profile | null>(null);
  const [lastActivityAuthor, setLastActivityAuthor] = useState<Profile | null>(
    null,
  );
  const [confirmations, setConfirmations] = useState<StickConfirmation[]>([]);
  const [reports, setReports] = useState<StickReport[]>([]);
  const [showValidation, setShowValidation] = useState(false);
  const [showAdminModeration, setShowAdminModeration] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isSavingStick, setIsSavingStick] = useState(false);
  const {
    pendingSticks,
    reviewSticks,

    validationIndex,
    setValidationIndex,

    adminModerationIndex,
    setAdminModerationIndex,

    handleValidationVote,
    handleAdminApproveStick,
    handleAdminRejectStick,
  } = useModeration({
    user,
    isAdmin,
    onError: setToastMessage,
  });
  const {
    sticks,
    stickStatuses,
    saveStick,
    confirmStick,
    isConfirmingStick,
    isReportingStick,
    reportMissingStick,
    deleteStickById,
  } = useSticks({
    user,
    isAdmin,
    onError: setToastMessage,
  });
  const mapContainer = useRef<HTMLDivElement>(null);
  const [addMode, setAddMode] = useState(false);
  const [draftStick, setDraftStick] = useState<DraftStick | null>(null);
  const [draftLocation, setDraftLocation] = useState<DraftLocation | null>(
    null,
  );
  const [selectedStick, setSelectedStick] = useState<Stick | null>(null);
  const [description, setDescription] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [originType, setOriginType] = useState<StickOrigin | null>(null);
  const [showRanking, setShowRanking] = useState(false);
  const [showFriends, setShowFriends] = useState(false);
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [rankingMode, setRankingMode] = useState<"all" | "friends">("all");

  const {
    friendships,
    friendProfiles,
    requesterProfiles,
    pendingFriendRequests,
    acceptFriend,
    rejectFriend,
  } = useFriends(user);
  const { ranking, loadRanking } = useRanking();
  const {
    publicProfile,
    publicProfileFriendship,
    openPublicProfile,
    handleSendFriendRequest,
    closePublicProfile,
  } = usePublicProfile(user);
  const { clearAddMarker } = useMap({
    mapContainer,
    sticks,
    stickStatuses,
    addMode,
    userLocation,
    onStickClick: (stick) => {
      setSelectedStick(stick);
      loadStickAuthor(stick.user_id);
      loadStickHistory(stick.id);
    },
    onAddLocation: (longitude, latitude) => {
      setDraftLocation({
        lng: longitude,
        lat: latitude,
      });
    },
    draftLocation,
  });

  useEffect(() => {
    const watchId = watchUserLocation((location) => {
      setUserLocation(location);
    });

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  async function openProfile() {
    if (!user) {
      return;
    }
    try {
      const data = await getUserSticks(user.id);
      setUserSticks(data);
      setShowProfile(true);
    } catch (error) {
      console.error("Erreur chargement profil :", error);
    }
  }

  async function handleFriendSearch(email: string) {
    if (!user) return;

    try {
      const result = await findUserByEmail(email);

      if (!result) {
        alert("Aucun utilisateur trouvé avec cet email.");
        return;
      }

      if (result.id === user.id) {
        alert("Tu ne peux pas t'ajouter toi-même.");
        return;
      }

      await openPublicProfile(result.id);

      setShowFriends(false);
    } catch (error) {
      console.error("Erreur recherche utilisateur :", error);
    }
  }

  const friendsRanking = ranking.filter((entry) => {
    return friendProfiles.some((friend) => {
      return friend.id === entry.user_id;
    });
  });
  const displayedRanking = rankingMode === "friends" ? friendsRanking : ranking;

  async function loadLastActivityAuthor(
    confirmations: StickConfirmation[],
    reports: StickReport[],
  ) {
    const latestConfirmation = confirmations[0];
    const latestReport = reports[0];

    if (!latestConfirmation && !latestReport) {
      setLastActivityAuthor(null);
      return;
    }

    let userId: string;

    if (latestConfirmation && !latestReport) {
      userId = latestConfirmation.user_id;
    } else if (!latestConfirmation && latestReport) {
      userId = latestReport.user_id;
    } else if (latestConfirmation && latestReport) {
      const confirmationDate = new Date(
        latestConfirmation.updated_at,
      ).getTime();

      const reportDate = new Date(latestReport.updated_at).getTime();

      userId =
        confirmationDate > reportDate
          ? latestConfirmation.user_id
          : latestReport.user_id;
    } else {
      setLastActivityAuthor(null);
      return;
    }

    try {
      const data = await getProfile(userId);
      setLastActivityAuthor(data);
    } catch (error) {
      console.error("Erreur chargement auteur dernière activité :", error);

      setLastActivityAuthor(null);
    }
  }

  async function loadStickHistory(stickId: string) {
    try {
      const [confirmationsData, reportsData] = await Promise.all([
        getConfirmations(stickId),
        getReports(stickId),
      ]);

      setConfirmations(confirmationsData);
      setReports(reportsData);

      await loadLastActivityAuthor(confirmationsData, reportsData);
    } catch (error) {
      console.error("Erreur chargement historique stick :", error);

      setConfirmations([]);
      setReports([]);
      setLastActivityAuthor(null);
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

  useEffect(() => {
    let cancelled = false;

    async function initializeAuth() {
      try {
        const {
          data: { user: currentUser },
        } = await supabase.auth.getUser();

        if (cancelled) {
          return;
        }

        setUser(currentUser);
      } catch (error) {
        console.error("Erreur initialisation authentification :", error);
      }
    }

    initializeAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadUserData() {
      if (!user) {
        setProfile(null);
        return;
      }

      try {
        const profileData = await getProfile(user.id);

        if (cancelled) {
          return;
        }

        setProfile(profileData);
      } catch (error) {
        console.error("Erreur chargement données utilisateur :", error);
      }
    }

    loadUserData();

    return () => {
      cancelled = true;
    };
  }, [user]);

  function cancelStick() {
    clearAddMarker();

    setDraftStick(null);
    setDescription("");
    setPhoto(null);
    setOriginType(null);
  }

  async function handleDeleteSelectedStick() {
    if (!selectedStick || !isAdmin) {
      return;
    }

    const deleted = await deleteStickById(selectedStick.id);

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
    if (!draftStick || !photo || !originType || isSavingStick) {
      return;
    }

    setIsSavingStick(true);

    try {
      const newStick = await saveStick({
        latitude: draftStick.lat,
        longitude: draftStick.lng,
        description,
        photo,
        originType,
      });

      if (!newStick) {
        return;
      }

      clearAddMarker();

      setDraftStick(null);
      setDescription("");
      setPhoto(null);
      setOriginType(null);
    } finally {
      setIsSavingStick(false);
    }
  }

  function confirmDraftLocation() {
    if (!draftLocation) {
      return;
    }

    setDraftStick({
      lng: draftLocation.lng,
      lat: draftLocation.lat,
    });

    setDraftLocation(null);
    setAddMode(false);
  }

  function replaceDraftLocation() {
    setDraftLocation(null);
    clearAddMarker();
  }

  return (
    <>
      {!user && (
        <button className="login-button" onClick={() => setShowAuth(true)}>
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
        onClick={() => {
          if (!userLocation) {
            setAddMode(true);
          } else {
            setDraftLocation({
              lng: userLocation.longitude,
              lat: userLocation.latitude,
            });
            setAddMode(true);
          }
        }}
        disabled={!user}
      >
        + Ajouter un stick
      </button>
      {draftLocation && (
        <div className="location-confirmation">
          <p>📍 Emplacement sélectionné</p>

          <button onClick={replaceDraftLocation}>↩️ Replacer</button>

          <button onClick={confirmDraftLocation}>✅ Valider la position</button>
        </div>
      )}
      {showProfile && profile && (
        <ProfilePanel
          profile={profile}
          sticks={userSticks}
          ranking={ranking}
          friendships={friendships}

          onClose={() => setShowProfile(false)}

          onOpenFriends={() => {
            setShowProfile(false);
            setShowFriends(true);
          }}

          onSelectStick={(stick) => {
            setShowProfile(false);
            setSelectedStick(stick);

            loadStickAuthor(stick.user_id);
            loadStickHistory(stick.id);
          }}

          onUsernameUpdated={(username) => {
            setProfile((current) =>
              current
                ? {
                    ...current,
                    username,
                  }
                : current,
            );
          }}
        />
      )}
      {showFriends && user && (
        <FriendsPanel
          user={user}
          friendships={friendships}
          friendProfiles={friendProfiles}
          requesterProfiles={requesterProfiles}
          pendingFriendRequests={pendingFriendRequests}
          onSearch={handleFriendSearch}
          onAccept={acceptFriend}
          onReject={rejectFriend}
          onOpenProfile={openPublicProfile}
          onClose={() => setShowFriends(false)}
        />
      )}
      {publicProfile && (
        <PublicProfilePanel
          profile={publicProfile}
          friendship={publicProfileFriendship}
          currentUser={user}
          onSendFriendRequest={handleSendFriendRequest}
          onClose={closePublicProfile}
        />
      )}
      {showRanking && (
        <Ranking
          ranking={displayedRanking}
          mode={rankingMode}
          onModeChange={setRankingMode}
          onClose={() => setShowRanking(false)}
        />
      )}
      {draftStick && (
        <StickForm
          description={description}
          photo={photo}
          originType={originType}
          isSaving={isSavingStick}
          onDescriptionChange={setDescription}
          onPhotoChange={setPhoto}
          onOriginTypeChange={setOriginType}
          onSubmit={handleSaveStick}
          onCancel={cancelStick}
        />
      )}
      {selectedStick && (
        <StickDetails
          stick={selectedStick}
          selectedAuthor={selectedAuthor}
          lastActivityAuthor={lastActivityAuthor}
          confirmations={confirmations}
          reports={reports}
          isAdmin={isAdmin}
          isConfirming={isConfirmingStick}
          isReporting={isReportingStick}
          onConfirm={() => confirmStick(selectedStick.id)}
          onReportMissing={() => reportMissingStick(selectedStick.id)}
          onDelete={handleDeleteSelectedStick}
          onOpenProfile={openPublicProfile}
          onClose={() => setSelectedStick(null)}
          getPhotoUrl={getStickPhotoUrl}
        />
      )}
      {showValidation && user && (
        <ValidationPanel
          sticks={pendingSticks}
          currentIndex={validationIndex}
          onIndexChange={setValidationIndex}
          onVote={handleValidationVote}
          onClose={() => setShowValidation(false)}
          getPhotoUrl={getStickPhotoUrl}
        />
      )}
      {showAdminModeration && isAdmin && (
        <AdminModerationPanel
          sticks={reviewSticks}
          currentIndex={adminModerationIndex}
          onIndexChange={setAdminModerationIndex}
          onApprove={handleAdminApproveStick}
          onReject={handleAdminRejectStick}
          onClose={() => setShowAdminModeration(false)}
          getPhotoUrl={getStickPhotoUrl}
        />
      )}
      {user && (
        <div className="bottom-actions">
          <button onClick={() => setShowRanking(true)}>Classement</button>
          <button onClick={() => setShowValidation(true)}>Valider</button>
          {isAdmin && (
            <button onClick={() => setShowAdminModeration(true)}>
              Modération
            </button>
          )}
        </div>
      )}
      {toastMessage && (
        <Toast message={toastMessage} onClose={() => setToastMessage(null)} />
      )}
      <Analytics />
      <SpeedInsights />
    </>
  );
}

export default App;
