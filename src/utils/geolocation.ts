export type UserLocation = {
  latitude: number;
  longitude: number;
  accuracy: number;
};

export function getCurrentLocation(): Promise<UserLocation> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(
        new Error("La géolocalisation n'est pas disponible sur cet appareil."),
      );
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
      },
      (error) => {
        reject(error);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      },
    );
  });
}

export function watchUserLocation(
  onLocationUpdate: (location: UserLocation) => void,
) {
  const watchId = navigator.geolocation.watchPosition((position) => {
    const currentLat = position.coords.latitude;
    const currentLong = position.coords.longitude;
    const currentAccuracy = position.coords.accuracy;

    onLocationUpdate({
      latitude: currentLat,
      longitude: currentLong,
      accuracy: currentAccuracy,
    });
  });

  return watchId;
}

/* 
function degreesToRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
} */

/* function calculateDistance(
  latitude1: number,
  longitude1: number,
  latitude2: number,
  longitude2: number,

): number {
  const deltaLatitude = latitude2 - latitude1;
  const deltaLongitude = longitude2 - longitude1;

  const deltaLatitudeRadians = degreesToRadians(deltaLatitude);
  const deltaLongitudeRadians = degreesToRadians(deltaLongitude);

  const a =
    Math.sin(deltaLatitudeRadians / 2) ** 2 +
    Math.cos(degreesToRadians(latitude1)) *
      Math.cos(degreesToRadians(latitude2)) *
      Math.sin(deltaLongitudeRadians / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  const earthRadius = 6371000;
  const distance = earthRadius * c;

  return distance;
} */