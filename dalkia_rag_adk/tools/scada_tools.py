"""
SCADA & GMAO Operational Tools for Dalkia Facility Supervision.
Provides real-time telemetry, equipment modulation, alarm management and maintenance ticketing
with full Google Cloud BigQuery persistence into dataset 'dalkia'.
"""

from __future__ import annotations

import datetime
import logging
import os
from typing import Any, Dict, List

from google.cloud import bigquery

logger = logging.getLogger(__name__)

BQ_PROJECT = os.environ.get("GOOGLE_CLOUD_PROJECT") or os.environ.get("GCP_PROJECT") or "your-gcp-project-id"
BQ_DATASET = "dalkia"
BQ_TABLE_GMAO = "interventions_gmao"
BQ_TABLE_BONS = "bons_intervention"
BQ_LOCATION = "EU"

_bq_client = None


def get_bigquery_client():
    """Lazily initializes and caches the BigQuery client."""
    global _bq_client
    if _bq_client is None:
        try:
            _bq_client = bigquery.Client(project=BQ_PROJECT, location=BQ_LOCATION)
        except Exception as e:
            logger.warning("Could not initialize BigQuery client: %s", e)
    return _bq_client


# Simulated live state of Dalkia heating plant
_facility_state: Dict[str, Any] = {
    "facility_name": "Centrale Biomasse & Réseau Chaleur Lille Métropole (DK-LILLE-NORD-01)",
    "primary_circuit": {
        "supply_temp_current": 84.6,
        "supply_temp_setpoint": 85.0,
        "return_temp_current": 66.8,
        "pressure_bars": 4.3,
        "flow_m3h": 495.0,
    },
    "secondary_circuit": {
        "supply_temp_current": 77.2,
        "supply_temp_setpoint": 78.0,
        "return_temp_current": 54.1,
        "pressure_bars": 3.9,
        "flow_m3h": 460.0,
    },
    "equipments": {
        "B1": {"name": "Chaudière Biomasse B1", "status": "on", "power_mw": 11.4, "mode": "base", "foyer_temp": 892.0},
        "G2": {"name": "Chaudière Gaz d'Appoint G2", "status": "standby", "power_mw": 0.0, "mode": "appoint"},
        "P1": {"name": "Circulateur Primaire P1", "status": "on", "speed_percent": 88},
        "ECH1": {"name": "Échangeur à Plaques ECH1", "status": "on", "delta_t": 23.1, "pincement": 2.7},
        "P2": {"name": "Circulateur Réseau P2", "status": "on", "speed_percent": 82},
        "V3V": {"name": "Vanne 3 Voies de Mélange V3V", "opening_percent": 74},
    },
    "alarms": [
        {
            "id": "ALM-102",
            "equipment": "Réseau Secondaire",
            "severity": "warning",
            "message": "Légère chute de pression différentielle (3.9 bars < 4.0 bars)",
            "timestamp": "08:14",
            "is_acknowledged": False,
        }
    ],
    "gmao_tickets": [
        {
            "ticket_id": "GMAO-2026-1029",
            "numero_intervention": 1029,
            "equipment": "ECH1",
            "title": "Détartrage chimique et contrôle de pincement",
            "description": "Perte de charge enregistrée à 48.2 kPa. Nettoyage doux à l'acide sulfamique 5%, rinçage abondant et serrage des tirants M24 à 180 N·m. Pincement rétabli à 2.7°C.",
            "severity": "preventif",
            "status": "closed",
            "technician": "Équipe Astreinte Dalkia",
            "timestamp": "20/09/2026 16:30",
            "source": "BigQuery",
        },
        {
            "ticket_id": "GMAO-2026-1028",
            "numero_intervention": 1028,
            "equipment": "V3V",
            "title": "Remplacement servomoteur vanne de mélange",
            "description": "Servomoteur Belimo bloqué à 80% d'ouverture. Remplacement par actuateur neuf 0-10V, calibrage du zéro et contrôle de recopie 4-20mA validé.",
            "severity": "normal",
            "status": "closed",
            "technician": "Technicien Régulation Dalkia",
            "timestamp": "19/09/2026 11:15",
            "source": "BigQuery",
        },
        {
            "ticket_id": "GMAO-2026-1027",
            "numero_intervention": 1027,
            "equipment": "B1",
            "title": "Inspection réfractaires voûte et vis de décendrage",
            "description": "Visite préventive trimestrielle de la chambre de combustion biomasse. Contrôle des thermocouples voûte, graissage paliers de la vis d'extraction des cendres.",
            "severity": "preventif",
            "status": "closed",
            "technician": "Technicien Biomasse Dalkia",
            "timestamp": "18/09/2026 14:00",
            "source": "BigQuery",
        },
    ],
}


