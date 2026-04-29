import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function calcAge(birthDate: string | null): string {
  if (!birthDate) return ''
  const birth = new Date(birthDate)
  const now = new Date()
  const months = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth())
  if (months < 12) return `${months} meses`
  const years = Math.floor(months / 12)
  return `${years} ${years === 1 ? 'ano' : 'anos'}`
}

function calcVaccineStatus(nextDate: string | null): string {
  if (!nextDate) return 'sem reforço agendado'
  const next = new Date(nextDate)
  const today = new Date()
  const days = Math.floor((next.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  if (days < 0) return `ATRASADA há ${Math.abs(days)} dias`
  if (days === 0) return 'vence HOJE'
  if (days <= 30) return `vence em ${days} dias`
  return `próximo reforço em ${days} dias`
}

async function buildContext(supabase: any, userId: string): Promise<string> {
  const [petsRes, vaccinesRes, weightRes, expensesRes] = await Promise.all([
    supabase.from('pets').select('*').eq('user_id', userId).order('created_at'),
    supabase.from('vaccines').select('*').eq('user_id', userId).order('applied_date', { ascending: false }),
    supabase.from('weight_records').select('*').eq('user_id', userId).order('date', { ascending: false }).limit(20),
    supabase.from('expenses').select('*').eq('user_id', userId).order('date', { ascending: false }).limit(15),
  ])

  const pets = petsRes.data ?? []
  const vaccines = vaccinesRes.data ?? []
  const weights = weightRes.data ?? []
  const expenses = expensesRes.data ?? []

  if (pets.length === 0) return 'O usuário ainda não cadastrou nenhum pet no app.'

  const now = new Date()
  let ctx = `## Pets do usuário:\n`

  for (const pet of pets) {
    const age = calcAge(pet.birth_date)
    const petVaccines = vaccines.filter((v: any) => v.pet_id === pet.id)
    const petWeights = weights.filter((w: any) => w.pet_id === pet.id).slice(0, 5)

    ctx += `\n### ${pet.name} (${pet.species}${pet.breed ? ` - ${pet.breed}` : ''})`
    if (age) ctx += `, ${age}`
    if (pet.neutered) ctx += ', castrado(a)'
    ctx += '\n'
    if (pet.weight_kg) ctx += `- Peso atual: ${pet.weight_kg} kg\n`

    if (petWeights.length >= 2) {
      const diff = (Number(petWeights[0].weight_kg) - Number(petWeights[1].weight_kg)).toFixed(2)
      const trend = Number(diff) > 0.05 ? `↑ ganhou ${diff}kg` : Number(diff) < -0.05 ? `↓ perdeu ${Math.abs(Number(diff))}kg` : '→ estável'
      ctx += `- Tendência: ${trend}\n`
    }

    if (petVaccines.length > 0) {
      ctx += `- Vacinas:\n`
      for (const v of petVaccines.slice(0, 5)) {
        ctx += `  • ${v.name}: ${calcVaccineStatus(v.next_dose_date)}\n`
      }
    } else {
      ctx += `- Vacinas: nenhuma cadastrada\n`
    }
  }

  const monthExpenses = expenses.filter((e: any) => {
    const d = new Date(e.date)
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  })
  const totalMonth = monthExpenses.reduce((s: number, e: any) => s + Number(e.amount), 0)

  if (expenses.length > 0) {
    ctx += `\n## Gastos este mês: R$ ${totalMonth.toFixed(2)}\n`
  }

  return ctx
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return new Response('Unauthorized', { status: 401, headers: corsHeaders })

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return new Response('Unauthorized', { status: 401, headers: corsHeaders })

    const { message, history = [] } = await req.json()
    if (!message) return new Response('Message required', { status: 400, headers: corsHeaders })

    const context = await buildContext(supabase, user.id)

    const systemPrompt = `Você é o Fred 🐱, assistente virtual do PetCare+. Você é carinhoso, direto e especialista em cuidados com pets.

${context}

Diretrizes:
- Use o nome real dos pets nas respostas
- Alerte sobre vacinas atrasadas ou vencendo em breve
- Seja objetivo: respostas curtas e práticas
- Em dúvidas médicas sérias, recomende consultar um veterinário
- Fale em português do Brasil`

    const messages = [
      ...history.slice(-10),
      { role: 'user', content: message },
    ]

    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!anthropicKey) throw new Error('ANTHROPIC_API_KEY não configurada')

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 512,
        system: systemPrompt,
        messages,
      }),
    })

    if (!response.ok) {
      const errBody = await response.text()
      throw new Error(`Anthropic API error ${response.status}: ${errBody}`)
    }

    const data = await response.json()
    const reply = data.content?.[0]?.text ?? 'Não consegui processar sua mensagem.'

    return new Response(JSON.stringify({ reply }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Fred error:', err?.message ?? err)
    return new Response(JSON.stringify({ error: 'Erro interno', detail: err?.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
