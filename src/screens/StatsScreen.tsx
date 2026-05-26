import Ionicons from "@expo/vector-icons/Ionicons";
import { useFocusEffect } from "@react-navigation/native";
import React, { useCallback, useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { RepRightHeader } from "@/components/RepRightHeader";
import { getAllSessions, type SessionLog } from "@/modules/session";
import { colors } from "@/theme/colors";
import { typography } from "@/theme/typography";

type FilterKind = "week" | "last" | "month";

// Helper: Get start of week (Monday)
function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Helper: Get array of 7 dates for the week
function getWeekDates(weekStart: Date): Date[] {
  const dates: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    dates.push(d);
  }
  return dates;
}

export function StatsScreen() {
  const [sessions, setSessions] = useState<SessionLog[]>([]);
  const [refresh, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterKind>("week");
  const [weekOffset, setWeekOffset] = useState(0); // 0 = this week, -1 = last week, etc
  const [showCalendar, setShowCalendar] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    const data = await getAllSessions();
    setSessions(data.sort((a, b) => b.date.localeCompare(a.date)));
    setRefreshing(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  // Calculate current viewing week
  const weekStart = useMemo(() => {
    const today = new Date();
    const start = getWeekStart(today);
    start.setDate(start.getDate() + weekOffset * 7);
    return start;
  }, [weekOffset]);

  const weekDates = useMemo(() => getWeekDates(weekStart), [weekStart]);

  // Map sessions by date string
  const sessionsByDate = useMemo(() => {
    const map = new Map<string, SessionLog[]>();
    sessions.forEach((s) => {
      const dateStr = new Date(s.date).toDateString();
      if (!map.has(dateStr)) map.set(dateStr, []);
      map.get(dateStr)!.push(s);
    });
    return map;
  }, [sessions]);

  // Get sessions for current week
  const weekSessions = useMemo(() => {
    return sessions.filter((s) => {
      const sessionDate = new Date(s.date);
      sessionDate.setHours(0, 0, 0, 0);
      return (
        sessionDate >= weekStart &&
        sessionDate < new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000)
      );
    });
  }, [sessions, weekStart]);

  const peak = weekSessions.length
    ? Math.max(...weekSessions.map((s) => Math.round(s.summary.avgScore)))
    : null;

  // Format week label
  const weekLabel = useMemo(() => {
    const end = new Date(weekStart);
    end.setDate(end.getDate() + 6);
    const startMonth = [
      "J",
      "F",
      "M",
      "A",
      "M",
      "J",
      "J",
      "A",
      "S",
      "O",
      "N",
      "D",
    ][weekStart.getMonth()];
    const endMonth = [
      "J",
      "F",
      "M",
      "A",
      "M",
      "J",
      "J",
      "A",
      "S",
      "O",
      "N",
      "D",
    ][end.getMonth()];
    const label =
      startMonth === endMonth
        ? `${startMonth} ${weekStart.getDate()} - ${end.getDate()}`
        : `${startMonth} ${weekStart.getDate()} - ${endMonth} ${end.getDate()}`;
    return weekOffset === 0 ? `This week: ${label}` : label;
  }, [weekStart, weekOffset]);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <RepRightHeader />
      <FlatList
        data={weekSessions}
        keyExtractor={(it) => it.sessionId}
        refreshControl={
          <RefreshControl
            refreshing={refresh}
            onRefresh={load}
            tintColor={colors.primary_green}
          />
        }
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.empty}>
            No sessions this week — complete a live lift to populate the rep
            log.
          </Text>
        }
        ListHeaderComponent={
          <View style={styles.hdr}>
            <Text style={styles.h1}>Rep log</Text>
            <Text style={styles.meta}>Your biomechanical history</Text>

            <View style={styles.filt}>
              <Pill
                tab="THIS WEEK"
                selected={filter === "week"}
                onPress={() => setFilter("week")}
              />
              <Pill
                tab="LAST WEEK"
                selected={filter === "last"}
                onPress={() => setFilter("last")}
              />
              <Pill
                tab="MONTHLY"
                selected={filter === "month"}
                onPress={() => setFilter("month")}
              />
            </View>

            {/* Week Navigation */}
            <View style={styles.weekNav}>
              <Pressable
                onPress={() => setWeekOffset((w) => w - 1)}
                style={styles.weekBtn}>
                <Ionicons
                  name="chevron-back"
                  size={20}
                  color={colors.primary_green}
                />
              </Pressable>
              <Text style={styles.weekLabel}>{weekLabel}</Text>
              <Pressable
                onPress={() => setWeekOffset((w) => w + 1)}
                style={styles.weekBtn}>
                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color={colors.primary_green}
                />
              </Pressable>
            </View>

            {/* Calendar Button */}
            <Pressable
              onPress={() => setShowCalendar(true)}
              style={styles.calendarBtn}>
              <Ionicons name="calendar" size={18} color={colors.text_primary} />
              <Text style={styles.calendarBtnTxt}>View calendar</Text>
            </Pressable>

            <View style={styles.peakCard}>
              <Text style={styles.peakLab}>Peak form score this week</Text>
              <Text style={styles.peakNum}>{peak != null ? peak : "—"}</Text>
              <View style={styles.peakBar}>
                <View
                  style={[
                    styles.peakFill,
                    peak != null && {
                      width:
                        `${Math.min(Math.max(peak, 0), 100)}%` as `${number}%`,
                    },
                  ]}
                />
              </View>
            </View>

            <Text style={styles.weekVol}>Weekly volume</Text>
            <View style={styles.bars}>
              {weekDates.map((d, idx) => {
                const dateStr = d.toDateString();
                const hasSessions = sessionsByDate.has(dateStr);
                const dayLabel = ["M", "T", "W", "T", "F", "S", "S"][idx];
                return (
                  <View key={String(idx)} style={styles.barWrap}>
                    <View
                      style={[
                        styles.bar,
                        hasSessions ? styles.barHot : styles.barCold,
                      ]}
                    />
                    <Text style={styles.dayL}>{dayLabel}</Text>
                    <Text style={styles.dayDate}>{d.getDate()}</Text>
                  </View>
                );
              })}
            </View>

            <Text style={styles.secTitle}>Deadlift sessions</Text>
          </View>
        }
        renderItem={({ item }) => {
          const sc = Math.round(item.summary.avgScore);
          const good = sc >= 70;
          const d = new Date(item.date);
          const months = [
            "Jan",
            "Feb",
            "Mar",
            "Apr",
            "May",
            "Jun",
            "Jul",
            "Aug",
            "Sep",
            "Oct",
            "Nov",
            "Dec",
          ];
          const dateStr = `${months[d.getMonth()]} ${String(d.getDate()).padStart(2, "0")}, ${d.getFullYear()}`;
          const accent =
            sc >= 90
              ? colors.primary_green
              : sc >= 70
                ? colors.accent_green_light
                : sc >= 50
                  ? colors.accent_yellow
                  : colors.accent_red;
          return (
            <View
              style={[
                styles.card,
                {
                  borderLeftColor: good
                    ? colors.primary_green
                    : colors.accent_red,
                },
              ]}>
              <Text style={styles.cardDate}>{dateStr}</Text>
              <Text style={styles.cardMuted}>
                {item.sets.length} set(s) · deadlift session
              </Text>
              <View
                style={[
                  styles.badge,
                  {
                    backgroundColor: accent + "18",
                    borderColor: accent + "30",
                  },
                ]}>
                <Text style={[styles.badgeTxt, { color: accent }]}>{sc}%</Text>
              </View>
            </View>
          );
        }}
      />

      {/* Calendar Modal */}
      <Modal
        visible={showCalendar}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCalendar(false)}>
        <CalendarModal
          sessions={sessions}
          onClose={() => setShowCalendar(false)}
        />
      </Modal>
    </SafeAreaView>
  );
}

