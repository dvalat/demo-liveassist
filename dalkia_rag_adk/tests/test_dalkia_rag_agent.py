"""
Automated Test Suite for Dalkia RAG & Live Assistant Agent (ADK).
Tests agent configuration, RAG retrieval quality, Live API payloads, and SCADA tools.
"""

import asyncio
import os
import unittest
from google.adk.agents.llm_agent import Agent
from google.adk.runners import Runner
from google.adk.sessions.in_memory_session_service import InMemorySessionService
from google.genai import types

from dalkia_rag_adk.agent import root_agent, dalkia_agent
from dalkia_rag_adk.tools.rag_tool import (
    get_rag_engine,
    search_dalkia_knowledge_base,
    get_vertex_rag_live_tool_config,
    get_genai_vertex_rag_tool,
)
from dalkia_rag_adk.tools.scada_tools import (
    get_facility_telemetry,
    set_temperature_setpoint,
    set_boiler_temperature,
    execute_equipment_override,
    log_gmao_intervention,
    delete_gmao_intervention,
    get_active_alarms,
)
from dalkia_rag_adk.live_rag_client import DalkiaLiveRagClient
from dalkia_rag_adk.adk_live_runner import DalkiaAdkRunner


class TestDalkiaRagAgent(unittest.TestCase):
    """Test suite for Dalkia RAG Agent implementation."""

    def test_01_agent_structure_and_tools(self):
        """Validates that root_agent conforms to Google ADK Agent interface."""
        self.assertIsInstance(root_agent, Agent)
        self.assertEqual(root_agent.name, "dalkia_rag_agent")
        self.assertIn("Dalkia", root_agent.instruction)
        self.assertIn("search_dalkia_knowledge_base", [getattr(t, "__name__", getattr(t, "name", str(t))) for t in root_agent.tools])
        self.assertGreaterEqual(len(root_agent.tools), 6)

    def test_02_rag_knowledge_base_retrieval(self):
        """Tests that local RAG engine indexes and retrieves accurate Dalkia procedures."""
        engine = get_rag_engine()
        self.assertGreaterEqual(len(engine.chunks), 4)

        # 1. Biomass boiler test
        bio_results = engine.search("décendrage chaudière biomasse B1", top_k=2)
        self.assertGreater(len(bio_results), 0)
        self.assertIn("biomasse", bio_results[0]["doc_id"])
        self.assertIn("cendres", bio_results[0]["content"].lower())

        # 2. Exchanger delta-T test
        ech_results = engine.search("pincement encrassement échangeur ECH1 delta P", top_k=2)
        self.assertGreater(len(ech_results), 0)
        self.assertIn("echangeur", ech_results[0]["doc_id"])
        self.assertTrue(any("pincement" in r["content"].lower() for r in ech_results))

        # 3. High level formatted RAG tool response
        formatted_rag = search_dalkia_knowledge_base("procédure allumage chaudière biomasse")
        self.assertIn("MAN-DK-BIO-001", formatted_rag)
        self.assertIn("Allumage", formatted_rag)

    def test_03_vertex_rag_live_tool_config(self):
        """Verifies Vertex RAG store config matches the Google Cloud official documentation."""
        config = get_vertex_rag_live_tool_config(
            project_id="sample-project-id",
            location="us-central1",
            rag_corpus_id="dalkia-manuals-corpus",
        )

        self.assertIn("retrieval", config)
        self.assertIn("vertex_rag_store", config["retrieval"])
        self.assertIn("rag_resources", config["retrieval"]["vertex_rag_store"])
        self.assertEqual(
            config["retrieval"]["vertex_rag_store"]["rag_resources"]["rag_corpus"],
            "projects/sample-project-id/locations/us-central1/ragCorpora/dalkia-manuals-corpus",
        )

        # Test types.Tool creation
        genai_tool = get_genai_vertex_rag_tool("sample-project-id", "us-central1", "dalkia-manuals-corpus")
        self.assertIsInstance(genai_tool, types.Tool)
        self.assertIsNotNone(genai_tool.retrieval)
        self.assertIsNotNone(genai_tool.retrieval.vertex_rag_store)

    def test_04_live_rag_client_setup_payload(self):
        """Verifies that DalkiaLiveRagClient builds the complete Live API setup message."""
        client = DalkiaLiveRagClient(
            project_id="sample-project-id",
            location="us-central1",
            rag_corpus_id="dalkia-manuals-corpus",
            model="gemini-2.5-flash",
            modalities=["TEXT", "AUDIO"],
        )

        setup_msg = client.build_setup_message()
        self.assertIn("setup", setup_msg)
        self.assertIn("tools", setup_msg["setup"])
        self.assertIn("retrieval", setup_msg["setup"]["tools"])
        self.assertIn("function_declarations", setup_msg["setup"]["tools"])

        func_names = [f["name"] for f in setup_msg["setup"]["tools"]["function_declarations"]]
        self.assertIn("get_facility_telemetry", func_names)
        self.assertIn("set_temperature_setpoint", func_names)
        self.assertIn("execute_equipment_override", func_names)
        self.assertIn("log_gmao_intervention", func_names)
        self.assertIn("delete_gmao_intervention", func_names)

    def test_05_scada_and_gmao_operational_tools(self):
        """Tests telemetry, setpoint modification, equipment override, and GMAO ticket creation."""
        # 1. Telemetry
        telemetry = get_facility_telemetry("primary")
        self.assertEqual(telemetry["status"], "success")
        self.assertIn("supply_temp_current", telemetry["metrics"])

        # 2. Setpoint update (nominal water circuit)
        setpoint_res = set_temperature_setpoint("primary", 87.5)
        self.assertEqual(setpoint_res["status"], "success")
        self.assertEqual(setpoint_res["new_setpoint_celsius"], 87.5)

        # 3. Dynamic High Temperature routing (e.g. 950°C voice command on primary or boiler)
        high_temp_res = set_temperature_setpoint("primary", 950.0)
        self.assertEqual(high_temp_res["status"], "success")
        self.assertEqual(high_temp_res["target"], "boiler")
        self.assertEqual(high_temp_res["boiler_temp"], 950.0)
        self.assertTrue(high_temp_res["is_alarm"])
        self.assertEqual(high_temp_res["status_label"], "SURCHAUFFE CRITIQUE")

        # 4. Direct boiler temperature tool & exchanger thermal coupling
        boiler_res = set_boiler_temperature(870.0)
        self.assertEqual(boiler_res["status"], "success")
        self.assertEqual(boiler_res["boiler_temp"], 870.0)
        self.assertFalse(boiler_res["is_alarm"])
        self.assertEqual(boiler_res["primary_supply_temp"], 84.6)
        self.assertEqual(boiler_res["primary_return_temp"], 66.8)
        self.assertEqual(boiler_res["secondary_supply_temp"], 77.2)
        self.assertEqual(boiler_res["secondary_return_temp"], 54.1)

        # Test overheat at 950°C: exchanger temperatures and flow rise dynamically
        overheat_res = set_boiler_temperature(950.0)
        self.assertTrue(overheat_res["is_alarm"])
        self.assertGreater(overheat_res["primary_supply_temp"], 84.6)
        self.assertGreater(overheat_res["primary_return_temp"], 66.8)
        self.assertGreater(overheat_res["secondary_supply_temp"], 77.2)
        self.assertGreater(overheat_res["secondary_return_temp"], 54.1)

        # 5. Equipment override
        eq_res = execute_equipment_override("G2", "start", 60)
        self.assertEqual(eq_res["status"], "success")
        self.assertEqual(eq_res["current_status"], "on")

        # 6. GMAO intervention ticket
        gmao_res = log_gmao_intervention(
            title="Purge filtre échangeur ECH1",
            description="Nettoyage et élimination des boues de fond",
            equipment_id="ECH1",
            severity="preventif",
        )
        self.assertEqual(gmao_res["status"], "success")
        self.assertTrue(gmao_res["ticket_id"].startswith("GMAO-2026-"))

        # 7. Active alarms
        alarms = get_active_alarms()
        self.assertIsInstance(alarms, list)

    def test_06_simulated_live_rag_turn_with_grounding(self):
        """Tests end-to-end simulated turn with RAG grounding metadata."""
        client = DalkiaLiveRagClient()

        query = "Quelle est la procédure d'urgence si la voûte de la chaudière biomasse dépasse 950°C ?"
        result = asyncio.run(client.simulate_live_rag_turn(query))

        self.assertIn("response_text", result)
        self.assertIn("grounding_metadata", result)
        chunks = result["grounding_metadata"]["grounding_chunks"]
        self.assertGreater(len(chunks), 0)
        self.assertIn("biomasse", chunks[0]["retrieved_context"]["title"].lower())
        self.assertTrue(any(term in result["response_text"].lower() for term in ["urgence", "950", "vis", "alimentation"]))

    def test_07_adk_runner_integration(self):
        """Tests that ADK Runner initializes and loads the root_agent properly."""
        session_service = InMemorySessionService()
        runner = Runner(
            agent=root_agent,
            app_name="dalkia_rag_adk",
            session_service=session_service,
            auto_create_session=True,
        )
        self.assertEqual(runner.app_name, "dalkia_rag_adk")
        self.assertEqual(runner.agent.name, "dalkia_rag_agent")

    def test_08_bigquery_gmao_persistence(self):
        """Tests that GMAO interventions are persisted and retrieved from BigQuery dataset 'dalkia'."""
        from dalkia_rag_adk.tools.scada_tools import get_gmao_tickets, log_gmao_intervention

        # 1. Retrieve current tickets
        tickets = get_gmao_tickets()
        self.assertIsInstance(tickets, list)
        self.assertGreater(len(tickets), 0)

        # Verify BigQuery schema compliance
        first = tickets[0]
        self.assertIn("ticket_id", first)
        self.assertIn("numero_intervention", first)
        self.assertIn("equipment", first)
        self.assertIn("title", first)
        self.assertIn("description", first)
        self.assertIn("severity", first)

        # 2. Insert new ticket
        new_ticket = log_gmao_intervention(
            title="Contrôle régulation brûleur gaz G2",
            description="Vérification ionisation et rapport air/gaz",
            equipment_id="G2",
            severity="normal",
        )
        self.assertEqual(new_ticket["status"], "success")
        self.assertTrue(new_ticket["ticket_id"].startswith("GMAO-2026-"))
        self.assertGreaterEqual(new_ticket["numero_intervention"], 1030)
        self.assertIn("bigquery_synced", new_ticket)

    def test_09_delete_gmao_intervention_unitary(self):
        """Tests that a GMAO ticket can be unitarily deleted from memory and BigQuery."""
        from dalkia_rag_adk.tools.scada_tools import get_gmao_tickets, log_gmao_intervention, delete_gmao_intervention

        # 1. Create a specific test ticket to delete
        created = log_gmao_intervention(
            title="Test unitaire pour suppression",
            description="Ce bon doit être supprimé unitairement",
            equipment_id="V3V",
            severity="preventif",
        )
        ticket_id = created["ticket_id"]
        self.assertEqual(created["status"], "success")

        # Verify it exists in list
        tickets_before = get_gmao_tickets()
        self.assertTrue(any(t["ticket_id"] == ticket_id for t in tickets_before))

        # 2. Delete the ticket unitarily
        del_res = delete_gmao_intervention(ticket_id)
        self.assertEqual(del_res["status"], "success")
        self.assertEqual(del_res["ticket_id"], ticket_id)
        self.assertTrue(del_res["removed_from_memory"])

        # Verify it no longer exists in list
        tickets_after = get_gmao_tickets()
        self.assertFalse(any(t["ticket_id"] == ticket_id for t in tickets_after))


if __name__ == "__main__":
    unittest.main()