def get_facility_telemetry(circuit: str = "all") -> Dict[str, Any]:
    """Retourne la télémétrie en temps réel de la chaufferie Dalkia (températures, pressions, débits, puissance).

    Args:
        circuit: 'primary', 'secondary', ou 'all'.

    Returns:
        Dictionnaire contenant les métriques d'exploitation.
    """
    if circuit == "primary":
        return {
            "status": "success",
            "circuit": "primary",
            "metrics": _facility_state["primary_circuit"],
            "power_mw": _facility_state["equipments"]["B1"]["power_mw"],
        }
    if circuit == "secondary":
        return {
            "status": "success",
            "circuit": "secondary",
            "metrics": _facility_state["secondary_circuit"],
        }
    return {
        "status": "success",
        "facility": _facility_state["facility_name"],
        "primary": _facility_state["primary_circuit"],
        "secondary": _facility_state["secondary_circuit"],
        "biomass_power_mw": _facility_state["equipments"]["B1"]["power_mw"],
        "gas_power_mw": _facility_state["equipments"]["G2"]["power_mw"],
    }


def set_boiler_temperature(temperature_celsius: float) -> Dict[str, Any]:
    """Modifie la température de combustion / foyer de la chaudière biomasse B1 en °C et répercute la thermique sur l'échangeur ECH1 et le réseau DESC.

    Args:
        temperature_celsius: Température du foyer en °C (ex: 870.0 nominal, 920.0 alerte, 950.0 arrêt, 965.0 critique).

    Returns:
        Dictionnaire avec les données télémétriques complètes mises à jour (chaudière, échangeur, réseau DESC) et le statut d'alarme.
    """
    temp = round(float(temperature_celsius), 1)
    _facility_state["equipments"]["B1"]["foyer_temp"] = temp

    # If boiler temperature reaches or exceeds 950°C, it's a critical safety threshold
    is_alarm = temp >= 950.0
    status_label = "SURCHAUFFE CRITIQUE" if is_alarm else ("ALERTE" if temp >= 900.0 else "NOMINAL")

    delta_t = temp - 870.0

    # Thermally coupled primary circuit values (Départ, Consigne, Retour, Débit)
    prim_supply = round(84.6 + (delta_t * 0.08), 1)
    prim_setpoint = round(85.0 + (delta_t * 0.075), 1)
    prim_return = round(66.8 + (delta_t * 0.055), 1)
    prim_flow = round(495.0 + (delta_t * 0.25), 1)

    _facility_state["primary_circuit"]["supply_temp_current"] = prim_supply
    _facility_state["primary_circuit"]["supply_temp_setpoint"] = prim_setpoint
    _facility_state["primary_circuit"]["return_temp_current"] = prim_return
    _facility_state["primary_circuit"]["flow_m3h"] = prim_flow

    # Thermally coupled secondary / DESC network values (Départ, Consigne, Retour, Pression)
    sec_supply = round(77.2 + (delta_t * 0.065), 1)
    sec_setpoint = round(78.0 + (delta_t * 0.06), 1)
    sec_return = round(54.1 + (delta_t * 0.04), 1)
    sec_pressure = round(3.9 + (delta_t * 0.0025), 1)

    _facility_state["secondary_circuit"]["supply_temp_current"] = sec_supply
    _facility_state["secondary_circuit"]["supply_temp_setpoint"] = sec_setpoint
    _facility_state["secondary_circuit"]["return_temp_current"] = sec_return
    _facility_state["secondary_circuit"]["pressure_bars"] = sec_pressure

    return {
        "status": "success",
        "target": "boiler",
        "boiler_temp": temp,
        "is_alarm": is_alarm,
        "status_label": status_label,
        "primary_supply_temp": prim_supply,
        "primary_setpoint_temp": prim_setpoint,
        "primary_return_temp": prim_return,
        "primary_flow": prim_flow,
        "secondary_supply_temp": sec_supply,
        "secondary_setpoint_temp": sec_setpoint,
        "secondary_return_temp": sec_return,
        "secondary_pressure": sec_pressure,
        "message": f"Température de la chaudière biomasse B1 ajustée à {temp}°C ({status_label}). Échangeur ECH1 et réseau DESC régulés.",
    }


