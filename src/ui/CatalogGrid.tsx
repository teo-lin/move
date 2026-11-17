import React from 'react';
import {Image, Pressable, StyleSheet, Text, useWindowDimensions, View} from 'react-native';

import {groupByCategory} from '../data/categories';
import type {Exercise} from '../data/exercises';

/** Exercise catalog: compact tiles (16:9 animation + name), two per row, grouped by position. */
export function CatalogGrid({
  exercises,
  onPress,
}: {
  exercises: Exercise[];
  onPress: (exercise: Exercise) => void;
}) {
  // Explicit sizes: on Android a percentage width + aspectRatio Image inside a wrapping row
  // renders at its native size (cropped, zoomed in). Screen padding 18 x 2, gap 8 between tiles.
  const {width: screenWidth} = useWindowDimensions();
  const tileWidth = Math.floor((screenWidth - 18 * 2 - GAP) / 2);
  const imageSize = {
    width: tileWidth - BORDER * 2,
    height: Math.round(((tileWidth - BORDER * 2) * 9) / 16),
  };
  return (
    <View style={styles.wrap}>
      {groupByCategory(exercises).map(group => (
        <View key={group.key} style={styles.group}>
          <Text style={styles.heading}>
            {group.title} <Text style={styles.count}>{group.items.length}</Text>
          </Text>
          <View style={styles.grid}>
            {group.items.map(exercise => (
              <Pressable
                key={exercise.id}
                style={[styles.tile, {width: tileWidth}]}
                onPress={() => onPress(exercise)}
                accessibilityRole="button"
                accessibilityLabel={exercise.name}>
                <Image source={exercise.asset} style={imageSize} resizeMode="contain" />
                <Text style={styles.name} numberOfLines={2}>
                  {exercise.name}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

const GAP = 8;
const BORDER = StyleSheet.hairlineWidth * 2;

const styles = StyleSheet.create({
  wrap: {
    gap: 16,
  },
  group: {
    gap: 8,
  },
  heading: {
    fontFamily: 'sans-serif-condensed',
    color: '#1f2d38',
    fontSize: 18,
    fontWeight: '700',
  },
  count: {
    color: '#9aa4ad',
    fontWeight: '400',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
  },
  tile: {
    borderRadius: 12,
    borderWidth: BORDER,
    borderColor: 'rgba(31,45,56,0.12)',
    backgroundColor: '#ffffff',
    overflow: 'hidden',
  },
  name: {
    fontFamily: 'sans-serif-condensed',
    color: '#1f2d38',
    fontSize: 13,
    lineHeight: 15,
    fontWeight: '600',
    textAlign: 'center',
    minHeight: 30, // room for two lines so tiles in a row line up
    textAlignVertical: 'center',
    paddingHorizontal: 4,
    paddingBottom: 3,
  },
});
