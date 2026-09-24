"""
ADK Runner wrapper for Dalkia RAG Agent.
Demonstrates running the Dalkia agent using Google ADK's Runner, Sessions and Event streams.
"""

from __future__ import annotations

import asyncio
from typing import Any, AsyncGenerator, Dict, List, Optional

from google.adk.runners import Runner
from google.adk.sessions.in_memory_session_service import InMemorySessionService
from google.genai import types

from .agent import root_agent


class DalkiaAdkRunner:
    """Wrapper around ADK Runner for executing queries against the Dalkia RAG Agent."""

    def __init__(self, agent=None):
        self.agent = agent or root_agent
        self.session_service = InMemorySessionService()
        self.runner = Runner(
            agent=self.agent,
            app_name="dalkia_rag_adk",
            session_service=self.session_service,
            auto_create_session=True,
        )

    async def execute_query_async(self, query: str, user_id: str = "technicien_dalkia", session_id: str = "session_001") -> List[Any]:
        """Runs a user query through the ADK Agent Runner and collects events."""
        events = []
        user_content = types.Content(
            role="user",
            parts=[types.Part.from_text(text=query)]
        )

        async for event in self.runner.run_async(
            user_id=user_id,
            session_id=session_id,
            new_message=user_content,
        ):
            events.append(event)

        return events


async def demo_runner():
    """Quick console test of the ADK runner."""
    print("=== Dalkia ADK Runner Demo ===")
    runner = DalkiaAdkRunner()
    print("ADK Runner initialized with agent:", runner.agent.name)
    query = "Quelle est la procédure de décendrage de la chaudière biomasse B1 ?"
    print(f"\nExécution de la requête : '{query}'...")
    try:
        events = await runner.execute_query_async(query)
        print(f"Événements reçus : {len(events)}")
        for ev in events:
            print("Event type:", type(ev), getattr(ev, "id", ""))
    except Exception as err:
        print("Note (exécution sans clé Cloud API) :", err)


if __name__ == "__main__":
    asyncio.run(demo_runner())
