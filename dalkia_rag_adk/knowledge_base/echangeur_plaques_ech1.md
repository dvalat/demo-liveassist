# Manuel Technique : Échangeur Thermique à Plaques ECH1
**Référence Dalkia :** MAN-DK-ECH-002  
**Installation :** Interface Primaire Haute Température / Réseau Secondaire Urbain

## 1. Caractéristiques et Performances Nominales
- **Puissance nominale transférée :** 16,0 MWth.
- **Plaques :** 280 plaques en acier inoxydable AISI 316L (épaisseur 0.5 mm) avec joints EPDM clipsés.
- **Circuit primaire (primaire chaudière) :**
  - Température entrée : 95°C / Température sortie : 68°C.
  - Débit nominal : 510 m3/h.
  - Perte de charge nominale (Delta P) : 0.45 bar (45 kPa).
- **Circuit secondaire (départ sous-stations ville) :**
  - Température retour réseau : 55°C / Température départ réseau : 82°C.
  - Débit nominal : 480 m3/h.
  - Perte de charge nominale : 0.40 bar (40 kPa).

## 2. Surveillance du Delta T et Diagnostic d'Encrassement
- **Indicateur de performance thermique (NTU & Delta T) :**
  - Le Delta T de pincement normal en sortie d'échangeur doit être compris entre 2.5°C et 3.5°C.
  - Formule du pincement : Pincement = T_primaire_retour - T_secondaire_retour.
- **Critères d'encrassement (tartre ou boues magnétite) :**
  - **Alerte niveau 1 :** Perte de charge Delta P supérieure à 0.70 bar (+55% par rapport à la valeur de référence).
  - **Alerte niveau 2 :** Pincement thermique supérieur à 5.0°C (dégradation du coefficient global d'échange U).
  - En présence conjointe d'un Delta P élevé et d'un Delta T dégradé, planifier une opération de nettoyage CIP sous 48 heures.

## 3. Procédure de Rétrolavage à Contre-Courant (Backwash)
1. Isoler le circuit secondaire en fermant les vannes papillon amont/aval d'isolement ECH1.
2. Ouvrir la vanne de vidange basse et connecter l'unité de rinçage à contre-courant.
3. Injecter de l'eau déminéralisée additivée d'un dispersant biodégradable à un débit de 120% du débit nominal pendant 35 minutes.
4. Rincer abondamment jusqu'à turbidité de l'eau inférieure à 5 NTU.

## 4. Couple de Serrage et Maintenance des Tirants
- Lors d'une réouverture pour inspection ou remplacement de joints :
  - Mesurer la cote de serrage "A" (distance entre les deux plateaux fixes et mobiles) : nominal 485 mm ± 1 mm.
  - Toujours resserrer les tirants en croix avec une clé dynamométrique en 4 passes successives.
  - Ne jamais dépasser la cote minimale A_min (478 mm), sous peine de déformation plastique permanente des chevrons de plaques.
