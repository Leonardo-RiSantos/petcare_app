import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Modal, ScrollView, Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const MONTHS = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
];
const DAYS  = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0'));
const YEARS = Array.from({ length: 35 }, (_, i) => String(new Date().getFullYear() - i));

const fmtDateInput = (text) => {
  const d = text.replace(/\D/g, '').slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
};

// Converte DD/MM/AAAA → {day, month (0-based), year}
function parseToState(ddmmyyyy) {
  const m = ddmmyyyy?.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return { day: m[1], month: parseInt(m[2], 10) - 1, year: m[3] };
  const today = new Date();
  return { day: '01', month: today.getMonth(), year: String(today.getFullYear()) };
}

function SelectColumn({ items, selected, onSelect, renderLabel }) {
  return (
    <ScrollView
      style={styles.colScroll}
      showsVerticalScrollIndicator={false}
    >
      {items.map((item) => {
        const isSelected = item === selected;
        return (
          <TouchableOpacity
            key={item}
            onPress={() => onSelect(item)}
            style={[styles.colItem, isSelected && styles.colItemSelected]}
            activeOpacity={0.7}
          >
            <Text style={[styles.colText, isSelected && styles.colTextSelected]}>
              {renderLabel ? renderLabel(item) : item}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const ICON_CALENDAR = require('../../assets/icon_calendar.png');
const ICON_BIRTHDAY = require('../../assets/icon_birthday.png');

export default function DatePickerInput({
  value = '',
  onChangeText,
  placeholder = 'DD/MM/AAAA',
  label,
  style,
  isBirthDate = false,
}) {
  const [showPicker, setShowPicker] = useState(false);
  const initial = parseToState(value);
  const [selDay,   setSelDay]   = useState(initial.day);
  const [selMonth, setSelMonth] = useState(initial.month);
  const [selYear,  setSelYear]  = useState(initial.year);

  const openPicker = () => {
    const s = parseToState(value);
    setSelDay(s.day);
    setSelMonth(s.month);
    setSelYear(s.year);
    setShowPicker(true);
  };

  const confirm = () => {
    const mm = String(selMonth + 1).padStart(2, '0');
    onChangeText?.(`${selDay}/${mm}/${selYear}`);
    setShowPicker(false);
  };

  return (
    <>
      {/* Campo com botão de calendário */}
      <View style={[styles.fieldRow, style]}>
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor="#9CA3AF"
          value={value}
          onChangeText={v => onChangeText?.(fmtDateInput(v))}
          keyboardType="numeric"
          maxLength={10}
        />
        <TouchableOpacity style={styles.calBtn} onPress={openPicker} activeOpacity={0.8}>
          <LinearGradient colors={['#0EA5E9', '#38BDF8']} style={styles.calBtnGrad}>
            <Image
              source={isBirthDate ? ICON_BIRTHDAY : ICON_CALENDAR}
              style={{ width: isBirthDate ? 18 : 22, height: isBirthDate ? 18 : 22 }}
              resizeMode="contain"
            />
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Modal picker */}
      <Modal visible={showPicker} transparent animationType="slide" onRequestClose={() => setShowPicker(false)}>
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={() => setShowPicker(false)}
        >
          <TouchableOpacity activeOpacity={1} onPress={() => {}}>
            <View style={styles.sheet}>
              {/* Handle */}
              <View style={styles.handle} />

              <Text style={styles.sheetTitle}>{label || 'Selecionar data'}</Text>

              <View style={styles.columns}>
                {/* Dia */}
                <View style={styles.colWrap}>
                  <Text style={styles.colHeader}>Dia</Text>
                  <SelectColumn
                    items={DAYS}
                    selected={selDay}
                    onSelect={setSelDay}
                  />
                </View>

                {/* Mês */}
                <View style={[styles.colWrap, { flex: 2 }]}>
                  <Text style={styles.colHeader}>Mês</Text>
                  <SelectColumn
                    items={MONTHS.map((_, i) => String(i))}
                    selected={String(selMonth)}
                    onSelect={v => setSelMonth(parseInt(v, 10))}
                    renderLabel={v => MONTHS[parseInt(v, 10)]}
                  />
                </View>

                {/* Ano */}
                <View style={styles.colWrap}>
                  <Text style={styles.colHeader}>Ano</Text>
                  <SelectColumn
                    items={YEARS}
                    selected={selYear}
                    onSelect={setSelYear}
                  />
                </View>
              </View>

              {/* Confirmar */}
              <TouchableOpacity style={styles.confirmWrap} onPress={confirm}>
                <LinearGradient
                  colors={['#0EA5E9', '#38BDF8']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={styles.confirmBtn}
                >
                  <Text style={styles.confirmText}>Confirmar</Text>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowPicker(false)}>
                <Text style={styles.cancelText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fieldRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: {
    flex: 1,
    backgroundColor: '#fff', borderRadius: 14,
    paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 15, borderWidth: 1.5, borderColor: '#E0F2FE', color: '#1E293B',
  },
  calBtn: { borderRadius: 14, overflow: 'hidden', flexShrink: 0 },
  calBtnGrad: { width: 50, height: 50, justifyContent: 'center', alignItems: 'center' },

  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40,
  },
  handle: {
    width: 44, height: 5, borderRadius: 3,
    backgroundColor: '#E2E8F0', alignSelf: 'center', marginBottom: 18,
  },
  sheetTitle: { fontSize: 17, fontWeight: '800', color: '#1E293B', textAlign: 'center', marginBottom: 20 },

  columns: { flexDirection: 'row', gap: 8, height: 200 },
  colWrap: { flex: 1 },
  colHeader: {
    fontSize: 11, fontWeight: '700', color: '#94A3B8',
    textAlign: 'center', letterSpacing: 0.5, marginBottom: 8,
  },
  colScroll: { flex: 1 },
  colItem: {
    paddingVertical: 10, paddingHorizontal: 4,
    borderRadius: 10, marginBottom: 2,
    alignItems: 'center',
  },
  colItemSelected: { backgroundColor: '#EFF6FF' },
  colText: { fontSize: 14, color: '#64748B', fontWeight: '500', textAlign: 'center' },
  colTextSelected: { color: '#0EA5E9', fontWeight: '800' },

  confirmWrap: { borderRadius: 14, overflow: 'hidden', marginTop: 20, marginBottom: 10 },
  confirmBtn: { paddingVertical: 15, alignItems: 'center' },
  confirmText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  cancelBtn: { alignItems: 'center', paddingVertical: 8 },
  cancelText: { fontSize: 14, color: '#94A3B8', fontWeight: '600' },
});
