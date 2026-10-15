import sys
import os

# Inject parent directory into sys.path so 'backend' package is resolvable in Vercel serverless environment
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

try:
    from backend.main import app
except ImportError:
    from main import app
