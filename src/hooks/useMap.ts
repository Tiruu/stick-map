import { useEffect, useRef } from "react";

import {
  Map,
  GeolocateControl,
  type GeoJSONSource,
} from "maplibre-gl";

import MaplibreGeocoder, {
  type MaplibreGeocoderApi,
  type MaplibreGeocoderApiConfig,
  type MaplibreGeocoderFeatureResults,
} from "@maplibre/maplibre-gl-geocoder";

import { sticksToGeoJSON } from "../utils/sticksGeoJSON";
import { MAP_COLORS } from "../utils/mapColors";

type UseMapOptions = {
  mapContainer: React.RefObject<HTMLDivElement | null>;
  sticks: Parameters<typeof sticksToGeoJSON>[0];
  stickStatuses: Parameters<typeof sticksToGeoJSON>[1];
};

export function useMap({
  mapContainer,
  sticks,
  stickStatuses,
}: UseMapOptions) {
  const mapRef = useRef<Map | null>(null);

  useEffect(() => {
    if (!mapContainer.current) {
      return;
    }

    const map = new Map({
      container: mapContainer.current,
      style:
        "https://tiles.openfreemap.org/styles/liberty",
      center: [3.57, 47.8],
      zoom: 12,
      dragRotate: false,
    });

    mapRef.current = map;

    const geocoderApi: MaplibreGeocoderApi = {
      forwardGeocode: async (
        config: MaplibreGeocoderApiConfig
      ): Promise<MaplibreGeocoderFeatureResults> => {
        const features: MaplibreGeocoderFeatureResults["features"] =
          [];

        if (typeof config.query !== "string") {
          return {
            type: "FeatureCollection",
            features,
          };
        }

        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/search?` +
              new URLSearchParams({
                q: config.query,
                format: "geojson",
                addressdetails: "1",
                limit: "5",
              })
          );

          const geojson = await response.json();
          const seen = new Set<string>();

          for (const feature of geojson.features) {
            const displayName =
              feature.properties.display_name;

            if (seen.has(displayName)) {
              continue;
            }

            seen.add(displayName);

            features.push({
              type: "Feature",
              geometry: feature.geometry,
              place_name: displayName,
              properties: feature.properties,
              text: displayName,
              place_type: ["place"],
              center: feature.geometry.coordinates,
            });
          }
        } catch (error) {
          console.error(
            "Erreur recherche adresse :",
            error
          );
        }

        return {
          type: "FeatureCollection",
          features,
        };
      },
    };

    map.on("load", () => {
      map.addSource("sticks", {
        type: "geojson",
        data: sticksToGeoJSON([], {}),
        cluster: true,
        clusterMaxZoom: 14,
        clusterRadius: 50,
      });

      map.addControl(
        new GeolocateControl({
          positionOptions: {
            enableHighAccuracy: true,
          },
          trackUserLocation: true,
          showUserLocation: true,
          showAccuracyCircle: true,
        }),
        "top-right"
      );

      const geocoder = new MaplibreGeocoder(
        geocoderApi,
        {
          maplibregl: {
            Map,
          },

          placeholder:
            "Rechercher une ville ou une adresse",

          showResultsWhileTyping: true,
          marker: false,

          flyTo: {
            duration: 2000,
            zoom: 14,
          },
        }
      );

      map.addControl(geocoder, "top-left");

      map.addLayer({
        id: "stick-clusters",
        type: "circle",
        source: "sticks",

        filter: ["has", "point_count"],

        paint: {
          "circle-color": MAP_COLORS.cluster,

          "circle-radius": [
            "step",
            ["get", "point_count"],
            18,
            10,
            23,
            50,
            30,
          ],

          "circle-stroke-width": 3,
          "circle-stroke-color": MAP_COLORS.white,
          "circle-opacity": 0.95,
        },
      });

      map.addLayer({
        id: "stick-cluster-count",
        type: "symbol",
        source: "sticks",

        filter: ["has", "point_count"],

        layout: {
          "text-field":
            "{point_count_abbreviated}",
          "text-size": 13,
        },

        paint: {
          "text-color": MAP_COLORS.white,
        },
      });

      map.addLayer({
        id: "stick-points",
        type: "circle",
        source: "sticks",

        filter: ["!", ["has", "point_count"]],

        paint: {
          "circle-color": [
            "case",

            [
              "==",
              ["get", "moderation_status"],
              "pending",
            ],
            MAP_COLORS.pending,

            [
              "==",
              ["get", "moderation_status"],
              "review",
            ],
            MAP_COLORS.review,

            [
              "all",
              [
                "==",
                ["get", "moderation_status"],
                "approved",
              ],
              [
                "==",
                ["get", "status"],
                "present",
              ],
            ],
            MAP_COLORS.present,

            [
              "all",
              [
                "==",
                ["get", "moderation_status"],
                "approved",
              ],
              [
                "==",
                ["get", "status"],
                "missing",
              ],
            ],
            MAP_COLORS.missing,

            MAP_COLORS.unknown,
          ],

          "circle-radius": 10,
          "circle-stroke-width": 3,
          "circle-stroke-color": MAP_COLORS.white,
        },
      });
    });

    map.touchZoomRotate.disableRotation();

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [mapContainer]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map) {
      return;
    }

    const updateSource = () => {
      const source = map.getSource("sticks") as
        | GeoJSONSource
        | undefined;

      if (!source) {
        return;
      }

      source.setData(
        sticksToGeoJSON(
          sticks,
          stickStatuses
        )
      );
    };

    if (map.isStyleLoaded()) {
      updateSource();
    } else {
      map.once("load", updateSource);
    }
  }, [sticks, stickStatuses]);

  return {
    mapRef,
  };
}