import { useEffect, useRef, useState } from "react";
import { AppState, Linking } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useIsFocused } from "@react-navigation/native";
import { capturePhotoDetails } from "../services/camera";
import type { Viewport } from "../config/captureGuides";
import type { VisualRequest } from "../types/visual";
import { errorMessage } from "../utils/format";

/** Coordinate camera permissions, readiness and capture while ignoring stale camera sessions. */
export function useDeviceCamera(onCapture: (photo: VisualRequest) => void) {
  const [permission, requestPermission, refreshPermission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);
  const focused = useIsFocused();
  const [foreground, setForeground] = useState(AppState.currentState === "active");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [session, setSession] = useState(0);
  const lock = useRef(false);
  const generation = useRef(0);
  const readyRef = useRef(false);
  const active = focused && foreground && !!permission?.granted;
  const live = useRef(active);
  live.current = active;
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      setForeground(state === "active");
      if (state === "active")
        void refreshPermission().catch(() =>
          setError("Could not check camera permission."),
        );
    });
    return () => subscription.remove();
  }, [refreshPermission]);
  useEffect(() => {
    generation.current += 1;
    readyRef.current = false;
    setReady(false);
    if (!active) return;
    const timeout = setTimeout(() => {
      if (!readyRef.current) setError("The camera did not start. Please restart it.");
    }, 15000);
    return () => {
      generation.current += 1;
      clearTimeout(timeout);
    };
  }, [active, session]);

  /** Request camera permission or open settings when permission cannot be requested again. */
  async function allow() {
    try {
      if (permission?.canAskAgain === false) await Linking.openSettings();
      else {
        const response = await requestPermission();
        if (!response.granted)
          setError(
            "Camera access was denied. Allow camera access in device Settings to capture a photo.",
          );
      }
    } catch {
      setError("Could not open camera permissions. Please use device Settings.");
    }
  }

  /** Capture one image while guarding against concurrent or inactive camera requests. */
  async function capture(viewport?: Viewport) {
    if (lock.current || !ready || !live.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    const current = generation.current;
    try {
      const photo = await capturePhotoDetails(camera.current, viewport);
      if (current === generation.current && live.current) onCapture(photo);
    } catch (e) {
      if (current === generation.current) setError(errorMessage(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return {
    camera,
    permission,
    active,
    ready,
    busy,
    error,
    session,
    allow,
    capture,

    /** Mark the active camera session ready for capture. */
    onReady: () => {
      readyRef.current = true;
      setReady(true);
      setError("");
    },

    /** Report a camera mount failure and clear readiness. */
    onError: () => {
      setReady(false);
      setError(
        "The rear camera is unavailable. Check permission and restart the camera.",
      );
    },

    /** Restart the current operation using its existing retry flow. */
    retry: () => {
      setError("");
      setSession((value) => value + 1);
    },
  };
}
