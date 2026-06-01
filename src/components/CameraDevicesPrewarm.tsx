import { useCameraDevices } from 'react-native-vision-camera';

/** Registers Vision Camera's device-change listener at app start (Android cold-start fix). */
export function CameraDevicesPrewarm() {
  useCameraDevices();
  return null;
}