def set_temperature_setpoint(circuit: str, temperature_celsius: float) -> Dict[str, Any]:
    """Modifie la consigne de température de départ d'un circuit ou la température du foyer de la chaudière B1.

    Args:
        circuit: Circuit cible ('primary', 'secondary', ou 'boiler' / 'chaudiere' / 'foyer' / 'b1').
        temperature_celsius: Température cible en degrés Celsius.

    Returns:
        Statut de la modification et télémétrie mise à jour.
    """
    temp = round(float(temperature_celsius), 1)
    c_lower = circuit.lower()

    # If temperature is >= 500°C OR circuit refers to boiler/foyer/chaudière/b1:
    # This refers to the combustion chamber / boiler B1!
    if temp >= 500.0 or any(k in c_lower for k in ("boiler", "chaud", "foyer", "b1")):
        return set_boiler_temperature(temp)

    is_primary = "prim" in c_lower
    circuit_key = "primary_circuit" if is_primary else "secondary_circuit"
    _facility_state[circuit_key]["supply_temp_setpoint"] = temp

    if is_primary:
        prim_supply = round(temp - 0.4, 1)
        prim_return = round(temp - 18.2, 1)
        sec_setpoint = round(temp - 7.0, 1)
        sec_supply = round(temp - 7.8, 1)
        sec_return = round(temp - 30.9, 1)

        _facility_state["primary_circuit"]["supply_temp_current"] = prim_supply
        _facility_state["primary_circuit"]["return_temp_current"] = prim_return
        _facility_state["secondary_circuit"]["supply_temp_setpoint"] = sec_setpoint
        _facility_state["secondary_circuit"]["supply_temp_current"] = sec_supply
        _facility_state["secondary_circuit"]["return_temp_current"] = sec_return

        return {
            "status": "success",
            "target": "setpoint",
            "circuit": "primary",
            "new_setpoint_celsius": temp,
            "primary_supply_temp": prim_supply,
            "primary_setpoint_temp": temp,
            "primary_return_temp": prim_return,
            "secondary_supply_temp": sec_supply,
            "secondary_setpoint_temp": sec_setpoint,
            "secondary_return_temp": sec_return,
            "message": f"Consigne mise à jour sur le circuit primaire : {temp}°C. Échangeur ECH1 réaligné.",
        }
    else:
        sec_supply = round(temp - 0.8, 1)
        sec_return = round(temp - 23.9, 1)
        prim_setpoint = round(temp + 7.0, 1)
        prim_supply = round(temp + 6.6, 1)

        _facility_state["secondary_circuit"]["supply_temp_current"] = sec_supply
        _facility_state["secondary_circuit"]["return_temp_current"] = sec_return
        _facility_state["primary_circuit"]["supply_temp_setpoint"] = prim_setpoint
        _facility_state["primary_circuit"]["supply_temp_current"] = prim_supply

        return {
            "status": "success",
            "target": "setpoint",
            "circuit": "secondary",
            "new_setpoint_celsius": temp,
            "secondary_supply_temp": sec_supply,
            "secondary_setpoint_temp": temp,
            "secondary_return_temp": sec_return,
            "primary_supply_temp": prim_supply,
            "primary_setpoint_temp": prim_setpoint,
            "message": f"Consigne mise à jour sur le réseau DESC : {temp}°C. Échangeur ECH1 réaligné.",
        }


