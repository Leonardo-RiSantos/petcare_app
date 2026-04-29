-- Atualiza policy de SELECT em medical_records
-- Tutores veem todos os registros dos seus pets (inclusive criados por vets)
drop policy if exists "users manage own medical records" on medical_records;

create policy "tutors see all pet records" on medical_records
  for select using (
    auth.uid() = user_id
    or exists (
      select 1 from pets
      where pets.id = medical_records.pet_id
      and pets.user_id = auth.uid()
    )
    or exists (
      select 1 from pet_vet_links pvl
      where pvl.pet_id = medical_records.pet_id
      and pvl.vet_id = auth.uid()
      and pvl.status = 'active'
    )
  );

create policy "users insert own records" on medical_records
  for insert with check (auth.uid() = user_id);

create policy "users update own records" on medical_records
  for update using (auth.uid() = user_id);

create policy "users delete own records" on medical_records
  for delete using (auth.uid() = user_id);

-- Vets podem ver dados dos pets vinculados
drop policy if exists "users manage own pets" on pets;

create policy "owners manage pets" on pets
  for all using (auth.uid() = user_id);

create policy "vets view linked patients" on pets
  for select using (
    exists (
      select 1 from pet_vet_links pvl
      where pvl.pet_id = pets.id
      and pvl.vet_id = auth.uid()
      and pvl.status = 'active'
    )
  );

-- Vets podem ver vacinas dos pacientes vinculados
drop policy if exists "users manage own vaccines" on vaccines;

create policy "owners manage vaccines" on vaccines
  for all using (auth.uid() = user_id);

create policy "vets view patient vaccines" on vaccines
  for select using (
    exists (
      select 1 from pet_vet_links pvl
      where pvl.pet_id = vaccines.pet_id
      and pvl.vet_id = auth.uid()
      and pvl.status = 'active'
    )
  );

-- Vets podem ver peso dos pacientes
drop policy if exists "users manage own weight records" on weight_records;

create policy "owners manage weight records" on weight_records
  for all using (auth.uid() = user_id);

create policy "vets view patient weight" on weight_records
  for select using (
    exists (
      select 1 from pet_vet_links pvl
      where pvl.pet_id = weight_records.pet_id
      and pvl.vet_id = auth.uid()
      and pvl.status = 'active'
    )
  );
