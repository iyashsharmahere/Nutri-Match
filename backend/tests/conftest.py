import os
import sys

# Tests make many requests in a short time; the rate limiter has its own tests.
os.environ.setdefault("RATE_LIMIT_PER_MIN", "0")
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
