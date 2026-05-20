import fs from 'fs';

const target = `### Titoli / Titles
- IT: [Titolo in italiano: 100% attinente al video, crea un "curiosity gap" reale senza clickbait. Max 50 caratteri.]
- EN: [Titolo in inglese: 100% attinente al video, crea un "curiosity gap" reale senza clickbait. Max 50 caratteri.]

### Video Hook (Overlay)
- IT: [Testo in sovrimpressione (primi 2s): Breve, contestuale all'azione visiva, pone una domanda o fa un'affermazione forte ma VERA rispetto al video.]
- EN: [Testo in sovrimpressione in inglese: Breve, contestuale all'azione visiva.]

### Ganci / Hooks
- IT: 1. [Hook 1 IT - basato sul contenuto reale], 2. [Hook 2 IT - basato sul contenuto reale]
- EN: 1. [Hook 1 EN - basato sul contenuto reale], 2. [Hook 2 EN - basato sul contenuto reale]

### Metadati / Metadata
- Descrizione IT: [Descrizione in italiano. Spiega il contesto del video aggiungendo valore o una domanda per i commenti. Molto attinente.]
- Description EN: [Descrizione in inglese. Spiega il contesto del video aggiungendo valore o una domanda per i commenti. Molto attinente.]
- Hashtags IT: [5-7 hashtag in italiano. SOLO hashtag iper-specifici e di nicchia, strettamente legati a ciò che si vede e si dice nel video. NESSUN hashtag generico.]
- Hashtags EN: [5-7 hashtag in inglese. SOLO hashtag iper-specifici e di nicchia, strettamente legati a ciò che si vede e si dice nel video. NESSUN hashtag generico.]
- Tags IT: [Tag in italiano. Keyword specifiche a coda lunga (long-tail) che descrivono esattamente la scena, i personaggi e l'argomento.]
- Tags EN: [Tag in inglese. Keyword specifiche a coda lunga (long-tail) che descrivono esattamente la scena, i personaggi e l'argomento.]
- Nome File / File Name: [Nome file ottimizzato SEO]
- Orario Consigliato / Recommended Time: [Orario consigliato]`;

const replacement = `### Titoli / Titles
- IT: [Titolo in italiano: DEVE ESSERE IPNOTICO E IPER-SPECIFICO. Niente titoli generici o noiosi. Crea un "curiosity gap" reale basato su un dettaglio assurdo o forte del video. Max 50 caratteri. Vietato usare emoji banali.]
- EN: [Titolo in inglese: DEVE ESSERE IPNOTICO E IPER-SPECIFICO. Niente titoli generici o noiosi. Crea un "curiosity gap" reale basato su un dettaglio assurdo o forte del video. Max 50 caratteri. Vietato usare emoji banali.]

### Video Hook (Overlay)
- IT: [Testo in sovrimpressione (primi 2s): Breve, tagliente, contestuale all'azione visiva. Pone una domanda scomoda o fa un'affermazione forte ma VERA rispetto al video. Deve fermare lo scroll all'istante.]
- EN: [Testo in sovrimpressione in inglese: Breve, tagliente, contestuale all'azione visiva. Pone una domanda scomoda o fa un'affermazione forte ma VERA rispetto al video. Deve fermare lo scroll all'istante.]

### Ganci / Hooks
- IT: 1. [Hook 1 IT - basato su un dettaglio microscopico e reale del video], 2. [Hook 2 IT - basato su un'emozione forte suscitata dal video]
- EN: 1. [Hook 1 EN - basato su un dettaglio microscopico e reale del video], 2. [Hook 2 EN - basato su un'emozione forte suscitata dal video]

### Metadati / Metadata
- Descrizione IT: [Descrizione in italiano. NIENTE FRASI FATTE. Spiega il contesto del video in modo crudo e diretto, aggiungendo valore o una domanda polarizzante per i commenti. Molto attinente.]
- Description EN: [Descrizione in inglese. NIENTE FRASI FATTE. Spiega il contesto del video in modo crudo e diretto, aggiungendo valore o una domanda polarizzante per i commenti. Molto attinente.]
- Hashtags IT: [5-7 hashtag in italiano. SOLO hashtag iper-specifici e di nicchia, strettamente legati a ciò che si vede e si dice nel video. NESSUN hashtag generico come #viral, #fyp, #funny. Usa hashtag che descrivono l'azione esatta o il sentimento.]
- Hashtags EN: [5-7 hashtag in inglese. SOLO hashtag iper-specifici e di nicchia, strettamente legati a ciò che si vede e si dice nel video. NESSUN hashtag generico come #viral, #fyp, #funny. Usa hashtag che descrivono l'azione esatta o il sentimento.]
- Tags IT: [Tag in italiano. Keyword specifiche a coda lunga (long-tail) che descrivono esattamente la scena, i personaggi e l'argomento. Niente tag generici.]
- Tags EN: [Tag in inglese. Keyword specifiche a coda lunga (long-tail) che descrivono esattamente la scena, i personaggi e l'argomento. Niente tag generici.]
- Nome File / File Name: [Nome file ottimizzato SEO, iper-descrittivo]
- Orario Consigliato / Recommended Time: [Orario consigliato]`;

let content = fs.readFileSync('src/services/gemini.ts', 'utf8');
content = content.split(target).join(replacement);
fs.writeFileSync('src/services/gemini.ts', content);
