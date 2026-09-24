"""
Dalkia LiveAssist V2 - Dedicated Simple Web Interface Server.
Connects browser directly to Gemini Multimodal Live API via WebSocket with real-time RAG & SCADA tools,
interactive supervision cockpit, screen sharing, and BigQuery-backed GMAO maintenance tracking.
"""

import asyncio
import base64
import json
import logging
import os
import sys
from typing import Any, Dict

import uvicorn
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

# Ensure project root is in sys.path
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from google import genai
from google.genai import types

# Import Dalkia Tools
from dalkia_rag_adk.tools.rag_tool import search_dalkia_knowledge_base
from dalkia_rag_adk.tools.scada_tools import (
    get_facility_telemetry,
    set_temperature_setpoint,
    set_boiler_temperature,
    get_active_alarms,
    log_gmao_intervention,
    delete_gmao_intervention,
    get_gmao_tickets,
)

# Configuration
os.environ.setdefault("GOOGLE_GENAI_USE_VERTEXAI", "true")
os.environ.setdefault(
    "GOOGLE_CLOUD_PROJECT",
    os.getenv("GCP_PROJECT", os.getenv("PROJECT_ID", "your-gcp-project-id")),
)
os.environ.setdefault("GOOGLE_CLOUD_LOCATION", "us-central1")

LIVE_MODEL = os.getenv("DALKIA_LIVE_MODEL", "gemini-3.8-live")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger("dalkia_web_app")

app = FastAPI(title="Dalkia LiveAssist V2 Web Server")

# Serve static files
STATIC_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static")
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


@app.get("/")
async def root():
    return FileResponse(os.path.join(STATIC_DIR, "index.html"))


@app.get("/api/gmao/interventions")
async def api_get_gmao_interventions():
    """Returns the list of GMAO maintenance tickets (from BigQuery and live cache)."""
    try:
        tickets = get_gmao_tickets()
        return {"status": "success", "count": len(tickets), "interventions": tickets}
    except Exception as e:
        logger.error("Error retrieving GMAO tickets: %s", e)
        return JSONResponse(status_code=500, content={"status": "error", "message": str(e)})


@app.post("/api/gmao/interventions")
async def api_create_gmao_intervention(request: Request):
    """Allows manual creation of an intervention ticket, synced to BigQuery."""
    try:
        data = await request.json()
        title = data.get("title", "Intervention maintenance")
        description = data.get("description", "")
        equipment_id = data.get("equipment_id", "B1")
        severity = data.get("severity", "normal")
        res = log_gmao_intervention(title, description, equipment_id, severity)
        return res
    except Exception as e:
        logger.error("Error creating GMAO ticket: %s", e)
        return JSONResponse(status_code=500, content={"status": "error", "message": str(e)})


@app.delete("/api/gmao/interventions/{ticket_id}")
async def api_delete_gmao_intervention(ticket_id: str):
    """Supprime unitairement un bon d'intervention de la GMAO et de BigQuery."""
    try:
        res = delete_gmao_intervention(ticket_id)
        return res
    except Exception as e:
        logger.error("Error deleting GMAO ticket %s: %s", ticket_id, e)
        return JSONResponse(status_code=500, content={"status": "error", "message": str(e)})