def execute_equipment_override(
    equipment_id: str, action: str, power_percent: int = 100
) -> Dict[str, Any]:
    """Démarre, arrête ou module un équipement de production (chaudière biomasse B1, gaz G2, pompes P1/P2, vanne V3V).

    Args:
        equipment_id: Identifiant de l'équipement ('B1', 'G2', 'P1', 'P2', 'V3V').
        action: Action à effectuer ('start', 'stop', 'modulate', 'standby').
        power_percent: Pourcentage de charge ou de puissance (0 à 100).

    Returns:
        Résultat de la commande SCADA.
    """
    eq_id = equipment_id.upper()
    if eq_id not in _facility_state["equipments"]:
        return {
            "status": "error",
            "message": f"Équipement '{equipment_id}' introuvable. Disponibles: B1, G2, P1, P2, V3V.",
        }

    eq = _facility_state["equipments"][eq_id]
    if action in ("start", "on"):
        eq["status"] = "on"
        if eq_id == "G2":
            eq["power_mw"] = round(4.0 * (power_percent / 100.0), 1)
    elif action in ("stop", "off"):
        eq["status"] = "off"
        if "power_mw" in eq:
            eq["power_mw"] = 0.0
    elif action in ("standby", "veille"):
        eq["status"] = "standby"
        if "power_mw" in eq:
            eq["power_mw"] = 0.0
    elif action == "modulate":
        if "opening_percent" in eq:
            eq["opening_percent"] = power_percent
        elif "speed_percent" in eq:
            eq["speed_percent"] = power_percent

    return {
        "status": "success",
        "equipment": eq_id,
        "action": action,
        "current_status": eq["status"],
        "message": f"Ordre exécuté avec succès sur {eq['name']}.",
    }


def save_intervention_to_bigquery(record: Dict[str, Any]) -> bool:
    """Inserts intervention into BigQuery dataset 'dalkia' (both interventions_gmao and bons_intervention)."""
    client = get_bigquery_client()
    if not client:
        return False
    try:
        # 1. Insert into interventions_gmao
        table_gmao_ref = f"{BQ_PROJECT}.{BQ_DATASET}.{BQ_TABLE_GMAO}"
        row_gmao = [
            {
                "ticket_id": record["ticket_id"],
                "numero_intervention": int(record["numero_intervention"]),
                "equipment": record["equipment"],
                "title": record["title"],
                "description": record["description"],
                "severity": record["severity"],
                "technician": record["technician"],
                "created_at": record.get("created_at_iso", datetime.datetime.utcnow().isoformat()),
                "date_intervention": record.get("date_iso", datetime.date.today().isoformat()),
            }
        ]
        errors_gmao = client.insert_rows_json(table_gmao_ref, row_gmao)
        if errors_gmao:
            logger.error("BigQuery insert errors in %s: %s", table_gmao_ref, errors_gmao)
        else:
            logger.info("Successfully inserted ticket %s into %s", record["ticket_id"], table_gmao_ref)

        # 2. Insert into historical bons_intervention
        table_bons_ref = f"{BQ_PROJECT}.{BQ_DATASET}.{BQ_TABLE_BONS}"
        bons_desc = (
            f"[{record['equipment']}] {record['title']} : {record['description']}\n"
            f"(Gravité: {record['severity'].upper()} - Opérateur: {record['technician']})"
        )
        row_bons = [
            {
                "numero_intervention": int(record["numero_intervention"]),
                "description": bons_desc,
                "date_intervention": record.get("date_iso", datetime.date.today().isoformat()),
            }
        ]
        errors_bons = client.insert_rows_json(table_bons_ref, row_bons)
        if errors_bons:
            logger.error("BigQuery insert errors in %s: %s", table_bons_ref, errors_bons)
        else:
            logger.info("Successfully inserted into %s", table_bons_ref)

        return True
    except Exception as e:
        logger.error("Exception writing to BigQuery: %s", e)
        return False


