import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: false,
      shouldSetBadge: true,
    }),
  });
}

export async function requestNotificationPermission() {
  if (Platform.OS === 'web') return false;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

async function cancelByIdentifier(prefix) {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const n of scheduled) {
    if (n.identifier.startsWith(prefix)) {
      await Notifications.cancelScheduledNotificationAsync(n.identifier);
    }
  }
}

// Agenda uma notificação para amanhã às 9h com deduplicação por ID
async function scheduleAt9h(identifier, title, body, daysFromNow = 1, data = {}) {
  const trigger = new Date();
  trigger.setDate(trigger.getDate() + daysFromNow);
  trigger.setHours(9, 0, 0, 0);
  if (trigger <= new Date()) return;

  await Notifications.scheduleNotificationAsync({
    identifier,
    content: { title, body, data },
    trigger: { date: trigger },
  });
}

// ── Aniversários ──────────────────────────────────────────────
export async function scheduleBirthdayNotifications(pets) {
  if (Platform.OS === 'web') return;
  const granted = await requestNotificationPermission();
  if (!granted) return;
  await cancelByIdentifier('birthday_');

  const today = new Date();
  for (const pet of pets) {
    if (!pet.birth_date) continue;
    const birth = new Date(pet.birth_date);
    const next = new Date(today.getFullYear(), birth.getMonth(), birth.getDate());
    if (next <= today) next.setFullYear(today.getFullYear() + 1);
    const daysUntil = Math.ceil((next - today) / (1000 * 60 * 60 * 24));

    const alerts = [
      { days: 15, msg: `Faltam 15 dias para o aniversário de ${pet.name}! Já pensou na celebração?` },
      { days: 7,  msg: `Uma semana para o aniversário de ${pet.name}! Prepare a festa!` },
      { days: 1,  msg: `Amanhã é aniversário de ${pet.name}! Não esqueça de comemorar.` },
      { days: 0,  msg: `Hoje é o aniversário de ${pet.name}! Parabéns ao seu melhor amigo!` },
    ];

    for (const alert of alerts) {
      if (daysUntil > alert.days) {
        const triggerDate = new Date(next);
        triggerDate.setDate(next.getDate() - alert.days);
        triggerDate.setHours(9, 0, 0, 0);
        if (triggerDate > today) {
          await Notifications.scheduleNotificationAsync({
            identifier: `birthday_${pet.id}_${alert.days}`,
            content: {
              title: 'PetCare+ — Aniversário',
              body: alert.msg,
              data: { type: 'birthday', petId: pet.id },
            },
            trigger: { date: triggerDate },
          });
        }
      }
    }
  }
}

// ── Vacinas ───────────────────────────────────────────────────
export async function scheduleVaccineNotifications(vaccines, pets) {
  if (Platform.OS === 'web') return;
  const granted = await requestNotificationPermission();
  if (!granted) return;
  await cancelByIdentifier('vaccine_');

  const today = new Date();
  for (const vaccine of vaccines) {
    if (!vaccine.next_dose_date) continue;
    const nextDose = new Date(vaccine.next_dose_date);
    const daysUntil = Math.ceil((nextDose - today) / (1000 * 60 * 60 * 24));
    const pet = pets.find(p => p.id === vaccine.pet_id);
    const petName = pet?.name || 'seu pet';

    const alerts = [
      { days: 30, msg: `A vacina ${vaccine.name} de ${petName} vence em 30 dias. Agende com o veterinário.` },
      { days: 7,  msg: `A vacina ${vaccine.name} de ${petName} vence em 7 dias! Não esqueça de renovar.` },
      { days: 0,  msg: `Hoje vence a vacina ${vaccine.name} de ${petName}. Contate o veterinário.` },
    ];

    for (const alert of alerts) {
      if (daysUntil > alert.days) {
        const triggerDate = new Date(nextDose);
        triggerDate.setDate(nextDose.getDate() - alert.days);
        triggerDate.setHours(9, 0, 0, 0);
        if (triggerDate > today) {
          await Notifications.scheduleNotificationAsync({
            identifier: `vaccine_${vaccine.id}_${alert.days}`,
            content: {
              title: 'PetCare+ — Vacina',
              body: alert.msg,
              data: { type: 'vaccine', vaccineId: vaccine.id, petId: vaccine.pet_id },
            },
            trigger: { date: triggerDate },
          });
        }
      }
    }
  }
}

