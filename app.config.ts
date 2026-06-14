import type { ExpoConfig } from "expo/config";

const config: ExpoConfig = {
  name: "RepRight",
  slug: "repright",
  version: "1.0.0",
  orientation: "portrait",
  scheme: "repright",
  userInterfaceStyle: "dark",
  backgroundColor: "#0D0D0D",
  assetBundlePatterns: ["**/*"],
  ios: {
    supportsTablet: false,
    bundleIdentifier: "com.unibe.repright",
    usesAppleSignIn: true,
    infoPlist: {
      NSCameraUsageDescription:
        "RepRight uses the camera to analyze your exercise form in real time and provide technique feedback. Video is processed on your device and is not uploaded to our servers.",
      NSPhotoLibraryUsageDescription:
        "RepRight accesses your photo library only when you choose a profile picture.",
      NSLocationWhenInUseUsageDescription:
        "RepRight does not use your GPS location for workouts or tracking. An included library references location APIs for regional settings; location is not collected or stored.",
    },
    buildNumber: "1",
  },
  android: {
    package: "com.unibe.repright",
    adaptiveIcon: {
      backgroundColor: "#0D0D0D",
    },
  },
  /** Linked EAS project (see https://expo.dev/accounts/emilmr/projects/repright). */
  extra: {
    eas: {
      projectId: "5a281dc2-c068-46fa-b9c5-abf5eaa5498b",
    },
  },
  // Native modules (e.g. expo-screen-orientation, new Expo packages) require a rebuilt binary.
  // After adding/changing them: npm run android:rebuild or npm run ios:rebuild (or prebuild:clean + run:*).
  plugins: [
    "./plugins/withAndroidKeepScreenOn.cjs",
    "expo-dev-client",
    "expo-apple-authentication",
    // expo-font / expo-asset need expo-file-system native filesystem bindings at runtime (e.g. AppDirectories).
    "expo-file-system",
    "expo-asset",
    "expo-localization",
    [
      "expo-image-picker",
      {
        photosPermission:
          "RepRight accesses your photo library only when you choose a profile picture.",
      },
    ],
    [
      "react-native-vision-camera",
      {
        cameraPermissionText:
          "RepRight uses the camera to analyze your exercise form in real time and provide technique feedback. Video is processed on your device and is not uploaded to our servers.",
        enableMicrophonePermission: false,
      },
    ],
    [
      "react-native-fast-tflite",
      {
        enableCoreMLDelegate: true,
        enableAndroidGpuLibraries: true,
      },
    ],
  ],
};

export default config;
