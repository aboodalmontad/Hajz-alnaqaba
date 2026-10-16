import sqlite3
import json
from datetime import datetime
from typing import Optional, Dict, Any
from backend.app.core.config import DB_PATH

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS fingerprint_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            quality_score REAL,
            quality_level TEXT,
            pattern TEXT,
            minutiae_data TEXT,
            quality_data TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.commit()
    conn.close()

def save_fingerprint_record(quality_score: float, quality_level: str, pattern: str, minutiae: list, quality: dict) -> int:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO fingerprint_records (quality_score, quality_level, pattern, minutiae_data, quality_data, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (
        quality_score,
        quality_level,
        pattern,
        json.dumps(minutiae),
        json.dumps(quality),
        datetime.utcnow().isoformat()
    ))
    record_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return record_id

def delete_fingerprint_record(record_id: int) -> bool:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM fingerprint_records WHERE id = ?", (record_id,))
    rows_affected = cursor.rowcount
    conn.commit()
    conn.close()
    return rows_affected > 0

def get_all_records():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, quality_score, quality_level, pattern, created_at FROM fingerprint_records ORDER BY created_at DESC")
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]
