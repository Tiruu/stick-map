import type {
  Profile,
  Friendship,
} from "../types";

type FriendsPanelProps = {
  friends: Profile[];
  pendingRequests: Friendship[];

  requesterProfiles: Record<string, Profile>;

  onClose: () => void;
  onSelectUser: (userId: string) => void;

  onAcceptFriend: (friendshipId: string) => void;
  onRejectFriend: (friendshipId: string) => void;

  onSearch: (
    email: string
  ) => Promise<void>;
};

export default function FriendsPanel({
  friends,
  pendingRequests,
  requesterProfiles,
  onClose,
  onSelectUser,
  onAcceptFriend,
  onRejectFriend,
  onSearch,
}: FriendsPanelProps) {
  return (
    <div className="friends-overlay">
      <div className="friends-panel">
        <button
          className="close-friends"
          onClick={onClose}
          aria-label="Fermer"
        >
          ✕
        </button>

        <h2>👥 Mes amis</h2>

        <FriendSearch
          onSearch={onSearch}
        />

        {pendingRequests.length > 0 && (
          <section className="friends-section">
            <h3>Demandes reçues</h3>

            <div className="friend-request-list">
              {pendingRequests.map((request) => {
                const requester =
                  requesterProfiles[
                    request.requester_id
                  ];

                return (
                  <div
                    key={request.id}
                    className="friend-request"
                  >
                    <button
                      className="friend-name"
                      onClick={() =>
                        onSelectUser(
                          request.requester_id
                        )
                      }
                    >
                      {requester?.username ??
                        "Utilisateur"}
                    </button>

                    <div className="friend-request-actions">
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
                );
              })}
            </div>
          </section>
        )}

        <section className="friends-section">
          <h3>
            Amis ({friends.length})
          </h3>

          {friends.length === 0 ? (
            <p className="friends-empty">
              Tu n'as pas encore d'amis.
            </p>
          ) : (
            <div className="friends-list">
              {friends.map((friend) => (
                <button
                  key={friend.id}
                  className="friend-list-entry"
                  onClick={() =>
                    onSelectUser(friend.id)
                  }
                >
                  👤 {friend.username}
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

type FriendSearchProps = {
  onSearch: (
    email: string
  ) => Promise<void>;
};

function FriendSearch({
  onSearch,
}: FriendSearchProps) {
  return (
    <section className="friends-section">
      <h3>Ajouter un ami</h3>

      <form
        className="friend-search"
        onSubmit={async (event) => {
          event.preventDefault();

          const form =
            event.currentTarget;

          const input =
            form.elements.namedItem(
              "email"
            ) as HTMLInputElement;

          const email =
            input.value.trim();

          if (!email) return;

          await onSearch(email);

          input.value = "";
        }}
      >
        <input
          name="email"
          type="email"
          placeholder="Adresse email"
          autoComplete="off"
        />

        <button type="submit">
          Rechercher
        </button>
      </form>
    </section>
  );
}