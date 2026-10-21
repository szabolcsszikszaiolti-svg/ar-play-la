# AR Play Lab — Specificație MVP

> Aplicație AR pentru copii (5–10 ani): copilul îndreaptă camera telefonului (al părintelui) spre masă sau podea și vede experimente științifice virtuale ancorate în cameră. Focus MVP: **plane detection simplă + interacțiune prin tap**.
> Platformă țintă: Android + iPhone. **Prototipul se testează întâi pe Android (Chrome + ARCore).**
> Fapte verificate la data de 20 oct 2026.

---

## 1. Abordare tehnică — comparație scurtă

| Opțiune | Android | iPhone | Pro | Contra |
|---|---|---|---|---|
| **WebXR `immersive-ar` + `hit-test`** (three.js) | ✅ Chrome Android cu *Google Play Services for AR* (ARCore) pe telefon compatibil | ❌ Safari iOS **nu** suportă WebXR immersive-ar (Apple: „not supported on visionOS or iOS”; flag-ul există, dar e nefuncțional) | Zero instalare, iterație în minute, un singur `index.html` | Doar Android; fără ocluziune/lumină avansată; UX depinde de browser |
| **`<model-viewer>`** (Google) | ✅ Scene Viewer (ARCore) sau WebXR | ✅ AR Quick Look (fișier USDZ) | Funcționează pe ambele platforme, foarte rapid | Practic doar „pune un model 3D animat”; interacțiune custom (butoane, particule, logică) foarte limitată în AR |
| **8th Wall-type (SLAM web pe camera brută)** | ✅ | ✅ | Funcționa cross-browser, inclusiv iOS | **8th Wall hosted s-a închis** (acces platformă oprit 28 feb 2026; proiectele găzduite rulează până 28 feb 2027). Continuă ca open source la 8thwall.org, dar SLAM e doar într-un binar închis cu licență limitată — risc mare pentru un produs nou |
| **Nativ: Unity AR Foundation** (ARKit + ARCore) | ✅ | ✅ | Un singur cod pentru ambele; plane detection robust, ocluziune, light estimation, offline complet, publicare în store-uri; ecosistem matur pentru jocuri pentru copii | Build/semnare/store review; dimensiune app mai mare; curbă de învățare Unity |
| Nativ separat (ARKit/RealityKit + ARCore/Sceneform-urmași) | ✅ | ✅ | Calitate maximă per platformă | Două coduri separate — prea scump pentru MVP |

### Recomandare
- **Prototip (acum): WebXR + three.js pe Android Chrome.** Validăm rapid „scan → place → tap → erupe” pe telefonul lui SNAKE, fără store și fără build. Pe iPhone/desktop, același fișier arată un **mod 3D fallback** (fără cameră). Pentru telefoanele Android fără ARCore avem **Modul simplu cu înclinarea telefonului** (vezi 2.4). Dacă vrem o demonstrație AR și pe iPhone, putem adăuga `<model-viewer>` cu un USDZ (Quick Look) — doar „vulcanul pe masă”, fără erupția interactivă.
- **Producție: Unity AR Foundation** (ARKit pe iOS, ARCore pe Android). E singura cale realistă de a avea aceeași experiență interactivă pe ambele platforme, offline, fără conturi, cu UX controlat complet. Logica și asset-urile validate în prototip se portează direct (aceleași 3 experimente, aceleași ecrane).

---

## 2. Experimentele MVP (3 în AR + modul simplu)

### 🌋 2.1 Vulcanul de pe masă
- **Suprafață:** orizontală — masă (ideal) sau podea. Mărime ~25 cm.
- **Ce face copilul:** scanează masa → tap pentru a pune vulcanul → tap pe „Erupe!” → (v2: tap pe „bicarbonat” + „oțet” ca ingrediente, în ordine).
- **Ce se întâmplă:** craterul începe să lumineze, vulcanul tremură puțin, iese lavă (particule portocalii/galbene) care cade și curge pe lângă bază.
- **Ce învață:** presiunea gazelor împinge magma în sus; magma care iese afară se numește lavă; (v2: reacția acid + bază face bule de CO₂ — experimentul real pe care îl pot face acasă cu un părinte).
- **Asset-uri:** model vulcan (procedural în prototip; low-poly stilizat în producție), sistem de particule lavă, sunet „bubuit” + fâsâit, 1 card „Ce s-a întâmplat?”, 2 icoane ingrediente.

