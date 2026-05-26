from sentence_transformers import SentenceTransformer
import numpy as np


MODEL_NAME = "intfloat/multilingual-e5-small"


class Embedder:
    def __init__(self):
        print(f"Loading embedding model: {MODEL_NAME}")
        self.model = SentenceTransformer(MODEL_NAME)
        print("Embedding model loaded.")

    def encode_query(self, text: str) -> list[float]:
        vec = self.model.encode(f"query: {text}", normalize_embeddings=True)
        return vec.tolist()

    def encode_passages(self, texts: list[str]) -> list[list[float]]:
        prefixed = [f"passage: {t}" for t in texts]
        vecs = self.model.encode(prefixed, normalize_embeddings=True, batch_size=64, show_progress_bar=True)
        return vecs.tolist()
