import { useState } from "react";

import type {
  Profile,
  Stick,
  RankingEntry,
  Friendship,
} from "../types";

import { updateUsername } from "../services/profiles";

type ProfilePanelProps = {
  profile: Profile;
  sticks: Stick[];
  ranking: RankingEntry[];

  friendships: Friendship[];

  onClose: () => void;
  onSelectStick: (stick: Stick) => void;
  onUsernameUpdated: (username: string) => void;

  onAcceptFriend: (
    friendshipId: string
  ) => void;

  onRejectFriend: (
    friendshipId: string
  ) => void;
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
}: ProfilePanelProps) {
  const rankIndex = ranking.findIndex(
    (entry) => entry.user_id === profile.id
  );

  const rank =
    rankIndex >= 0
      ? rankIndex + 1
      : null;

    const [editingUsername, setEditingUsername] = useState(false);
    const [username, setUsername] = useState(profile.username);
    const [savingUsername, setSavingUsername] = useState(false);
    const [usernameError, setUsernameError] = useState("");

    const incomingRequests =
      friendships.filter(
        (friendship) =>
          friendship.addressee_id === profile.id &&
          friendship.status === "pending"
      );

  return (
    <div className="profile-overlay">
      <div className="profile-panel">
        <button
          className="close-profile"
          onClick={onClose}
        >
          ✕
        </button>
        {incomingRequests.length > 0 && (
          <>
            <h3>Demandes d'amis</h3>

            <div className="friend-request-list">
              {incomingRequests.map((request) => (
                <div
                  key={request.id}
                  className="friend-request"
                >
                  <span>
                    Nouvelle demande
                  </span>

                  <div>
                    <button
                      onClick={() =>
                        onAcceptFriend(request.id)
                      }
                    >
                      ✅
                    </button>

                    <button
                      onClick={() =>
                        onRejectFriend(request.id)
                      }
                    >
                      ❌
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {!editingUsername ? (
            <div className="profile-username">
                <h2>👤 {profile.username}</h2>

                <button
                onClick={() => setEditingUsername(true)}
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
                onChange={(event) =>
                    setUsername(event.target.value)
                }
                />

                <div className="username-editor-actions">
                <button
                    onClick={() => {
                    setUsername(profile.username);
                    setUsernameError("");
                    setEditingUsername(false);
                    }}
                >
                    Annuler
                </button>

                <button
                    disabled={savingUsername}
                    onClick={async () => {
                    try {
                        setSavingUsername(true);
                        setUsernameError("");

                        await updateUsername(username);

                        onUsernameUpdated(username.trim());

                        setEditingUsername(false);
                    } catch (error) {
                        console.error(error);
                        setUsernameError(
                        "Impossible de modifier le pseudo."
                        );
                    } finally {
                        setSavingUsername(false);
                    }
                    }}
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

        <h3>Mes contributions</h3>

        <div className="profile-stick-list">
          {sticks.length === 0 && (
            <p>
              Aucun stick ajouté pour le moment.
            </p>
          )}

          {sticks.map((stick) => (
            <button
              key={stick.id}
              className="profile-stick-entry"
              onClick={() => onSelectStick(stick)}
            >
              <span>
                📍 {stick.description || "Stick"}
              </span>

              <small>
                {new Date(
                  stick.created_at
                ).toLocaleDateString("fr-FR")}
              </small>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