### 💡 2.2 Circuitul simplu: baterie + bec
- **Suprafață:** masă.
- **Ce face copilul:** pune pe masă o placă cu baterie, bec și 2 fire desprinse → trage/atinge capetele firelor ca să le „conecteze” la bornele bateriei → apasă întrerupătorul.
- **Ce se întâmplă:** când circuitul e închis, apar „bilute” de electricitate care circulă pe fir și becul se aprinde (lumină caldă pe masă); dacă deschide întrerupătorul, becul se stinge. Mod bonus: înlocuiește un fir cu „lemn” vs „metal” (conductor/izolator).
- **Ce învață:** curentul circulă doar printr-un **cerc închis**; metalul conduce, lemnul/plasticul nu.
- **Asset-uri:** baterie, bec (cu stare aprins/stins + emisivă), 2 fire cu capete „snap”, întrerupător, particule pentru curent, materiale lemn/metal, sunet „clic” + „zumzet”, card explicativ.
- **Prototip (acum):** placa de lemn, 2×AA, bec cu filament, întrerupător și 3 fire cu cleme sunt în pagină. Electronii animați sunt opționali și opriți implicit. Bonusul lemn/metal nu este încă inclus.

### 🌱 2.3 Creșterea plantei (timelapse)
- **Suprafață:** podea sau masă (ghiveci ~20 cm; pe podea poate crește „mare”).
- **Ce face copilul:** pune ghiveciul → tap pe sămânță ca s-o planteze → tap pe „💧 Apă” și „☀️ Soare” → glisează un slider de timp „Zile” (1 → 30).
- **Ce se întâmplă:** sămânța încolțește, apar rădăcini (vizibile printr-un ghiveci „de sticlă”), tulpina și frunzele cresc, apare o floare. Fără apă/soare planta se ofilește (feedback blând, nu „game over”).
- **Ce învață:** plantele au nevoie de apă, lumină și timp; ordinea: sămânță → rădăcină → tulpină → frunze → floare.
- **Asset-uri:** ghiveci transparent, 5 etape de plantă (sau o animație blend-shape), particule apă, rază de soare, slider UI, card cu cele 5 etape.

### 📲 2.4 Mod simplu cu înclinarea telefonului (fallback fără ARCore)
- **Pentru cine:** telefoane fără ARCore / fără WebXR AR (Android vechi sau low-end, iPhone în varianta web, desktop). **Fără plane detection și fără cameră** — scena 3D e pe ecran, pe un fundal colorat („masa virtuală”).
- **Tehnologie:** `DeviceOrientationEvent` (unghiurile `beta`/`gamma`) în web; în Unity, `Input.gyro` / accelerometru. Pe Android Chrome merge direct pe HTTPS; pe iOS Safari trebuie cerută permisiunea cu `DeviceOrientationEvent.requestPermission()` dintr-un tap (buton „Activează înclinarea”). Dacă senzorul lipsește → control cu degetul (drag).
- **Ce face copilul (exemple):**
  - *Plantă:* înclină telefonul ca să „verse” apă din stropitoare pe plantă; prea multă apă → baltă în ghiveci (feedback blând: „Destul, planta e sătulă!”).
  - *Vulcan:* după erupție, înclină telefonul stânga/dreapta ca lava să curgă la vale și să ocolească o căsuță/un copac — vede că lava curge mereu în jos.
  - *Circuit (opțional):* înclină ca o bilă de „electricitate” să parcurgă firul până la bec.
