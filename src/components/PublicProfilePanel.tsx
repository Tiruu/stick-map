import type { Profile, Friendship } from "../types";

type PublicProfilePanelProps = {
  profile: Profile;
  currentUserId: string;
  friendship: Friendship | null;

  stickCount: number;

  onClose: () => void;
  onSendRequest: () => void;
};

export default function PublicProfilePanel({
  profile,
  currentUserId,
  friendship,
  stickCount,
  onClose,
  onSendRequest,
}: PublicProfilePanelProps) {
  const isOwnProfile = profile.id === currentUserId;

  const isFriend = friendship?.status === "accepted";

  const requestSent =
    friendship?.status === "pending" &&
    friendship.requester_id === currentUserId;

  const requestReceived =
    friendship?.status === "pending" &&
    friendship.addressee_id === currentUserId;

  return (
    <div className="profile-overlay">
      <div className="profile-panel">
        <button className="close-profile" onClick={onClose}>
          ✕
        </button>

        <h2>👤 {profile.username}</h2>

        <div className="profile-stats">
          <div>
            <strong>{stickCount}</strong>
            <span>sticks validés</span>
          </div>
        </div>

        {!isOwnProfile && (
          <div className="friend-action">
            {isFriend && <button disabled>✅ Amis</button>}

            {requestSent && <button disabled>Demande envoyée</button>}

            {requestReceived && <button disabled>Demande reçue</button>}

            {!friendship && (
              <button onClick={onSendRequest}>➕ Ajouter en ami</button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
