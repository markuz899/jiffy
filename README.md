# Jiffy

I tuoi ticket Jira aperti, a un clic di distanza.

Jiffy è un'estensione per Chrome e Firefox che mostra, in un popup, i ticket Jira Cloud assegnati a te e non ancora risolti. Puoi filtrarli per chiave o titolo e aprirli direttamente in Jira.

## Come funziona

- Usa la sessione Jira con cui sei già autenticato nel browser: niente token o password.
- Interroga `https://<tuo-sito>.atlassian.net` con la JQL:
  `assignee = currentUser() AND resolution = Unresolved ORDER BY updated DESC`
- Salva in locale (`chrome.storage.local`) solo il nome del sito Jira. Nessun dato viene inviato a terzi.

## Installazione dalla repo

```sh
git clone git@github.com:markuz899/jiffy.git
```

Non c'è niente da compilare: la cartella clonata è già l'estensione.

### Chrome / Edge / Brave

1. Apri `chrome://extensions`.
2. Attiva **Modalità sviluppatore** (in alto a destra).
3. Clicca **Carica estensione non pacchettizzata** e seleziona la cartella `jiffy`.
4. Fissa l'icona di Jiffy nella barra degli strumenti.

### Firefox

1. Apri `about:debugging#/runtime/this-firefox`.
2. Clicca **Carica componente aggiuntivo temporaneo…** e seleziona `manifest.json`.

> In Firefox l'installazione temporanea viene rimossa alla chiusura del browser. Per un'installazione permanente usa la versione pubblicata su AMO.

### Primo avvio

1. Assicurati di aver fatto login su `https://<tuo-sito>.atlassian.net`.
2. Apri il popup di Jiffy e inserisci il nome del sito (es. `acme` per `acme.atlassian.net`).
3. Clicca **Connect**.

Per aggiornare: `git pull`, poi clicca ↻ sull'estensione in `chrome://extensions` (in Firefox: **Ricarica**).

## Pubblicazione

### Creare il pacchetto

Aumenta `version` in `manifest.json`, poi, dalla cartella del progetto:

```sh
zip -r ../jiffy-$(grep -o '"version": *"[^"]*"' manifest.json | cut -d'"' -f4).zip \
  manifest.json popup.* icons -x "*.DS_Store"
```

I file devono trovarsi alla radice dello zip.

### Chrome Web Store

1. Registrati su https://chrome.google.com/webstore/devconsole (5 $ una tantum).
2. **New item** → carica lo zip.
3. Compila la scheda: descrizione, almeno uno screenshot 1280×800 o 640×400, categoria.
4. Nella scheda **Privacy**:
   - scopo unico: mostrare i ticket Jira aperti dell'utente;
   - `storage`: memorizza il nome del sito Jira;
   - `https://*.atlassian.net/*`: legge i ticket dall'API di Jira Cloud;
   - nessuna raccolta dati; indica l'URL di una privacy policy.
5. **Submit for review**.

### Firefox Add-ons (AMO)

1. Prima del primo upload, sostituisci `jiffy@local` in `browser_specific_settings.gecko.id` con un ID univoco (es. `jiffy@tuodominio`). Dopo non potrai più cambiarlo.
2. Vai su https://addons.mozilla.org/developers/ → **Submit a New Add-on**.
3. Scegli **On this site** (listato pubblico) o **On your own** (solo firma).
4. Carica lo stesso zip. Il codice non è minificato, quindi non servono i sorgenti.

Per ogni aggiornamento: aumenta `version`, rifai lo zip e caricalo nello stesso item su entrambi gli store.
