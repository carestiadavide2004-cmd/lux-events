# LUX — Serate esclusive sul lungomare di Pescara

Sito vetrina per Lux, organizzazione di eventi esclusivi e serate di lusso sul lungomare di Pescara.

**Sito online:** https://carestiadavide2004-cmd.github.io/lux-events/

## Caratteristiche

- Scroll a schermo intero su desktop con transizioni fluide (scroll nativo con snap su tablet e mobile)
- Parallasse nella hero (scroll e movimento del mouse) e sugli sfondi delle sezioni
- Animazioni di comparsa su tutti gli elementi, titoli animati parola per parola
- Contatori animati, countdown al prossimo evento, galleria foto/video con lightbox
- Hover con bagliore dorato, pulsanti magnetici, cursore personalizzato
- Form "Lista esclusiva" e "Contatti" con validazione (solo frontend)
- Completamente responsive, rispetta `prefers-reduced-motion`

## Struttura

```
index.html      # markup di tutte le sezioni
css/style.css   # stile (palette in cima al file, variabili CSS)
js/main.js      # scroll a schermo intero, parallasse, animazioni, form
```

Nessuna dipendenza né build: è un sito statico, basta aprire `index.html`.

## Note

- Contatti, location, partner, statistiche ed evento sono **dati di esempio**.
- Foto e video: [Pexels](https://www.pexels.com) (licenza gratuita), caricati dai loro server.
