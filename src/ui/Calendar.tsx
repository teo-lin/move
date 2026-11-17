import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';

import {
  formatDisplayDate,
  localDateKey,
  monthGrid,
  startOfWeek,
  weekdayLabels,
} from '../data/history';
import {Icon} from './Icon';

const monthNames = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/**
 * Compact Monday-first month calendar. Days with sessions get a round marker in the colour of
 * the first workout that day; days with more than one session get a dark outline.
 */
export function Calendar({
  year,
  month,
  dayColors,
  onShift,
}: {
  year: number;
  month: number;
  /** Local date key (yyyy-MM-dd) -> workout colours of that day's sessions, oldest first. */
  dayColors: Map<string, string[]>;
  onShift: (delta: number) => void;
}) {
  const today = localDateKey(new Date());
  const weekStart = startOfWeek(new Date());
  const week = Array.from({length: 7}, (_, offset) => {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + offset);
    return date;
  });
  const activeThisWeek = week.filter(date => dayColors.has(localDateKey(date))).length;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Pressable
          style={styles.chevron}
          onPress={() => onShift(-1)}
          accessibilityRole="button"
          accessibilityLabel="Previous month">
          <Icon name="symbolChevronLeft" size={20} color="#1f2d38" />
        </Pressable>
        <Text style={styles.title}>
          {monthNames[month]} <Text style={styles.year}>{year}</Text>
        </Text>
        <Pressable
          style={styles.chevron}
          onPress={() => onShift(1)}
          accessibilityRole="button"
          accessibilityLabel="Next month">
          <Icon name="symbolChevronRight" size={20} color="#1f2d38" />
        </Pressable>
      </View>

      <View style={styles.row}>
        {weekdayLabels.map((label, index) => (
          <Text style={[styles.weekday, index >= 5 && styles.weekend]} key={label}>
            {label.charAt(0)}
          </Text>
        ))}
      </View>

      {monthGrid(year, month).map((weekRow, rowIndex) => (
        <View style={styles.row} key={rowIndex}>
          {weekRow.map((day, dayIndex) => {
            const key = day ? localDateKey(day) : '';
            const colors = day ? dayColors.get(key) : undefined;
            const isToday = key === today;
            return (
              <View key={dayIndex} style={[styles.cell, dayIndex >= 5 && styles.weekendCell]}>
                {day && (
                  <View
                    style={[
                      styles.day,
                      colors && {backgroundColor: colors[0]},
                      colors && colors.length > 1 && styles.multiple,
                      isToday && styles.today,
                    ]}>
                    <Text
                      style={[
                        styles.dayText,
                        colors && styles.dayTextActive,
                        dayIndex >= 5 && !colors && styles.weekend,
                      ]}>
                      {day.getDate()}
                    </Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      ))}

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          This week {formatDisplayDate(week[0]).slice(0, 5)}–
          {formatDisplayDate(week[6]).slice(0, 5)}
        </Text>
        <View style={styles.weekStrip}>
          {week.map(date => {
            const colors = dayColors.get(localDateKey(date));
            return (
              <View
                key={date.toISOString()}
                style={[styles.weekSegment, colors && {backgroundColor: colors[0]}]}
              />
            );
          })}
        </View>
        <Text style={styles.footerCount}>{activeThisWeek}/7</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 1,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e4e9ee',
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  chevron: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f4f7',
  },
  title: {
    fontFamily: 'sans-serif-condensed',
    color: '#1f2d38',
    fontSize: 18,
    fontWeight: '700',
  },
  year: {
    color: '#9aa4ad',
    fontWeight: '400',
  },
  row: {
    flexDirection: 'row',
  },
  weekday: {
    flex: 1,
    textAlign: 'center',
    color: '#697782',
    fontSize: 10,
    fontWeight: '700',
  },
  weekend: {
    color: '#c0587a',
  },
  cell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 1,
  },
  weekendCell: {
    backgroundColor: '#fcf5f8',
  },
  day: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  multiple: {
    borderWidth: 1.5,
    borderColor: '#1f2d38',
  },
  today: {
    borderWidth: 2,
    borderColor: '#168f5c',
  },
  dayText: {
    color: '#1f2d38',
    fontSize: 12,
  },
  dayTextActive: {
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  footerText: {
    color: '#697782',
    fontSize: 12,
  },
  footerCount: {
    fontFamily: 'sans-serif-condensed',
    color: '#1f2d38',
    fontSize: 13,
    fontWeight: '700',
  },
  weekStrip: {
    flex: 1,
    flexDirection: 'row',
    gap: 3,
    height: 6,
  },
  weekSegment: {
    flex: 1,
    borderRadius: 3,
    backgroundColor: '#e8edf1',
  },
});
