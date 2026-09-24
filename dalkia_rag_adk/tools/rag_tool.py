"""
RAG (Retrieval-Augmented Generation) Tools for Dalkia Technical Knowledge Base.
Implements Google Cloud Vertex RAG Engine integration for Gemini Live API and local semantic retrieval.
"""

from __future__ import annotations

import os
import glob
import re
from dataclasses import dataclass
from typing import Any, Dict, List, Optional
from google.genai import types

try:
    from google.adk.tools.retrieval.vertex_ai_rag_retrieval import VertexAiRagRetrieval
except ImportError:
    VertexAiRagRetrieval = None


@dataclass
class DocumentChunk:
    doc_id: str
    title: str
    reference: str
    section: str
    content: str
    source_file: str


class DalkiaLocalRagEngine:
    """Local RAG indexing engine for Dalkia technical operating manuals."""

    def __init__(self, knowledge_base_dir: Optional[str] = None):
        if knowledge_base_dir is None:
            base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            knowledge_base_dir = os.path.join(base_dir, "knowledge_base")
        self.knowledge_base_dir = knowledge_base_dir
        self.chunks: List[DocumentChunk] = []
        self._load_and_chunk_corpus()

    def _load_and_chunk_corpus(self) -> None:
        """Parses and chunks markdown documents in the knowledge base."""
        pattern = os.path.join(self.knowledge_base_dir, "*.md")
        files = glob.glob(pattern)

        for file_path in files:
            doc_id = os.path.basename(file_path).replace(".md", "")
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    content = f.read()
            except Exception as err:
                print(f"Warning: Failed to read {file_path}: {err}")
                continue

            # Extract Document Title (# Title)
            title_match = re.search(r"^#\s+(.+)$", content, re.MULTILINE)
            doc_title = title_match.group(1).strip() if title_match else doc_id

            # Extract Reference
            ref_match = re.search(r"\*\*Référence Dalkia\s*:\*\*\s*(.+)$", content, re.MULTILINE)
            doc_ref = ref_match.group(1).strip() if ref_match else ""

            # Split into sections based on ## headers
            sections = re.split(r"\n(?=##\s+)", content)
            for sec in sections:
                sec = sec.strip()
                if not sec:
                    continue
                header_match = re.match(r"^##\s+(.+)$", sec, re.MULTILINE)
                section_title = header_match.group(1).strip() if header_match else "Introduction"
                self.chunks.append(
                    DocumentChunk(
                        doc_id=doc_id,
                        title=doc_title,
                        reference=doc_ref,
                        section=section_title,
                        content=sec,
                        source_file=file_path,
                    )
                )

    def search(self, query: str, top_k: int = 3) -> List[Dict[str, Any]]:
        """Retrieves most relevant chunks for a user query."""
        if not self.chunks:
            self._load_and_chunk_corpus()

        query_terms = [t.lower() for t in re.findall(r"\w+", query) if len(t) > 2]
        scored_chunks: List[tuple[float, DocumentChunk]] = []

        for chunk in self.chunks:
            score = 0.0
            content_lower = chunk.content.lower()
            title_lower = chunk.title.lower()
            section_lower = chunk.section.lower()

            for term in query_terms:
                if term in title_lower:
                    score += 5.0
                if term in section_lower:
                    score += 4.0
                # Term occurrences in body
                occurrences = content_lower.count(term)
                score += min(occurrences * 1.5, 6.0)

            if score > 0:
                scored_chunks.append((score, chunk))

        # Sort descending by relevance score
        scored_chunks.sort(key=lambda x: x[0], reverse=True)
        results = []
        for score, chunk in scored_chunks[:top_k]:
            results.append({
                "doc_id": chunk.doc_id,
                "title": chunk.title,
                "reference": chunk.reference,
                "section": chunk.section,
                "content": chunk.content,
                "score": round(score, 2),
                "source": os.path.basename(chunk.source_file),
            })
        return results


# Global singleton instance of the local RAG engine
_rag_engine_instance: Optional[DalkiaLocalRagEngine] = None


def get_rag_engine() -> DalkiaLocalRagEngine:
    global _rag_engine_instance
    if _rag_engine_instance is None:
        _rag_engine_instance = DalkiaLocalRagEngine()
    return _rag_engine_instance


def search_dalkia_knowledge_base(query: str, max_results: int = 3) -> str:
    """Interroge la base de connaissances et les manuels techniques Dalkia (biomasse, échangeurs, réseau DESC, vannes V3V).

    Utilisez cet outil dès que le technicien pose une question sur les consignes d'exploitation,
    les seuils critiques, les procédures de sécurité, d'allumage, de décendrage, de désembouage
    ou la maintenance préventive de la chaufferie.

    Args:
        query: Requête technique ou question de l'exploitant (ex: "procédure décendrage chaudière biomasse", "delta T échangeur").
        max_results: Nombre maximal d'extraits pertinents à retourner.

    Returns:
        Extraits documentaires avec titre, référence et procédure détaillée.
    """
    engine = get_rag_engine()
    results = engine.search(query, top_k=max_results)

    if not results:
        return f"Aucun extrait technique trouvé pour la requête : '{query}'. Veuillez vérifier les termes techniques ou consulter la GMAO centrale."

    output_lines = [f"=== RÉSULTATS DE RECHERCHE RAG DALKIA ({len(results)} extrait(s)) ==="]
    for i, res in enumerate(results, start=1):
        ref_label = f" [{res['reference']}]" if res.get('reference') else ""
        output_lines.append(f"\n[Source {i}] {res['title']}{ref_label} — Section: {res['section']} (Pertinence: {res['score']})")
        output_lines.append(f"Fichier : {res['source']}")
        output_lines.append(res['content'])
        output_lines.append("-" * 50)

    return "\n".join(output_lines)


def get_vertex_rag_live_tool_config(
    project_id: Optional[str] = None,
    location: str = "us-central1",
    rag_corpus_id: str = "dalkia-manuals-corpus",
) -> Dict[str, Any]:
    """Generates the Vertex RAG Store Live API tool specification according to Google Cloud docs.

    Reference: https://docs.cloud.google.com/gemini-enterprise-agent-platform/build/rag-engine/use-rag-in-multimodal-live
    """
    pid = project_id or os.getenv("GOOGLE_CLOUD_PROJECT", "your-gcp-project-id")
    corpus_resource = f"projects/{pid}/locations/{location}/ragCorpora/{rag_corpus_id}"
    return {
        "retrieval": {
            "vertex_rag_store": {
                "rag_resources": {
                    "rag_corpus": corpus_resource
                }
            }
        }
    }


def get_genai_vertex_rag_tool(
    project_id: Optional[str] = None,
    location: str = "us-central1",
    rag_corpus_id: str = "dalkia-manuals-corpus",
) -> types.Tool:
    """Generates a google.genai types.Tool instance with Vertex RAG Store for Gemini Live API."""
    pid = project_id or os.getenv("GOOGLE_CLOUD_PROJECT", "your-gcp-project-id")
    corpus_resource = f"projects/{pid}/locations/{location}/ragCorpora/{rag_corpus_id}"
    memory_store = types.VertexRagStore(
        rag_resources=[
            types.VertexRagStoreRagResource(rag_corpus=corpus_resource)
        ],
        store_context=True,
    )
    return types.Tool(
        retrieval=types.Retrieval(vertex_rag_store=memory_store)
    )
