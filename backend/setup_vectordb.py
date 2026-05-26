"""
Run once to embed the IMDB Top 1000 CSV and populate ChromaDB.
Usage: python setup_vectordb.py
"""
import os
import sys
import math
import pandas as pd
from dotenv import load_dotenv

load_dotenv()

sys.path.insert(0, os.path.dirname(__file__))
from recommender.embedder import Embedder
from recommender.vector_store import VectorStore


CSV_PATH = os.path.join(os.path.dirname(__file__), "data", "imdb_top_1000.csv")
CHROMA_PATH = os.getenv("CHROMA_DB_PATH", "./chroma_db")


def build_meta_text(row: pd.Series) -> str:
    stars = ", ".join(filter(None, [
        str(row.get("Star1", "")),
        str(row.get("Star2", "")),
        str(row.get("Star3", "")),
        str(row.get("Star4", "")),
    ]))
    return (
        f"{row['Series_Title']}. "
        f"Directed by {row.get('Director', 'Unknown')}. "
        f"Genre: {row.get('Genre', '')}. "
        f"Cast: {stars}. "
        f"Year: {row.get('Released_Year', '')}. "
        f"{row.get('Overview', '')}"
    )


def main():
    print(f"Reading dataset from {CSV_PATH}")
    df = pd.read_csv(CSV_PATH)
    df = df.dropna(subset=["Series_Title", "Overview"])
    df["IMDB_Rating"] = pd.to_numeric(df["IMDB_Rating"], errors="coerce").fillna(0)
    df["Meta_score"] = pd.to_numeric(df["Meta_score"], errors="coerce").fillna(0)
    df["No_of_Votes"] = pd.to_numeric(df["No_of_Votes"], errors="coerce").fillna(0)
    print(f"Loaded {len(df)} movies.")

    embedder = Embedder()
    vector_store = VectorStore(persist_dir=CHROMA_PATH)

    texts = [build_meta_text(row) for _, row in df.iterrows()]
    print("Encoding passages (this takes a minute)...")
    embeddings = embedder.encode_passages(texts)

    ids = [f"movie_{i}" for i in range(len(df))]
    metadatas = []
    for _, row in df.iterrows():
        stars = " | ".join(filter(None, [
            str(row.get("Star1", "")), str(row.get("Star2", "")),
            str(row.get("Star3", "")), str(row.get("Star4", "")),
        ]))
        metadatas.append({
            "title": str(row["Series_Title"]),
            "director": str(row.get("Director", "")),
            "genre": str(row.get("Genre", "")),
            "year": str(row.get("Released_Year", "")),
            "imdb_rating": float(row["IMDB_Rating"]),
            "meta_score": float(row["Meta_score"]),
            "num_votes": float(row["No_of_Votes"]),
            "stars": stars,
            "overview": str(row.get("Overview", ""))[:500],
        })

    print("Upserting into ChromaDB...")
    batch = 100
    for start in range(0, len(ids), batch):
        end = start + batch
        vector_store.upsert(
            ids=ids[start:end],
            embeddings=embeddings[start:end],
            metadatas=metadatas[start:end],
            documents=texts[start:end],
        )
        print(f"  {min(end, len(ids))}/{len(ids)} done")

    print(f"\nDone! {vector_store.collection.count()} movies indexed in ChromaDB.")


if __name__ == "__main__":
    main()
