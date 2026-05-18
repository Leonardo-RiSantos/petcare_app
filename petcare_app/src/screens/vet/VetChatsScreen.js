import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Image, TextInput,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

const SPECIES_IMAGES = {
  Cachorro: require('../../../assets/pet_cachorro.png'),
  Gato:     require('../../../assets/pet_gato.png'),
  Ave:      require('../../../assets/pet_ave.png'),
  Coelho:   require('../../../assets/pet_coelho.png'),
  Hamster:  require('../../../assets/pet_hamster.png'),
  Réptil:   require('../../../assets/pet_reptil.png'),
  Peixe:    require('../../../assets/pet_peixe.png'),
};

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = (Date.now() - new Date(dateStr)) / 1000;
  if (diff < 60)    return 'agora';
  if (diff < 3600)  return `${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

export default function VetChatsScreen({ navigation }) {
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [search,        setSearch]        = useState('');

  const fetchConversations = async () => {
    // Busca todas as mensagens distintas por (vet_id, pet_id), com JOIN em pets e profiles
    const { data: msgs } = await supabase
      .from('vet_chat_messages')
      .select('pet_id, sender_role, content, created_at, read_at, pets(id, name, species, photo_url, user_id)')
      .eq('vet_id', user.id)
      .order('created_at', { ascending: false });

    if (!msgs) { setLoading(false); return; }

    // Agrupa por pet_id, mantendo a última mensagem e contagem de não lidas
    const byPet = {};
    msgs.forEach(m => {
      if (!byPet[m.pet_id]) {
        byPet[m.pet_id] = {
          petId:       m.pet_id,
          petName:     m.pets?.name || 'Pet',
          petSpecies:  m.pets?.species || '',
          petPhoto:    m.pets?.photo_url || null,
          tutorId:     m.pets?.user_id || null,
          lastMessage: m.content,
          lastTime:    m.created_at,
          unread:      0,
        };
      }
      // Conta não lidas do tutor (que o vet ainda não leu)
      if (m.sender_role === 'tutor' && !m.read_at) {
        byPet[m.pet_id].unread += 1;
      }
    });

    // Busca nome dos tutores
    const tutorIds = [...new Set(Object.values(byPet).map(c => c.tutorId).filter(Boolean))];
    let tutorMap = {};
    if (tutorIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', tutorIds);
      (profiles || []).forEach(p => { tutorMap[p.id] = p.full_name; });
    }

    const list = Object.values(byPet).map(c => ({
      ...c,
      tutorName: tutorMap[c.tutorId] || 'Tutor',
    })).sort((a, b) => new Date(b.lastTime) - new Date(a.lastTime));

    setConversations(list);
    setLoading(false);
  };

  useFocusEffect(useCallback(() => { fetchConversations(); }, []));

  const filtered = conversations.filter(c => {
    const q = search.toLowerCase();
    return !q || c.petName.toLowerCase().includes(q) || c.tutorName.toLowerCase().includes(q);
  });

  const totalUnread = conversations.reduce((s, c) => s + c.unread, 0);

  const renderItem = ({ item }) => {
    const speciesImg = SPECIES_IMAGES[item.petSpecies];
    return (
      <TouchableOpacity
        style={[styles.card, item.unread > 0 && styles.cardUnread]}
        onPress={() => navigation.navigate('VetChat', {
          petId:    item.petId,
          petName:  item.petName,
          tutorId:  item.tutorId,
        })}
        activeOpacity={0.78}
      >
        {/* Avatar */}
        {item.petPhoto ? (
          <Image source={{ uri: item.petPhoto }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            {speciesImg
              ? <Image source={speciesImg} style={{ width: 26, height: 26 }} resizeMode="contain" />
              : <Text style={{ fontSize: 20 }}>🐾</Text>}
          </View>
        )}

        {/* Info */}
        <View style={styles.info}>
          <View style={styles.infoTop}>
            <Text style={[styles.petName, item.unread > 0 && styles.petNameUnread]} numberOfLines={1}>
              {item.petName}
            </Text>
            <Text style={styles.time}>{timeAgo(item.lastTime)}</Text>
          </View>
          <Text style={styles.tutorName}>👤 {item.tutorName}</Text>
          <Text style={[styles.lastMsg, item.unread > 0 && styles.lastMsgUnread]} numberOfLines={1}>
            {item.lastMessage}
          </Text>
        </View>

        {/* Badge não lido */}
        {item.unread > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeTxt}>{item.unread}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#0EA5E9" /></View>;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>💬 Conversas</Text>
          {totalUnread > 0 && (
            <Text style={styles.headerSub}>{totalUnread} mensagem{totalUnread > 1 ? 'ns' : ''} não lida{totalUnread > 1 ? 's' : ''}</Text>
          )}
        </View>
      </View>

      {/* Busca */}
      <View style={styles.searchWrap}>
        <TextInput
          style={styles.search}
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar por pet ou tutor..."
          placeholderTextColor="#9CA3AF"
        />
      </View>

      {filtered.length === 0 ? (
        <View style={styles.empty}>
          <Text style={{ fontSize: 40, marginBottom: 12 }}>💬</Text>
          <Text style={styles.emptyTitle}>
            {search ? 'Nenhuma conversa encontrada' : 'Nenhuma conversa ainda'}
          </Text>
          <Text style={styles.emptySub}>
            {search ? 'Tente outro nome' : 'As mensagens dos tutores aparecerão aqui'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={i => i.petId}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F9FF' },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: {
    backgroundColor: '#fff', paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: '#E2E8F0',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  headerTitle: { fontSize: 20, fontWeight: '900', color: '#1E293B' },
  headerSub:   { fontSize: 12, color: '#0EA5E9', fontWeight: '600', marginTop: 2 },

  searchWrap: { paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  search: {
    backgroundColor: '#F8FAFC', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 14, borderWidth: 1.5, borderColor: '#E0F2FE', color: '#1E293B',
  },

  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#fff', marginHorizontal: 12, marginTop: 10,
    borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#E0F2FE',
  },
  cardUnread: { borderColor: '#BAE6FD', backgroundColor: '#F0F9FF' },

  avatar: { width: 52, height: 52, borderRadius: 26, flexShrink: 0 },
  avatarPlaceholder: {
    width: 52, height: 52, borderRadius: 26, backgroundColor: '#DBEAFE',
    justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },

  info: { flex: 1, minWidth: 0 },
  infoTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  petName:       { fontSize: 15, fontWeight: '700', color: '#1E293B', flex: 1 },
  petNameUnread: { fontWeight: '900', color: '#0284C7' },
  time:          { fontSize: 11, color: '#94A3B8', flexShrink: 0, marginLeft: 8 },
  tutorName:     { fontSize: 11, color: '#0EA5E9', fontWeight: '600', marginBottom: 3 },
  lastMsg:       { fontSize: 13, color: '#94A3B8' },
  lastMsgUnread: { color: '#1E293B', fontWeight: '600' },

  badge: {
    width: 22, height: 22, borderRadius: 11, backgroundColor: '#0EA5E9',
    justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  badgeTxt: { fontSize: 11, color: '#fff', fontWeight: '900' },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: '#94A3B8', marginBottom: 6, textAlign: 'center' },
  emptySub:   { fontSize: 13, color: '#BAE6FD', textAlign: 'center' },
});
