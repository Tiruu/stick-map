import type {
  Stick,
  StickStatus,
} from "../types";

export function sticksToGeoJSON(
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