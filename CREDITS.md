# Credite texturi și model

Modelul 3D (`assets/volcano.glb`) este original: un con sculptat în cod, deplasat cu harta de înălțime de mai jos, apoi comprimat cu [EXT_meshopt_compression](https://github.com/KhronosGroup/glTF/blob/main/extensions/2.0/Vendor/EXT_meshopt_compression/README.md). Nu este un scan sau un model de la terți.

## Rocă — Poly Haven „Dark Rock”

- Autor: Amal Kumar
- Licență: [CC0](https://creativecommons.org/publicdomain/zero/1.0/)
- Pagină: https://polyhaven.com/a/dark_rock
- Fișiere folosite (JPG 2K): diffuse, normal GL, roughness, ambient occlusion, displacement
- Descărcare: https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/dark_rock/

În pagină ajung doar trei texturi WebP la 2048²: `rock_albedo.webp` (culoarea, cu ocluzia amestecată ușor și umbrele puțin ridicate ca să se vadă pe telefon), `rock_normal.webp`, `rock_rough.webp`. Harta de înălțime a fost folosită doar la sculptarea mesh-ului și nu este servită.

## Lavă — ambientCG „Lava001”

- Licență: [CC0](https://creativecommons.org/publicdomain/zero/1.0/)
- Pagină: https://ambientcg.com/view?id=Lava001
- Fișier: `Lava001_1K-JPG.zip` de la https://ambientcg.com/get?file=Lava001_1K-JPG.zip
- În pagină: `lava_color.webp` și `lava_emit.webp` (redimensionate la 1024²). Normala setului nu este folosită; crusta și curgerea sunt animate în shader.

## Lemn — ambientCG „Wood049”

Placa circuitului (`assets/wood_albedo.webp`, `wood_normal.webp`, `wood_rough.webp`).

- Licență: [CC0](https://creativecommons.org/publicdomain/zero/1.0/)
- Pagină: https://ambientcg.com/view?id=Wood049
- Fișier: `Wood049_1K-JPG.zip` de la https://ambientcg.com/get?file=Wood049_1K-JPG.zip
- Folosite: Color, NormalGL, Roughness (1K), salvate ca WebP. Bateria, becul, clemele și firele sunt geometrie three.js, nu modele de la terți. Eticheta „PILĂ USCATĂ / 1,5 V” este generică, fără marcă.