# Instructions for Gemini Live 3.8
SYSTEM_INSTRUCTION = """Tu es Dalkia LiveAssist V2, l'assistant expert en génie climatique et exploitation thermique de Dalkia (Groupe EDF).
Tu es en communication multimodale bidirectionnelle temps réel (voix, vidéo/partage d'écran et texte) avec un technicien d'exploitation Dalkia.

VISION & PARTAGE D'ÉCRAN :
- Le technicien partage son écran avec toi. Tu as des yeux sur l'écran et tu vois en direct la fenêtre de l'application.
- Tu peux observer les composants industriels affichés :
  * Chaudière biomasse B1 : foyer de combustion avec flammes animées, température foyer (°C), repère de surchauffe à 950°C, pression foyer et tirage d'air comburant.
  * Échangeur à plaques ECH1 : températures primaires (départ chaudière et retour), températures secondaires (départ réseau DESC et retour), débit et pression qui réagissent dynamiquement aux variations thermiques de la chaudière.
  * Bandeau d'alarmes en haut : vert (Nominal) ou rouge clignotant en cas d'alerte critique (> 950°C).
  * Onglet GMAO : liste des interventions enregistrées et archivées dans BigQuery (dataset 'dalkia').
- Lorsque le technicien te pose une question sur ce qu'il a à l'écran, commente directement ce que tu vois (valeur de la température foyer, températures de l'échangeur ECH1, état des flammes, statut d'alarme).

RÔLE ET CAPACITÉS :
- Tu as accès à la base de connaissances documentaire technique Dalkia via l'outil 'search_dalkia_knowledge_base' (manuels chaudière B1 MAN-DK-BIO-001, échangeur ECH1 MAN-DK-ECH-002, régulation DESC REG-DK-DESC-003, vanne V3V MAN-DK-V3V-004).
- Tu as accès aux outils SCADA pour lire la télémétrie ('get_facility_telemetry'), modifier les consignes ('set_temperature_setpoint'), et auditer les alarmes ('get_active_alarms').
- Tu as accès à la GMAO Dalkia ('log_gmao_intervention', 'delete_gmao_intervention') qui archive immédiatement les tickets dans BigQuery dans le dataset 'dalkia' (tables 'interventions_gmao' et 'bons_intervention').
- Lorsque le technicien te demande d'enregistrer une intervention, appelle systématiquement 'log_gmao_intervention' en précisant l'équipement (B1, ECH1, V3V...), le titre, la description et la gravité.
- Lorsque le technicien te demande de supprimer un bon d'intervention (ex: "supprime le bon d'intervention GMAO-2026-1030" ou "supprime l'intervention numéro 1030"), appelle 'delete_gmao_intervention' avec l'identifiant du ticket.

COMMANDES ET RÉGULATION EN DIRECT (DYNAMIQUES) :
- Si le technicien te demande de modifier une consigne ou d'augmenter/baisser la température (ex: "augmente la température du circuit primaire à 950 degrés", "règle la chaudière à 920°C", "passe à 950 degrés", "baisse la consigne primaire à 82°C") :
  * Appelle TOUJOURS immédiatement l'outil 'set_boiler_temperature' ou 'set_temperature_setpoint' pour exécuter la consigne en temps réel.
  * Si la température demandée est élevée (>= 500°C, ex: 870, 920, 950, 965°C) ou concerne la chaudière B1 / le foyer : appelle 'set_boiler_temperature' (ou 'set_temperature_setpoint' avec circuit='boiler' ou 'primary').
  * Précise à l'oral de façon dynamique et naturelle que la consigne est appliquée et commente ce qui se passe à l'écran (ex: "J'augmente la température de la chaudière B1 à 950°C. Les températures de l'échangeur ECH1 augmentent également et l'alarme de surchauffe s'affiche à l'écran !").

RÈGLES D'ÉLOCUTION :
- Réponds en français à l'oral de manière concise, directe et fluide (2 à 4 phrases).
- Ne t'interromps pas au milieu d'une phrase. N'utilise pas de puces markdown ou astérisques pour la synthèse vocale.
"""

DALKIA_TOOL_DECLARATIONS = [
    types.Tool(
        function_declarations=[
            types.FunctionDeclaration(
                name="search_dalkia_knowledge_base",
                description="Recherche dans les manuels techniques d'exploitation Dalkia (chaudière B1, échangeur ECH1, loi d'eau, vanne V3V).",
                parameters=types.Schema(
                    type=types.Type.OBJECT,
                    properties={
                        "query": types.Schema(
                            type=types.Type.STRING,
                            description="Question technique ou mot-clé à rechercher",
                        )
                    },
                    required=["query"],
                ),
            ),
            types.FunctionDeclaration(
                name="get_facility_telemetry",
                description="Récupère la télémétrie SCADA en temps réel de la chaufferie (températures départ/retour, pressions, débits).",
                parameters=types.Schema(
                    type=types.Type.OBJECT,
                    properties={
                        "circuit": types.Schema(
                            type=types.Type.STRING,
                            description="Circuit cible : 'primary', 'secondary' ou 'all'",
                        )
                    },
                ),
            ),
            types.FunctionDeclaration(
                name="set_boiler_temperature",
                description="Modifie ou simule en direct la température (°C) du foyer de la chaudière biomasse B1 (plage 750°C à 1020°C). Déclenche les alertes visuelles, le bandeau d'alarme et anime l'écran de supervision.",
                parameters=types.Schema(
                    type=types.Type.OBJECT,
                    properties={
                        "temperature_celsius": types.Schema(
                            type=types.Type.NUMBER,
                            description="Nouvelle température du foyer en °C (ex: 870 nominal, 920 alerte, 950 seuil d'arrêt, 965 surchauffe critique)",
                        )
                    },
                    required=["temperature_celsius"],
                ),
            ),
            types.FunctionDeclaration(
                name="set_temperature_setpoint",
                description="Modifie la consigne de température (°C) sur l'automate SCADA pour le circuit primaire, le circuit secondaire, ou la chaudière B1.",
                parameters=types.Schema(
                    type=types.Type.OBJECT,
                    properties={
                        "circuit": types.Schema(
                            type=types.Type.STRING,
                            description="'primary', 'secondary', ou 'boiler' / 'chaudiere'",
                        ),
                        "temperature_celsius": types.Schema(
                            type=types.Type.NUMBER,
                            description="Température souhaitée en °C",
                        ),
                    },
                    required=["circuit", "temperature_celsius"],
                ),
            ),
            types.FunctionDeclaration(
                name="get_active_alarms",
                description="Liste les alertes et alarmes en cours sur les installations thermiques Dalkia.",
                parameters=types.Schema(
                    type=types.Type.OBJECT,
                    properties={},
                ),
            ),
            types.FunctionDeclaration(
                name="log_gmao_intervention",
                description="Enregistre un compte-rendu d'intervention dans la GMAO Dalkia et dans la table BigQuery du dataset 'dalkia'.",
                parameters=types.Schema(
                    type=types.Type.OBJECT,
                    properties={
                        "title": types.Schema(type=types.Type.STRING, description="Titre du rapport"),
                        "description": types.Schema(type=types.Type.STRING, description="Détail des opérations"),
                        "equipment_id": types.Schema(type=types.Type.STRING, description="Équipement concerné (B1, ECH1, V3V)"),
                        "severity": types.Schema(type=types.Type.STRING, description="'normal', 'critique' ou 'preventif'"),
                    },
                    required=["title", "description", "equipment_id"],
                ),
            ),
            types.FunctionDeclaration(
                name="delete_gmao_intervention",
                description="Supprime unitairement un bon d'intervention dans la GMAO Dalkia et dans BigQuery (dataset 'dalkia').",
                parameters=types.Schema(
                    type=types.Type.OBJECT,
                    properties={
                        "ticket_id": types.Schema(
                            type=types.Type.STRING,
                            description="Identifiant du ticket GMAO (ex: 'GMAO-2026-1030') ou numéro de bon (ex: '1030')",
                        )
                    },
                    required=["ticket_id"],
                ),
            ),
        ]
    )
]


