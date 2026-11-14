"""Default locations, independent of the directory a command is run from."""

from pathlib import Path

SERVICE_DIR = Path(__file__).resolve().parent
REPO_ROOT = SERVICE_DIR.parents[1]
DATA_DIR = REPO_ROOT / "data"

VECTOR_DB_PATH = DATA_DIR / "vector_db"
SOURCES_JSON = DATA_DIR / "sources" / "total_RAG.json"
KO_DIR = DATA_DIR / "sources" / "json_ko"
EVAL_DIR = DATA_DIR / "eval"
CONFIG_DEFAULT = SERVICE_DIR / "retriver.yaml"
CONFIG_LOCAL = SERVICE_DIR / "retriver.local.yaml"
