import os
import sys

# Ensure backend directory and project root are in sys.path
api_dir = os.path.dirname(os.path.abspath(__file__))
root_dir = os.path.abspath(os.path.join(api_dir, ".."))
backend_dir = os.path.join(root_dir, "backend")

for path in [backend_dir, root_dir]:
    if path not in sys.path:
        sys.path.insert(0, path)

from app import app

# Vercel serverless WSGI entrypoint
handler = app
