import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Anthropic from 'npm:@anthropic-ai/sdk'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const anthropic = new Anthropic({
  apiKey: Deno.env.get('ANTHROPIC_API_KEY')!,
})

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

async function buildContext(supabase: ReturnType<typeof createClient>, userId: string): Promise<string> {
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

  if (pets.length === 0) {
    return 'O usuário ainda não cadastrou nenhum pet no app.'
  }

  const now = new Date()
  const currentMonth = now.getMonth()
  const currentYear = now.getFullYear()

  let ctx = `## Pets do usuário:\n`
  for (const pet of pets) {
    const age = calcAge(pet.birth_date)
    const petVaccines = vaccines.filter((v: any) => v.pet_id === pet.id)
    const petWeights = weights.filter((w: any) => w.pet_id === pet.id).slice(0, 5)

    ctx += `\n### ${pet.name} (${pet.species}${pet.breed ? ` - ${pet.breed}` : ''})`
    if (age) ctx += `, ${age}`
    if (pet.sex) ctx += `, ${pet.sex}`
    if (pet.neutered) ctx += ', castrado(a)'
    ctx += '\n'

    if (pet.weight_kg) ctx += `- Peso atual: ${pet.weight_kg} kg\n`

    if (petWeights.length >= 2) {
      const latest = Number(petWeights[0].weight_kg)
      const prev = Number(petWeights[1].weight_kg)
      const diff = (latest - prev).toFixed(2)
      const trend = Number(diff) > 0.05 ? `↑ ganhou ${diff}kg` : Number(diff) < -0.05 ? `↓ perdeu ${Math.abs(Number(diff))}kg` : '→ estável'
      ctx += `- Tendência de peso: ${trend} (últimas medições: ${petWeights.slice(0, 3).map((w: any) => `${w.weight_kg}kg em ${w.date}`).join(', ')})\n`
    }

    if (petVaccines.length > 0) {
      ctx += `- Vacinas:\n`
      for (const v of petVaccines.slice(0, 5)) {
        ctx += `  • ${v.name}: aplicada ${v.applied_date}, ${calcVaccineStatus(v.next_dose_date)}\n`
      }
    } else {
      ctx += `- Vacinas: nenhuma cadastrada\n`
    }
  }

  // Gastos do mês atual
  const monthExpenses = expenses.filter((e: any) => {
    const d = new Date(e.date)
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear
  })
  const totalMonth = monthExpenses.reduce((s: number, e: any) => s + Number(e.amount), 0)

  if (expenses.length > 0) {
    ctx += `\n## Gastos recentes:\n`
    ctx += `- Total este mês: R$ ${totalMonth.toFixed(2)}\n`
    const byCategory: Record<string, number> = {}
    expenses.forEach((e: any) => { byCategory[e.category] = (byCategory[e.category] || 0) + Number(e.amount) })
    const cats = Object.entries(byCategory).sort((a, b) => b[1] - a[1]).slice(0, 4)
    for (const [cat, total] of cats) {
      ctx += `- ${cat}: R$ ${total.toFixed(2)}\n`
    }
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

    const systemPrompt = `Você é o Fred 🐱, assistente virtual inteligente do PetCare+. Você é carinhoso, direto e especialista em cuidados com pets.

Seu objetivo é ajudar tutores a cuidarem melhor de seus animais usando os dados reais do app — vacinas, peso, gastos e rotinas.

${context}

## Diretrizes:
- Use o nome real dos pets nas respostas
- Alerte sobre vacinas atrasadas ou vencendo em breve
- Comente sobre tendências de peso (ganho/perda relevante)
- Parabenize o tutor por bons cuidados
- Seja objetivo: respostas curtas e práticas, sem rodeios
- Em dúvidas médicas sérias, recomende consultar um veterinário
- Fale em português do Brasil`

    // Limita histórico a últimas 10 trocas para economizar tokens
    const recentHistory = history.slice(-10)

    const response = await anthropic.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 512,
      system: [
        {
          type: 'text',
          text: systemPrompt,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [
        ...recentHistory,
        { role: 'user', content: message },
      ],
    })

    const reply = response.content.find((b: any) => b.type === 'text')?.text ?? 'Não consegui processar sua mensagem.'

    return new Response(JSON.stringify({ reply }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Fred error:', err)
    return new Response(JSON.stringify({ error: 'Erro interno' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
