export type DraftStick = {
  lng: number;
  lat: number;
};

export type Stick = {
  id: string;
  latitude: number;
  longitude: number;
  description: string;
  photo_path: string | null;
  user_id: string | null;
};

export type Profile = {
  id: string;
  username: string;
  role: "user" | "admin";
};

export type RankingEntry = {
  user_id: string;
  username: string;
  stick_count: number;
};

export type StickConfirmation = {
  id: string;
  stick_id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
};

export type StickReport = {
  id: string;
  stick_id: string;
  user_id: string;
  reason: string;
  created_at: string;
  updated_at: string;
};

export type StickStatus =
  | "present"
  | "missing"
  | "unknown";