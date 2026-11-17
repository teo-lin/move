import React from 'react';
import {ImageBackground, ImageSourcePropType, StyleSheet, Text} from 'react-native';

/** Key-number tile on a grainy aurora texture. */
export function GlowTile({
  value,
  label,
  texture,
}: {
  value: number | string;
  label: string;
  texture: ImageSourcePropType;
}) {
  return (
    <ImageBackground
      source={texture}
      style={styles.tile}
      imageStyle={styles.image}
      resizeMethod="scale"
      resizeMode="cover">
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  tile: {
    flexGrow: 1,
    flexBasis: '45%',
    minHeight: 64,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: 'rgba(31,45,56,0.12)',
  },
  image: {
    borderRadius: 12,
  },
  value: {
    fontFamily: 'sans-serif-condensed',
    color: '#1f2d38',
    fontSize: 26,
    fontWeight: '700',
  },
  label: {
    color: '#2f3d48',
    fontSize: 13,
    fontWeight: '600',
  },
});
