import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

Deno.serve(async (req) => {
  const url = new URL(req.url)
  const qrId = url.searchParams.get('id')

  if (!qrId) {
    return new Response('QR inválido', { status: 400 })
  }

  const { data: pet } = await supabase
    .from('pets')
    .select('*, profiles!pets_user_id_fkey(full_name, phone)')
    .eq('qr_code_id', qrId)
    .eq('qr_public', true)
    .single()

  if (!pet) {
    return new Response(notFoundPage(), { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } })
  }

  const emoji = { Cachorro: '🐶', Gato: '🐱', Ave: '🐦', Coelho: '🐰', Hamster: '🐹', Réptil: '🦎' }[pet.species] || '🐾'
  const ownerName = pet.profiles?.full_name || 'Tutor'
  const contact = pet.contact_phone || pet.profiles?.phone || null

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${pet.name} — PetCare+</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #F0F9FF; display: flex; justify-content: center; align-items: flex-start; min-height: 100vh; padding: 24px 16px; }
    .card { background: #fff; border-radius: 20px; overflow: hidden; max-width: 380px; width: 100%; box-shadow: 0 8px 32px rgba(0,0,0,0.12); }
    .header { background: linear-gradient(135deg, #0C4A6E, #0EA5E9); padding: 20px; }
    .header-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
    .brand { color: rgba(255,255,255,0.85); font-size: 12px; font-weight: 600; letter-spacing: 1px; }
    .doc-type { color: #fff; font-size: 16px; font-weight: 800; }
    .qr-id { color: rgba(255,255,255,0.7); font-size: 11px; font-family: monospace; }
    .body { padding: 20px; }
    .pet-section { display: flex; align-items: center; gap: 14px; margin-bottom: 16px; }
    .pet-emoji { font-size: 52px; }
    .pet-info h1 { font-size: 22px; font-weight: 800; color: #1E293B; }
    .pet-breed { font-size: 14px; color: #64748B; margin-top: 2px; }
    .badge { display: inline-block; background: #DCFCE7; color: #16A34A; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 20px; margin-top: 8px; letter-spacing: 0.5px; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px; padding: 16px; background: #F8FAFC; border-radius: 12px; }
    .info-item label { font-size: 10px; font-weight: 700; color: #94A3B8; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 4px; }
    .info-item span { font-size: 14px; font-weight: 600; color: #1E293B; }
    .contact-btn { display: block; background: #0EA5E9; color: #fff; text-decoration: none; text-align: center; padding: 14px; border-radius: 12px; font-size: 16px; font-weight: 700; margin-bottom: 12px; }
    .footer { text-align: center; font-size: 11px; color: #94A3B8; padding: 12px; border-top: 1px solid #F1F5F9; }
    .lost-banner { background: #FFF7ED; border: 1px solid #FED7AA; border-radius: 12px; padding: 14px; margin-bottom: 16px; text-align: center; }
    .lost-banner h2 { font-size: 16px; color: #EA580C; font-weight: 700; margin-bottom: 4px; }
    .lost-banner p { font-size: 13px; color: #9A3412; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="header-top">
        <div>
          <div class="brand">🐾 PETCARE+</div>
          <div class="doc-type">RG Digital</div>
        </div>
        <div class="qr-id">#${pet.qr_code_id.substring(0, 8).toUpperCase()}</div>
      </div>
    </div>
    <div class="body">
      <div class="lost-banner">
        <h2>🔍 Pet encontrado?</h2>
        <p>Use as informações abaixo para entrar em contato com o tutor</p>
      </div>
      <div class="pet-section">
        <div class="pet-emoji">${emoji}</div>
        <div class="pet-info">
          <h1>${pet.name}</h1>
          <div class="pet-breed">${pet.species}${pet.breed ? ' · ' + pet.breed : ''}${pet.sex ? ' · ' + pet.sex : ''}</div>
          <span class="badge">✓ IDENTIFICAÇÃO ATIVA</span>
        </div>
      </div>
      <div class="info-grid">
        <div class="info-item">
          <label>👤 Tutor</label>
          <span>${ownerName}</span>
        </div>
        ${pet.neutered ? `<div class="info-item"><label>Status</label><span>Castrado(a)</span></div>` : ''}
        ${pet.weight_kg ? `<div class="info-item"><label>⚖️ Peso</label><span>${pet.weight_kg} kg</span></div>` : ''}
        ${pet.birth_date ? `<div class="info-item"><label>🎂 Nascimento</label><span>${pet.birth_date}</span></div>` : ''}
      </div>
      ${contact ? `<a class="contact-btn" href="tel:${contact.replace(/\D/g, '')}">📞 Ligar para o tutor: ${contact}</a>` : ''}
    </div>
    <div class="footer">🐾 Documento oficial PetCare+ · petcareplus.app</div>
  </div>
</body>
</html>`

  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
})

function notFoundPage() {
  return `<!DOCTYPE html><html><body style="font-family:sans-serif;text-align:center;padding:40px">
    <h1>🐾</h1><h2>QR Code não encontrado</h2>
    <p>Este QR pode ter sido desativado ou é inválido.</p>
  </body></html>`
}
