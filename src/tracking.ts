import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";

export const TASK = "momentum-location";
const CRM = "https://crm.momentumlandscapingut.com";

/**
 * Where the crew phone is, reported in the background.
 *
 * The session comes from the web sign-in rather than a second native login —
 * see App.tsx. This module only needs the token, not a way to obtain one.
 */
let token: string | null = null;
export function setToken(t: string | null) { token = t; }
export function hasToken() { return Boolean(token); }

TaskManager.defineTask(TASK, async ({ data, error }: any) => {
  if (error || !data?.locations?.length || !token) return;
  try {
    await fetch(`${CRM}/api/crm/ping`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        pings: data.locations.map((l: any) => ({
          lat: l.coords.latitude,
          lng: l.coords.longitude,
          accuracy_m: l.coords.accuracy,
          speed_mps: l.coords.speed,
          recorded_at: new Date(l.timestamp).toISOString(),
        })),
      }),
    });
  } catch {
    // A dropped ping is not worth a retry queue: the next one is 30 seconds
    // away and the geofence only needs a run of them, not every single one.
  }
});

export async function startTracking() {
  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== "granted") return false;
  const bg = await Location.requestBackgroundPermissionsAsync();
  if (bg.status !== "granted") return false;
  if (await Location.hasStartedLocationUpdatesAsync(TASK)) return true;

  await Location.startLocationUpdatesAsync(TASK, {
    accuracy: Location.Accuracy.Balanced,
    timeInterval: 30_000,
    distanceInterval: 25,
    // "Other", never AutomotiveNavigation: that setting makes iOS treat this as
    // turn-by-turn and hand the Dynamic Island over to a navigation banner.
    activityType: Location.ActivityType.Other,
    showsBackgroundLocationIndicator: false,
    pausesUpdatesAutomatically: false,
    foregroundService: {
      notificationTitle: "Momentum",
      notificationBody: "Confirming which properties you service.",
    },
  });
  return true;
}

export async function stopTracking() {
  if (await Location.hasStartedLocationUpdatesAsync(TASK)) {
    await Location.stopLocationUpdatesAsync(TASK);
  }
}
