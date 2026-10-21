# Science Race

Cursă de circuite pentru 2–4 copii, în 3D, pe telefon. Fără cont, fără chat, fără nume scris de mână.

Deschide pe telefon: **https://szabolcsszikszaiolti-svg.github.io/ar-play-la/**

Laboratorul vechi de realitate augmentată (vulcan + circuit) rămâne la **/ar-legacy/** și nu s-a schimbat ca joc.

## Cum joci cu două telefoane

1. Ambele telefoane deschid linkul de mai sus, în Chrome sau Safari, cu internet.
2. Pe primul telefon: **Creează cameră**. Alege porecla (o atingi, nu o scrii). Apare un cod de 4 semne, de exemplu `K7QZ`.
3. Apasă **Distribuie** și trimite linkul, sau spune codul cu vocea.
4. Pe al doilea telefon: **Intră în cameră** și pune codul.
5. Pe telefonul gazdei alege **Puncte** sau **Eliminare**, apoi **Start**.
6. Amândoi văd 3, 2, 1. Atinge un clește (devine verde), apoi un șurub. Când becul se aprinde, runda ta s-a terminat.
7. Apare **Gata!** cu timpii. Gazda apasă **Continuă** pentru nivelul următor. La final e podiumul și **Jucăm iar**.

**Joacă singur** e antrenament, fără rețea.

Un deget rotește masa. Două degete fac zoom. **🎯 Recentrează** aduce camera înapoi. Nu poți trece pe sub masă.

## Ce e gata acum

- 3 niveluri, grupa Mijlocii (8–10): baterie + bec; + întrerupător; două becuri în serie (luminează mai slab).
- Camere de 2–4 jucători. Implicit **PeerJS** (WebRTC prin brokerul public `0.peerjs.com`). Telefonul gazdei e serverul: el ține ceasul, numărătoarea, timpii și locurile.
- Dacă gazda pleacă, ceilalți văd „Gazda a plecat”. Un jucător care pleacă e marcat ieșit.
- Specul complet e în [`docs/GAME_SPEC.md`](docs/GAME_SPEC.md). Specul vechi de AR e păstrat în [`docs/MVP_SPEC.md`](docs/MVP_SPEC.md).

## Ce nu e încă legat

Firebase nu pornește singur: în [`config.js`](config.js) stă `firebaseConfig = null`. Până umpli configul, jocul rămâne pe PeerJS. Grupele Mici și Mari, stelele salvate, alte jocuri și plățile nu sunt în prototip.

## Ca să treci pe Firebase (când vrei)

1. Intră pe https://console.firebase.google.com și creează un proiect **nou**. La întrebarea de Analytics, lasă **dezactivat**.
2. **Build → Authentication → Sign-in method → Anonymous → Enable**. Salvează.
3. **Build → Realtime Database → Create Database**.
   - Alege locația **europe-west1** (Belgia), dacă apare în listă. RTDB oferă de obicei `us-central1`, `europe-west1` și `asia-southeast1`.
   - Pornește în **locked mode**.
4. Deschide fila **Rules**, șterge ce e acolo și lipește tot fișierul [`firebase.rules.json`](firebase.rules.json). Apasă **Publish**.
   Regulile fac asta: citește doar cine e autentificat anonim; fiecare copil scrie doar în `players/{uid-ul lui}`; `finishAt` se poate pune o singură dată și doar cu ora serverului (`now`); gazda scrie starea camerei; camera se poate șterge de gazdă, sau de oricine dacă e mai veche de 2 ore.
5. **Project settings (rotița) → Your apps → Add app → Web** (`</>`). Nu bifa Analytics. Copiază obiectul `firebaseConfig`.
6. În `config.js` înlocuiește `null` cu obiectul. `databaseURL` arată cam așa: `https://NUMELE-PROIECTULUI-default-rtdb.europe-west1.firebasedatabase.app`.
7. Fă commit și push pe `main`. La următoarea deschidere, jocul folosește Firebase în loc de PeerJS. Nu adăuga Analytics, Crashlytics sau alt SDK.

Adapterul din `src/net/firebase.js` urmează schema din spec §3 (cameră, `serverTimestamp` la final, `onDisconnect`, ceas `.info/serverTimeOffset`). Nu a fost rulat pe un proiect real, pentru că proiectul încă nu există.

## Verificări locale

```bash
node --test test/race.test.js
python3 -m http.server 8765
```

Apoi deschide `http://127.0.0.1:8765/`. PeerJS pe `http://` poate refuza brokerul; pe GitHub Pages (https) merge. Pentru două taburi fără internet, adaugă `?net=channel` (doar pentru test).