- **Ce se întâmplă:** obiectele reacționează la gravitație simulată (direcția „în jos” = înclinarea telefonului), cu animații și sunete ca în modul AR; la final apare același card „Ce am învățat?”.
- **Ce învață:** gravitația trage lichidele în jos; plantele au nevoie de apă, dar nu prea multă.
- **Asset-uri:** aceleași modele ca în AR + stropitoare, fundal „masă” ilustrat, filtrare/netezire a senzorului (low-pass), o calibrare „ține telefonul drept și apasă OK”.
- **De ce contează:** niciun copil nu rămâne „pe dinafară” pentru că telefonul părintelui nu suportă AR; și e un mod bun pentru copiii mici (5–6 ani) care obosesc repede ținând telefonul spre masă.

---

## 3. UX de bază

1. **Ecran start** (fără cont, fără login): 3 cartonașe mari cu experimentele. Părintele vede un scurt mesaj de siguranță („Joacă-te într-un loc liber, cu un adult aproape”).
2. **Scanează suprafața:** animație cu o mână care mișcă telefonul + text simplu („Mișcă încet telefonul deasupra mesei”). Reticul galben când e găsită o suprafață. Dacă telefonul nu are ARCore sau nu găsește suprafață în ~15 s → oferim Modul simplu cu înclinarea (2.4).
3. **Plasează:** un singur tap pune obiectul; buton „Mută” pentru a-l repoziționa. Scala e fixă (de jucărie), nu cere pinch.
4. **Interacționează:** 1–3 butoane mari (≥ 64 px), cu icoane + text scurt; acțiunile au feedback imediat (sunet, vibrație scurtă, animație).
5. **Card „Ce am învățat?”:** 2–3 propoziții, text mare, opțional audio citit (pentru copiii care nu citesc încă) + o idee „Încearcă acasă cu un adult”.
6. **Reia / alt experiment.**

Principii: texte de max. 1–2 rânduri, tot UI-ul utilizabil fără citit (icoane + voce), fără limite de timp, fără eșec „punitiv”, sesiuni scurte (3–5 min).

---

## 4. Siguranța copiilor și confidențialitate

- **Fără conturi, fără login, fără date personale.** Nu colectăm nume, email, locație, fotografii.
- **Camera rămâne pe dispozitiv:** fluxul video e folosit doar local pentru tracking; nu se înregistrează și nu se trimite nicăieri. Fără funcție de captură/partajare în MVP.
- **Fără analytics de terță parte, fără reclame, fără SDK-uri de tracking, fără in-app purchases** în MVP. Dacă vrem statistici mai târziu: doar agregate, anonime, opt-in pentru părinte.
- **Offline-friendly:** toate asset-urile sunt în aplicație (în producție). Prototipul web are nevoie de internet doar pentru CDN-ul three.js (poate fi inclus local).
- **COPPA (SUA):** dacă nu colectăm *nicio* informație personală (inclusiv identificatori persistenți pentru reclame/analytics), obligațiile se reduc mult. Regula COPPA amendată de FTC a fost publicată pe 22 aprilie 2025, a intrat în vigoare pe **23 iunie 2025**, iar termenul de conformare a fost **22 aprilie 2026** (cu excepția § 312.11(d)(1), (d)(4) și (g)) — deci se aplică deja. Amendamentele cer, printre altele, consimțământ parental separat pentru dezvăluirea datelor către terți (ex. publicitate țintită), politică scrisă de retenție a datelor și program de securitate a informațiilor, și includ identificatorii biometrici în „personal information” — încă un motiv să nu avem SDK-uri de terță parte.
- **GDPR / „GDPR-K” (UE, art. 8 GDPR):** pentru servicii online oferite direct copiilor, consimțământul parental e necesar sub vârsta stabilită de fiecare stat (13–16 ani). **În România vârsta este 16 ani**: România nu a folosit opțiunea de a coborî pragul (Legea 190/2018, care pune în aplicare GDPR, nu modifică art. 8), deci se aplică pragul implicit de 16 ani din GDPR. Toată ținta noastră (5–10 ani) e sub prag. Prin design „fără date personale” evităm nevoia de consimțământ. Privacy policy scurtă și clară totuși necesară.
- **Store-uri:** Google Play „Designed for Families” / Teacher Approved și Apple „Kids Category” au reguli suplimentare (fără linkuri externe neprotejate, parental gate pentru orice ieșire din app, fără reclame comportamentale). Planificăm de la început un **parental gate** simplu.
- **Siguranță fizică:** avertisment „Uită-te în jur, nu merge cu spatele”, experimente preferabil pe masă, sesiuni scurte, recomandare de supraveghere de către un adult.

