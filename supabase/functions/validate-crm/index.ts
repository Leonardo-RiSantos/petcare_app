import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const ESTADOS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS',
                 'MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

// ── Aguarda N ms ────────────────────────────────────────────────────────────
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

// ── Tenta extrair nome de uma resposta (JSON ou HTML) ───────────────────────
function extractName(text: string): string {
  try {
    const result = JSON.parse(text)
    const name: string =
      result?.data?.nome      ??
      result?.data?.name      ??
      result?.nome            ??
      result?.name            ??
      result?.data?.[0]?.nome ??
      result?.data?.[0]?.name ??
      ''
    if (name && name.trim().length > 2) return name.trim()
  } catch { /* não é JSON */ }

  // Tenta no HTML
  const patterns = [
    /<strong>([A-ZÀ-Ú][^<]{4,80})<\/strong>/,
    /class="nome[^"]*"[^>]*>([A-ZÀ-Ú][^<]{4,80})</,
    /"nome"\s*:\s*"([A-ZÀ-Ú][^"]{4,80})"/,
    /nome['":\s]+([A-ZÀ-Ú][a-zà-ú\s]{4,60})/i,
  ]
  for (const p of patterns) {
    const m = text.match(p)
    if (m?.[1]) return m[1].trim()
  }
  return ''
}

// ── Estratégia 1: WordPress AJAX via nonce ──────────────────────────────────
async function tryWordPressAjax(crm: string, estado: string): Promise<string> {
  const pageRes = await fetch('https://cfmv.gov.br/consulta-de-medico-veterinario/', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'text/html,application/xhtml+xml',
    },
    signal: AbortSignal.timeout(12_000),
  })
  if (!pageRes.ok) throw new Error(`page ${pageRes.status}`)
  const html = await pageRes.text()

  const nonceMatch =
    html.match(/"nonce"\s*:\s*"([a-f0-9]{8,})"/) ||
    html.match(/nonce['":\s]+([a-f0-9]{8,})/)
  const nonce = nonceMatch?.[1] ?? ''

  // Tenta múltiplos nomes de action (o CFMV pode mudar)
  const actions = ['buscar_medico_veterinario', 'consultar_veterinario', 'buscar_vet']
  for (const action of actions) {
    const body = new URLSearchParams({ action, nrCRM: crm, UF: estado, ...(nonce ? { nonce } : {}) })
    const ajaxRes = await fetch('https://cfmv.gov.br/wp-admin/admin-ajax.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://cfmv.gov.br/consulta-de-medico-veterinario/',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body,
      signal: AbortSignal.timeout(12_000),
    })
    const text = await ajaxRes.text()
    // Rejeita respostas claramente negativas
    if (text === '0' || text === 'false' || text.trim() === '') continue
    const name = extractName(text)
    if (name) return name
  }
  return ''
}

// ── Estratégia 2: Busca direta pela URL de busca (se CFMV tiver endpoint REST) ─
async function tryDirectSearch(crm: string, estado: string): Promise<string> {
  const urls = [
    `https://cfmv.gov.br/?s=${crm}+${estado}`,
    `https://cfmv.gov.br/busca/?crm=${crm}&uf=${estado}`,
  ]
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible)' },
        signal: AbortSignal.timeout(8_000),
      })
      if (!res.ok) continue
      const text = await res.text()
      const name = extractName(text)
      if (name) return name
    } catch { /* ignora */ }
  }
  return ''
}

// ── Orquestrador com retries ─────────────────────────────────────────────────
async function consultarCFMV(
  crm: string,
  estado: string,
  maxAttempts = 3,
): Promise<{ found: boolean; name: string; attempts: number; strategy: string }> {
  let lastErr = ''
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(`[CFMV] tentativa ${attempt}/${maxAttempts} — CRM ${crm}/${estado}`)

      // Estratégia principal: WordPress AJAX
      const name = await tryWordPressAjax(crm, estado)
      if (name) {
        console.log(`[CFMV] encontrado: "${name}" (tentativa ${attempt})`)
        return { found: true, name, attempts: attempt, strategy: 'ajax' }
      }

      // Estratégia alternativa: busca direta (só na última tentativa para não bloquear)
      if (attempt === maxAttempts) {
        const name2 = await tryDirectSearch(crm, estado)
        if (name2) return { found: true, name: name2, attempts: attempt, strategy: 'direct' }
      }

    } catch (err) {
      lastErr = String(err)
      console.error(`[CFMV] erro tentativa ${attempt}:`, err)
      if (attempt < maxAttempts) await sleep(1500 * attempt) // backoff: 1.5s, 3s
    }
  }

  console.warn(`[CFMV] não encontrado após ${maxAttempts} tentativas. Último erro: ${lastErr}`)
  return { found: false, name: '', attempts: maxAttempts, strategy: 'failed' }
}

// ── Handler principal ────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const { crm, estado, userId } = await req.json()

    if (!crm || !estado || !userId) {
      return json({ valid: false, error: 'crm, estado e userId são obrigatórios.' }, 400)
    }

    const crmNum   = String(crm).replace(/\D/g, '').trim()
    const estadoUp = String(estado).trim().toUpperCase()

    if (!crmNum || crmNum.length < 2 || crmNum.length > 8) {
      return json({ valid: false, error: 'CRM inválido. Informe apenas os números (ex: 12345).' })
    }
    if (!ESTADOS.includes(estadoUp)) {
      return json({ valid: false, error: `Estado "${estado}" inválido. Use a sigla (ex: SP, RJ, MG).` })
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SERVICE_ROLE_KEY')!,
    )

    // Verifica duplicata
    const { data: existing } = await admin
      .from('vet_profiles')
      .select('id')
      .eq('crm', crmNum)
      .eq('estado', estadoUp)
      .neq('id', userId)
      .maybeSingle()

    if (existing) {
      return json({ valid: false, error: `CRM ${crmNum}/${estadoUp} já vinculado a outra conta.` })
    }

    // Consulta CFMV com retries
    const cfmv = await consultarCFMV(crmNum, estadoUp, 3)

    const status      = cfmv.found ? 'approved' : 'pending'
    const validatedAt = cfmv.found ? new Date().toISOString() : null

    // Atualiza vet_profiles
    const { error: updateErr } = await admin
      .from('vet_profiles')
      .update({
        status,
        estado: estadoUp,
        validated_at: validatedAt,
        // Guarda log da tentativa para auditoria
        ...(cfmv.found && cfmv.name ? { full_name: cfmv.name } : {}),
      })
      .eq('id', userId)

    if (updateErr) throw updateErr

    // Notifica admin se ficou pendente (insere em tabela de alertas se existir)
    if (!cfmv.found) {
      await admin.from('vet_profiles')
        .update({ status: 'pending' })
        .eq('id', userId)
        .then(() => console.log(`[CFMV] CRM ${crmNum}/${estadoUp} ficou pendente para revisão manual`))
    }

    return json({
      valid:    true,
      status,
      name:     cfmv.name,
      attempts: cfmv.attempts,
      message:  cfmv.found
        ? `CRM ${crmNum}/${estadoUp} validado pelo CFMV! Bem-vindo(a), Dr(a). ${cfmv.name}.`
        : `Não foi possível confirmar seu CRM com o CFMV agora (${cfmv.attempts} tentativas). Seu cadastro será revisado manualmente em breve.`,
    })

  } catch (err) {
    console.error('[validate-crm]', err)
    return json({ error: String(err) }, 500)
  }
})
