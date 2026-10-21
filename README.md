# AR Play Lab — WebXR (Android Chrome)

`index.html` încarcă three.js din CDN. La deschidere alegi experimentul, pe ecran mare: **Vulcan** sau **Circuit electric**. În AR, **„⇄ Schimbă”** trece de la unul la altul fără să ieși din sesiune. Ambele folosesc aceeași căutare a mesei: mai multe raze, planul cel mai mare și mai înalt, planurile mici ignorate, tap de plasare, umbră de contact.

**Vulcanul** este modelul sculptat `assets/volcano.glb` (meshopt) cu texturi foto CC0. **„Erupe!”** pornește lava, bombele și fumul. Poți apropia telefonul și te uiti în crater.

**Circuitul** este construit în three.js, la scară de masă (placa are ~30 cm). Tragi clema unui fir până la o bornă (se lipește când e aproape), apoi închizi întrerupătorul. Când bucla baterie–fir–întrerupător–bec–fir–baterie e închisă, filamentul se încălzește, sticla capătă o aură caldă și o lumină reală cade pe placă. **„✦ Electroni”** arată puncte mici de-a lungul firelor (oprit implicit). **„↺ Resetează”** desface firele.

Texturile CC0 (rocă Poly Haven, lavă și lemn ambientCG) sunt în [`CREDITS.md`](CREDITS.md). Pe desktop / iPhone se deschide automat **modul 3D** (fără cameră).

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
1. Deschide linkul → două carduri, **Vulcan** și **Circuit electric**. Alege unul. Apare butonul verde **„📱 Pornește AR”**. (Dacă lipsește: telefonul/Chrome nu raportează suport `immersive-ar` → verifică pașii de mai sus.)
2. Apasă „Pornește AR”, acceptă permisiunea pentru cameră.
3. Stai pe scaun, ține telefonul **puțin mai sus** și mișcă-l încet deasupra unei mese luminate, cu textură (nu sticlă/alb lucios). Apare **reticulul galben pe masă**, nu pe tastatură, mouse sau piciorul monitorului. Dacă nu găsește masa, textul spune: „Ține telefonul puțin mai sus și mișcă-l încet”.
4. **Atinge ecranul** → experimentul apare pe masă, cu umbră de contact. Lumina ar trebui să semene cu camera (dacă telefonul dă light estimation).
5. La vulcan: **„🔥 Erupe!”** → lavă pe pante, fum, scântei, un ușor tremur, sunet. **🔊** (stânga sus) oprește sunetul. Apoi cardul „Ce s-a întâmplat?”. Apropie telefonul și uită-te **în crater**.
6. La circuit: trage o clemă pe o bornă (se lipește când e aproape), leagă bucla și închide întrerupătorul. Textul devine „Circuit închis!…”. Apropie telefonul de bec și uită-te **în sticlă**, la filament. **„✦ Electroni”** pornește punctele de pe fire. **„↺ Resetează”** le desface.
7. **„⇄ Schimbă”** trece la celălalt experiment, pe aceeași masă, fără să ieși din AR. **„↺ Mută”** îl pune în alt loc. **„✕ Ieși”** închide AR.

### Probleme frecvente
- *Reticulul sare pe obiecte mici:* ține telefonul mai de sus, ca să vadă toată masa, și mișcă-l încet. Chrome nou (cu plane detection) ignoră planurile mici; pe Chrome mai vechi se folosesc mai multe raze în jos și se păstrează suprafața cea mai joasă.
- *Nu apare reticulul:* lumină slabă sau suprafață fără textură; mișcă telefonul lateral 2–3 secunde.
- *„Nu am putut porni AR”:* actualizează Google Play Services for AR și Chrome; verifică că URL-ul e `https://`.
- *Butoanele nu se văd în AR:* Chrome vechi fără `dom-overlay` — actualizează Chrome.

## iPhone (pe scurt)
Safari pe iOS **nu** suportă WebXR AR, deci pe iPhone se vede doar modul 3D (rotire cu degetul + „Erupe!”). Pentru AR pe iPhone în producție: aplicație Unity AR Foundation (ARKit); pentru un demo rapid se poate adăuga un `<model-viewer>` cu USDZ (AR Quick Look), dar fără erupția interactivă.

## Verificat pe box
- Sintaxa JS (`node --check`)
- Modul fallback 3D în Chrome headless, servit din subcalea `/ar-play-la/`: fără erori în consolă, bara de încărcare dispare, „Erupe!” pornește lavă / fum / scântei
- **De retestat pe telefon (vulcan, neschimbat):** cheagurile cad pe pante sau pe masă și se închid la culoare; pâraiele stau pe stâncă, în chei, și înaintează încet (~14 s).
- **De retestat pe telefon (circuit):** trage clemele, închide întrerupătorul, apoi apropie telefonul la 5–10 cm de bec și de o clemă de pe borna bateriei.

Specificația de produs: [`docs/MVP_SPEC.md`](docs/MVP_SPEC.md).