def execute_dalkia_tool(name: str, args: Dict[str, Any]) -> Any:
    """Dispatches tool execution to the appropriate Dalkia module."""
    logger.info("Executing tool: %s with args: %s", name, args)
    if name == "search_dalkia_knowledge_base":
        query = args.get("query", "")
        return search_dalkia_knowledge_base(query)
    elif name == "get_facility_telemetry":
        circuit = args.get("circuit", "all")
        return get_facility_telemetry(circuit)
    elif name == "set_boiler_temperature":
        temp = float(args.get("temperature_celsius", 870.0))
        return set_boiler_temperature(temp)
    elif name == "set_temperature_setpoint":
        circuit = args.get("circuit", "primary")
        temp = float(args.get("temperature_celsius", 80.0))
        return set_temperature_setpoint(circuit, temp)
    elif name == "get_active_alarms":
        return get_active_alarms()
    elif name == "log_gmao_intervention":
        return log_gmao_intervention(
            args.get("title", "Intervention maintenance"),
            args.get("description", "Vérification sur site"),
            args.get("equipment_id", "B1"),
            args.get("severity", "normal"),
        )
    elif name == "delete_gmao_intervention":
        return delete_gmao_intervention(args.get("ticket_id", ""))
    return {"error": f"Tool '{name}' unknown"}


