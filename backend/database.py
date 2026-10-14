"""
Motor (async MongoDB) client, database handle, and collection exports.
Indexes are created once during FastAPI lifespan startup.
"""

import os

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
import pymongo

# Load .env file relative to this module's directory
_ENV_PATH = os.path.join(os.path.dirname(__file__), ".env")
load_dotenv(_ENV_PATH)

MONGO_URI: str | None = os.getenv("MONGO_URI")
DB_NAME: str = os.getenv("DB_NAME", "smartrelief")

if not MONGO_URI:
    raise RuntimeError("MONGO_URI environment variable is not set.")

# Single shared client instance
_client: AsyncIOMotorClient = AsyncIOMotorClient(MONGO_URI)

db = _client[DB_NAME]

needs_collection = db["needs"]
volunteers_collection = db["volunteers"]
tasks_collection = db["tasks"]
interests_collection = db["interests"]
completions_collection = db["completions"]


async def create_indexes() -> None:
    """Create MongoDB indexes for both collections.
    Called once from the FastAPI lifespan startup handler.
    """
    # needs indexes
    await needs_collection.create_index("location")
    await needs_collection.create_index("urgency")
    await needs_collection.create_index(
        [("created_at", pymongo.DESCENDING)]
    )
    await needs_collection.create_index(
        [("urgency_score", pymongo.DESCENDING), ("created_at", pymongo.DESCENDING)]
    )

    # volunteers indexes
    await volunteers_collection.create_index(
        "contact_email", unique=True
    )
    await volunteers_collection.create_index("location")
    await volunteers_collection.create_index("availability")

    # 2dsphere sparse index on coordinates (null-safe)
    await volunteers_collection.create_index(
        [("coordinates", pymongo.GEOSPHERE)],
        sparse=True,
    )

    # tasks indexes
    await tasks_collection.create_index("volunteer_uid")
    await tasks_collection.create_index("status")
    await tasks_collection.create_index(
        [("created_at", pymongo.DESCENDING)]
    )

    # interests indexes
    await interests_collection.create_index("need_id")
    await interests_collection.create_index("volunteer_uid")
    await interests_collection.create_index(
        [("volunteer_uid", pymongo.ASCENDING), ("need_id", pymongo.ASCENDING)],
        unique=True,
    )
