# Dalkia LiveAssist : Agent RAG avec Gemini Live API & Google ADK

Application et agent intelligent d'assistance opérationnelle pour les techniciens de réseaux de chaleur urbains et chaufferies biomasse Dalkia.  
Basé directement sur l'architecture Google Cloud :  
[Use RAG Engine on Gemini Enterprise Agent Platform in Gemini Live API](https://docs.cloud.google.com/gemini-enterprise-agent-platform/build/rag-engine/use-rag-in-multimodal-live) et implémenté avec **Google ADK (Agent Development Kit)**.

---

## Fonctionnalités Principales

1. **RAG Grounding en Temps Réel** :
   - Interrogation en langage naturel (texte ou audio) des manuels techniques et consignes de sécurité Dalkia.
   - Les réponses sont sourcées et justifiées avec les références documentaires précises (`MAN-DK-BIO-001`, `MAN-DK-ECH-002`, `REG-DK-DESC-003`, `MAN-DK-V3V-004`).
   - Intégration de la configuration **Vertex RAG Store** de Google Cloud pour l'ancrage en direct.

2. **Pilotage SCADA & GMAO (Function Calling)** :
   - Consultation de la télémétrie en direct (températures, pressions, débits, puissances MW).
   - Modification des consignes thermiques des circuits primaire et secondaire.
   - Pilotage des équipements de production (chaudière biomasse B1, appoint gaz G2, pompes P1/P2, vanne V3V).
   - Journalisation instantanée des interventions dans la GMAO Dalkia.

3. **Compatibilité Complète Google ADK** :
   - Déclaration native `Agent` (`root_agent`).
   - Exécution directe avec la CLI ADK : `adk run`, `adk web`, `adk api_server`.
   - Support des sessions en mémoire ou persistantes SQLite/Agent Engine.

---

## Structure du Projet

```
dalkia_rag_adk/
├── .env                               # Configuration Vertex AI & projet GCP
├── __init__.py                        # Point d'entrée pour découverte ADK
├── agent.py                           # Déclaration du root_agent ADK
├── tools/
│   ├── rag_tool.py                    # Outil RAG & configuration VertexRagStore
│   └── scada_tools.py                 # Télémétrie SCADA, consignes et GMAO
├── knowledge_base/                    # Base documentaire technique Dalkia
│   ├── biomasse_chaudiere_b1.md       # Manuel d'exploitation chaudière B1
│   ├── echangeur_plaques_ech1.md      # Maintenance et delta T échangeur ECH1
│   ├── reseau_distribution_desc.md    # Régulation loi d'eau DESC
│   └── vanne_trois_voies_v3v.md       # Consignes de secours vanne V3V
├── live_rag_client.py                 # Client Gemini Live API (WebSocket & Grounding)
├── adk_live_runner.py                 # Exécuteur ADK avec Runner.run_live
├── cli.py                             # Interface CLI de test interactive
└── tests/
    └── test_dalkia_rag_agent.py       # Suite de tests unitaires et d'intégration
```

---

## Démarrage Rapide

### 1. Variables d'Environnement
```bash
export GOOGLE_GENAI_USE_VERTEXAI=true
export GOOGLE_CLOUD_PROJECT=your-gcp-project-id
export GOOGLE_CLOUD_LOCATION=us-central1
export PYTHONPATH=.:$PYTHONPATH
```

### 2. Exécution avec la CLI ADK
```bash
# Requête ponctuelle
adk run dalkia_rag_adk "Comment diagnostiquer un encrassement sur l'échangeur ECH1 ?"

# Mode conversationnel interactif
adk run dalkia_rag_adk
```

### 3. Exécution avec l'Interface Dédiée
```bash
# Test du RAG et grounding
python3 -m dalkia_rag_adk.cli --query "Quelle est la procédure si la chaudière biomasse surchauffe au dessus de 950°C ?"

# Affichage du payload WebSocket conforme à la doc Cloud
python3 -m dalkia_rag_adk.cli --show-setup

# Mode interactif terrain
python3 -m dalkia_rag_adk.cli --interactive
```

### 4. Lancer les Tests Automatisés
```bash
python3 -m unittest discover -s dalkia_rag_adk/tests -p "test_*.py" -v
```
