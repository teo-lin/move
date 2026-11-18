import React, {useEffect, useRef} from 'react';
import {Animated, Easing, ScrollView, StyleSheet, Text, View} from 'react-native';

import {getLanguage, t} from '../i18n';
import type {Quote} from '../data/quotes';

/** Twenty pastel "reward" pictures: a big emoji on a soft backdrop. */
export const rewards: {emoji: string; backdrop: string; blob: string}[] = [
  {emoji: '🌸', backdrop: '#fde8f0', blob: '#f9c9dc'},
  {emoji: '🐱', backdrop: '#fdf0dc', blob: '#f9dcae'},
  {emoji: '🐶', backdrop: '#f3ebdf', blob: '#e6d3b6'},
  {emoji: '🧸', backdrop: '#f7e9dd', blob: '#ecc9a6'},
  {emoji: '🌷', backdrop: '#fde6ea', blob: '#f8c3cd'},
  {emoji: '🐰', backdrop: '#eef0fb', blob: '#d4d8f4'},
  {emoji: '🦋', backdrop: '#e6f3fb', blob: '#c2e1f5'},
  {emoji: '🐥', backdrop: '#fff7d6', blob: '#fbe9a0'},
  {emoji: '🌻', backdrop: '#fff3d1', blob: '#fadf8f'},
  {emoji: '🐼', backdrop: '#eef3ee', blob: '#d3e2d3'},
  {emoji: '🦊', backdrop: '#fde9dc', blob: '#f8cba9'},
  {emoji: '🐢', backdrop: '#e4f5ea', blob: '#bfe6cb'},
  {emoji: '🦄', backdrop: '#f4e8fb', blob: '#e2c8f3'},
  {emoji: '🍓', backdrop: '#fde4e4', blob: '#f7bcbc'},
  {emoji: '🌈', backdrop: '#e9f1fd', blob: '#c9dcf8'},
  {emoji: '🐨', backdrop: '#edf0f3', blob: '#d3dae1'},
  {emoji: '🪻', backdrop: '#efe8fb', blob: '#d8c9f3'},
  {emoji: '🐻', backdrop: '#f5e8de', blob: '#e4c8b0'},
  {emoji: '🌼', backdrop: '#fdf6dc', blob: '#f7e6a3'},
  {emoji: '🐹', backdrop: '#fdeedc', blob: '#f7d6a8'},
];

export function pickReward(random: () => number = Math.random) {
  return Math.floor(random() * rewards.length);
}

export function CongratsView({
  rewardIndex,
  quote,
  summary,
  children,
}: {
  rewardIndex: number;
  quote: Quote;
  summary: string;
  children: React.ReactNode; // the Done button
}) {
  const reward = rewards[rewardIndex % rewards.length];
  const bounce = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bounce, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(bounce, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [bounce]);

  const text = getLanguage() === 'ro' ? quote.ro : quote.text;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={[styles.art, {backgroundColor: reward.backdrop}]}>
        <View style={[styles.blob, styles.blobBig, {backgroundColor: reward.blob}]} />
        <View style={[styles.blob, styles.blobSmall, {backgroundColor: reward.blob}]} />
        <Animated.Text
          style={[
            styles.emoji,
            {
              transform: [
                {translateY: bounce.interpolate({inputRange: [0, 1], outputRange: [0, -14]})},
                {scale: bounce.interpolate({inputRange: [0, 1], outputRange: [1, 1.06]})},
              ],
            },
          ]}>
          {reward.emoji}
        </Animated.Text>
        <Text style={[styles.spark, styles.sparkA]}>✨</Text>
        <Text style={[styles.spark, styles.sparkB]}>✨</Text>
      </View>
      <Text style={styles.heading}>{t('Well done!')}</Text>
      <Text style={styles.summary}>{summary}</Text>
      <View style={[styles.quoteCard, {backgroundColor: reward.backdrop}]}>
        <Text style={styles.quote}>“{text}”</Text>
        <Text style={styles.author}>— {quote.author}</Text>
      </View>
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {padding: 18, gap: 16, alignItems: 'stretch'},
  art: {
    height: 260,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  blob: {position: 'absolute', borderRadius: 999, opacity: 0.8},
  blobBig: {width: 220, height: 220},
  blobSmall: {width: 90, height: 90, right: 28, top: 24},
  emoji: {fontSize: 120},
  spark: {position: 'absolute', fontSize: 26},
  sparkA: {left: 34, top: 40},
  sparkB: {right: 46, bottom: 36},
  heading: {
    textAlign: 'center',
    fontFamily: 'sans-serif-condensed',
    color: '#1f2d38',
    fontSize: 36,
    fontWeight: '700',
  },
  summary: {textAlign: 'center', color: '#52606d', fontSize: 16},
  quoteCard: {borderRadius: 18, padding: 18, gap: 8},
  quote: {color: '#1f2d38', fontSize: 19, lineHeight: 27, fontStyle: 'italic'},
  author: {color: '#52606d', fontSize: 14, textAlign: 'right'},
});