def get_gmao_tickets() -> List[Dict[str, Any]]:
    """Returns list of GMAO tickets, combining BigQuery and local records."""
    client = get_bigquery_client()
    if client:
        try:
            query = f"""
            SELECT ticket_id, numero_intervention, equipment, title, description, severity, technician,
                   FORMAT_TIMESTAMP('%d/%m/%Y %H:%M', created_at) as timestamp
            FROM `{BQ_PROJECT}.{BQ_DATASET}.{BQ_TABLE_GMAO}`
            ORDER BY created_at DESC
            LIMIT 50
            """
            job = client.query(query)
            rows = list(job.result())
            if rows:
                bq_records = []
                for r in rows:
                    bq_records.append({
                        "ticket_id": r["ticket_id"],
                        "numero_intervention": r["numero_intervention"],
                        "equipment": r["equipment"],
                        "title": r["title"],
                        "description": r["description"],
                        "severity": r["severity"],
                        "technician": r["technician"],
                        "timestamp": r["timestamp"] or datetime.date.today().strftime("%d/%m/%Y 09:00"),
                        "source": "BigQuery",
                    })
                # Merge local in-memory records if any not yet in BigQuery
                bq_ids = {r["ticket_id"] for r in bq_records}
                for loc in _facility_state["gmao_tickets"]:
                    if loc["ticket_id"] not in bq_ids:
                        bq_records.append(loc)
                return bq_records
        except Exception as e:
            logger.warning("Could not read GMAO tickets from BigQuery: %s. Using local state.", e)

    return _facility_state["gmao_tickets"]


def get_next_intervention_number() -> int:
    """Computes next strictly increasing intervention number across BigQuery and local state."""
    max_num = 1029
    client = get_bigquery_client()
    if client:
        try:
            query = f"SELECT COALESCE(MAX(numero_intervention), 1029) as max_num FROM `{BQ_PROJECT}.{BQ_DATASET}.{BQ_TABLE_GMAO}`"
            res = list(client.query(query).result())
            if res and res[0]["max_num"] is not None:
                max_num = max(max_num, int(res[0]["max_num"]))
        except Exception as e:
            logger.warning("Could not query max numero_intervention from BigQuery: %s", e)

    for t in _facility_state.get("gmao_tickets", []):
        if "numero_intervention" in t and t["numero_intervention"] is not None:
            max_num = max(max_num, int(t["numero_intervention"]))

    return max_num + 1


def log_gmao_intervention(
    title: str, description: str, equipment_id: str, severity: str = "normal"
) -> Dict[str, Any]:
    """Crée et enregistre un compte-rendu d'intervention dans la GMAO centrale Dalkia et dans BigQuery (dataset dalkia).

    Args:
        title: Titre synthétique de l'intervention (ex: "Rétrolavage filtre à manches").
        description: Détail des opérations réalisées et constats techniques.
        equipment_id: Équipement concerné ('B1', 'G2', 'ECH1', 'V3V', 'P1', 'P2').
        severity: Gravité ('mineure', 'normal', 'critique', 'preventif').

    Returns:
        Numéro de ticket GMAO créé, persistance BigQuery et confirmation.
    """
    now = datetime.datetime.now()
    next_num = get_next_intervention_number()
    ticket_id = f"GMAO-{now.year}-{next_num}"
    record = {
        "ticket_id": ticket_id,
        "numero_intervention": next_num,
        "equipment": equipment_id.upper(),
        "title": title,
        "description": description,
        "severity": severity.lower(),
        "timestamp": now.strftime("%d/%m/%Y %H:%M"),
        "created_at_iso": now.isoformat(),
        "date_iso": now.date().isoformat(),
        "technician": "Technicien Exploitation (Via Dalkia LiveAssist)",
        "source": "BigQuery",
    }
    _facility_state["gmao_tickets"].insert(0, record)

    # Persist directly into BigQuery dataset dalkia
    bq_ok = save_intervention_to_bigquery(record)

    return {
        "status": "success",
        "ticket_id": ticket_id,
        "numero_intervention": next_num,
        "equipment": record["equipment"],
        "title": title,
        "description": description,
        "severity": severity.lower(),
        "timestamp": record["timestamp"],
        "bigquery_synced": bq_ok,
        "bigquery_table": f"{BQ_PROJECT}.{BQ_DATASET}.{BQ_TABLE_GMAO}",
        "message": f"Intervention enregistrée sous la référence {ticket_id} (n° {next_num}) et tracée dans BigQuery.",
    }


