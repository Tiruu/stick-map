import { useEffect, useState } from "react";

import type {
  Profile,
  Stick,
  RankingEntry,
  Friendship,
} from "../types";

import {
  getProfile,
  updateUsername,
} from "../services/profiles";

type ProfilePanelProps = {
  profile: Profile;
  sticks: Stick[];
  ranking: RankingEntry[];
  friendships: Friendship[];

  onClose: () => void;
  onSelectStick: (stick: Stick) => void;
  onUsernameUpdated: (username: string) => void;

  onAcceptFriend: (friendshipId: string) => void;
  onRejectFriend: (friendshipId: string) => void;

  onOpenFriends: () => void;
};

export default function ProfilePanel({
  profile,
  sticks,
  ranking,
  friendships,
  onClose,
  onSelectStick,
  onUsernameUpdated,
  onAcceptFriend,
  onRejectFriend,
  onOpenFriends,
}: ProfilePanelProps) {
  const [editingUsername, setEditingUsername] =
    useState(false);

  const [username, setUsername] = useState(
    profile.username
  );

  const [savingUsername, setSavingUsername] =
    useState(false);

  const [usernameError, setUsernameError] =
    useState("");

  const [requesterProfiles, setRequesterProfiles] =
    useState<Record<string, Profile>>({});

  const incomingRequests = friendships.filter(
    (friendship) =>
      friendship.addressee_id === profile.id &&
      friendship.status === "pending"
  );

  const rankIndex = ranking.findIndex(
    (entry) => entry.user_id === profile.id
  );

  const rank =
    rankIndex >= 0
      ? rankIndex + 1
      : null;

  useEffect(() => {
    let cancelled = false;

    async function loadRequesterProfiles() {
      if (incomingRequests.length === 0) {
        setRequesterProfiles({});
        return;
      }

      try {
        const entries = await Promise.all(
          incomingRequests.map(async (request) => {
            const requester = await getProfile(
              request.requester_id
            );

            return [
              request.requester_id,
              requester,
            ] as const;
          })
        );

        if (!cancelled) {
          setRequesterProfiles(
            Object.fromEntries(entries)
          );
        }
      } catch (error) {
        console.error(
          "Erreur chargement demandes d'amis :",
          error
        );
      }
    }

    loadRequesterProfiles();

    return () => {
      cancelled = true;
    };
  }, [friendships, profile.id]);

  async function saveUsername() {
    const trimmedUsername = username.trim();

    if (trimmedUsername.length < 3) {
      setUsernameError(
        "Le pseudo doit contenir au moins 3 caractères."
      );
      return;
    }

    if (trimmedUsername.length > 24) {
      setUsernameError(
        "Le pseudo ne peut pas dépasser 24 caractères."
      );
      return;
    }

    try {
      setSavingUsername(true);
      setUsernameError("");

      await updateUsername(trimmedUsername);

      setUsername(trimmedUsername);
      setEditingUsername(false);

      onUsernameUpdated(trimmedUsername);
    } catch (error) {
      console.error(
        "Erreur modification pseudo :",
        error
      );

      setUsernameError(
        "Impossible de modifier le pseudo."
      );
    } finally {
      setSavingUsername(false);
    }
  }

  function cancelUsernameEdit() {
    setUsername(profile.username);
    setUsernameError("");
    setEditingUsername(false);
  }

  return (
    <div className="profile-overlay">
      <div className="profile-panel">
        <button
          className="close-profile"
          onClick={onClose}
          aria-label="Fermer le profil"
        >
          ✕
        </button>

        {/* -------------------- */}
        {/* DEMANDES D'AMIS      */}
        {/* -------------------- */}

        {incomingRequests.length > 0 && (
          <section className="profile-section">
            <h3>Demandes d'amis</h3>

            <div className="friend-request-list">
              {incomingRequests.map((request) => {
                const requester =
                  requesterProfiles[
                    request.requester_id
                  ];

                return (
                  <div
                    key={request.id}
                    className="friend-request"
                  >
                    <span>
                      <strong>
                        {requester?.username ??
                          "Utilisateur"}
                      </strong>{" "}
                      souhaite vous ajouter en ami.
                    </span>

                    <div className="friend-request-actions">
                      <button
                        onClick={() =>
                          onAcceptFriend(
                            request.id
                          )
                        }
                        aria-label="Accepter la demande"
                      >
                        ✅
                      </button>

                      <button
                        onClick={() =>
                          onRejectFriend(
                            request.id
                          )
                        }
                        aria-label="Refuser la demande"
                      >
                        ❌
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* -------------------- */}
        {/* NOM D'UTILISATEUR    */}
        {/* -------------------- */}

        {!editingUsername ? (
          <div className="profile-username">
            <h2>👤 {profile.username}</h2>

            <button
              onClick={() =>
                setEditingUsername(true)
              }
            >
              Modifier
            </button>
          </div>
        ) : (
          <div className="username-editor">
            <input
              type="text"
              value={username}
              maxLength={24}
              autoFocus
              onChange={(event) =>
                setUsername(event.target.value)
              }
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  saveUsername();
                }

                if (event.key === "Escape") {
                  cancelUsernameEdit();
                }
              }}
            />

            <div className="username-editor-actions">
              <button
                onClick={cancelUsernameEdit}
                disabled={savingUsername}
              >
                Annuler
              </button>

              <button
                onClick={saveUsername}
                disabled={savingUsername}
              >
                {savingUsername
                  ? "Enregistrement..."
                  : "Enregistrer"}
              </button>
            </div>

            {usernameError && (
              <p className="username-error">
                {usernameError}
              </p>
            )}
          </div>
        )}

        {/* -------------------- */}
        {/* STATISTIQUES         */}
        {/* -------------------- */}

        <div className="profile-stats">
          <div>
            <strong>{sticks.length}</strong>
            <span>sticks ajoutés</span>
          </div>

          <div>
            <strong>
              {rank ? `#${rank}` : "—"}
            </strong>
            <span>classement</span>
          </div>
        </div>

        <button
          className="friends-button"
          onClick={onOpenFriends}
        >
          👥 Mes amis
        </button>

        {/* -------------------- */}
        {/* CONTRIBUTIONS        */}
        {/* -------------------- */}

        <h3>Mes contributions</h3>

        <div className="profile-stick-list">
          {sticks.length === 0 ? (
            <p>
              Aucun stick ajouté pour le moment.
            </p>
          ) : (
            sticks.map((stick) => (
              <button
                key={stick.id}
                className="profile-stick-entry"
                onClick={() =>
                  onSelectStick(stick)
                }
              >
                <span>
                  📍{" "}
                  {stick.description ||
                    "Stick"}
                </span>

                <small>
                  {new Date(
                    stick.created_at
                  ).toLocaleDateString(
                    "fr-FR"
                  )}
                </small>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}