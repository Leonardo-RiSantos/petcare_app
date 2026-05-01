import { useState, useRef, useCallback } from 'react';
import { useNavigation } from '@react-navigation/native';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator,
  SafeAreaView, Image,
} from 'react-native';
import { supabase } from '../../lib/supabase';

const FRED_URL = 'https://wqabzvataiellbttoojn.supabase.co/functions/v1/fred-chat';

const FRED_IMG = require('../../../assets/icon_fred.png');

const QUICK_QUESTIONS = [
  'Como estão as vacinas dos meus pets?',
  'Tem algum alerta importante hoje?',
  'Como está o peso do meu pet?',
  'Quanto gastei este mês?',
];

function Message({ item }) {
  const isFred = item.role === 'assistant';
  return (
    <View style={[styles.msgRow, isFred ? styles.msgRowFred : styles.msgRowUser]}>
      {isFred && (
        <View style={styles.fredAvatar}>
          <Image source={FRED_IMG} style={{ width: 26, height: 26 }} resizeMode="contain" />
        </View>
      )}
      <View style={[styles.bubble, isFred ? styles.bubbleFred : styles.bubbleUser]}>
        <Text style={[styles.bubbleText, isFred ? styles.bubbleTextFred : styles.bubbleTextUser]}>
          {item.content}
        </Text>
      </View>
    </View>
  );
}

function TypingIndicator() {
  return (
    <View style={styles.msgRow}>
      <View style={styles.fredAvatar}>
        <Image source={FRED_IMG} style={{ width: 26, height: 26 }} resizeMode="contain" />
      </View>
      <View style={[styles.bubble, styles.bubbleFred, styles.typingBubble]}>
        <Text style={styles.typingDots}>• • •</Text>
      </View>
    </View>
  );
}

export default function FredScreen() {
  const navigation = useNavigation();
  const [messages, setMessages] = useState([
    {
      id: '0',
      role: 'assistant',
      content: 'Oi! Eu sou o Fred 🐾 Posso te ajudar com informações sobre seus pets, vacinas, peso e muito mais. Como posso te ajudar hoje?',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const listRef = useRef(null);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  }, []);

  const sendMessage = useCallback(async (text) => {
    const userText = (text || input).trim();
    if (!userText || loading) return;

    const userMsg = { id: Date.now().toString(), role: 'user', content: userText };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setLoading(true);
    scrollToBottom();

    try {
      const { data: { session } } = await supabase.auth.getSession();

      const history = newMessages.slice(1, -1).map(m => ({
        role: m.role,
        content: m.content,
      }));

      const res = await fetch(FRED_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ message: userText, history }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Servidor retornou ${res.status}: ${errText}`);
      }

      const data = await res.json();
      const fredMsg = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.reply || 'Não consegui processar sua mensagem. Tente novamente.',
      };
      setMessages(prev => [...prev, fredMsg]);
      scrollToBottom();
    } catch (e) {
      setMessages(prev => [
        ...prev,
        { id: Date.now().toString(), role: 'assistant', content: `Ops, algo deu errado: ${e?.message || 'erro desconhecido'}` },
      ]);
    } finally {
      setLoading(false);
    }
  }, [input, messages, loading, scrollToBottom]);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerAvatar}>
          <Image source={FRED_IMG} style={{ width: 36, height: 36 }} resizeMode="contain" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerName}>Fred</Text>
          <Text style={styles.headerSub}>Assistente PetCare+</Text>
        </View>
        <View style={styles.onlineIndicator} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={90}
      >
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={item => item.id}
          renderItem={({ item }) => <Message item={item} />}
          contentContainerStyle={styles.messagesList}
          onContentSizeChange={scrollToBottom}
          ListFooterComponent={loading ? <TypingIndicator /> : null}
        />

        {messages.length <= 1 && !loading && (
          <View style={styles.quickWrap}>
            <Text style={styles.quickLabel}>Perguntas rápidas</Text>
            <View style={styles.quickRow}>
              {QUICK_QUESTIONS.map(q => (
                <TouchableOpacity key={q} style={styles.quickChip} onPress={() => sendMessage(q)}>
                  <Text style={styles.quickChipText}>{q}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="Digite sua dúvida..."
            placeholderTextColor="#9CA3AF"
            value={input}
            onChangeText={setInput}
            multiline
            maxLength={500}
            onSubmitEditing={() => sendMessage()}
            returnKeyType="send"
            editable={!loading}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!input.trim() || loading) && styles.sendBtnDisabled]}
            onPress={() => sendMessage()}
            disabled={!input.trim() || loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.sendIcon}>➤</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F9FF' },

  header: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    paddingHorizontal: 16, paddingVertical: 12, gap: 12,
    borderBottomWidth: 1, borderBottomColor: '#E2E8F0',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  backBtn: { padding: 4, marginRight: 4 },
  backIcon: { fontSize: 22, color: '#0EA5E9' },
  headerAvatar: {
    width: 46, height: 46, borderRadius: 23, backgroundColor: '#FEF9C3',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: '#FDE68A',
  },
  headerName: { fontSize: 16, fontWeight: '700', color: '#1E293B' },
  headerSub: { fontSize: 12, color: '#94A3B8' },
  onlineIndicator: {
    width: 9, height: 9, borderRadius: 5, backgroundColor: '#10B981',
  },

  messagesList: { padding: 16, paddingBottom: 8 },

  msgRow: { flexDirection: 'row', marginBottom: 12, alignItems: 'flex-end', gap: 8 },
  msgRowFred: { justifyContent: 'flex-start' },
  msgRowUser: { justifyContent: 'flex-end' },

  fredAvatar: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: '#FEF9C3',
    justifyContent: 'center', alignItems: 'center', flexShrink: 0,
    borderWidth: 1.5, borderColor: '#FDE68A',
  },

  bubble: { maxWidth: '78%', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleFred: {
    backgroundColor: '#fff', borderBottomLeftRadius: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 3, elevation: 1,
  },
  bubbleUser: { backgroundColor: '#0EA5E9', borderBottomRightRadius: 4 },
  bubbleText: { fontSize: 15, lineHeight: 21 },
  bubbleTextFred: { color: '#1E293B' },
  bubbleTextUser: { color: '#fff' },

  typingBubble: { paddingVertical: 14 },
  typingDots: { fontSize: 18, color: '#94A3B8', letterSpacing: 3 },

  quickWrap: { paddingHorizontal: 16, paddingBottom: 8 },
  quickLabel: { fontSize: 12, color: '#94A3B8', fontWeight: '600', marginBottom: 8 },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  quickChip: {
    backgroundColor: '#EFF6FF', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7,
    borderWidth: 1, borderColor: '#BAE6FD',
  },
  quickChipText: { fontSize: 13, color: '#0EA5E9', fontWeight: '500' },

  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 10,
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#E2E8F0',
  },
  input: {
    flex: 1, backgroundColor: '#F8FAFC', borderRadius: 22,
    paddingHorizontal: 16, paddingVertical: 10, fontSize: 15,
    maxHeight: 100, color: '#1E293B', borderWidth: 1, borderColor: '#E2E8F0',
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#0EA5E9',
    justifyContent: 'center', alignItems: 'center',
  },
  sendBtnDisabled: { backgroundColor: '#BAE6FD' },
  sendIcon: { color: '#fff', fontSize: 16 },
});