---

## 5. Limitări practice pentru copii

- **Mâini mici, telefon greu:** un telefon de 180–230 g ținut cu brațele întinse e greu pentru un copil de 5–7 ani. Designul presupune că părintele poate ține telefonul, iar copilul doar atinge ecranul; toate acțiunile merg cu o singură mână/un deget.
- **Telefon ținut stabil / oboseala brațelor:** tracking-ul AR și plasarea cer telefon relativ nemișcat; brațele obosesc repede. Sesiuni de **~5–10 minute** per experiment, cu pauze naturale (cardul „Ce am învățat?” se poate citi cu telefonul jos). Odată pus obiectul, nu cerem mișcări mari.
- **Siguranță la mers:** copiii merg cu ochii în ecran și se lovesc de mobilă/scări. Recomandăm explicit **joaca stând la masă** (experimentele sunt gândite pentru masă; podeaua doar în spațiu liber); fără mecanici care cer să te plimbi prin cameră; mesaj la start „Stai jos la masă 🪑”.
- **Lumină și suprafețe cu textură:** plane detection are nevoie de lumină bună și de o suprafață cu textură (lemn, față de masă, covor). **Mesele din sticlă, albe/uni, lucioase sau reflectorizante eșuează des**, la fel lumina slabă. Onboarding-ul spune „Aprinde lumina” / „Pune o carte sau o față de masă”; după ~15 s fără suprafață oferim Modul simplu (2.4).
- **Telefoane low-end:** părinții au adesea telefoane vechi/ieftine fără ARCore sau cu performanță slabă. Ținem poligoane și particule puține (ex. ≤ 400 particule), detectăm suportul AR și trecem automat pe Modul simplu cu înclinarea.
- **Încălzire și baterie:** camera + tracking + randare încălzesc telefonul și consumă rapid bateria. Limităm FPS-ul/efectele, oprim sesiunea AR când aplicația trece în fundal și afișăm o sugestie de pauză după ~10 min.
- **Supraveghere parentală și permisiunea camerei:** permisiunea camerei e cerută de sistem; textul de dinainte e pentru părinte („Camera e folosită doar pe telefon, nu se înregistrează nimic”). Recomandăm supraveghere de către un adult; orice ieșire din aplicație (linkuri, setări) e în spatele unui **parental gate**.
- **Nivel de citire:** mulți copii de 5–7 ani nu citesc fluent. Tot UI-ul folosește **icoane + voce** (instrucțiuni audio în română), textul e scurt și opțional.
- **Ținte de atingere:** butoane de minim **48 dp** (recomandarea Android; Apple: 44 pt), ideal 64 dp+ pentru copii, cu spațiu între ele ca să nu fie apăsate din greșeală; fără gesturi complicate (pinch, rotire cu două degete) în MVP.

---

## 6. Primul prototip

**Ce conține acum** (`prototype/index.html`, un singur fișier, three.js din CDN):
- Sesiune WebXR `immersive-ar` cu `hit-test` (Android Chrome + ARCore), `dom-overlay` pentru butoane în AR.
- Reticul galben pe suprafața detectată; **tap** = pune vulcanul (orientat spre copil); buton **„↺ Mută vulcanul”**; buton **„✕ Ieși”**.
- Vulcan procedural (con + crater + lavă strălucitoare + bază verde), mărime de jucărie (~25 cm).
- Buton **„🔥 Erupe!”**: erupție cu particule de lavă (gravitație, curgere la bază), vibrație scurtă, apoi cardul **„Ce s-a întâmplat?”**.
- **Mod 3D fallback** (desktop / iPhone / fără AR): masă virtuală, rotire cu degetul/mouse-ul, același buton „Erupe!”.
- UI în română, culori vii, butoane mari; tapurile pe butoane nu plasează accidental vulcanul (`beforexrselect`).
- Verificat pe box: sintaxă JS, mod fallback în Chrome headless fără erori. **Netestat încă pe un telefon Android real.**

