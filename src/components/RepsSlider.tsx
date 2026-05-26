import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  LayoutChangeEvent,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';

export const REPS_PER_SET_MIN = 1;
export const REPS_PER_SET_MAX = 30;

const THUMB_SIZE = 26;
const TRACK_H = 6;

type Props = {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
};

function clampReps(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(n)));
}

function ratioFromPageX(pageX: number, trackPageX: number, trackWidth: number): number {
  if (trackWidth <= 0) return 0;
  return Math.min(1, Math.max(0, (pageX - trackPageX) / trackWidth));
}

function valueFromRatio(ratio: number, min: number, max: number): number {
  return clampReps(min + ratio * (max - min), min, max);
}

export function RepsSlider({
  value,
  onChange,
  min = REPS_PER_SET_MIN,
  max = REPS_PER_SET_MAX,
}: Props) {
  const trackRef = useRef<View>(null);
  const trackWidthRef = useRef(0);
  const trackPageXRef = useRef(0);
  const onChangeRef = useRef(onChange);
  const minRef = useRef(min);
  const maxRef = useRef(max);
  const valueRef = useRef(value);

  const [trackWidth, setTrackWidth] = useState(0);
  const [dragging, setDragging] = useState(false);
  /** Continuous 0–1 thumb position while dragging (avoids integer snap jitter). */
  const [dragRatio, setDragRatio] = useState(0);

  onChangeRef.current = onChange;
  minRef.current = min;
  maxRef.current = max;
  valueRef.current = value;

  const measureTrack = useCallback(() => {
    trackRef.current?.measureInWindow((x, _y, width) => {
      trackPageXRef.current = x;
      trackWidthRef.current = width;
      setTrackWidth(width);
    });
  }, []);

  const onTrackLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const w = e.nativeEvent.layout.width;
      trackWidthRef.current = w;
      setTrackWidth(w);
      measureTrack();
    },
    [measureTrack],
  );

  const applyPageX = useCallback((pageX: number) => {
    const ratio = ratioFromPageX(pageX, trackPageXRef.current, trackWidthRef.current);
    setDragRatio(ratio);
    const next = valueFromRatio(ratio, minRef.current, maxRef.current);
    if (next !== valueRef.current) {
      valueRef.current = next;
      onChangeRef.current(next);
    }
  }, []);

  const panHandlers = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (e) => {
          measureTrack();
          setDragging(true);
          applyPageX(e.nativeEvent.pageX);
        },
        onPanResponderMove: (e) => {
          applyPageX(e.nativeEvent.pageX);
        },
        onPanResponderRelease: () => setDragging(false),
        onPanResponderTerminate: () => setDragging(false),
      }).panHandlers,
    [applyPageX, measureTrack],
  );

  const span = max - min;
  const valueRatio = span > 0 ? (value - min) / span : 0;
  const displayRatio = dragging ? dragRatio : valueRatio;
  const thumbTravel = Math.max(trackWidth - THUMB_SIZE, 0);
  const thumbLeft = displayRatio * thumbTravel;
  const fillWidth = displayRatio * trackWidth;

  const step = (delta: number) => onChange(clampReps(value + delta, min, max));

  return (
    <View style={styles.root}>
      <View style={styles.headerRow}>
        <Text style={styles.label}>Reps per set</Text>
        <View style={styles.valuePill}>
          <Text style={styles.valueTxt}>{value}</Text>
        </View>
      </View>

      <View
        ref={trackRef}
        style={styles.trackWrap}
        onLayout={onTrackLayout}
        collapsable={false}
        {...panHandlers}
      >
        <View style={styles.track}>
          {trackWidth > 0 ? (
            <View style={[styles.fill, { width: fillWidth }]} />
          ) : (
            <View style={[styles.fill, { width: `${displayRatio * 100}%` }]} />
          )}
        </View>
        <View style={[styles.thumb, { left: thumbLeft }]} />
      </View>

      <View style={styles.rangeRow}>
        <Text style={styles.rangeTxt}>{min}</Text>
        <Text style={styles.rangeTxt}>{max}</Text>
      </View>

      <View style={styles.stepperRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Decrease reps"
          onPress={() => step(-1)}
          disabled={value <= min}
          style={[styles.stepBtn, value <= min && styles.stepBtnDisabled]}
        >
          <Text style={styles.stepBtnTxt}>−</Text>
        </Pressable>
        <Text style={styles.stepHint}>Slide or tap the bar</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Increase reps"
          onPress={() => step(1)}
          disabled={value >= max}
          style={[styles.stepBtn, value >= max && styles.stepBtnDisabled]}
        >
          <Text style={styles.stepBtnTxt}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { marginTop: 12 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    color: colors.text_muted,
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.captionCaps + 2,
    letterSpacing: typography.letterSpacing.capsWide,
    textTransform: 'uppercase',
  },
  valuePill: {
    minWidth: 52,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.bg_elevated,
    alignItems: 'center',
  },
  valueTxt: {
    color: colors.primary_green,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.fontSize.titleSm + 4,
  },
  trackWrap: {
    marginTop: 18,
    height: THUMB_SIZE + 20,
    justifyContent: 'center',
  },
  track: {
    height: TRACK_H,
    borderRadius: TRACK_H / 2,
    backgroundColor: colors.bg_elevated,
    overflow: 'hidden',
  },
  fill: {
    height: TRACK_H,
    borderRadius: TRACK_H / 2,
    backgroundColor: colors.primary_green,
  },
  thumb: {
    position: 'absolute',
    top: (THUMB_SIZE + 20 - THUMB_SIZE) / 2,
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: colors.primary_green,
    borderWidth: 3,
    borderColor: colors.text_on_green,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  rangeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  rangeTxt: {
    color: colors.text_muted,
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.captionCaps + 1,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    gap: 12,
  },
  stepBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.bg_elevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnDisabled: { opacity: 0.35 },
  stepBtnTxt: {
    color: colors.text_primary,
    fontFamily: typography.fontFamily.bold,
    fontSize: 22,
    lineHeight: 24,
  },
  stepHint: {
    flex: 1,
    textAlign: 'center',
    color: colors.text_muted,
    fontSize: typography.fontSize.captionCaps + 1,
  },
});
