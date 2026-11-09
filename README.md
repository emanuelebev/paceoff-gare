# Pace Off: calendario gare

L'elenco delle gare di corsa su strada italiane che l'app Pace Off propone
alla domanda "La tua gara?".

- `gare.json`: quello che scarica l'app (`{ aggiornato, gare: [{ nome, citta, distanza, data }] }`).
  Solo gare con data confermata dall'organizzatore e non ancora passate.
- `fonti.json`: la ricerca completa, con la fonte di ogni data e le gare non ancora confermate.

Si aggiorna una volta al mese. Le date vengono dai siti ufficiali degli
organizzatori o dal calendario FIDAL: se una data non è confermata, non
entra in `gare.json`.

Due controlli automatici (`.github/workflows/`): `controlla.yml` controlla
`gare.json` e `versione.json` a ogni modifica (`controlla.mjs`), e
`servizio-garmin.yml` ogni mattina chiede una seduta al servizio delle
sedute Garmin e apre una issue se non risponde.
