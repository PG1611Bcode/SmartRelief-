import os
import sys

# Ensure project root is in sys.path so 'backend' package is resolvable
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.main import app
