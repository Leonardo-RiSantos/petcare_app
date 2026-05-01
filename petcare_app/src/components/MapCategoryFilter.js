import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { CATEGORY_CONFIG } from '../services/placesService';

const ALL = { label: 'Todos', emoji: '🗺️', color: '#0EA5E9', bg: '#EFF6FF' };

const FILTERS = [
  { key: 'all', ...ALL },
  ...Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => ({ key, ...cfg })),
];

export default function MapCategoryFilter({ selected, onSelect, counts = {} }) {
  return (
    <View style={styles.wrapper} pointerEvents="box-none">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        pointerEvents="auto"
      >
        {FILTERS.map(f => {
          const active = selected === f.key;
          const count  = f.key === 'all'
            ? Object.values(counts).reduce((a, b) => a + b, 0)
            : (counts[f.key] ?? 0);

          return (
            <TouchableOpacity
              key={f.key}
              style={[styles.chip, active && { backgroundColor: f.color, borderColor: f.color }]}
              onPress={() => onSelect(f.key)}
              activeOpacity={0.8}
            >
              <Text style={styles.chipEmoji}>{f.emoji}</Text>
              <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{f.label}</Text>
              {count > 0 && (
                <View style={[styles.countBadge, active && styles.countBadgeActive]}>
                  <Text style={[styles.countText, active && styles.countTextActive]}>{count}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 14, left: 0, right: 0, zIndex: 10 },
  row: { paddingHorizontal: 16, gap: 8, paddingVertical: 2 },

  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#fff', borderRadius: 22,
    paddingHorizontal: 14, paddingVertical: 9,
    borderWidth: 1.5, borderColor: '#E0F2FE',
    shadowColor: '#0EA5E9', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, shadowRadius: 6, elevation: 3,
  },
  chipEmoji: { fontSize: 15 },
  chipLabel: { fontSize: 13, fontWeight: '700', color: '#374151' },
  chipLabelActive: { color: '#fff' },
  countBadge: {
    backgroundColor: '#EFF6FF', borderRadius: 20,
    minWidth: 20, height: 20, paddingHorizontal: 5,
    justifyContent: 'center', alignItems: 'center',
  },
  countBadgeActive: { backgroundColor: 'rgba(255,255,255,0.25)' },
  countText: { fontSize: 10, fontWeight: '800', color: '#0EA5E9' },
  countTextActive: { color: '#fff' },
});
