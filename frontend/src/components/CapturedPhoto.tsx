import { useEffect, useState } from "react";
import { ActivityIndicator, Image, View } from "react-native";
import { WarningMessage } from "./ui";
import { resolvePhotoUri } from "../storage/photos";
export function CapturedPhoto({
  uri,
  height = 240,
  onReadyChange,
}: {
  uri?: string;
  height?: number;
  onReadyChange?: (ready: boolean) => void;
}) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    setFailed(false);
    setLoaded(false);
    onReadyChange?.(false);
  }, [uri, onReadyChange]);
  if (!uri || failed)
    return (
      <WarningMessage
        text="The captured photo could not be displayed. Please retake it."
        error
      />
    );
  return (
    <View>
      <Image
        source={{ uri: resolvePhotoUri(uri) }}
        accessibilityLabel="Actual captured cinnamon sample"
        resizeMode="contain"
        style={{ width: "100%", height, borderRadius: 16 }}
        onLoad={() => {
          setLoaded(true);
          onReadyChange?.(true);
        }}
        onError={() => {
          setFailed(true);
          onReadyChange?.(false);
        }}
      />
      {!loaded && <ActivityIndicator accessibilityLabel="Loading photo" />}
    </View>
  );
}
