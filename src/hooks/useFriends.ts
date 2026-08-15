import { useCallback, useEffect, useState } from "react";

import type { Friendship, Profile } from "../types";

import { getProfile } from "../services/profiles";

import { getMyFriendships, updateFriendshipStatus } from "../services/friends";

export function useFriends(
  user: {
    id: string;
  } | null,
) {
  const [friendships, setFriendships] = useState<Friendship[]>([]);

  const [friendProfiles, setFriendProfiles] = useState<Profile[]>([]);

  const [requesterProfiles, setRequesterProfiles] = useState<
    Record<string, Profile>
  >({});

  const loadFriends = useCallback(async () => {
    if (!user) {
      setFriendships([]);
      setFriendProfiles([]);
      setRequesterProfiles({});
      return;
    }

    try {
      const data = await getMyFriendships(user.id);

      setFriendships(data);

      const accepted = data.filter(
        (friendship) => friendship.status === "accepted",
      );

      const profiles = await Promise.all(
        accepted.map(async (friendship) => {
          const friendId =
            friendship.requester_id === user.id
              ? friendship.addressee_id
              : friendship.requester_id;

          return getProfile(friendId);
        }),
      );

      setFriendProfiles(profiles);

      const pendingRequests = data.filter(
        (friendship) =>
          friendship.status === "pending" &&
          friendship.addressee_id === user.id,
      );

      const requesterEntries = await Promise.all(
        pendingRequests.map(async (request) => {
          const requester = await getProfile(request.requester_id);

          return [request.requester_id, requester] as const;
        }),
      );

      setRequesterProfiles(Object.fromEntries(requesterEntries));
    } catch (error) {
      console.error("Erreur chargement amis :", error);
    }
  }, [user]);

  const acceptFriend = useCallback(
    async (friendshipId: string) => {
      await updateFriendshipStatus(friendshipId, "accepted");

      await loadFriends();
    },
    [loadFriends],
  );

  const rejectFriend = useCallback(
    async (friendshipId: string) => {
      await updateFriendshipStatus(friendshipId, "rejected");

      await loadFriends();
    },
    [loadFriends],
  );

  useEffect(() => {
    loadFriends();
  }, [loadFriends]);

  const pendingFriendRequests = friendships.filter(
    (friendship) =>
      friendship.status === "pending" && friendship.addressee_id === user?.id,
  );

  return {
    friendships,
    friendProfiles,
    requesterProfiles,
    pendingFriendRequests,
    loadFriends,
    acceptFriend,
    rejectFriend,
  };
}
