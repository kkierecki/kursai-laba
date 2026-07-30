# Migracje Supabase

Uruchamiaj skrypty w Supabase SQL Editor dokładnie w tej kolejności:

1. `001_initial_agent_memory.sql`
2. `002_running_mvp.sql`
3. `003_add_athlete_home_location.sql`
4. `004_add_metric_observation_dates.sql`
5. `006_add_race_plans.sql`
6. `007_allow_manual_race_plans.sql`
7. `007_add_sleep_quality_scale.sql`
8. `008_add_runner_briefings.sql`
9. `009_add_webhook_events.sql`
10. `010_enable_row_level_security.sql`
11. `011_add_chat_security.sql`

Zakres migracji:

- `001` — historia rozmów, profile, dokumenty z embeddingami oraz funkcja `match_documents`;
- `002` — profil biegacza, strefy tętna, cele, treningi i regeneracja;
- `003` — lokalizacja biegacza do dopasowania warunków i terenu.
- `004` — daty źródłowe metryk, potrzebne do bezpiecznego rozstrzygania konfliktów.
- `011` — walidowane logi wiadomości oraz atomowy limit 50 wiadomości na godzinę na użytkownika.

Każda kolejna zmiana schematu powinna być nowym plikiem z kolejnym numerem — nie edytuj migracji wykonanych już na współdzielonym środowisku.
