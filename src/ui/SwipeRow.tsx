import React, {useEffect, useRef} from 'react';
import {Animated, PanResponder, StyleSheet, useWindowDimensions, View} from 'react-native';

import {Icon} from './Icon';

const REVEAL = 76; // dp the tile slides to show the bin
const TRIGGER = 36; // dp of swipe that counts as a swipe

/**
 * A row you can swipe.
 *  - swipe LEFT: the tile slides over and a bin shows underneath (`open`); swipe left AGAIN
 *    and the tile slides away and `onDelete` runs. Swiping right closes the bin.
 *  - swipe RIGHT (only when `onEdit` is given): a pencil shows underneath and `onEdit` runs.
 *
 * The parent owns `open`, so only one row is ever open at a time. Only horizontal-looking moves
 * are claimed, so vertical scrolling and the buttons inside the row keep working.
 */
export function SwipeRow({
  open,
  onOpenChange,
  onDelete,
  onEdit,
  radius = 8,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDelete: () => void;
  onEdit?: () => void;
  radius?: number;
  children: React.ReactNode;
}) {
  const x = useRef(new Animated.Value(0)).current;
  const {width} = useWindowDimensions();
  const latest = useRef({open, onOpenChange, onDelete, onEdit, width});
  latest.current = {open, onOpenChange, onDelete, onEdit, width};
  const base = useRef(0);

  const settle = (to: number) =>
    Animated.timing(x, {toValue: to, duration: 160, useNativeDriver: true}).start();

  useEffect(() => {
    settle(open ? -REVEAL : 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const responder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_event, gesture) =>
        Math.abs(gesture.dx) > 10 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.6,
      onPanResponderGrant: () => {
        x.stopAnimation(value => {
          base.current = value;
        });
      },
      onPanResponderMove: (_event, gesture) => {
        const min = -(REVEAL + 140);
        const max = latest.current.onEdit ? REVEAL + 60 : 0;
        x.setValue(Math.max(min, Math.min(max, base.current + gesture.dx)));
      },
      onPanResponderRelease: (_event, gesture) => {
        const {
          open: isOpen,
          onOpenChange: setOpen,
          onDelete: remove,
          onEdit: edit,
        } = latest.current;
        if (gesture.dx < -TRIGGER) {
          if (isOpen) {
            // second swipe: slide the tile away, then delete
            Animated.timing(x, {
              toValue: -latest.current.width,
              duration: 160,
              useNativeDriver: true,
            }).start(() => remove());
          } else {
            setOpen(true);
          }
        } else if (gesture.dx > TRIGGER) {
          if (isOpen) {
            setOpen(false);
          } else if (edit) {
            settle(0);
            edit();
          } else {
            settle(0);
          }
        } else {
          settle(isOpen ? -REVEAL : 0);
        }
      },
      onPanResponderTerminate: () => settle(latest.current.open ? -REVEAL : 0),
    }),
  ).current;

  return (
    <View>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.layer,
          styles.bin,
          {
            borderRadius: radius,
            opacity: x.interpolate({
              inputRange: [-6, 0],
              outputRange: [1, 0],
              extrapolate: 'clamp',
            }),
          },
        ]}>
        <View style={styles.binIcon}>
          <Icon name="symbolDelete" size={28} color="#b4443b" />
        </View>
      </Animated.View>
      {onEdit ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.layer,
            styles.edit,
            {
              borderRadius: radius,
              opacity: x.interpolate({
                inputRange: [0, 6],
                outputRange: [0, 1],
                extrapolate: 'clamp',
              }),
            },
          ]}>
          <View style={styles.editIcon}>
            <Icon name="symbolEdit" size={26} color="#226fb8" />
          </View>
        </Animated.View>
      ) : null}
      <Animated.View style={{transform: [{translateX: x}]}} {...responder.panHandlers}>
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFill as object,
    justifyContent: 'center',
  },
  bin: {
    backgroundColor: '#fde4e1',
    alignItems: 'flex-end',
  },
  edit: {
    backgroundColor: '#dce9fb',
    alignItems: 'flex-start',
  },
  binIcon: {
    width: REVEAL,
    alignItems: 'center',
  },
  editIcon: {
    width: REVEAL,
    alignItems: 'center',
  },
});
