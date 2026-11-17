import React, {useState} from 'react';
import {FlatList, Modal, Pressable, StyleSheet, Text, View} from 'react-native';

export type DropdownOption = {value: string; label: string};

/** Simple dropdown: a field with the current choice that opens a list in a bottom sheet. */
export function Dropdown({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string | null;
  options: DropdownOption[];
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find(option => option.value === value);

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        style={styles.field}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${current?.label ?? 'not set'}`}>
        <Text style={styles.value} numberOfLines={1}>
          {current?.label ?? 'Choose…'}
        </Text>
        <Text style={styles.caret}>▾</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>{label}</Text>
          <FlatList
            data={options}
            keyExtractor={option => option.value}
            renderItem={({item}) => (
              <Pressable
                style={[styles.option, item.value === value && styles.optionActive]}
                onPress={() => {
                  setOpen(false);
                  onChange(item.value);
                }}
                accessibilityRole="button"
                accessibilityLabel={item.label}>
                <Text style={styles.optionText}>{item.label}</Text>
                {item.value === value && <Text style={styles.check}>✓</Text>}
              </Pressable>
            )}
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 4,
  },
  label: {
    color: '#697782',
    fontSize: 13,
    fontWeight: '600',
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#c8d8e8',
    backgroundColor: '#ffffff',
  },
  value: {
    flex: 1,
    color: '#1f2d38',
    fontSize: 16,
  },
  caret: {
    color: '#697782',
    fontSize: 16,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  sheet: {
    maxHeight: '60%',
    paddingTop: 14,
    paddingBottom: 24,
    paddingHorizontal: 16,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    backgroundColor: '#ffffff',
  },
  sheetTitle: {
    fontFamily: 'sans-serif-condensed',
    color: '#1f2d38',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 46,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  optionActive: {
    backgroundColor: '#eaf7f1',
  },
  optionText: {
    flex: 1,
    color: '#1f2d38',
    fontSize: 16,
  },
  check: {
    color: '#126b46',
    fontSize: 18,
    fontWeight: '700',
  },
});
