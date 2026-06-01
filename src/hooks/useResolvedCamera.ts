import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import {
  Camera,
  getCameraDevice,
  useCameraDevice,
  useCameraDevices,
  useCameraPermission,
  type CameraDevice,
  type CameraPermissionStatus,
  type CameraPosition,
} from 'react-native-vision-camera';

import { sessionTrace } from '@/modules/sessionTrace';

type Options = {
  position: CameraPosition;
  isFocused: boolean;
};

function mergeDevices(lists: CameraDevice[][]): CameraDevice[] {
  const byId = new Map<string, CameraDevice>();
  for (const list of lists) {
    for (const d of list) byId.set(d.id, d);
  }
  return [...byId.values()];
}

function pickDevice(
  allDevices: CameraDevice[],
  primary: CameraPosition,
  hookedPrimary?: CameraDevice,
  hookedFallback?: CameraDevice,
): CameraDevice | undefined {
  const fallback: CameraPosition = primary === 'front' ? 'back' : 'front';

  const resolve = (pos: CameraPosition, hooked?: CameraDevice) =>
    hooked ?? getCameraDevice(allDevices, pos) ?? allDevices.find((d) => d.position === pos);

  return resolve(primary, hookedPrimary) ?? resolve(fallback, hookedFallback) ?? allDevices[0];
}

/** Vision Camera caches devices from getConstants(); only CameraDevicesChanged updates the list. */
export async function warmUpCameraEnumeration(): Promise<void> {
  await Camera.requestCameraPermission();
}

export function useResolvedCamera({ position, isFocused }: Options) {
  const { hasPermission, requestPermission: requestPermissionHook } = useCameraPermission();
  const hookedList = useCameraDevices();
  const hookedPrimary = useCameraDevice(position);
  const fallbackPosition: CameraPosition = position === 'front' ? 'back' : 'front';
  const hookedFallback = useCameraDevice(fallbackPosition);

  const [discovering, setDiscovering] = useState(false);

  const permissionStatus: CameraPermissionStatus = Camera.getCameraPermissionStatus();
  const cameraGranted = hasPermission || permissionStatus === 'granted';

  const allDevices = useMemo(() => mergeDevices([hookedList]), [hookedList]);

  const device = useMemo(
    () => pickDevice(allDevices, position, hookedPrimary, hookedFallback),
    [allDevices, position, hookedPrimary, hookedFallback],
  );

  const logDevices = useCallback(
    (source: string) => {
      sessionTrace.session('camera_enum', {
        source,
        count: allDevices.length,
        permission: Camera.getCameraPermissionStatus(),
        hookPermission: hasPermission,
        devices: allDevices.map((d) => ({ id: d.id, position: d.position })),
      });
    },
    [allDevices, hasPermission],
  );

  const requestAccess = useCallback(async () => {
    const status = await Camera.requestCameraPermission();
    await requestPermissionHook();
    await warmUpCameraEnumeration();
    logDevices('permission_request');
    sessionTrace.session('camera_permission_request', { status });
    return status;
  }, [requestPermissionHook, logDevices]);

  useEffect(() => {
    if (!isFocused) return;
    logDevices('focus');
    const sub = Camera.addCameraDevicesChangedListener((devices) => {
      sessionTrace.session('camera_devices_changed', {
        count: devices.length,
        devices: devices.map((d) => ({ id: d.id, position: d.position })),
      });
    });
    return () => sub.remove();
  }, [isFocused, logDevices]);

  useEffect(() => {
    if (!isFocused) return;
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') logDevices('app_active');
    });
    return () => sub.remove();
  }, [isFocused, logDevices]);

  useEffect(() => {
    if (!isFocused) return;
    if (Camera.getCameraPermissionStatus() !== 'not-determined') return;
    void requestAccess();
  }, [isFocused, requestAccess]);

  useEffect(() => {
    if (!isFocused || !cameraGranted || device != null) {
      setDiscovering(false);
      return;
    }
    setDiscovering(true);
    const timeout = setTimeout(() => setDiscovering(false), 15000);
    return () => {
      clearTimeout(timeout);
      setDiscovering(false);
    };
  }, [isFocused, cameraGranted, device, allDevices.length]);

  useEffect(() => {
    if (device != null) {
      sessionTrace.session('camera_discovered', { count: allDevices.length });
    }
  }, [device, allDevices.length]);

  return {
    device,
    allDevices,
    hasPermission,
    permissionStatus,
    cameraGranted,
    discovering,
    requestAccess,
    refreshEnumeration: () => logDevices('manual_refresh'),
    fallbackPosition,
  };
}
