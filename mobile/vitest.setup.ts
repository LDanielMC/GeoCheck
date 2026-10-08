// Simula los módulos nativos para poder probar la lógica del spike (sesiones, marcadores, tareas) en Node.
// Los módulos del propio proyecto (spikeStorage, geofenceLab, labNotifications…) corren tal cual.
import { vi } from "vitest";

// labNotifications solo toca notificaciones en el build del spike.
process.env.EXPO_PUBLIC_SPIKE = "1";

vi.mock("react-native", () => ({
  AppState: { currentState: "background", addEventListener: () => ({ remove: () => undefined }) },
  Linking: { openSettings: vi.fn(async () => undefined) },
  Platform: { OS: "android", constants: {} },
}));

vi.mock("expo-battery", () => ({
  BatteryState: { UNKNOWN: 0, UNPLUGGED: 1, CHARGING: 2, FULL: 3 },
  getBatteryLevelAsync: vi.fn(async () => 0.8),
  getBatteryStateAsync: vi.fn(async () => 1),
  isBatteryOptimizationEnabledAsync: vi.fn(async () => true),
  isLowPowerModeEnabledAsync: vi.fn(async () => false),
}));

vi.mock("expo-file-system", async () => await import("./src/spike/testing/memoryFs"));

vi.mock("expo-constants", () => ({ default: { expoConfig: { android: { package: "com.cliche.geocheck" } } } }));

vi.mock("expo-intent-launcher", () => ({
  ActivityAction: {
    REQUEST_IGNORE_BATTERY_OPTIMIZATIONS: "android.settings.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS",
    IGNORE_BATTERY_OPTIMIZATION_SETTINGS: "android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS",
    APP_NOTIFICATION_SETTINGS: "android.settings.APP_NOTIFICATION_SETTINGS",
  },
  startActivityAsync: vi.fn(async () => ({ resultCode: 0 })),
}));

vi.mock("expo-keep-awake", () => ({ activateKeepAwakeAsync: vi.fn(async () => undefined), deactivateKeepAwake: vi.fn(async () => undefined) }));

vi.mock("expo-location", () => ({
  Accuracy: { Balanced: 3, High: 4, BestForNavigation: 6 },
  GeofencingEventType: { Enter: 1, Exit: 2 },
  GeofencingRegionState: { 1: "Inside", 2: "Outside", Inside: 1, Outside: 2 },
  getForegroundPermissionsAsync: vi.fn(async () => ({ status: "granted", granted: true, android: { accuracy: "fine" } })),
  getBackgroundPermissionsAsync: vi.fn(async () => ({ status: "granted", granted: true })),
  requestForegroundPermissionsAsync: vi.fn(async () => ({ status: "granted", granted: true })),
  requestBackgroundPermissionsAsync: vi.fn(async () => ({ status: "granted", granted: true })),
  hasServicesEnabledAsync: vi.fn(async () => true),
  getProviderStatusAsync: vi.fn(async () => ({ gpsAvailable: true, networkAvailable: true, passiveAvailable: true })),
  hasStartedGeofencingAsync: vi.fn(async () => false),
  startGeofencingAsync: vi.fn(async () => undefined),
  stopGeofencingAsync: vi.fn(async () => undefined),
  getLastKnownPositionAsync: vi.fn(async () => ({ coords: { accuracy: 12 }, timestamp: Date.now() - 2000 })),
  getCurrentPositionAsync: vi.fn(async () => ({ coords: { latitude: 19.4284, longitude: -99.1677, accuracy: 8 }, timestamp: Date.now() })),
  watchPositionAsync: vi.fn(async () => ({ remove: () => undefined })),
  geocodeAsync: vi.fn(async () => []),
  reverseGeocodeAsync: vi.fn(async () => []),
}));

vi.mock("expo-task-manager", () => ({ defineTask: vi.fn(), isTaskDefined: vi.fn(() => true) }));

vi.mock("expo-notifications", () => ({
  AndroidImportance: { LOW: 4, DEFAULT: 5, HIGH: 6 },
  AndroidNotificationVisibility: { PUBLIC: 1 },
  setNotificationChannelAsync: vi.fn(async () => null),
  setNotificationCategoryAsync: vi.fn(async () => ({})),
  scheduleNotificationAsync: vi.fn(async () => "id"),
  dismissNotificationAsync: vi.fn(async () => undefined),
  getPermissionsAsync: vi.fn(async () => ({ granted: true, status: "granted" })),
  requestPermissionsAsync: vi.fn(async () => ({ granted: true, status: "granted" })),
  getPresentedNotificationsAsync: vi.fn(async () => []),
  setNotificationHandler: vi.fn(),
  registerTaskAsync: vi.fn(async () => null),
  addNotificationResponseReceivedListener: vi.fn(() => ({ remove: () => undefined })),
}));
