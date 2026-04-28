# Fred Chat — Supabase Edge Function

## Deploy

1. Instale o Supabase CLI:
   https://supabase.com/docs/guides/cli

2. Faça login:
   supabase login

3. Adicione a chave da Anthropic como secret:
   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...

4. Deploy da função:
   supabase functions deploy fred-chat --project-ref wqabzvataiellbttoojn

## SQL adicional no Supabase (opcional - histórico persistente)

Rode no SQL Editor do Supabase:

create table fred_conversations (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  role text not null,
  content text not null,
  created_at timestamp with time zone default now()
);
alter table fred_conversations enable row level security;
create policy "users own conversations" on fred_conversations
  for all using (auth.uid() = user_id);
