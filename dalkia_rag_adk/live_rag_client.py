"""
Gemini Live API Client with Vertex RAG Engine grounding for Dalkia.
Directly implements the Google Cloud architecture described at:
https://docs.cloud.google.com/gemini-enterprise-agent-platform/build/rag-engine/use-rag-in-multimodal-live
"""

from __future__ import annotations

import asyncio
import json
import os
from typing import Any, AsyncGenerator, Callable, Dict, List, Optional
from google.genai import types

from .tools.rag_tool import (
    get_vertex_rag_live_tool_config,
    get_genai_vertex_rag_tool,
    get_rag_engine,
)
from .tools.scada_tools import (
    get_facility_telemetry,
    set_temperature_setpoint,
    execute_equipment_override,
    log_gmao_intervention,
)


class DalkiaLiveRagClient:
    """Client for Gemini Live API with Vertex RAG Engine integration and SCADA Function Calling."""

    def __init__(
        self,
        project_id: Optional[str] = None,
        location: str = "us-central1",
        rag_corpus_id: str = "dalkia-manuals-corpus",
        model: str = "gemini-3.8-live",
        modalities: Optional[List[str]] = None,
    ):
        self.project_id = project_id or os.getenv("GOOGLE_CLOUD_PROJECT", "your-gcp-project-id")
        self.location = location
        self.rag_corpus_id = rag_corpus_id
        self.model = model
        self.modalities = modalities or ["AUDIO"]
        self.rag_engine = get_rag_engine()

    def get_setup_tools_payload(self) -> Dict[str, Any]:
        """Builds the RAG tools payload as defined in the Google Cloud documentation."""
        rag_config = get_vertex_rag_live_tool_config(
            project_id=self.project_id,
            location=self.location,
            rag_corpus_id=self.rag_corpus_id,
        )

        function_declarations = [
            {
                "name": "get_facility_telemetry",
                "description": "Retourne la télémétrie en temps réel de la chaufferie Dalkia (températures, pressions, débits).",
                "parameters": {
                    "type": "OBJECT",
                    "properties": {
                        "circuit": {
                            "type": "STRING",
                            "description": "Circuit cible ('primary', 'secondary', ou 'all').",
                        }
                    },
                },
            },
            {
                "name": "set_temperature_setpoint",
                "description": "Modifie la consigne de température de départ d'un circuit thermique.",
                "parameters": {
                    "type": "OBJECT",
                    "properties": {
                        "circuit": {"type": "STRING", "description": "'primary' ou 'secondary'"},
                        "temperature_celsius": {"type": "NUMBER", "description": "Température cible en °C."},
                    },
                    "required": ["circuit", "temperature_celsius"],
                },
            },
            {
                "name": "execute_equipment_override",
                "description": "Pilote un équipement thermique Dalkia (B1 biomasse, G2 gaz, P1, P2, V3V).",
                "parameters": {
                    "type": "OBJECT",
                    "properties": {
                        "equipment_id": {"type": "STRING", "description": "Identifiant de l'équipement (B1, G2, etc.)"},
                        "action": {"type": "STRING", "description": "start, stop, standby, modulate"},
                        "power_percent": {"type": "INTEGER", "description": "Pourcentage de charge 0-100"},
                    },
                    "required": ["equipment_id", "action"],
                },
            },
            {
                "name": "log_gmao_intervention",
                "description": "Enregistre une intervention technique dans la GMAO Dalkia.",
                "parameters": {
                    "type": "OBJECT",
                    "properties": {
                        "title": {"type": "STRING", "description": "Titre du compte-rendu."},
                        "description": {"type": "STRING", "description": "Détails opérationnels."},
                        "equipment_id": {"type": "STRING", "description": "Équipement concerné."},
                        "severity": {"type": "STRING", "description": "normal, critique, preventif"},
                    },
                    "required": ["title", "description", "equipment_id"],
                },
            },
        ]

        return {
            "retrieval": rag_config["retrieval"],
            "function_declarations": function_declarations,
        }

    def build_setup_message(self) -> Dict[str, Any]:
        """Constructs the initial WebSocket setup message for the Gemini Live API."""
        return {
            "setup": {
                "model": f"models/{self.model}" if not self.model.startswith("models/") else self.model,
                "generation_config": {
                    "response_modalities": self.modalities,
                    "speech_config": {"language_code": "fr-FR"},
                },
                "tools": self.get_setup_tools_payload(),
            }
        }

    def execute_tool_call(self, tool_name: str, args: Dict[str, Any]) -> Dict[str, Any]:
        """Executes a function call requested by the model during a Live session."""
        if tool_name == "get_facility_telemetry":
            return get_facility_telemetry(args.get("circuit", "all"))
        if tool_name == "set_temperature_setpoint":
            return set_temperature_setpoint(
                args.get("circuit", "primary"),
                float(args.get("temperature_celsius", 80.0)),
            )
        if tool_name == "execute_equipment_override":
            return execute_equipment_override(
                args.get("equipment_id", "G2"),
                args.get("action", "start"),
                int(args.get("power_percent", 100)),
            )
        if tool_name == "log_gmao_intervention":
            return log_gmao_intervention(
                args.get("title", "Intervention maintenance"),
                args.get("description", "Opération réalisée par l'exploitant"),
                args.get("equipment_id", "B1"),
                args.get("severity", "normal"),
            )
        return {"status": "error", "message": f"Outil inconnu : {tool_name}"}

    async def simulate_live_rag_turn(self, user_query: str) -> Dict[str, Any]:
        """Simulates a complete Live API turn with RAG grounding and tool handling.

        Used for automated testing, offline verification, or fallback when Live endpoint is unavailable.
        """
        # 1. Retrieve RAG grounding chunks from Dalkia manuals
        rag_results = self.rag_engine.search(user_query, top_k=2)

        grounding_chunks = []
        for r in rag_results:
            grounding_chunks.append({
                "web": None,
                "retrieved_context": {
                    "uri": f"gs://dalkia-manuals/{r['source']}",
                    "title": r["title"],
                    "text": r["content"][:300] + "...",
                },
            })

        # 2. Check for action intent (e.g. set consigne, telemetry, etc.)
        tool_results = []
        lower_q = user_query.lower()
        if any(w in lower_q for w in ["consigne", "règle la consigne", "applique une consigne", "ajuste la température", "mets la consigne"]):
            temp = 80.0
            import re
            m = re.search(r"(\d+([.,]\d+)?)\s*(degrés|°c)?", lower_q)
            if m:
                temp = float(m.group(1).replace(",", "."))
            circuit = "secondary" if "second" in lower_q else "primary"
            res = set_temperature_setpoint(circuit, temp)
            tool_results.append(("set_temperature_setpoint", res))

        elif any(w in lower_q for w in ["télémétrie", "mesures", "température actuelle", "état"]):
            res = get_facility_telemetry("all")
            tool_results.append(("get_facility_telemetry", res))

        # 3. Synthesize response based on RAG chunks and actions
        response_parts = []
        if rag_results:
            best_chunk = rag_results[0]
            response_parts.append(
                f"D'après le manuel d'exploitation Dalkia [{best_chunk['title']} - {best_chunk['section']}], "
                f"voici les consignes applicables :"
            )
            # Extract first 2 meaningful lines from chunk
            lines = [l.strip() for l in best_chunk["content"].split("\n") if l.strip() and not l.startswith("#")]
            response_parts.append("\n".join(lines[:3]))
        else:
            response_parts.append("Voici les éléments d'exploitation pour votre demande.")

        if tool_results:
            for tool_name, t_res in tool_results:
                response_parts.append(f"\n[Action SCADA {tool_name}] : {t_res.get('message', 'Exécuté')}")

        return {
            "query": user_query,
            "response_text": "\n\n".join(response_parts),
            "grounding_metadata": {
                "grounding_chunks": grounding_chunks,
                "retrieval_queries": [user_query],
            },
            "tool_executions": tool_results,
        }
