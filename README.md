# Dalkia LiveAssist ⚡🔥

> **Assistant vocal d'exploitation en temps réel pour chaufferies biomasse et réseaux de chaleur urbains (RCU), propulsé par l'API Gemini Multimodal Live 3.8 et Vertex AI RAG Engine.**

---

## 📋 Présentation

**Dalkia LiveAssist** permet aux techniciens et exploitants de piloter et superviser les installations thermiques Dalkia les mains libres grâce à la voix :
1. **Échanges oraux naturels et bidirectionnels** à très faible latence avec Gemini Live 3.8 (`gemini-3.8-live`, micro PCM 16 kHz mono, synthèse vocale native PCM 24 kHz).
2. **RAG Grounding automatique** sur les manuels techniques et procédures d'urgence Dalkia (chaudière biomasse B1, échangeur à plaques ECH1, loi d'eau DESC, vannes 3 voies V3V).
3. **Supervision SCADA & GMAO** en temps réel : consultation de télémétrie, modification de consignes thermiques, acquittement d'alarmes et création de rapports de maintenance.

---

## 🏛️ Architecture du Projet

```text
demo-liveassist/
├── dalkia_web_app/              # Interface Web Dédiée Gemini Live + RAG (FastAPI + WebSockets)
│   ├── server.py                # Passerelle WebSocket bidirectionnelle & dispatching RAG/SCADA
│   └── static/                  # Client Web Audio API (PCM 16kHz in / 24kHz out, visualiseur canvas)
│       ├── index.html           # IHM épurée Dalkia (Orange #FF4A00 / Bleu #0A192F)
│       ├── app.js               # Capture micro, streaming temps réel, visualiseur dynamique
│       └── style.css            # Styles modernes et réactifs
│
├── dalkia_rag_adk/              # Agent ADK (Google Agent Development Kit) & Outils
│   ├── agent.py                 # Définition de l'agent Dalkia LiveAssist (root_agent)
│   ├── live_rag_client.py       # Client Gemini Live API (Vertex RAG Store)
│   ├── cli.py                   # Interface en ligne de commande interactive
│   ├── knowledge_base/          # Manuels techniques Dalkia indexés par le RAG
│   │   ├── biomasse_chaudiere_b1.md       # Exploitation et allumage chaudière B1
│   │   ├── echangeur_plaques_ech1.md      # Maintenance et delta T échangeur ECH1
│   │   ├── reseau_distribution_desc.md    # Loi d'eau et régulation DESC
│   │   └── vanne_trois_voies_v3v.md       # Procédures de secours vanne V3V
│   ├── tools/
│   │   ├── rag_tool.py          # Outil de recherche documentaire RAG Dalkia
│   │   └── scada_tools.py       # Télémétrie SCADA, consignes et GMAO
│   └── tests/
│       └── test_dalkia_rag_agent.py # Suite de tests automatisés (100% passing)
│
├── src/                         # Cockpit Synoptique Industriel (React + TypeScript + Vite)
├── package.json                 # Dépendances Node.js / Frontend React
├── .env.example                 # Modèle de variables d'environnement
└── .gitignore                   # Exclusion des fichiers temporaires et secrets
```

---

## 🚀 Démarrage Rapide

### 1. Prérequis

- Python 3.10+
- Node.js 18+ (pour le synoptique React optionnel)
- Un projet Google Cloud avec Vertex AI activé (ou une clé API Google AI Studio)

### 2. Configuration

Copiez le modèle de configuration et renseignez votre projet GCP :
```bash
cp .env.example .env
export GOOGLE_GENAI_USE_VERTEXAI=true
export GOOGLE_CLOUD_PROJECT=your-gcp-project-id
export GOOGLE_CLOUD_LOCATION=us-central1
export PYTHONPATH=.:$PYTHONPATH
```

### 3. Lancer l'Interface Web Dédiée (Recommandé)

Démarrez le serveur FastAPI :
```bash
python3 dalkia_web_app/server.py
```
Ouvrez votre navigateur sur **`http://localhost:8085`** :
- Cliquez sur le **Microphone** pour démarrer la session vocale bidirectionnelle.
- Posez vos questions à l'oral ou cliquez sur les chips de test rapide (*Consigne échangeur ECH1*, *Loi d'eau réseau DESC*, *Télémétrie SCADA*, *Alarme surchauffe B1*).

### 4. Lancer avec la CLI ADK

```bash
# Requête ponctuelle
adk run dalkia_rag_adk "Quelle est la procédure si la chaudière biomasse dépasse 950°C ?"

# Mode conversationnel interactif
adk run dalkia_rag_adk
```

### 5. Lancer la Suite de Tests

```bash
python3 -m unittest discover -s dalkia_rag_adk/tests -p "test_*.py" -v
```

---

## 🔒 Sécurité et Confidentialité

Ce dépôt ne contient aucun identifiant personnel, aucune clé API en clair ni aucun nom de projet Google Cloud interne. Toute la configuration s'effectue via les variables d'environnement standard (`GOOGLE_CLOUD_PROJECT`, `GOOGLE_GENAI_USE_VERTEXAI`, `GOOGLE_CLOUD_LOCATION`).
