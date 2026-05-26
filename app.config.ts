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
    infoPlist: {
      NSCameraUsageDescription:
        "RepRight needs camera access to analyze your deadlift form in real time.",
    },
    usesAppleSignIn: true,
  },
  android: {
    package: "com.unibe.repright",
    adaptiveIcon: {
      backgroundColor: "#0D0D0D",
    },
  },
  plugins: [
    "expo-dev-client",
    "expo-asset",
    [
      "react-native-vision-camera",
      {
        cameraPermissionText:
          "RepRight needs camera access to analyze your deadlift form in real time.",
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
