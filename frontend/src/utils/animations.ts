import { useEffect, useRef } from "react";
import { Animated, Easing } from "react-native";

/**
 * Simple fade in on mount.
 */
export function useFadeIn(delay = 0, duration = 400) {
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(opacity, {
      toValue: 1,
      duration,
      delay,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [delay, duration, opacity]);
  return { opacity };
}

/**
 * Scale spring on mount (for hero elements).
 */
export function useScaleIn(delay = 0) {
  const scale = useRef(new Animated.Value(0.88)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        delay,
        friction: 8,
        tension: 60,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 300,
        delay,
        useNativeDriver: true,
      }),
    ]).start();
  }, [delay, scale, opacity]);

  return { opacity, transform: [{ scale }] };
}

/**
 * Pulse animation (loop) — for active/scanning states.
 */
export function usePulse(active = true) {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!active) {
      scale.setValue(1);
      return;
    }
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 1.06,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [active, scale]);

  return { transform: [{ scale }] };
}

/**
 * Stagger helper: returns a delay value for the nth item.
 */
export function staggerDelay(index: number, base = 80) {
  return index * base;
}