**Ce urmează:**
1. Test pe telefonul Android al lui SNAKE (vezi `prototype/README.md`) și ajustări: mărime vulcan, viteza lavei, texte.
2. Sunete (bubuit, fâsâit) + instrucțiuni vocale în română.
3. Modul simplu cu înclinarea (2.4) pentru telefoane fără ARCore — întâi „lava curge la vale”.
4. Onboarding animat pentru scanare + mesaj după 15 s fără suprafață.
5. three.js inclus local (fără CDN) pentru funcționare offline.
6. Playtest scurt cu 2–3 copii, apoi decizia de pornire a proiectului Unity AR Foundation (M1).

---

## 7. Scope MVP

**În scope:**
- Plane detection orizontală (masă/podea), reticul, plasare cu un tap, buton „Mută”.
- 3 experimente (vulcan, circuit, plantă) cu 1–3 interacțiuni prin tap fiecare.
- Card „Ce am învățat?” cu text + audio în română.
- Modul simplu cu înclinarea telefonului (fallback fără ARCore).
- Funcționare offline, fără conturi, fără colectare de date.
- Android + iOS (în producție, prin Unity AR Foundation).

**În afara scope-ului (deocamdată):**
- Suprafețe verticale (pereți), ocluziune cu persoane/obiecte, image tracking.
- Multiplayer / sesiuni partajate, conturi, profil copil, progres în cloud.
- Captură foto/video și partajare.
- Alte limbi decât română (pregătim doar i18n în cod).
- Monetizare, magazine de conținut, notificări push.
- Profesor/clasă (mod școală).

---

## 8. Milestone-uri orientative

| # | Durată | Livrabil |
|---|---|---|
| M0 | săpt. 1 | Prototip WebXR „Vulcan” pe Android (✅ inclus în `prototype/`), test cu 2–3 copii: înțeleg scan → tap → erupe? |
| M1 | săpt. 2–3 | Proiect Unity AR Foundation: scan/place/move, UI kit pentru copii, sistem de carduri + audio; vulcanul portat |
| M2 | săpt. 4–5 | Experiment „Circuit” + experiment „Plantă” + Modul simplu cu înclinarea |
| M3 | săpt. 6 | Polish: sunete, onboarding animat, parental gate, mod offline complet, performanță pe telefoane mid-range |
| M4 | săpt. 7 | Playtest cu 5–8 copii (5–10 ani) + părinți; iterație pe UX |
| M5 | săpt. 8 | Beta intern (Play Internal Testing + TestFlight), privacy policy, pregătire store (Families / Kids Category) |

---

## Surse (verificate 20 oct 2026)
- Apple Developer Forums — WebXR immersive-ar „not supported on visionOS or iOS”: https://developer.apple.com/forums/thread/756850
- WebKit — Safari 26.x: WebXR doar pe visionOS (immersive-vr): https://webkit.org/blog/17640/webkit-features-for-safari-26-2/
- Niantic Spatial — închiderea 8th Wall: https://info.nianticspatial.com/blog/next-chapter ; 8thwall.org open source: https://8thwall.org/blog/8th-wall-open-source
- model-viewer (AR Quick Look / Scene Viewer / WebXR): https://modelviewer.dev/
- Unity AR Foundation: https://docs.unity3d.com/Packages/com.unity.xr.arfoundation@latest
- ARCore dispozitive suportate: https://developers.google.com/ar/devices
- FTC — COPPA Rule amendată (Federal Register, 22 apr 2025; în vigoare 23 iun 2025; conformare 22 apr 2026): https://www.federalregister.gov/documents/2025/04/22/2025-05904/childrens-online-privacy-protection-rule
- GDPR art. 8: https://gdpr-info.eu/art-8-gdpr/ ; vârsta de consimțământ digital în România = 16 ani: https://euconsent.eu/digital-age-of-consent-under-the-gdpr/ și https://childreninthedigitalworld.twobirds.com/home/romania ; Legea 190/2018: https://legislatie.just.ro/Public/DetaliiDocument/203151
