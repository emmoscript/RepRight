import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

import { colors } from '@/theme/colors';

type Props = {
  progress: number;
};

export function OnboardingProgressBar({ progress }: Props) {
  const widthAnim = useRef(new Animated.Value(progress)).current;

  useEffect(() => {
    Animated.timing(widthAnim, {
      toValue: progress,
      duration: 500,
      useNativeDriver: false,
    }).start();
  }, [progress, widthAnim]);

  const width = widthAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.track} accessibilityRole="progressbar">
      <Animated.View style={[styles.fill, { width }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 4,
    borderRadius: 999,
    backgroundColor: colors.surface_container,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: colors.primary_green,
  },
});