// ── Resumo semanal de gastos (toda segunda-feira às 9h) ────────
export async function scheduleWeeklyExpenseSummary(pets, expenses) {
  if (Platform.OS === 'web') return;
  const granted = await requestNotificationPermission();
  if (!granted) return;
  await cancelByIdentifier('weekly_expenses_');

  if (!expenses?.length || !pets?.length) return;

  // Soma gastos dos últimos 7 dias
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7);
  const weekExpenses = expenses.filter(e => new Date(e.date) >= cutoff);
  if (!weekExpenses.length) return;

  const total = weekExpenses.reduce((s, e) => s + (e.amount || 0), 0);
  const petNames = [...new Set(weekExpenses.map(e => pets.find(p => p.id === e.pet_id)?.name).filter(Boolean))];

  // Próxima segunda-feira às 9h
  const nextMonday = new Date();
  const day = nextMonday.getDay();
  const daysUntilMonday = day === 1 ? 7 : (8 - day) % 7;
  nextMonday.setDate(nextMonday.getDate() + daysUntilMonday);
  nextMonday.setHours(9, 0, 0, 0);

  const petStr = petNames.length === 1 ? petNames[0] : `${petNames.length} pets`;

  await Notifications.scheduleNotificationAsync({
    identifier: `weekly_expenses_${nextMonday.toISOString().slice(0, 10)}`,
    content: {
      title: 'Fred — Resumo semanal',
      body: `Esta semana você investiu R$${total.toFixed(2)} nos cuidados de ${petStr}. Veja o detalhamento no app.`,
      data: { type: 'weekly_expenses' },
    },
    trigger: { date: nextMonday },
  });
}

// ── Alerta de variação de peso ────────────────────────────────
export async function scheduleWeightChangeAlert(pet, previousWeight, newWeight) {
  if (Platform.OS === 'web') return;
  const granted = await requestNotificationPermission();
  if (!granted) return;

  if (!previousWeight || !newWeight || !pet) return;

  const diff = newWeight - previousWeight;
  const pct = Math.abs(diff / previousWeight) * 100;

  // Só alerta variações acima de 5%
  if (pct < 5) return;

  const direction = diff > 0 ? 'ganhou' : 'perdeu';
  const abs = Math.abs(diff).toFixed(1);
  const emoji = diff < 0 ? 'Atenção:' : 'Fred notou:';
  const tip = diff < 0
    ? 'Perda de peso pode indicar algo. Considere uma consulta veterinária.'
    : 'Ganho acima do esperado. Vale conversar com o veterinário na próxima visita.';

  await Notifications.scheduleNotificationAsync({
    identifier: `weight_alert_${pet.id}_${Date.now()}`,
    content: {
      title: `${emoji} peso de ${pet.name}`,
      body: `${pet.name} ${direction} ${abs}kg (${pct.toFixed(0)}%). ${tip}`,
      data: { type: 'weight_change', petId: pet.id },
    },
    trigger: { seconds: 3 }, // Dispara logo após registrar o peso
  });
}