function CalendarModal({
  sessions,
  onClose,
}: {
  sessions: SessionLog[];
  onClose: () => void;
}) {
  const today = new Date();
  const [viewMonth, setViewMonth] = useState(
    new Date(today.getFullYear(), today.getMonth(), 1),
  );

  // Only keep sessions for memoization - compute dates on demand
  const sessionsByDate = useMemo(() => {
    const map = new Map<string, number>();
    sessions.forEach((s) => {
      const dateStr = new Date(s.date).toDateString();
      map.set(dateStr, (map.get(dateStr) ?? 0) + 1);
    });
    return map;
  }, [sessions]);

  // Memoize calendar grid generation per month
  const calendarData = useMemo(() => {
    const daysInMonth = (date: Date) =>
      new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    const firstDay = (date: Date) =>
      new Date(date.getFullYear(), date.getMonth(), 1).getDay();

    const days: (number | null)[] = [];
    for (let i = 0; i < (firstDay(viewMonth) || 7); i++) days.push(null);
    for (let i = 1; i <= daysInMonth(viewMonth); i++) days.push(i);

    return days;
  }, [viewMonth]);

  const monthName = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ][viewMonth.getMonth()];

  // Prevent navigating to future months
  const canGoForward =
    new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1) <= today;

  const handlePrevMonth = () => {
    setViewMonth(
      new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1),
    );
  };

  const handleNextMonth = () => {
    if (canGoForward) {
      setViewMonth(
        new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1),
      );
    }
  };

  return (
    <View style={styles.modalOverlay}>
      <View style={styles.modalContent}>
        <View style={styles.modalHeader}>
          <Pressable onPress={handlePrevMonth}>
            <Ionicons
              name="chevron-back"
              size={24}
              color={colors.text_primary}
            />
          </Pressable>
          <Text style={styles.modalTitle}>
            {monthName} {viewMonth.getFullYear()}
          </Text>
          <Pressable onPress={handleNextMonth} disabled={!canGoForward}>
            <Ionicons
              name="chevron-forward"
              size={24}
              color={canGoForward ? colors.text_primary : colors.text_muted}
            />
          </Pressable>
        </View>

        <View style={styles.calendarGrid}>
          {["M", "T", "W", "T", "F", "S", "S"].map((d, idx) => (
            <Text key={`day-label-${idx}`} style={styles.calendarDayLabel}>
              {d}
            </Text>
          ))}
          {calendarData.map((day, idx) => {
            if (day === null) {
              return <View key={`empty-${idx}`} style={styles.calendarDay} />;
            }
            const d = new Date(
              viewMonth.getFullYear(),
              viewMonth.getMonth(),
              day,
            );
            const dateStr = d.toDateString();
            const count = sessionsByDate.get(dateStr) ?? 0;
            return (
              <View
                key={`day-${day}-${idx}`}
                style={[
                  styles.calendarDay,
                  count > 0 && { backgroundColor: colors.primary_green },
                ]}>
                <Text
                  style={[
                    styles.calendarDayNum,
                    count > 0 && { color: colors.text_on_green },
                  ]}>
                  {day}
                </Text>
              </View>
            );
          })}
        </View>

        <Pressable onPress={onClose} style={styles.closeBtn}>
          <Text style={styles.closeBtnTxt}>Close</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Pill(props: { tab: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={props.onPress}
      style={[
        styles.pillBase,
        props.selected ? styles.pillOn : styles.pillOff,
      ]}>
      <Text
        style={[
          styles.pillTxt,
          props.selected ? styles.pillTxtOn : styles.pillTxtOff,
        ]}>
        {props.tab}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg_v3 },
  list: { paddingHorizontal: 24, paddingBottom: 112 },
  hdr: {},
  h1: {
    marginTop: 6,
    color: colors.text_primary,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.fontSize.hero - 14,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  meta: {
    marginTop: 8,
    color: colors.text_muted,
    fontSize: typography.fontSize.bodySm,
  },
  filt: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 20,
    marginBottom: 8,
  },
  pillBase: {
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 999,
  },
  pillOn: { backgroundColor: colors.primary_green },
  pillTxt: {
    fontFamily: typography.fontFamily.display,
    fontSize: typography.fontSize.captionCaps + 2,
    letterSpacing: 1.6,
  },
  pillTxtOff: { color: colors.text_secondary, textTransform: "uppercase" },

  // Week Navigation
  weekNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 18,
    marginBottom: 12,
    paddingHorizontal: 8,
  },
  weekBtn: {
    padding: 8,
  },
  weekLabel: {
    flex: 1,
    textAlign: "center",
    color: colors.text_primary,
    fontFamily: typography.fontFamily.bold,
    fontSize: 15,
    letterSpacing: 0.5,
  },

  // Calendar Button
  calendarBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 16,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: colors.bg_elevated,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border_subtle,
  },
  calendarBtnTxt: {
    color: colors.text_primary,
    fontFamily: typography.fontFamily.medium,
    fontSize: 14,
  },

  peakCard: {
    marginTop: 16,
    backgroundColor: colors.surface_v3,
    borderRadius: 16,
    padding: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border_subtle,
  },
  peakLab: {
    color: colors.text_secondary,
    letterSpacing: 2,
    fontSize: 11,
    textTransform: "uppercase",
    fontFamily: typography.fontFamily.medium,
  },
  peakNum: {
    marginTop: 10,
    fontFamily: typography.fontFamily.display,
    fontSize: 44,
    color: colors.primary_green,
  },
  peakBar: {
    marginTop: 14,
    flexDirection: "row",
    height: 10,
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: colors.bg_high,
  },
  peakFill: {
    borderRadius: 999,
    backgroundColor: colors.primary_green,
    height: "100%",
    minWidth: 0,
  },
  pillOff: { backgroundColor: colors.bg_high },
  pillTxtOn: { color: colors.text_on_green, textTransform: "uppercase" },
  weekVol: {
    marginTop: 26,
    color: colors.text_primary,
    fontFamily: typography.fontFamily.medium,
    fontSize: 13,
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  bars: { flexDirection: "row", marginTop: 12, gap: 8 },
  barWrap: { flex: 1, alignItems: "center" },
  bar: { width: "100%", maxWidth: 24, borderRadius: 999, height: 48 },
  barHot: { backgroundColor: colors.primary_green },
  barCold: { backgroundColor: colors.bg_high },
  dayL: {
    marginTop: 8,
    fontSize: 10,
    color: colors.text_muted,
    fontFamily: typography.fontFamily.medium,
  },
  dayDate: {
    marginTop: 2,
    fontSize: 9,
    color: colors.text_muted,
    fontFamily: typography.fontFamily.regular,
  },
  secTitle: {
    marginTop: 28,
    marginBottom: 14,
    color: colors.text_primary,
    fontFamily: typography.fontFamily.bold,
    fontSize: 16,
  },
  card: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.bg_elevated,
    borderRadius: 14,
    padding: 18,
    marginBottom: 12,
    borderLeftWidth: 5,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border_subtle,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: colors.border_subtle,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border_subtle,
  },
  cardDate: {
    flex: 1,
    minWidth: "40%",
    fontFamily: typography.fontFamily.bold,
    color: colors.text_primary,
    fontSize: 17,
  },
  cardMuted: {
    width: "100%",
    color: colors.text_secondary,
    fontSize: 13,
    marginBottom: -4,
  },
  badge: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  badgeTxt: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.captions,
    letterSpacing: 0.5,
  },
  empty: {
    marginTop: 24,
    marginBottom: 40,
    color: colors.text_secondary,
    fontSize: 15,
    textAlign: "center",
  },

  // Calendar Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  modalContent: {
    backgroundColor: colors.bg_v3,
    borderRadius: 20,
    padding: 24,
    width: "100%",
    maxWidth: 380,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  modalTitle: {
    color: colors.text_primary,
    fontFamily: typography.fontFamily.bold,
    fontSize: 18,
    letterSpacing: 0.5,
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 20,
  },
  calendarDayLabel: {
    width: "14.2%",
    textAlign: "center",
    color: colors.text_muted,
    fontFamily: typography.fontFamily.bold,
    fontSize: 12,
    marginBottom: 8,
  },
  calendarDay: {
    width: "14.2%",
    aspectRatio: 1,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 8,
    backgroundColor: colors.bg_elevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border_subtle,
  },
  calendarDayNum: {
    color: colors.text_primary,
    fontFamily: typography.fontFamily.bold,
    fontSize: 13,
  },
  closeBtn: {
    backgroundColor: colors.primary_green,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  closeBtnTxt: {
    color: colors.text_on_green,
    fontFamily: typography.fontFamily.bold,
    fontSize: 16,
  },
});
