import React, {useMemo} from 'react';
import {
  Image,
  Pressable,
  SectionList,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import {groupByCategory} from '../data/categories';
import {t} from '../i18n';
import type {Exercise} from '../data/exercises';

type Section = {key: string; title: string; count: number; data: Exercise[][]};

/**
 * Exercise catalog: compact tiles (16:9 animation + name), two per row, grouped by position.
 *
 * It is a virtualized SectionList: only the rows near the screen exist, so only a handful of the
 * ~120 animated GIFs are decoded and playing at any time (rendering them all made scrolling
 * choppy). It scrolls by itself: pass any content above the list as `header`.
 */
export function CatalogGrid({
  exercises,
  onPress,
  header,
}: {
  exercises: Exercise[];
  onPress: (exercise: Exercise) => void;
  header?: React.ReactElement;
}) {
  // Explicit sizes: on Android a percentage width + aspectRatio Image in a wrapping row renders
  // at its native size (cropped, zoomed in). Screen padding 18 x 2, gap 8 between the two tiles.
  const {width: screenWidth} = useWindowDimensions();
  const tileWidth = Math.floor((screenWidth - 18 * 2 - GAP) / 2);
  const imageSize = {
    width: tileWidth - BORDER * 2,
    height: Math.round(((tileWidth - BORDER * 2) * 9) / 16),
  };

  const sections: Section[] = useMemo(
    () =>
      groupByCategory(exercises).map(group => {
        const rows: Exercise[][] = [];
        for (let i = 0; i < group.items.length; i += 2) {
          rows.push(group.items.slice(i, i + 2));
        }
        return {key: group.key, title: group.title, count: group.items.length, data: rows};
      }),
    [exercises],
  );

  return (
    <SectionList
      sections={sections}
      keyExtractor={row => String(row[0].id)}
      ListHeaderComponent={header}
      stickySectionHeadersEnabled={false}
      renderSectionHeader={({section}) => (
        <Text style={styles.heading}>
          {t(section.title)} <Text style={styles.count}>{section.count}</Text>
        </Text>
      )}
      renderItem={({item: row}) => (
        <View style={styles.row}>
          {row.map(exercise => (
            <Pressable
              key={exercise.id}
              style={[styles.tile, {width: tileWidth}]}
              onPress={() => onPress(exercise)}
              accessibilityRole="button"
              accessibilityLabel={exercise.name}>
              <Image
                source={exercise.asset}
                style={imageSize}
                resizeMode="contain"
                fadeDuration={0}
              />
              <Text style={styles.name} numberOfLines={2}>
                {exercise.name}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      initialNumToRender={5}
      maxToRenderPerBatch={4}
      updateCellsBatchingPeriod={40}
      windowSize={5}
      removeClippedSubviews
    />
  );
}

const GAP = 8;
const BORDER = StyleSheet.hairlineWidth * 2;

const styles = StyleSheet.create({
  content: {
    padding: 18,
    paddingBottom: 40,
  },
  heading: {
    fontFamily: 'sans-serif-condensed',
    color: '#1f2d38',
    fontSize: 18,
    fontWeight: '700',
    marginTop: 14,
    marginBottom: 8,
    backgroundColor: '#ffffff',
  },
  count: {
    color: '#9aa4ad',
    fontWeight: '400',
  },
  row: {
    flexDirection: 'row',
    gap: GAP,
    marginBottom: GAP,
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
