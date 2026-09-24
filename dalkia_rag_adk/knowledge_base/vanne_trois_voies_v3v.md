# Consignes Opérationnelles : Vanne Trois Voies V3V et Régulation Primaire
**Référence Dalkia :** MAN-DK-V3V-004  
**Équipement :** Vanne de mélange / répartition à clapet équilibré DN250 - Servomoteur électrohydraulique 24V

## 1. Rôle et Principe Fonctionnel
- La vanne trois voies V3V régule la température d'alimentation de l'échangeur thermique ECH1 en mélangeant l'eau surchauffée issue de la boucle chaudières avec l'eau de retour primaire.
- **Signal de pilotage :** Signal analogique 4-20 mA (ou bus Modbus RTU).
  - 4 mA = Vanne fermée à 0% (passage direct en boucle fermée sans injection chaudière).
  - 20 mA = Vanne ouverte à 100% (pleine admission chaudière vers ECH1).
- **Temps de course totale :** 60 secondes de 0% à 100%.

## 2. Procédure de Débrayage et Commande Manuelle de Secours
En cas de coupure d'alimentation électrique 24V, d'anomalie sur le bus de terrain ou d'oscillation critique de régulation (pompage thermique) :
1. Débrayer le volant de manœuvre manuel situé sur le carter supérieur du servomoteur en tirant sur la goupille de sécurité jaune.
2. Aligner l'index d'ouverture sur le cadran gradué :
   - Position standard d'exploitation normale : 65% d'ouverture.
   - Position régime éco : 40% d'ouverture.
   - Position de sécurité antigel : ouverture minimale forcée à 25%.
3. Verrouiller la goupille de position.
4. Noter immédiatement l'opération dans le journal de quart et consigner l'intervention dans la GMAO.

## 3. Maintenance Préventive et Détection des Fuites Internes
- **Test d'étanchéité au siège :** Effectué trimestriellement.
  - Fermer la V3V à 0% et mesurer la température en aval immédiat du siège de vanne.
  - Si l'élévation de température aval dépasse 3.0°C après 10 minutes d'arrêt, remplacer la garniture en PTFE et le presse-étoupe.
