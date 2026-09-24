#!/usr/bin/env python3
"""
CLI tool for Dalkia RAG & Live Assistant.
Allows interactive testing of RAG search, Live API payload structure, and SCADA tools.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from .tools.rag_tool import search_dalkia_knowledge_base, get_rag_engine
from .live_rag_client import DalkiaLiveRagClient
from .agent import root_agent


def print_banner():
    print("""
===============================================================
       DALKIA LIVEASSIST - AGENT RAG & GEMINI LIVE API
             (Propulsé par Google ADK 2.9.2)
===============================================================
    """)


async def run_query(client: DalkiaLiveRagClient, query: str):
    print(f"\n[?] Question Technicien : {query}\n" + "-" * 60)

    result = await client.simulate_live_rag_turn(query)

    print("\n[RAG GROUNDING METADATA]")
    chunks = result["grounding_metadata"]["grounding_chunks"]
    if chunks:
        for i, c in enumerate(chunks, 1):
            ctx = c["retrieved_context"]
            print(f"  [{i}] Source : {ctx['title']} ({ctx['uri']})")
            print(f"      Extrait : {ctx['text'].strip()}")
    else:
        print("  Aucun chunk RAG extrait.")

    if result["tool_executions"]:
        print("\n[ACTIONS SCADA & GMAO EXÉCUTÉES]")
        for tool_name, t_res in result["tool_executions"]:
            print(f"  * {tool_name} -> {t_res}")

    print("\n[RÉPONSE DE L'AGENT DALKIA]")
    print(result["response_text"])
    print("-" * 60)


async def interactive_loop(client: DalkiaLiveRagClient):
    print("\nMode interactif activé. Posez vos questions ou tapez 'quit' pour quitter.")
    print("Exemples :")
    print(" - 'Quelle est la procédure de décendrage de la chaudière B1 ?'")
    print(" - 'Comment diagnostiquer un encrassement sur l'échangeur ECH1 ?'")
    print(" - 'Règle la consigne primaire à 86 degrés'")
    print(" - 'Quelle est la loi d'eau DESC ?'\n")

    while True:
        try:
            q = input("\nDalkia-Tech> ").strip()
            if not q:
                continue
            if q.lower() in ("exit", "quit", "q"):
                print("Fin de session.")
                break
            await run_query(client, q)
        except (KeyboardInterrupt, EOFError):
            print("\nArrêt.")
            break


def main():
    parser = argparse.ArgumentParser(description="Dalkia RAG & Live Assistant CLI")
    parser.add_argument("--query", "-q", type=str, help="Question unique à poser à l'agent")
    parser.add_argument("--interactive", "-i", action="store_true", help="Lancer en mode interactif")
    parser.add_argument("--show-setup", action="store_true", help="Afficher le payload WebSocket Live API conforme à la doc Cloud")
    parser.add_argument("--search-rag", "-s", type=str, help="Tester directement la recherche RAG dans les manuels Dalkia")

    args = parser.parse_args()
    print_banner()

    client = DalkiaLiveRagClient()

    if args.show_setup:
        print("=== PAYLOAD CONFIGURATION GEMINI LIVE API + VERTEX RAG STORE ===")
        print(json.dumps(client.build_setup_message(), indent=2, ensure_ascii=False))
        return

    if args.search_rag:
        print(f"Recherche dans les manuels Dalkia pour : '{args.search_rag}'...\n")
        res = search_dalkia_knowledge_base(args.search_rag)
        print(res)
        return

    if args.query:
        asyncio.run(run_query(client, args.query))
    else:
        asyncio.run(interactive_loop(client))


if __name__ == "__main__":
    main()
