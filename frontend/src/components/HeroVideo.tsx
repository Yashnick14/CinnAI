import { type PropsWithChildren, useEffect, useState } from "react";
import {
  AppState,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useIsFocused } from "@react-navigation/native";
import { useVideoPlayer, VideoView } from "expo-video";

/** Video-only hero; a plain dark background is shown while the video loads. */
export function HeroVideo({
  children,
  style,
}: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  const focused = useIsFocused();
  const [active, setActive] = useState(AppState.currentState === "active");
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const player = useVideoPlayer(
    require("../../assets/quill_video_1.mp4"),
    (video) => {
      video.loop = true;
      video.muted = true;
    },
  );

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) =>
      setActive(state === "active"),
    );
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    const subscription = player.addListener("statusChange", ({ status }) => {
      setFailed(status === "error");
    });
    return () => subscription.remove();
  }, [player]);

  useEffect(() => {
    if (focused && active && !failed) player.play();
    else player.pause();
  }, [player, focused, active, failed]);

  return (
    <View
      style={[
        {
          width: "100%",
          position: "relative",
          overflow: "hidden",
          backgroundColor: "#3D281C",
        },
        style,
      ]}
    >
      {!failed && (
        <View
          pointerEvents="none"
          accessible={false}
          style={StyleSheet.absoluteFill}
        >
          <VideoView
            player={player}
            style={[StyleSheet.absoluteFill, { opacity: ready ? 1 : 0 }]}
            onFirstFrameRender={() => setReady(true)}
            contentFit="cover"
            nativeControls={false}
            playsInline
            accessible={false}
          />
        </View>
      )}
      {children}
    </View>
  );
}
