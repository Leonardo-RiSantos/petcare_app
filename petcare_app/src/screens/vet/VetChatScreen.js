import { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput,
  TouchableOpacity, KeyboardAvoidingView, Platform,
  ActivityIndicator, Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { sendPushToUser } from '../../utils/pushService';

export default function VetChatScreen({ route, navigation }) {
  const { petId, petName, tutorId } = route.params || {};
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const listRef = useRef(null);

  useEffect(() => {
    if (!petId) return;
    navigation.setOptions({ title: `Chat — ${petName || 'Paciente'}` });
    loadMessages();

    const channel = supabase
      .channel(`chat:${petId}:${user.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'vet_chat_messages',
        filter: `pet_id=eq.${petId}`,
      }, (payload) => {
        setMessages(prev => [...prev, payload.new]);
        setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [petId]);

  const loadMessages = async () => {
    const { data } = await supabase
      .from('vet_chat_messages')
      .select('*')
      .eq('vet_id', user.id)
      .eq('pet_id', petId)
      .order('created_at', { ascending: true });
    if (data) setMessages(data);
    setLoading(false);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 100);

    // Marca mensagens do tutor como lidas
    await supabase.from('vet_chat_messages')
      .update({ read_at: new Date().toISOString() })
      .eq('vet_id', user.id).eq('pet_id', petId)
      .eq('sender_role', 'tutor').is('read_at', null);
  };

  const sendMessage = async () => {
    const content = text.trim();
    if (!content || sending) return;
    setSending(true);
    setText('');
    const { error } = await supabase.from('vet_chat_messages').insert({
      vet_id: user.id,
      pet_id: petId,
      sender_id: user.id,
      sender_role: 'vet',
      content,
    });
    if (!error && tutorId) {
      sendPushToUser(tutorId, {
        title: `Mensagem do veterinário`,
        body: content,
        data: { type: 'chat', petId },
      });
    }
    setSending(false);
  };

  const renderMessage = ({ item }) => {
    const isMe = item.sender_role === 'vet';
    const time = new Date(item.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    return (
      <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
        <Text style={[styles.bubbleText, isMe && styles.bubbleTextMe]}>{item.content}</Text>
        <Text style={[styles.bubbleTime, isMe && { color: 'rgba(255,255,255,0.65)' }]}>{time}</Text>
      </View>
    );
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color="#0EA5E9" /></View>;

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={90}>
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={i => i.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Image source={require('../../../assets/icon_medical.png')} style={{ width: 48, height: 48, opacity: 0.2, marginBottom: 12 }} resizeMode="contain" />
            <Text style={styles.emptyText}>Nenhuma mensagem ainda</Text>
            <Text style={styles.emptySub}>Inicie a conversa com o tutor de {petName}</Text>
          </View>
        }
      />
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="Digite uma mensagem..."
          placeholderTextColor="#9CA3AF"
          multiline
          maxLength={500}
        />
        <TouchableOpacity onPress={sendMessage} disabled={!text.trim() || sending} style={styles.sendBtn} activeOpacity={0.8}>
          <LinearGradient colors={['#0284C7', '#0EA5E9']} style={styles.sendBtnGrad}>
            {sending
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={styles.sendBtnTxt}>›</Text>}
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F9FF' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: 16, paddingBottom: 8, flexGrow: 1, justifyContent: 'flex-end' },

  bubble: {
    maxWidth: '78%', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10,
    marginBottom: 8,
  },
  bubbleMe: {
    alignSelf: 'flex-end',
    backgroundColor: '#0EA5E9',
    borderBottomRightRadius: 4,
  },
  bubbleThem: {
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
    borderBottomLeftRadius: 4,
    borderWidth: 1, borderColor: '#E0F2FE',
  },
  bubbleText: { fontSize: 15, color: '#1E293B', lineHeight: 21 },
  bubbleTextMe: { color: '#fff' },
  bubbleTime: { fontSize: 10, color: '#94A3B8', marginTop: 4, alignSelf: 'flex-end' },

  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyText: { fontSize: 15, fontWeight: '700', color: '#94A3B8', marginBottom: 4 },
  emptySub: { fontSize: 13, color: '#BAE6FD', textAlign: 'center' },

  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 10,
    padding: 12, backgroundColor: '#fff',
    borderTopWidth: 1, borderTopColor: '#E0F2FE',
  },
  input: {
    flex: 1, backgroundColor: '#F8FAFC', borderRadius: 22,
    paddingHorizontal: 16, paddingVertical: 10, fontSize: 15,
    borderWidth: 1.5, borderColor: '#E0F2FE', color: '#1E293B',
    maxHeight: 100,
  },
  sendBtn: { borderRadius: 22, overflow: 'hidden', flexShrink: 0 },
  sendBtnGrad: { width: 46, height: 46, justifyContent: 'center', alignItems: 'center' },
  sendBtnTxt: { color: '#fff', fontSize: 24, fontWeight: '300', lineHeight: 28 },
});
