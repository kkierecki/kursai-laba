# Komendy trenera biegania

## `/trening`

Zapisuje i analizuje wykonany trening na podstawie opisu lub screena z Garmin Connect, Stravy albo innej aplikacji.

Format odpowiedzi:

1. **Trening**
2. **Dane**
3. **Ocena intensywności**
4. **Regeneracja**
5. **Następny krok**

Przykład:

```text
/trening 8 km spokojnie, 46:20, średnie tętno 142, kadencja 168
```

## `/podsumowanie`

Podsumowuje tydzień lub inny wskazany okres treningowy.

Format odpowiedzi:

1. **Okres**
2. **Obciążenie**
3. **Co działa**
4. **Ryzyka**
5. **Plan na kolejny tydzień**

Przykład:

```text
/podsumowanie tydzień: 32 km, 4 biegi, interwały we wtorek, długi bieg 14 km w sobotę
```

Agent nie zgaduje danych niewidocznych na screenie, nie zaleca biegania przez ból i kieruje do specjalisty przy sygnałach zdrowotnych wymagających konsultacji.
