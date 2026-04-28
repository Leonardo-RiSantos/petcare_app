import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useAuth } from '../../context/AuthContext';

export default function DashboardScreen({ navigation }) {
  const { user, signOut } = useAuth();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.greeting}>Olá, tutor! 🐾</Text>
        <Text style={styles.subtitle}>Tudo organizado em um só lugar</Text>
      </View>

      <View style={styles.vaccineSection}>
        <Text style={styles.sectionTitle}>Status das Vacinas</Text>
        <View style={styles.vaccineCards}>
          <View style={[styles.vaccineCard, styles.vaccineOk]}>
            <Text style={styles.vaccineIcon}>✅</Text>
            <Text style={styles.vaccineCount}>0</Text>
            <Text style={styles.vaccineLabel}>Em dia</Text>
          </View>
          <View style={[styles.vaccineCard, styles.vaccineWarn]}>
            <Text style={styles.vaccineIcon}>⚠️</Text>
            <Text style={styles.vaccineCount}>0</Text>
            <Text style={styles.vaccineLabel}>Vencendo</Text>
          </View>
          <View style={[styles.vaccineCard, styles.vaccineLate]}>
            <Text style={styles.vaccineIcon}>❌</Text>
            <Text style={styles.vaccineCount}>0</Text>
            <Text style={styles.vaccineLabel}>Atrasadas</Text>
          </View>
        </View>
      </View>

      <View style={styles.petsSection}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Meus Pets</Text>
          <TouchableOpacity onPress={() => navigation.navigate('AddPet')}>
            <Text style={styles.addButton}>+ Adicionar</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>🐶🐱</Text>
          <Text style={styles.emptyText}>Nenhum pet cadastrado ainda</Text>
          <Text style={styles.emptySubtext}>Adicione seu primeiro pet para começar!</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F9FF' },
  content: { padding: 20, paddingBottom: 40 },
  header: { marginBottom: 24 },
  greeting: { fontSize: 24, fontWeight: '700', color: '#1E293B' },
  subtitle: { fontSize: 14, color: '#64748B', marginTop: 4 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#1E293B', marginBottom: 12 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  addButton: { color: '#0EA5E9', fontWeight: '600', fontSize: 14 },
  vaccineSection: { marginBottom: 24 },
  vaccineCards: { flexDirection: 'row', gap: 10 },
  vaccineCard: {
    flex: 1, borderRadius: 12, padding: 14, alignItems: 'center',
    borderWidth: 1,
  },
  vaccineOk: { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' },
  vaccineWarn: { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' },
  vaccineLate: { backgroundColor: '#FFF1F2', borderColor: '#FECDD3' },
  vaccineIcon: { fontSize: 22, marginBottom: 4 },
  vaccineCount: { fontSize: 22, fontWeight: '700', color: '#1E293B' },
  vaccineLabel: { fontSize: 11, color: '#64748B', marginTop: 2 },
  petsSection: { marginBottom: 24 },
  emptyState: { backgroundColor: '#fff', borderRadius: 16, padding: 32, alignItems: 'center' },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 16, fontWeight: '600', color: '#1E293B', marginBottom: 4 },
  emptySubtext: { fontSize: 13, color: '#94A3B8', textAlign: 'center' },
});
