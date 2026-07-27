# Migracje Supabase

Uruchamiaj skrypty w Supabase SQL Editor dokładnie w tej kolejności:

1. `001_initial_agent_memory.sql`
2. `002_running_mvp.sql`
3. `003_add_athlete_home_location.sql`
4. `004_add_metric_observation_dates.sql`
5. `006_add_race_plans.sql`

Zakres migracji:

- `001` — historia rozmów, profile, dokumenty z embeddingami oraz funkcja `match_documents`;
- `002` — profil biegacza, strefy tętna, cele, treningi i regeneracja;
- `003` — lokalizacja biegacza do dopasowania warunków i terenu.
- `004` — daty źródłowe metryk, potrzebne do bezpiecznego rozstrzygania konfliktów.

Każda kolejna zmiana schematu powinna być nowym plikiem z kolejnym numerem — nie edytuj migracji wykonanych już na współdzielonym środowisku.
