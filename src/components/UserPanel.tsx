import type { Profile } from "../types";

type UserPanelProps = {
  profile: Profile | null;
  onLogout: () => void;
  onOpenProfile: () => void;
};

export default function UserPanel({
  profile,
  onLogout,
  onOpenProfile,
}: UserPanelProps) {
  return (
    <div className="user-panel">
      <span>👤 {profile?.username ?? "Chargement..."}</span>
      <button onClick={onOpenProfile}>Profil</button>

      <button onClick={onLogout}>Déconnexion</button>
    </div>
  );
}