@app.websocket("/ws/live")
async def websocket_live_endpoint(websocket: WebSocket):
    await websocket.accept()
    logger.info("Client connected to Dalkia LiveAssist WebSocket")

    client = genai.Client()

    config = types.LiveConnectConfig(
        response_modalities=[types.Modality.AUDIO],
        tools=DALKIA_TOOL_DECLARATIONS,
        system_instruction=types.Content(
            parts=[types.Part.from_text(text=SYSTEM_INSTRUCTION)]
        ),
        speech_config=types.SpeechConfig(
            voice_config=types.VoiceConfig(
                prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name="Puck")
            )
        ),
        input_audio_transcription=types.AudioTranscriptionConfig(),
        output_audio_transcription=types.AudioTranscriptionConfig(),
    )

    try:
        async with client.aio.live.connect(model=LIVE_MODEL, config=config) as session:
            await websocket.send_json({"type": "ready", "model": LIVE_MODEL})
            logger.info("Live session active with model %s", LIVE_MODEL)

            in_tool_call = False

            async def receive_from_model():
                nonlocal in_tool_call
                try:
                    while True:
                        resp = await session._receive()
                        if not resp:
                            break

                        # Handle Tool Calls
                        if resp.tool_call:
                            in_tool_call = True
                            for call in resp.tool_call.function_calls:
                                await websocket.send_json({
                                    "type": "tool_call",
                                    "name": call.name,
                                    "args": call.args,
                                    "call_id": call.id,
                                    "status": "pending",
                                })
                                # Execute tool locally
                                result = execute_dalkia_tool(call.name, call.args)
                                summary = str(result)[:350] + ("..." if len(str(result)) > 350 else "")
                                await websocket.send_json({
                                    "type": "tool_result",
                                    "name": call.name,
                                    "result": summary,
                                    "call_id": call.id,
                                })

                                # If telemetry, setpoint or boiler was modified, notify frontend immediately
                                if call.name in ("set_temperature_setpoint", "set_boiler_temperature", "execute_equipment_override") and isinstance(result, dict):
                                    await websocket.send_json({
                                        "type": "telemetry_updated",
                                        "data": result,
                                    })

                                # If GMAO intervention was logged, notify frontend immediately
                                if call.name == "log_gmao_intervention" and isinstance(result, dict):
                                    await websocket.send_json({
                                        "type": "gmao_updated",
                                        "ticket": result,
                                    })

                                # If GMAO intervention was deleted, notify frontend immediately
                                if call.name == "delete_gmao_intervention" and isinstance(result, dict):
                                    await websocket.send_json({
                                        "type": "gmao_deleted",
                                        "ticket_id": result.get("ticket_id"),
                                        "result": result,
                                    })

                                # Send response back to Gemini Live
                                await session.send_tool_response(
                                    function_responses=types.FunctionResponse(
                                        name=call.name,
                                        id=call.id,
                                        response={"result": result if isinstance(result, (dict, list)) else {"text": str(result)}},
                                    )
                                )

                        # Handle Server Content (Audio + Transcriptions)
                        if resp.server_content:
                            sc = resp.server_content
                            if sc.interrupted:
                                await websocket.send_json({"type": "interrupted"})

                            if sc.input_transcription and sc.input_transcription.text:
                                await websocket.send_json({
                                    "type": "transcript",
                                    "role": "user",
                                    "text": sc.input_transcription.text,
                                    "finished": bool(sc.input_transcription.finished),
                                })

                            if sc.output_transcription and sc.output_transcription.text:
                                await websocket.send_json({
                                    "type": "transcript",
                                    "role": "assistant",
                                    "text": sc.output_transcription.text,
                                    "finished": bool(sc.output_transcription.finished),
                                })

                            if sc.model_turn:
                                for part in sc.model_turn.parts:
                                    if part.inline_data and part.inline_data.data:
                                        b64_audio = base64.b64encode(part.inline_data.data).decode("utf-8")
                                        await websocket.send_json({
                                            "type": "audio",
                                            "data": b64_audio,
                                        })

                            if sc.turn_complete:
                                in_tool_call = False
                                await websocket.send_json({"type": "turn_complete"})

                except asyncio.CancelledError:
                    pass
                except Exception as e:
                    logger.error("Error receiving from Gemini Live: %s", e)
                    try:
                        await websocket.send_json({"type": "error", "message": str(e)})
                    except Exception:
                        pass

            async def receive_from_client():
                try:
                    while True:
                        msg_str = await websocket.receive_text()
                        data = json.loads(msg_str)
                        msg_type = data.get("type")

                        if msg_type == "audio":
                            pcm_b64 = data.get("data")
                            if pcm_b64:
                                raw_bytes = base64.b64decode(pcm_b64)
                                await session.send_realtime_input(
                                    audio=types.Blob(data=raw_bytes, mime_type="audio/pcm;rate=16000")
                                )

                        elif msg_type in ("video_frame", "image"):
                            img_b64 = data.get("data")
                            if img_b64:
                                if "," in img_b64:
                                    img_b64 = img_b64.split(",", 1)[1]
                                frame_bytes = base64.b64decode(img_b64)
                                await session.send_realtime_input(
                                    video=types.Blob(data=frame_bytes, mime_type="image/jpeg")
                                )

                        elif msg_type == "text":
                            text = data.get("text")
                            if text:
                                await session.send(input=text, end_of_turn=True)

                        elif msg_type == "stop":
                            pass

                except (WebSocketDisconnect, asyncio.CancelledError):
                    pass
                except Exception as e:
                    logger.error("Error receiving from client: %s", e)

            t1 = asyncio.create_task(receive_from_model())
            t2 = asyncio.create_task(receive_from_client())
            done, pending = await asyncio.wait([t1, t2], return_when=asyncio.FIRST_COMPLETED)
            for task in pending:
                task.cancel()

    except Exception as e:
        logger.error("Live session failed: %s", e)
        try:
            await websocket.send_json({"type": "error", "message": str(e)})
        except Exception:
            pass
    finally:
        logger.info("Live WebSocket session closed.")


if __name__ == "__main__":
    port = int(os.getenv("PORT", "8085"))
    logger.info("Starting Dalkia LiveAssist web interface on http://localhost:%d", port)
    uvicorn.run("server:app", host="0.0.0.0", port=port, log_level="info")
