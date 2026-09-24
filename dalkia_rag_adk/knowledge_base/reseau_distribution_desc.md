# Consignes d'Exploitation : Réseau de Distribution et Régulation DESC
**Référence Dalkia :** REG-DK-DESC-003  
**Installation :** Réseau de Chaleur Urbain Grand Format - Pilotage DESC (Dalkia Energy Savings Center)

## 1. Objectifs Énergétiques et Taux d'Énergie Renouvelable (ENR&R)
- **Objectif réglementaire :** Le réseau doit garantir un taux d'énergies renouvelables et de récupération (ENR&R) supérieur à 65% en moyenne annuelle pour bénéficier de la TVA réduite à 5.5%.
- **Priorité de production :**
  1. Base : Chaudière Biomasse B1 (bois énergie) à pleine charge (12 MWth).
  2. Demi-base / Récupération : Échangeur ECH1 et valorisation fatale.
  3. Appoint / Secours : Chaudière Gaz G2 (uniquement en pointe hivernale ou lors des ramonages de B1).

## 2. Loi d'Eau et Température de Consigne Départ
La température de départ du circuit secondaire vers les sous-stations abonnés est asservie à la température extérieure mesurée par la station météorologique de site selon la loi d'eau :
- **Si T_ext <= -5°C :** Consigne départ = 88°C (Régime grand froid).
- **Si T_ext = 0°C :** Consigne départ = 82°C.
- **Si T_ext = +10°C :** Consigne départ = 72°C.
- **Si T_ext >= +15°C :** Consigne départ = 65°C (Mode été / ECS seule).
- **Règle de dérive :** Aucun écart de consigne supérieur à ±2.0°C ne doit être toléré pendant plus de 15 minutes consécutives sous peine de non-respect du contrat d'engagement de service.

## 3. Maintien de Pression et Débit Réseau
- **Pression statique au point le plus haut :** Minimum 2.5 bars.
- **Pression de refoulement circulateur P2 :** 4.8 bars ± 0.3 bar.
- **Débit maximal de distribution :** 550 m3/h.
- **Gestion de la réserve de dégazage et appoint d'eau :**
  - Conductivité de l'eau de réseau : < 150 µS/cm.
  - pH de l'eau de boucle : 9.2 à 9.8 (traitement filmant anti-corrosion).
  - Teneur en oxygène dissous : < 0.02 mg/L.
