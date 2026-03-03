"""
Run once to create MongoDB indexes and optionally seed sample books.

Usage:
    python -m scripts.init_db            # indexes only
    python -m scripts.init_db --seed     # indexes + 10 sample books
"""

import sys
import datetime
from dotenv import load_dotenv
import os
from pymongo import MongoClient, ASCENDING, TEXT

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

client = MongoClient(os.getenv("MONGO_URI"))
db = client.get_default_database()


def create_indexes():
    # ── users ──────────────────────────────────────────────────────────────
    db.users.create_index([("email", ASCENDING)], unique=True)

    # ── books ──────────────────────────────────────────────────────────────
    db.books.create_index([("isbn", ASCENDING)], unique=True, sparse=True)
    db.books.create_index([
        ("title",  TEXT),
        ("author", TEXT),
        ("isbn",   TEXT),
    ], name="book_search")

    # ── checkouts ──────────────────────────────────────────────────────────
    db.checkouts.create_index([("book_id",   ASCENDING)])
    db.checkouts.create_index([("user_id",   ASCENDING)])
    db.checkouts.create_index([("status",    ASCENDING)])

    # ── logs ───────────────────────────────────────────────────────────────
    db.logs.create_index([("timestamp", ASCENDING)])
    db.logs.create_index([("book_id",   ASCENDING)])
    db.logs.create_index([("user_id",   ASCENDING)])

    print("Indexes created.")


SAMPLE_BOOKS = [
    {"title": "Clean Code",                     "author": "Robert C. Martin",  "isbn": "9780132350884", "total_copies": 3},
    {"title": "The Pragmatic Programmer",       "author": "David Thomas",      "isbn": "9780135957059", "total_copies": 2},
    {"title": "Design Patterns",                "author": "Gang of Four",      "isbn": "9780201633610", "total_copies": 2},
    {"title": "Introduction to Algorithms",     "author": "Thomas H. Cormen",  "isbn": "9780262046305", "total_copies": 4},
    {"title": "You Don't Know JS",              "author": "Kyle Simpson",      "isbn": "9781491904244", "total_copies": 2},
    {"title": "The Mythical Man-Month",         "author": "Frederick Brooks",  "isbn": "9780201835953", "total_copies": 1},
    {"title": "Refactoring",                    "author": "Martin Fowler",     "isbn": "9780134757599", "total_copies": 3},
    {"title": "Structure and Interpretation",   "author": "Harold Abelson",    "isbn": "9780262510875", "total_copies": 2},
    {"title": "Code Complete",                  "author": "Steve McConnell",   "isbn": "9780735619678", "total_copies": 2},
    {"title": "The Art of Computer Programming","author": "Donald Knuth",      "isbn": "9780201853926", "total_copies": 1},
]


def seed_books():
    now = datetime.datetime.utcnow()
    inserted = 0
    for book in SAMPLE_BOOKS:
        if db.books.find_one({"isbn": book["isbn"]}):
            print(f"  skip (exists): {book['title']}")
            continue
        db.books.insert_one({
            **book,
            "description":      "",
            "available_copies": book["total_copies"],
            "created_at":       now,
            "updated_at":       now,
        })
        inserted += 1
        print(f"  inserted: {book['title']}")
    print(f"Seed complete — {inserted} books added.")


if __name__ == "__main__":
    create_indexes()
    if "--seed" in sys.argv:
        seed_books()
    client.close()
