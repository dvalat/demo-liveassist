"""
Dalkia RAG & Live Assistant Agent built with Google Agent Development Kit (ADK).
Provides grounded thermal engineering expertise, RAG search over Dalkia manuals, and SCADA control.
"""

from __future__ import annotations

import os
from google.adk.agents.llm_agent import Agent
from google.adk.models.google_llm import Gemini

from .tools.rag_tool import (
    search_dalkia_knowledge_base,
    get_vertex_rag_live_tool_config,
    VertexAiRagRetrieval,
)
from .tools.scada_tools import (
    get_facility_telemetry,
    set_temperature_setpoint,
    execute_equipment_override,
    log_gmao_intervention,
    delete_gmao_intervention,
    get_active_alarms,
)

# Configuration from environment or defaults
# Primary requested model: gemini-3.8-live
MODEL_NAME = os.getenv("DALKIA_AGENT_MODEL", "gemini-2.5-flash")
LIVE_MODEL_NAME = os.getenv("DALKIA_LIVE_MODEL", "gemini-3.8-live")
PROJECT_ID = os.getenv("GOOGLE_CLOUD_PROJECT", "your-gcp-project-id")
LOCATION = os.getenv("GOOGLE_CLOUD_LOCATION", "us-central1")
RAG_CORPUS_ID = os.getenv("DALKIA_RAG_CORPUS_ID", "dalkia-manuals-corpus")

is_vertex_env = os.getenv("GOOGLE_GENAI_USE_VERTEXAI", "false").lower() == "true"
effective_text_model = MODEL_NAME

DALKIA_AGENT_INSTRUCTION = """\
Tu es l'agent IA d'assistance opérationnelle en temps réel de Dalkia (Dalkia LiveAssist), expert en exploitation de chaufferies biomasse et de réseaux de chaleur urbains (RCU).

Tes missions prioritaires :
1. ASSISTANCE TECHNIQUE & RAG GROUNDING :
   - Dès que le technicien te pose une question technique sur une procédure, une consigne de sécurité, un seuil critique ou un diagnostic (chaudière biomasse B1, échangeur ECH1, loi d'eau DESC, vanne V3V), interroge SYSTÉMATIQUEMENT la base de connaissances via l'outil `search_dalkia_knowledge_base`.
   - Fonde TOUTES tes réponses techniques sur les extraits des manuels Dalkia récupérés. Cite toujours la référence du document et les valeurs clés (pressions en bars, températures en °C, débits en m3/h).

2. SUPERVISION & PILOTAGE SCADA :
   - Tu peux consulter l'état en temps réel des installations avec `get_facility_telemetry` et `get_active_alarms`.
   - Tu peux modifier les consignes avec `set_temperature_setpoint` et piloter les équipements avec `execute_equipment_override` après avoir vérifié la conformité avec les manuels d'exploitation.

3. TRAÇABILITÉ GMAO :
   - Chaque fois qu'une intervention, une purge, un dépoussiérage ou un réglage important est effectué par le technicien, propose ou effectue l'enregistrement dans la GMAO via `log_gmao_intervention`.

4. RÈGLES D'ÉLOCUTION VOCALE EN DIRECT (Live Audio) :
   - Tu échanges à la voix en temps réel avec le technicien sur le terrain.
   - Tes explications orales doivent être fluides, directes et complètes, sans jamais t'interrompre au milieu d'une phrase.
   - Formule des réponses claires en 2 à 4 phrases bien articulées.
   - Évite les puces markdown, astérisques ou listes numérotées qui dégradent la synthèse vocale : exprime les étapes sous forme de phrases naturelles enchaînées.

Sois professionnel, concis, orienté terrain et sécurité industrielle.
"""

tools_list = [
    search_dalkia_knowledge_base,
    get_facility_telemetry,
    set_temperature_setpoint,
    execute_equipment_override,
    log_gmao_intervention,
    delete_gmao_intervention,
    get_active_alarms,
]

# If Vertex AI RAG corpus is explicitly enabled in environment, attach the VertexAiRagRetrieval tool
if os.getenv("ENABLE_VERTEX_RAG_TOOL", "false").lower() == "true" and VertexAiRagRetrieval is not None:
    corpus_resource = f"projects/{PROJECT_ID}/locations/{LOCATION}/ragCorpora/{RAG_CORPUS_ID}"
    tools_list.append(
        VertexAiRagRetrieval(
            name="vertex_dalkia_corpus_retrieval",
            description="Interroge le corpus RAG Vertex AI officiel contenant tous les manuels Dalkia.",
            rag_corpora=[corpus_resource],
        )
    )


class DalkiaLiveAgent(Agent):
    """Dalkia thermal engineering agent supporting both standard generateContent and Gemini Live API."""

    @property
    def canonical_live_model(self) -> Gemini:
        """Resolves the live model required by Gemini Live API (gemini-3.8-live)."""
        return Gemini(model=LIVE_MODEL_NAME)


root_agent = DalkiaLiveAgent(
    name="dalkia_rag_agent",
    description="Assistant vocal et RAG pour techniciens d'exploitation des réseaux de chaleur Dalkia.",
    instruction=DALKIA_AGENT_INSTRUCTION,
    model=effective_text_model,
    tools=tools_list,
)

# Alias for explicit import
dalkia_agent = root_agent
