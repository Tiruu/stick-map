import type { Profile } from "../types";

type UserPanelProps = {
  profile: Profile | null;
  onLogout: () => void;
};

export default function UserPanel({
  profile,
  onLogout,
}: UserPanelProps) {
  return (
    <div className="user-panel">
      <span>
        👤 {profile?.username ?? "Chargement..."}
      </span>

      <button onClick={onLogout}>
        Déconnexion
      </button>
    </div>
  );
}