def delete_gmao_intervention(ticket_id: str) -> Dict[str, Any]:
    """Supprime unitairement un bon d'intervention dans la GMAO locale et dans BigQuery (dataset dalkia).

    Args:
        ticket_id: Identifiant du ticket (ex: 'GMAO-2026-1030') ou numéro d'intervention (ex: 1030).

    Returns:
        Dictionnaire confirmant la suppression unitaire et le statut BigQuery.
    """
    clean_id = str(ticket_id).strip()
    num_val = None
    if clean_id.startswith("GMAO-"):
        parts = clean_id.split("-")
        if len(parts) >= 3 and parts[-1].isdigit():
            num_val = int(parts[-1])
    elif clean_id.isdigit():
        num_val = int(clean_id)

    # 1. Suppression dans le cache mémoire local
    initial_count = len(_facility_state["gmao_tickets"])
    _facility_state["gmao_tickets"] = [
        t for t in _facility_state["gmao_tickets"]
        if t.get("ticket_id") != clean_id and (num_val is None or t.get("numero_intervention") != num_val)
    ]
    removed_from_memory = len(_facility_state["gmao_tickets"]) < initial_count

    # 2. Suppression dans BigQuery dataset 'dalkia'
    bq_deleted = False
    client = get_bigquery_client()
    if client:
        try:
            conditions = ["ticket_id = @tid"]
            query_params = [bigquery.ScalarQueryParameter("tid", "STRING", clean_id)]
            if num_val is not None:
                conditions.append("numero_intervention = @num")
                query_params.append(bigquery.ScalarQueryParameter("num", "INT64", num_val))

            where_clause = " OR ".join(conditions)
            sql_gmao = f"DELETE FROM `{BQ_PROJECT}.{BQ_DATASET}.{BQ_TABLE_GMAO}` WHERE {where_clause}"
            job_config = bigquery.QueryJobConfig(query_parameters=query_params)
            client.query(sql_gmao, job_config=job_config).result()

            if num_val is not None:
                sql_bons = f"DELETE FROM `{BQ_PROJECT}.{BQ_DATASET}.{BQ_TABLE_BONS}` WHERE numero_intervention = @num"
                client.query(sql_bons, job_config=bigquery.QueryJobConfig(
                    query_parameters=[bigquery.ScalarQueryParameter("num", "INT64", num_val)]
                )).result()

            bq_deleted = True
            logger.info("Successfully deleted ticket %s from BigQuery", clean_id)
        except Exception as e:
            logger.warning("Could not delete ticket %s from BigQuery: %s", clean_id, e)

    return {
        "status": "success",
        "ticket_id": clean_id,
        "numero_intervention": num_val,
        "removed_from_memory": removed_from_memory,
        "bigquery_deleted": bq_deleted,
        "message": f"Bon d'intervention {clean_id} supprimé avec succès.",
    }


def get_active_alarms() -> List[Dict[str, Any]]:
    """Retourne la liste des alarmes actives non acquittées sur le réseau et la chaufferie."""
    return [a for a in _facility_state["alarms"] if not a.get("is_acknowledged", False)]
