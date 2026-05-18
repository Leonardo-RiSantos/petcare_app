-- ============================================================
-- FIX: RLS do chat vet↔tutor + Realtime
-- Problema: tutor não recebia mensagens do vet em tempo real
-- porque a política SELECT bloqueava rows com sender_role='vet'
-- Execute no Supabase SQL Editor
-- ============================================================

-- Garante que a tabela existe com REPLICA IDENTITY FULL
-- (necessário para Supabase Realtime entregar eventos com RLS)
ALTER TABLE public.vet_chat_messages REPLICA IDENTITY FULL;

-- Ativa Realtime na tabela (caso não esteja ativo)
BEGIN;
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime FOR ALL TABLES;
COMMIT;

-- Remove políticas antigas
DROP POLICY IF EXISTS "vet_can_manage_chat"   ON public.vet_chat_messages;
DROP POLICY IF EXISTS "tutor_can_read_chat"   ON public.vet_chat_messages;
DROP POLICY IF EXISTS "tutor_can_send_chat"   ON public.vet_chat_messages;
DROP POLICY IF EXISTS "vet_can_read_chat"     ON public.vet_chat_messages;
DROP POLICY IF EXISTS "vet_can_send_chat"     ON public.vet_chat_messages;
DROP POLICY IF EXISTS "chat_select"           ON public.vet_chat_messages;
DROP POLICY IF EXISTS "chat_insert"           ON public.vet_chat_messages;

-- Habilita RLS (caso não esteja)
ALTER TABLE public.vet_chat_messages ENABLE ROW LEVEL SECURITY;

-- SELECT: vet vê todas as mensagens das suas conversas
--         tutor vê todas as mensagens dos seus pets
CREATE POLICY "chat_select"
  ON public.vet_chat_messages FOR SELECT
  USING (
    vet_id = auth.uid()
    OR
    pet_id IN (
      SELECT id FROM public.pets WHERE user_id = auth.uid()
    )
  );

-- INSERT: vet insere mensagens onde é o vet
CREATE POLICY "vet_can_send_chat"
  ON public.vet_chat_messages FOR INSERT
  WITH CHECK (
    vet_id = auth.uid() AND sender_role = 'vet'
  );

-- INSERT: tutor insere mensagens nos seus pets
CREATE POLICY "tutor_can_send_chat"
  ON public.vet_chat_messages FOR INSERT
  WITH CHECK (
    sender_role = 'tutor'
    AND pet_id IN (
      SELECT id FROM public.pets WHERE user_id = auth.uid()
    )
  );

-- UPDATE: mark as read — vet marca tutor msgs, tutor marca vet msgs
CREATE POLICY "chat_update_read"
  ON public.vet_chat_messages FOR UPDATE
  USING (
    vet_id = auth.uid()
    OR pet_id IN (SELECT id FROM public.pets WHERE user_id = auth.uid())
  );
