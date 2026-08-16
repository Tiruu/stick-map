import { useEffect, useRef } from "react";

import {
  Map,
  Marker,
  GeolocateControl,
  type GeoJSONSource,
  type MapMouseEvent,
} from "maplibre-gl";

import MaplibreGeocoder, {
  type MaplibreGeocoderApi,
  type MaplibreGeocoderApiConfig,
  type MaplibreGeocoderFeatureResults,
} from "@maplibre/maplibre-gl-geocoder";

import type { Stick, StickStatus } from "../types";

import { sticksToGeoJSON } from "../utils/sticksGeoJSON";
import { MAP_COLORS } from "../utils/mapColors";

type UseMapOptions = {
  mapContainer: React.RefObject<HTMLDivElement | null>;
  sticks: Stick[];
  stickStatuses: Record<string, StickStatus>;
  addMode: boolean;
  onStickClick: (stick: Stick) => void;
  onAddLocation: (longitude: number, latitude: number) => void;
};

export function useMap({
  mapContainer,
  sticks,
  stickStatuses,
  addMode,
  onStickClick,
  onAddLocation,
}: UseMapOptions) {
  const mapRef = useRef<Map | null>(null);
  const sticksRef = useRef<Stick[]>(sticks);
  const addModeRef = useRef(addMode);
  const onStickClickRef = useRef(onStickClick);
  const markerRef = useRef<Marker | null>(null);
  const clearAddMarker = () => {
    markerRef.current?.remove();
    markerRef.current = null;
  };
  const onAddLocationRef = useRef(onAddLocation);

  useEffect(() => {
    sticksRef.current = sticks;
  }, [sticks]);

  useEffect(() => {
    addModeRef.current = addMode;
  }, [addMode]);

  useEffect(() => {
    onStickClickRef.current = onStickClick;
  }, [onStickClick]);

  useEffect(() => {
    onAddLocationRef.current = onAddLocation;
  }, [onAddLocation]);

  useEffect(() => {
    if (!mapContainer.current) {
      return;
    }

    const map = new Map({
      container: mapContainer.current,
      style: "https://tiles.openfreemap.org/styles/positron",
      center: [3.57, 47.8],
      zoom: 12,
      dragRotate: false,
    });

    mapRef.current = map;

    const geocoderApi: MaplibreGeocoderApi = {
      forwardGeocode: async (
        config: MaplibreGeocoderApiConfig,
      ): Promise<MaplibreGeocoderFeatureResults> => {
        const features: MaplibreGeocoderFeatureResults["features"] = [];

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
              }),
          );

          const geojson = await response.json();
          const seen = new Set<string>();

          for (const feature of geojson.features) {
            const displayName = feature.properties.display_name;

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
          console.error("Erreur recherche adresse :", error);
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
        "top-right",
      );

      const geocoder = new MaplibreGeocoder(geocoderApi, {
        maplibregl: {
          Map,
        },

        placeholder: "Rechercher une ville ou une adresse",

        showResultsWhileTyping: true,
        marker: false,

        flyTo: {
          duration: 2000,
          zoom: 14,
        },
      });

      map.addControl(geocoder, "top-left");

      map.addLayer({
        id: "stick-clusters",
        type: "circle",
        source: "sticks",

        filter: ["has", "point_count"],

        paint: {
          "circle-color": MAP_COLORS.cluster,

          "circle-radius": ["step", ["get", "point_count"], 18, 10, 23, 50, 30],

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
          "text-field": "{point_count_abbreviated}",
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

            ["==", ["get", "moderation_status"], "pending"],
            MAP_COLORS.pending,

            ["==", ["get", "moderation_status"], "review"],
            MAP_COLORS.review,

            [
              "all",
              ["==", ["get", "moderation_status"], "approved"],
              ["==", ["get", "status"], "present"],
            ],
            MAP_COLORS.present,

            [
              "all",
              ["==", ["get", "moderation_status"], "approved"],
              ["==", ["get", "status"], "missing"],
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

    map.on("click", "stick-points", (event) => {
      if (addModeRef.current) {
        return;
      }

      const feature = event.features?.[0];

      if (!feature) {
        return;
      }

      const stickId = feature.properties?.id;

      if (!stickId) {
        return;
      }

      const stick = sticksRef.current.find((item) => item.id === stickId);

      if (!stick) {
        return;
      }

      onStickClickRef.current(stick);

      const isMobile = window.innerWidth <= 700;

      map.easeTo({
        center: [stick.longitude, stick.latitude],

        zoom: Math.max(map.getZoom(), 18),

        offset: isMobile ? [0, -140] : [-180, 0],

        duration: 2000,
      });
    });
    map.on("click", "stick-clusters", async (event) => {
      if (addModeRef.current) {
        return;
      }

      const features = map.queryRenderedFeatures(event.point, {
        layers: ["stick-clusters"],
      });

      const feature = features[0];

      if (!feature) {
        return;
      }

      const clusterId = feature.properties?.cluster_id;

      if (clusterId === undefined) {
        return;
      }

      const source = map.getSource("sticks") as GeoJSONSource;

      const zoom = await source.getClusterExpansionZoom(clusterId);

      if (feature.geometry.type !== "Point") {
        return;
      }

      map.easeTo({
        center: feature.geometry.coordinates as [number, number],

        zoom,
        duration: 350,
      });
    });
    map.on("mouseenter", "stick-points", () => {
      map.getCanvas().style.cursor = "pointer";
    });

    map.on("mouseleave", "stick-points", () => {
      map.getCanvas().style.cursor = "";
    });

    map.on("mouseenter", "stick-clusters", () => {
      map.getCanvas().style.cursor = "pointer";
    });

    map.on("mouseleave", "stick-clusters", () => {
      map.getCanvas().style.cursor = "";
    });

    map.touchZoomRotate.disableRotation();

    return () => {
      clearAddMarker();

      map.remove();
      mapRef.current = null;
    };
  }, [mapContainer]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map) {
      return;
    }

    if (!addMode) {
      map.dragPan.enable();
      map.getCanvas().style.cursor = "";
      return;
    }

    map.getCanvas().style.cursor = "crosshair";

    const handleClick = (event: MapMouseEvent) => {
      const { lng, lat } = event.lngLat;

      if (markerRef.current) {
        markerRef.current.setLngLat([lng, lat]);
      } else {
        markerRef.current = new Marker().setLngLat([lng, lat]).addTo(map);
      }

      onAddLocationRef.current(lng, lat);
    };

    map.on("click", handleClick);

    return () => {
      map.off("click", handleClick);
    };
  }, [addMode]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map) {
      return;
    }

    const updateSource = () => {
      const source = map.getSource("sticks") as GeoJSONSource | undefined;

      if (!source) {
        return;
      }

      source.setData(sticksToGeoJSON(sticks, stickStatuses));
    };

    if (map.isStyleLoaded()) {
      updateSource();
    } else {
      map.once("load", updateSource);
    }
  }, [sticks, stickStatuses]);

  return {
    clearAddMarker,
  };
}
