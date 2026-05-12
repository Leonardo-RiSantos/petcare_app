import { Platform } from 'react-native';
import * as Sharing from 'expo-sharing';

const fmt = (d) => {
  if (!d) return '—';
  const s = String(d).split('T')[0];
  const [y, m, day] = s.split('-');
  return `${day}/${m}/${y}`;
};

const currency = (v) => `R$ ${Number(v || 0).toFixed(2).replace('.', ',')}`;

const BASE_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif; color: #1E293B; background: #fff; }
  .page { max-width: 800px; margin: 0 auto; padding: 40px 32px; }
  .header { display: flex; align-items: center; gap: 20px; margin-bottom: 32px; padding-bottom: 24px; border-bottom: 2px solid #E0F2FE; }
  .header-logo { width: 56px; height: 56px; background: linear-gradient(135deg,#0284C7,#38BDF8); border-radius: 16px; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 24px; font-weight: 900; flex-shrink: 0; }
  .header-info h1 { font-size: 22px; font-weight: 900; color: #0284C7; }
  .header-info p { font-size: 13px; color: #64748B; margin-top: 3px; }
  .meta-row { display: flex; gap: 24px; margin-bottom: 28px; }
  .meta-box { background: #F0F9FF; border-radius: 12px; padding: 14px 18px; flex: 1; border: 1px solid #BAE6FD; }
  .meta-label { font-size: 10px; font-weight: 700; color: #0EA5E9; letter-spacing: 0.8px; text-transform: uppercase; margin-bottom: 4px; }
  .meta-value { font-size: 15px; font-weight: 800; color: #1E293B; }
  .section-title { font-size: 14px; font-weight: 800; color: #0284C7; letter-spacing: 0.5px; text-transform: uppercase; margin: 28px 0 12px; padding-bottom: 6px; border-bottom: 1px solid #E0F2FE; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { text-align: left; padding: 9px 12px; background: #F8FAFC; color: #64748B; font-weight: 700; font-size: 11px; letter-spacing: 0.3px; }
  td { padding: 10px 12px; border-bottom: 1px solid #F1F5F9; vertical-align: top; }
  tr:last-child td { border-bottom: none; }
  .badge { display: inline-block; border-radius: 20px; padding: 3px 10px; font-size: 11px; font-weight: 700; }
  .total-row td { font-weight: 800; font-size: 14px; background: #F0F9FF; }
  .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #E2E8F0; text-align: center; font-size: 11px; color: #94A3B8; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
`;

const CATEGORY_COLORS = {
  Ração:       { bg: '#FEF3C7', color: '#D97706' },
  Veterinário: { bg: '#EFF6FF', color: '#0284C7' },
  'Banho/Tosa':{ bg: '#F0FFF4', color: '#16A34A' },
  Remédio:     { bg: '#FDF4FF', color: '#7C3AED' },
  Acessórios:  { bg: '#FFF7ED', color: '#EA580C' },
  Outros:      { bg: '#F1F5F9', color: '#64748B' },
};

// ── RELATÓRIO DE GASTOS ───────────────────────────────────────
export function generateExpenseReportHTML({ pet, expenses, startDate, endDate, ownerName }) {
  const filtered = expenses.filter(e => {
    const d = new Date(e.date);
    return d >= new Date(startDate) && d <= new Date(endDate);
  }).sort((a, b) => new Date(b.date) - new Date(a.date));

  const total = filtered.reduce((s, e) => s + (e.amount || 0), 0);

  const byCategory = {};
  filtered.forEach(e => {
    const cat = e.category || 'Outros';
    byCategory[cat] = (byCategory[cat] || 0) + (e.amount || 0);
  });

  const rows = filtered.map(e => {
    const c = CATEGORY_COLORS[e.category] || CATEGORY_COLORS.Outros;
    return `
      <tr>
        <td>${fmt(e.date)}</td>
        <td><span class="badge" style="background:${c.bg};color:${c.color}">${e.category || 'Outros'}</span></td>
        <td>${e.description || '—'}</td>
        <td style="text-align:right;font-weight:700">${currency(e.amount)}</td>
      </tr>
    `;
  }).join('');

  const catRows = Object.entries(byCategory)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, val]) => {
      const c = CATEGORY_COLORS[cat] || CATEGORY_COLORS.Outros;
      const pct = ((val / total) * 100).toFixed(0);
      return `
        <tr>
          <td><span class="badge" style="background:${c.bg};color:${c.color}">${cat}</span></td>
          <td style="text-align:right">${currency(val)}</td>
          <td style="text-align:right;color:#64748B">${pct}%</td>
        </tr>
      `;
    }).join('');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Relatório de Gastos — ${pet.name}</title>
<style>${BASE_CSS}</style>
</head>
<body>
<div class="page">
  <div class="header">
    <div class="header-logo">P+</div>
    <div class="header-info">
      <h1>Relatório de Gastos</h1>
      <p>PetCare+ · Gerado em ${fmt(new Date().toISOString())}</p>
    </div>
  </div>

  <div class="meta-row">
    <div class="meta-box"><div class="meta-label">Pet</div><div class="meta-value">${pet.name}</div></div>
    <div class="meta-box"><div class="meta-label">Espécie</div><div class="meta-value">${pet.species || '—'}</div></div>
    <div class="meta-box"><div class="meta-label">Tutor</div><div class="meta-value">${ownerName || '—'}</div></div>
    <div class="meta-box"><div class="meta-label">Período</div><div class="meta-value">${fmt(startDate)} – ${fmt(endDate)}</div></div>
  </div>

  <div class="meta-row">
    <div class="meta-box" style="background:#DCFCE7;border-color:#86EFAC">
      <div class="meta-label" style="color:#16A34A">Total do período</div>
      <div class="meta-value" style="font-size:22px;color:#16A34A">${currency(total)}</div>
    </div>
    <div class="meta-box">
      <div class="meta-label">Número de lançamentos</div>
      <div class="meta-value">${filtered.length}</div>
    </div>
    <div class="meta-box">
      <div class="meta-label">Média por lançamento</div>
      <div class="meta-value">${filtered.length ? currency(total / filtered.length) : '—'}</div>
    </div>
  </div>

  <div class="section-title">Por categoria</div>
  <table>
    <thead><tr><th>Categoria</th><th style="text-align:right">Total</th><th style="text-align:right">% do total</th></tr></thead>
    <tbody>${catRows}</tbody>
    <tfoot><tr class="total-row"><td>Total</td><td style="text-align:right">${currency(total)}</td><td></td></tr></tfoot>
  </table>

  <div class="section-title">Lançamentos detalhados</div>
  ${filtered.length === 0
    ? '<p style="color:#94A3B8;font-size:13px">Nenhum gasto no período selecionado.</p>'
    : `<table>
      <thead><tr><th>Data</th><th>Categoria</th><th>Descrição</th><th style="text-align:right">Valor</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr class="total-row"><td colspan="3">Total</td><td style="text-align:right">${currency(total)}</td></tr></tfoot>
    </table>`}

  <div class="footer">PetCare+ · Relatório gerado automaticamente · Não substitui documentação veterinária oficial</div>
</div>
</body></html>`;
}

// ── RELATÓRIO DE SAÚDE ────────────────────────────────────────
export function generateHealthReportHTML({ pet, vaccines, weights, medicalRecords, vetRecords, ownerName }) {
  const today = new Date();
  const birthDate = pet.birth_date ? new Date(pet.birth_date) : null;
  const months = birthDate ? Math.floor((today - birthDate) / (1000 * 60 * 60 * 24 * 30.44)) : null;
  const ageStr = months === null ? '—'
    : months < 12 ? `${months} meses`
    : `${Math.floor(months / 12)} ano${Math.floor(months / 12) > 1 ? 's' : ''}${months % 12 > 0 ? ` e ${months % 12} meses` : ''}`;

  const latestWeight = weights?.slice().sort((a, b) => new Date(b.recorded_at || b.date) - new Date(a.recorded_at || a.date))[0];

  const vaccineRows = (vaccines || []).map(v => {
    const hasNext = !!v.next_dose_date;
    const late = hasNext && new Date(v.next_dose_date) < today;
    const status = hasNext
      ? (late ? `<span style="color:#DC2626;font-weight:700">Vencida</span>` : `<span style="color:#16A34A">Próxima: ${fmt(v.next_dose_date)}</span>`)
      : '<span style="color:#16A34A">Em dia</span>';
    return `<tr><td>${v.name}</td><td>${fmt(v.applied_date)}</td><td>${status}</td><td style="color:#64748B;font-size:12px">${v.notes || '—'}</td></tr>`;
  }).join('');

  const weightRows = (weights || [])
    .sort((a, b) => new Date(b.recorded_at || b.date) - new Date(a.recorded_at || a.date))
    .slice(0, 12)
    .map((w, i, arr) => {
      const prev = arr[i + 1];
      const diff = prev ? (w.weight_kg - prev.weight_kg) : null;
      const diffStr = diff === null ? '—'
        : diff > 0 ? `<span style="color:#D97706">+${diff.toFixed(1)}kg</span>`
        : diff < 0 ? `<span style="color:#EF4444">${diff.toFixed(1)}kg</span>`
        : '—';
      return `<tr><td>${fmt(w.recorded_at || w.date)}</td><td style="font-weight:700">${w.weight_kg} kg</td><td>${diffStr}</td><td style="color:#64748B;font-size:12px">${w.notes || '—'}</td></tr>`;
    }).join('');

  const medRows = (medicalRecords || [])
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .map(r => `<tr><td>${fmt(r.date)}</td><td>${r.title || '—'}</td><td style="color:#64748B;font-size:12px">${r.description || '—'}</td></tr>`)
    .join('');

  const typeLabels = { consulta: 'Consulta', exame: 'Exame', cirurgia: 'Cirurgia', prescricao: 'Prescrição', outro: 'Outro' };
  const vetRows = (vetRecords || [])
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .map(r => `
      <tr>
        <td>${fmt(r.date)}</td>
        <td>${typeLabels[r.type] || r.type || '—'}</td>
        <td>${r.title || '—'}</td>
        <td style="color:#64748B;font-size:12px">${[r.description, r.diagnosis, r.prescription].filter(Boolean).join(' · ') || '—'}</td>
      </tr>`)
    .join('');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Relatório de Saúde — ${pet.name}</title>
<style>${BASE_CSS}</style>
</head>
<body>
<div class="page">
  <div class="header">
    <div class="header-logo">P+</div>
    <div class="header-info">
      <h1>Relatório de Saúde</h1>
      <p>PetCare+ · Gerado em ${fmt(new Date().toISOString())} · Apresente ao veterinário</p>
    </div>
  </div>

  <div class="meta-row">
    <div class="meta-box"><div class="meta-label">Nome</div><div class="meta-value">${pet.name}</div></div>
    <div class="meta-box"><div class="meta-label">Espécie / Raça</div><div class="meta-value">${pet.species || '—'}${pet.breed ? ` · ${pet.breed}` : ''}</div></div>
    <div class="meta-box"><div class="meta-label">Sexo</div><div class="meta-value">${pet.sex || '—'}${pet.neutered ? ' · Castrado(a)' : ''}</div></div>
    <div class="meta-box"><div class="meta-label">Tutor</div><div class="meta-value">${ownerName || '—'}</div></div>
  </div>
  <div class="meta-row">
    <div class="meta-box"><div class="meta-label">Nascimento</div><div class="meta-value">${fmt(pet.birth_date)}</div></div>
    <div class="meta-box"><div class="meta-label">Idade</div><div class="meta-value">${ageStr}</div></div>
    <div class="meta-box"><div class="meta-label">Peso atual</div><div class="meta-value">${latestWeight ? `${latestWeight.weight_kg} kg` : '—'}</div></div>
    <div class="meta-box"><div class="meta-label">Pelagem</div><div class="meta-value">${pet.coat_color || '—'}</div></div>
  </div>

  ${(pet.health_notes || pet.medications) ? `
  <div class="section-title">Informações de saúde</div>
  <table>
    ${pet.health_notes ? `<tr><td style="font-weight:700;width:160px">Condições</td><td>${pet.health_notes}</td></tr>` : ''}
    ${pet.medications ? `<tr><td style="font-weight:700">Medicamentos</td><td>${pet.medications}</td></tr>` : ''}
  </table>` : ''}

  <div class="section-title">Carteira de vacinação</div>
  ${vaccines?.length
    ? `<table>
        <thead><tr><th>Vacina</th><th>Aplicada em</th><th>Status</th><th>Observações</th></tr></thead>
        <tbody>${vaccineRows}</tbody>
      </table>`
    : '<p style="color:#94A3B8;font-size:13px">Nenhuma vacina registrada.</p>'}

  <div class="section-title">Histórico de peso</div>
  ${weights?.length
    ? `<table>
        <thead><tr><th>Data</th><th>Peso</th><th>Variação</th><th>Observações</th></tr></thead>
        <tbody>${weightRows}</tbody>
      </table>`
    : '<p style="color:#94A3B8;font-size:13px">Nenhum registro de peso.</p>'}

  <div class="section-title">Registros do tutor</div>
  ${medicalRecords?.length
    ? `<table>
        <thead><tr><th>Data</th><th>Título</th><th>Descrição</th></tr></thead>
        <tbody>${medRows}</tbody>
      </table>`
    : '<p style="color:#94A3B8;font-size:13px">Nenhum registro médico.</p>'}

  <div class="section-title">Registros veterinários</div>
  ${vetRecords?.length
    ? `<table>
        <thead><tr><th>Data</th><th>Tipo</th><th>Título</th><th>Detalhes</th></tr></thead>
        <tbody>${vetRows}</tbody>
      </table>`
    : '<p style="color:#94A3B8;font-size:13px">Nenhum registro veterinário no sistema.</p>'}

  <div class="footer">PetCare+ · Documento gerado para apresentação veterinária · Os dados refletem o histórico registrado no aplicativo</div>
</div>
</body></html>`;
}

// ── Receita médica com assinatura digital ─────────────────────
export function generatePrescriptionHTML({ consultation, prescriptions, pet, vet }) {
  const today = new Date().toLocaleDateString('pt-BR');
  const typeLabel = { consulta:'Consulta',retorno:'Retorno',cirurgia:'Cirurgia',exame:'Exame',vacinacao:'Vacinação',outro:'Procedimento' };
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Receita</title><style>
  ${BASE_CSS}
  .rx-header { display:flex; align-items:flex-start; justify-content:space-between; margin-bottom:28px; padding-bottom:20px; border-bottom:3px solid #0EA5E9; }
  .rx-clinic { }
  .rx-clinic h1 { font-size:22px; font-weight:900; color:#0284C7; margin-bottom:4px; }
  .rx-clinic p { font-size:12px; color:#64748B; }
  .rx-logo { width:60px; height:60px; background:linear-gradient(135deg,#0284C7,#38BDF8); border-radius:16px; display:flex; align-items:center; justify-content:center; color:#fff; font-size:24px; font-weight:900; flex-shrink:0; }
  .patient-box { background:#F0F9FF; border-radius:12px; padding:16px 20px; margin-bottom:24px; border:1px solid #BAE6FD; display:flex; gap:24px; }
  .patient-item { flex:1; }
  .patient-label { font-size:10px; font-weight:700; color:#0EA5E9; text-transform:uppercase; letter-spacing:0.6px; margin-bottom:3px; }
  .patient-value { font-size:14px; font-weight:800; color:#1E293B; }
  .rx-title { font-size:20px; font-weight:900; color:#1E293B; text-align:center; letter-spacing:1px; border:2px solid #0EA5E9; border-radius:12px; padding:10px; margin-bottom:24px; }
  .rx-item { border:1px solid #E0F2FE; border-radius:12px; padding:16px; margin-bottom:12px; }
  .rx-med { font-size:16px; font-weight:800; color:#0284C7; margin-bottom:8px; }
  .rx-detail { display:flex; gap:24px; flex-wrap:wrap; margin-bottom:6px; }
  .rx-detail span { font-size:13px; color:#374151; }
  .rx-detail b { color:#1E293B; }
  .rx-instructions { font-size:13px; color:#64748B; font-style:italic; margin-top:6px; }
  .rx-notes { background:#FFF7ED; border-radius:12px; padding:14px; border:1px solid #FED7AA; margin:20px 0; }
  .rx-notes p { font-size:13px; color:#92400E; }
  .signature-area { display:flex; align-items:flex-end; justify-content:flex-end; margin-top:48px; gap:20px; }
  .signature-line { text-align:center; min-width:220px; }
  .signature-img { max-height:70px; max-width:200px; object-fit:contain; margin-bottom:6px; display:block; margin-left:auto; margin-right:auto; }
  .sig-line { border-top:1px solid #334155; padding-top:6px; font-size:11px; color:#64748B; }
  </style></head><body><div class="page">
  <div class="rx-header">
    <div class="rx-clinic">
      <h1>${vet?.clinic_name || 'Clínica Veterinária'}</h1>
      <p>${vet?.full_name ? `Dr(a). ${vet.full_name}` : ''}${vet?.crm ? ` · CRMV ${vet.crm}/${vet.estado}` : ''}</p>
      ${vet?.clinic_address ? `<p>${vet.clinic_address}</p>` : ''}
    </div>
    ${vet?.clinic_logo_url ? `<img src="${vet.clinic_logo_url}" style="max-height:70px;max-width:160px;object-fit:contain;border-radius:8px;" />` : '<div class="rx-logo">P+</div>'}
  </div>

  <div class="rx-title">RECEITUÁRIO VETERINÁRIO</div>

  <div class="patient-box">
    <div class="patient-item"><div class="patient-label">Paciente</div><div class="patient-value">${pet?.name || '—'}</div></div>
    <div class="patient-item"><div class="patient-label">Espécie / Raça</div><div class="patient-value">${pet?.species || '—'}${pet?.breed ? ` · ${pet.breed}` : ''}</div></div>
    <div class="patient-item"><div class="patient-label">Tipo</div><div class="patient-value">${typeLabel[consultation?.type] || '—'}</div></div>
    <div class="patient-item"><div class="patient-label">Data</div><div class="patient-value">${today}</div></div>
  </div>

  ${consultation?.diagnosis ? `<div class="rx-notes"><p><b>Diagnóstico:</b> ${consultation.diagnosis}</p></div>` : ''}

  <div class="section-title">Medicamentos Prescritos</div>
  ${prescriptions.map((p, i) => `
  <div class="rx-item">
    <div class="rx-med">${i + 1}. ${p.medication}</div>
    <div class="rx-detail">
      ${p.dosage    ? `<span><b>Dose:</b> ${p.dosage}</span>` : ''}
      ${p.frequency ? `<span><b>Frequência:</b> ${p.frequency}</span>` : ''}
      ${p.duration  ? `<span><b>Duração:</b> ${p.duration}</span>` : ''}
    </div>
    ${p.instructions ? `<div class="rx-instructions">${p.instructions}</div>` : ''}
  </div>`).join('')}

  ${consultation?.treatment_plan ? `<div class="rx-notes"><p><b>Plano terapêutico:</b> ${consultation.treatment_plan}</p></div>` : ''}

  <div class="signature-area">
    <div class="signature-line">
      ${vet?.signature_url ? `<img src="${vet.signature_url}" class="signature-img" />` : '<div style="height:70px;"></div>'}
      <div class="sig-line">${vet?.full_name ? `Dr(a). ${vet.full_name}` : 'Médico(a) Veterinário(a)'}${vet?.crm ? `<br>CRMV ${vet.crm}/${vet.estado}` : ''}</div>
    </div>
  </div>

  <div class="footer">PetCare+ · Receituário válido somente com assinatura do profissional · ${today}</div>
</div></body></html>`;
}

// ── Exportador universal (web + native) ───────────────────────
export async function exportReport(html, filename) {
  if (Platform.OS === 'web') {
    // No web: abre nova aba e dispara o print dialog do browser
    const win = window.open('', '_blank');
    if (!win) { alert('Permita pop-ups para exportar o PDF.'); return; }
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 500);
    return;
  }

  // Nativo: gera PDF com expo-print e compartilha
  try {
    const Print = await import('expo-print');
    const { uri } = await Print.printToFileAsync({ html, base64: false });
    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: filename,
        UTI: 'com.adobe.pdf',
      });
    }
  } catch (e) {
    console.warn('Erro ao gerar PDF:', e);
  }
}
