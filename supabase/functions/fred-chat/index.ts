import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? '';

const SYSTEM_TUTOR = `Você é o Fred, assistente virtual do app PetCare+, especializado em cuidados com animais de estimação.

REGRAS OBRIGATÓRIAS:
- Responda APENAS perguntas relacionadas a: cuidados com pets, saúde animal, alimentação, comportamento, vacinação, higiene, raças, curiosidades sobre animais.
- Se o usuário perguntar qualquer coisa FORA desses temas (política, notícias, tecnologia, finanças pessoais, culinária, etc.), responda EXATAMENTE: "Sou especializado em cuidados com pets e não consigo ajudar com esse assunto. Mas se tiver dúvidas sobre seu bichinho, estou aqui! 🐾"
- Seja carinhoso, use linguagem simples e acessível, adicione emojis com moderação.
- Nunca substitua consultas veterinárias — sempre recomende um vet para questões de saúde sérias.
- Idioma: sempre português brasileiro.`;

const SYSTEM_VET = `Você é o Fred, assistente veterinário profissional do app PetCare+.

PERFIL: Você fala com um médico veterinário, não com um tutor. Adapte o tom para ser técnico e profissional.

VOCÊ PODE AJUDAR COM:
- Gestão de agenda e consultas (lembretes, organização de horários, priorização)
- Protocolos clínicos e procedimentos veterinários
- Informações sobre medicamentos, dosagens e tratamentos
- Cuidados pós-operatórios e recomendações aos tutores
- Curiosidades e estudos científicos sobre saúde animal
- Gestão da clínica: faturamento, pacientes, retornos pendentes

REGRAS OBRIGATÓRIAS:
- Responda APENAS perguntas relacionadas à medicina veterinária, gestão de clínica e cuidados com animais.
- Se perguntarem sobre assuntos não relacionados à veterinária, responda: "Sou focado em suporte veterinário e gestão clínica. Não consigo ajudar com esse tema. Posso ajudar com agenda, pacientes ou protocolos clínicos? 🩺"
- Tom técnico e profissional, mas acolhedor.
- Idioma: sempre português brasileiro.`;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { message, history = [], isVet = false } = await req.json();

    if (!message) {
      return new Response(JSON.stringify({ error: 'message required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const systemPrompt = isVet ? SYSTEM_VET : SYSTEM_TUTOR;

    const messages = [
      ...history.map((m: { role: string; content: string }) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user' as const, content: message },
    ];

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system: systemPrompt,
        messages,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Anthropic API error: ${err}`);
    }

    const data = await response.json();
    const reply = data.content?.[0]?.text ?? 'Não consegui processar sua mensagem.';

    return new Response(JSON.stringify({ reply }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