// ── Lembrete de registro de saúde (30 dias sem atividade) ─────
export async function scheduleHealthActivityReminders(pets, lastActivityByPet) {
  if (Platform.OS === 'web') return;
  const granted = await requestNotificationPermission();
  if (!granted) return;
  await cancelByIdentifier('health_reminder_');

  const today = new Date();

  for (const pet of pets) {
    const lastDate = lastActivityByPet[pet.id];
    if (!lastDate) {
      // Nunca teve registro — lembra em 3 dias
      await scheduleAt9h(
        `health_reminder_${pet.id}_new`,
        `Fred lembra: complete o perfil de ${pet.name}`,
        `${pet.name} ainda não tem histórico médico no PetCare+. Adicione vacinas e registros para acompanhar a saúde.`,
        3,
        { type: 'health_reminder', petId: pet.id }
      );
      continue;
    }

    const daysSince = Math.floor((today - new Date(lastDate)) / (1000 * 60 * 60 * 24));

    if (daysSince >= 15 && daysSince < 16) {
      await scheduleAt9h(
        `health_reminder_${pet.id}_15d`,
        `Fred pergunta: tudo bem com ${pet.name}?`,
        `Faz 15 dias sem novos registros de ${pet.name}. Adicione peso, vacinas ou visitas ao vet para manter o histórico atualizado.`,
        1,
        { type: 'health_reminder', petId: pet.id }
      );
    } else if (daysSince >= 30 && daysSince < 31) {
      await scheduleAt9h(
        `health_reminder_${pet.id}_30d`,
        `${pet.name} está bem? Fred não esqueceu`,
        `Um mês sem atualizações de ${pet.name}. Que tal uma consulta de rotina? Registre no PetCare+ para manter o histórico.`,
        1,
        { type: 'health_reminder', petId: pet.id }
      );
    }
  }
}

// ── Alerta quando veterinário adiciona registro ────────────────
export async function notifyVetRecord(petName, vetName, recordType) {
  if (Platform.OS === 'web') return;
  const granted = await requestNotificationPermission();
  if (!granted) return;

  const typeLabels = {
    consulta: 'consulta',
    exame: 'resultado de exame',
    cirurgia: 'registro cirúrgico',
    prescricao: 'prescrição',
    outro: 'registro médico',
  };

  await Notifications.scheduleNotificationAsync({
    identifier: `vet_record_${Date.now()}`,
    content: {
      title: `Novo registro de ${petName}`,
      body: `Dr(a). ${vetName} adicionou um ${typeLabels[recordType] || 'registro médico'} para ${petName}. Veja no app.`,
      data: { type: 'vet_record', petName },
    },
    trigger: { seconds: 1 },
  });
}

// ── Lembrete de perfil incompleto ─────────────────────────────
export async function scheduleProfileCompletionReminders(pets) {
  if (Platform.OS === 'web') return;
  const granted = await requestNotificationPermission();
  if (!granted) return;
  await cancelByIdentifier('profile_reminder_');

  for (const pet of pets) {
    const missing = [];
    if (!pet.birth_date)   missing.push('data de nascimento');
    if (!pet.breed)        missing.push('raça');
    if (!pet.weight_kg)    missing.push('peso');
    if (!pet.coat_color)   missing.push('cor da pelagem');

    // Só lembra se faltam 2 ou mais informações — não fica chato por pouca coisa
    if (missing.length < 2) continue;

    await scheduleAt9h(
      `profile_reminder_${pet.id}`,
      `Fred sugere: complete o perfil de ${pet.name}`,
      `Faltam informações de ${pet.name}: ${missing.slice(0, 2).join(' e ')}. Um perfil completo ajuda o veterinário a cuidar melhor.`,
      2,
      { type: 'profile_reminder', petId: pet.id }
    );
  }
}

// ── Orquestrador principal — chame do Dashboard ───────────────
export async function scheduleAllSmartNotifications({ pets, vaccines, expenses, weights, medicalRecords, lastVetRecordByPet }) {
  if (Platform.OS === 'web') return;
  const granted = await requestNotificationPermission();
  if (!granted) return;

  // Roda em background sem bloquear a UI
  Promise.allSettled([
    scheduleBirthdayNotifications(pets),
    scheduleVaccineNotifications(vaccines, pets),
    scheduleWeeklyExpenseSummary(pets, expenses),
    scheduleHealthActivityReminders(pets, lastVetRecordByPet || {}),
    scheduleProfileCompletionReminders(pets),
  ]).catch(() => {});
}
