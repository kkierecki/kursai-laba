-- Naprawa starszych skrótów płci zapisanych przed wprowadzeniem ograniczenia.
-- Dzięki temu późniejsza aktualizacja innej metryki profilu nie narusza CHECK-a.
update public.athlete_profiles
set sex = case lower(trim(sex))
  when 'm' then 'male'
  when 'man' then 'male'
  when 'mezczyzna' then 'male'
  when 'mężczyzna' then 'male'
  when 'f' then 'female'
  when 'k' then 'female'
  when 'woman' then 'female'
  when 'kobieta' then 'female'
  when 'non-binary' then 'nonbinary'
  when 'niebinarna' then 'nonbinary'
  when 'niebinarny' then 'nonbinary'
  when 'nie podano' then 'undisclosed'
  when 'brak' then 'undisclosed'
  else sex
end,
updated_at = now()
where sex is not null
  and sex not in ('female', 'male', 'nonbinary', 'undisclosed');
