import os

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STORAGE_DIR = os.path.join(BASE_DIR, "storage_data")
UPLOAD_DIR = os.path.join(STORAGE_DIR, "uploads")
ANNOTATED_DIR = os.path.join(STORAGE_DIR, "annotated")
DB_PATH = os.path.join(STORAGE_DIR, "fingerprints.db")

os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(ANNOTATED_DIR, exist_ok=True)
os.makedirs(STORAGE_DIR, exist_ok=True)

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB
ALLOWED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".bmp", ".tif", ".tiff"}
