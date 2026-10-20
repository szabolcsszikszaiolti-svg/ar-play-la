# Prototip „Vulcanul” — WebXR AR (Android Chrome)

Un singur fișier `index.html` (three.js din CDN, texturi procedurale, fără fișiere extra). Pe **Android Chrome cu ARCore** pornește AR real: caută **masa** (planul mare), nu obiectele mici de pe ea, arată un reticul galben, un tap pune vulcanul, butonul **„Erupe!”** pornește lava, fum și sunet. Pe desktop / iPhone se deschide automat **modul 3D de previzualizare** (fără cameră).

**GitHub Pages (main, rădăcină):** https://szabolcsszikszaiolti-svg.github.io/ar-play-la/

Deschide linkul de mai sus în Chrome pe telefon. Fișierul e în rădăcina repo-ului, cu căi relative și un `.nojekyll` gol, ca Pages să-l servească din subcalea `/ar-play-la/` fără procesare Jekyll.

## Ce îți trebuie pe telefon (Android)
1. Telefon din lista ARCore: https://developers.google.com/ar/devices
2. **Google Play Services for AR** instalat și actualizat din Play Store (caută „Google Play Services for AR”). Pe multe telefoane e preinstalat; dacă AR nu pornește, actualizează-l.
3. **Google Chrome** actualizat (nu Samsung Internet / Firefox pentru test).
4. Pagina trebuie servită prin **HTTPS** (WebXR nu merge pe `http://`, cu excepția `localhost`).

## Varianta 1 — GitHub Pages (cea mai simplă, link permanent)
1. Pagina e deja aici: `index.html` în rădăcina branch-ului `main` (plus `.nojekyll`).
2. Repo → **Settings → Pages** → Source: *Deploy from a branch* → `main` / `(root)` → Save.
3. După ~1 minut deschide **https://szabolcsszikszaiolti-svg.github.io/ar-play-la/** în Chrome pe telefon.

## Varianta 2 — server local + tunel HTTPS (pentru iterații rapide)
Pe calculator, în rădăcina repo-ului:
```bash
python3 -m http.server 8000
# într-un alt terminal, una dintre variante:
npx cloudflared tunnel --url http://localhost:8000     # Cloudflare quick tunnel, fără cont
# sau
ngrok http 8000                                        # cere cont ngrok gratuit
```
Deschide pe telefon linkul `https://...` afișat de tunel.

## Varianta 3 — USB + Chrome port forwarding (fără internet public)
1. Pe telefon: activează *Developer options* → *USB debugging*; conectează-l prin USB.
2. Pe calculator: Chrome → `chrome://inspect/#devices` → **Port forwarding** → `8000` → `localhost:8000` → bifează „Enable port forwarding”.
3. Pornește `python3 -m http.server 8000` și pe telefon deschide `http://localhost:8000` (localhost e considerat „secure”, deci WebXR merge). Bonus: vezi consola telefonului în `chrome://inspect`.

## Cum se testează
1. Deschide linkul → vezi vulcanul în 3D și butonul verde **„📱 Pornește AR”**. (Dacă butonul lipsește: telefonul/Chrome nu raportează suport `immersive-ar` → verifică pașii de mai sus.)
2. Apasă „Pornește AR”, acceptă permisiunea pentru cameră.
3. Stai pe scaun, ține telefonul **puțin mai sus** și mișcă-l încet deasupra unei mese luminate, cu textură (nu sticlă/alb lucios). Apare **reticulul galben pe masă**, nu pe tastatură, mouse sau piciorul monitorului. Dacă nu găsește masa, textul spune: „Ține telefonul puțin mai sus și mișcă-l încet”.
4. **Atinge ecranul** → vulcanul apare pe masă, cu umbră de contact. Lumina ar trebui să semene cu camera (dacă telefonul dă light estimation).
5. Apasă **„🔥 Erupe!”** → lavă pe pante, fum, scântei, un ușor tremur, sunet. **🔊** (stânga sus) oprește sunetul. Apoi cardul „Ce s-a întâmplat?”.
6. **„↺ Mută vulcanul”** → îl poți pune în alt loc. **„✕ Ieși”** închide AR.

### Probleme frecvente
- *Reticulul sare pe obiecte mici:* ține telefonul mai de sus, ca să vadă toată masa, și mișcă-l încet. Chrome nou (cu plane detection) ignoră planurile mici; pe Chrome mai vechi se folosesc mai multe raze în jos și se păstrează suprafața cea mai joasă.
- *Nu apare reticulul:* lumină slabă sau suprafață fără textură; mișcă telefonul lateral 2–3 secunde.
- *„Nu am putut porni AR”:* actualizează Google Play Services for AR și Chrome; verifică că URL-ul e `https://`.
- *Butoanele nu se văd în AR:* Chrome vechi fără `dom-overlay` — actualizează Chrome.

## iPhone (pe scurt)
Safari pe iOS **nu** suportă WebXR AR, deci pe iPhone se vede doar modul 3D (rotire cu degetul + „Erupe!”). Pentru AR pe iPhone în producție: aplicație Unity AR Foundation (ARKit); pentru un demo rapid se poate adăuga un `<model-viewer>` cu USDZ (AR Quick Look), dar fără erupția interactivă.

## Verificat pe box
- Sintaxa JS (`node --check`)
- Modul fallback 3D în Chrome headless, servit din subcalea `/ar-play-la/`: fără erori în consolă, „Erupe!” pornește lavă / fum / scântei, cardul apare
- **De retestat pe telefon:** reticulul de pe scaun (masa, nu tastatura), lumina din cameră, sunetul, și dacă erupția rămâne fluidă

Specificația de produs: [`docs/MVP_SPEC.md`](docs/MVP_SPEC.md).
