import asyncio
from typing import Optional

import chromadb
from chromadb.utils.embedding_functions import SentenceTransformerEmbeddingFunction

_kb_instance: Optional["KnowledgeBase"] = None


def get_kb() -> "KnowledgeBase":
    global _kb_instance
    if _kb_instance is None:
        _kb_instance = KnowledgeBase()
    return _kb_instance


class KnowledgeBase:
    """
    Persistent vector store backed by ChromaDB + MiniLM embeddings.
    Call ingest_kb.py once to populate; query() is used live during calls.
    """

    def __init__(self, collection_name: str = "company_kb", db_path: str = "./kb_data"):
        ef = SentenceTransformerEmbeddingFunction(model_name="all-MiniLM-L6-v2")
        client = chromadb.PersistentClient(path=db_path)
        self.collection = client.get_or_create_collection(
            name=collection_name,
            embedding_function=ef,
        )

    async def query(self, query: str, n_results: int = 3) -> str:
        results = await asyncio.to_thread(
            self.collection.query,
            query_texts=[query],
            n_results=n_results,
        )
        docs = results.get("documents", [[]])[0]
        if not docs:
            return "No relevant information found in the knowledge base."
        return "\n\n---\n\n".join(docs)

    def ingest(self, documents: list[dict]):
        """
        documents: [{"id": "doc-1", "text": "...", "metadata": {...}}]
        Safe to call multiple times — uses upsert.
        """
        self.collection.upsert(
            ids=[d["id"] for d in documents],
            documents=[d["text"] for d in documents],
            metadatas=[d.get("metadata", {}) for d in documents],
        )
        print(f"[KB] Ingested {len(documents)} documents.")
