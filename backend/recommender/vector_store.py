import chromadb
from chromadb.config import Settings
import json


COLLECTION_NAME = "movies"


class VectorStore:
    def __init__(self, persist_dir: str = "./chroma_db"):
        self.client = chromadb.PersistentClient(path=persist_dir)
        self.collection = self.client.get_or_create_collection(
            name=COLLECTION_NAME,
            metadata={"hnsw:space": "cosine"},
        )
        print(f"VectorStore ready. Collection '{COLLECTION_NAME}' has {self.collection.count()} docs.")

    def upsert(self, ids: list[str], embeddings: list[list[float]], metadatas: list[dict], documents: list[str]):
        self.collection.upsert(
            ids=ids,
            embeddings=embeddings,
            metadatas=metadatas,
            documents=documents,
        )

    def query(self, embedding: list[float], n_results: int = 10) -> list[dict]:
        results = self.collection.query(
            query_embeddings=[embedding],
            n_results=min(n_results, self.collection.count()),
            include=["metadatas", "distances", "documents"],
        )
        movies = []
        for i, meta in enumerate(results["metadatas"][0]):
            distance = results["distances"][0][i]
            semantic_score = 1.0 - distance
            movies.append({
                **meta,
                "semantic_score": semantic_score,
            })
        return movies
