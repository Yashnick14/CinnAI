"""Tested Colab ranking; scores are internal combined scores, not similarities."""
import json
from pathlib import Path
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity
from app.ai_assistant.cinnamon_assistant_final import detect_grade

ARTIFACT_ROOT = Path(__file__).resolve().parent

class Retriever:
    def __init__(self, embedding_model, root=ARTIFACT_ROOT):
        self.embedding_model = embedding_model
        self.kb = json.loads((root / "knowledge/cinnamon_quill_rag_final.json").read_text(encoding="utf-8-sig"))
        self.documents = json.loads((root / "embeddings/cinnamon_rag_documents.json").read_text(encoding="utf-8-sig"))
        self.embeddings = np.load(root / "embeddings/cinnamon_rag_embeddings.npy", allow_pickle=False)
        if self.embeddings.shape != (62, 384) or len(self.documents) != 62 or not np.isfinite(self.embeddings).all():
            raise ValueError("Invalid assistant artifacts")
        if not any(d["id"] == "P01" for d in self.documents):
            raise ValueError("Missing application policy")

    def get_answering_guide_ids(self, query):
        q = query.lower().strip()

        guide = self.kb.get("answering_guide", {})

        matched_ids = []

        for guide_question, refs in guide.items():
            guide_q = guide_question.lower()

            intent_match = (
                ("produce alba" in q and "produce alba" in guide_q)
                or
                (
                    "requirements for alba" in q
                    and "requirements for alba" in guide_q
                )
                or
                (
                    "dry" in q
                    and "dry quills" in guide_q
                )
                or
                (
                    "moisture" in q
                    and "moisture" in guide_q
                )
                or
                (
                    "improve" in q
                    and "improve" in guide_q
                )
            )

            if intent_match:

                for ref in refs:

                    if isinstance(ref, str):

                        # Examples:
                        # "G01"
                        # "G01 (bark width 22 mm)"
                        # "R24 (grade follows...)"

                        record_id = ref.split()[0]
                        record_id = record_id.split("(")[0]
                        record_id = record_id.strip()

                        matched_ids.append(record_id)

        return list(set(matched_ids))


    # ============================================================
    # RETRIEVAL
    #
    # documents:
    # [
    #   {
    #       "id": ...,
    #       "collection": ...,
    #       "embedding_text": ...,
    #       "full_record": ...
    #   }
    # ]
    #
    # embeddings:
    # numpy array shape (62, 384)
    # ============================================================

    def retrieve(self, query, top_k=10):

        # --------------------------------------------------------
        # Encode user query
        # --------------------------------------------------------

        query_embedding = self.embedding_model.encode(
            [query],
            normalize_embeddings=True
        )

        # --------------------------------------------------------
        # Base cosine similarity
        # --------------------------------------------------------

        semantic_scores = cosine_similarity(
            query_embedding,
            self.embeddings
        )[0]

        detected_grade = detect_grade(query)

        guide_ids = self.get_answering_guide_ids(query)

        ranked = []

        query_lower = query.lower()

        # --------------------------------------------------------
        # Score every knowledge document
        # --------------------------------------------------------

        for idx, doc in enumerate(self.documents):

            score = float(
                semantic_scores[idx]
            )

            record = doc["full_record"]

            grades = record.get(
                "relevant_grade",
                []
            )

            record_id = record.get(
                "id"
            )

            # ====================================================
            # 1. GRADE-AWARE BOOST
            # ====================================================

            if (
                detected_grade
                and detected_grade in grades
            ):
                score += 0.20


            # ====================================================
            # 2. EXACT GRADE TABLE RECORD BOOST
            #
            # Example:
            # "Grade table row for Alba..."
            # ====================================================

            text = record.get(
                "corrected_english",
                ""
            ).lower()

            if detected_grade:

                phrase = (
                    f"grade table row for "
                    f"{detected_grade.lower()}"
                )

                if phrase in text:
                    score += 0.20


            # ====================================================
            # 3. ANSWERING-GUIDE BOOST
            # ====================================================

            if record_id in guide_ids:
                score += 0.18


            # ====================================================
            # 4. KEYWORD OVERLAP BOOST
            # ====================================================

            keywords = [
                str(x).lower()
                for x in record.get(
                    "rag_keywords",
                    []
                )
            ]

            for keyword in keywords:

                if keyword in query_lower:
                    score += 0.03


            # ====================================================
            # 5. PRODUCTION-QUESTION TOPIC BOOST
            # ====================================================

            production_words = [
                "produce",
                "make",
                "prepare",
                "processing"
            ]

            if any(
                word in query_lower
                for word in production_words
            ):

                if record.get("topic") in [
                    "preparation",
                    "quill_structure",
                    "drying",
                    "filling",
                    "handling",
                    "moisture"
                ]:
                    score += 0.04


            ranked.append(
                (score, idx)
            )


        # --------------------------------------------------------
        # Rank highest score first
        # --------------------------------------------------------

        ranked.sort(
            key=lambda x: x[0],
            reverse=True
        )


        # --------------------------------------------------------
        # Build result objects
        # --------------------------------------------------------

        results = []

        for rank, (score, idx) in enumerate(
            ranked[:top_k],
            start=1
        ):

            doc = self.documents[idx]

            results.append({
                "rank": rank,

                # This is a combined retrieval score,
                # NOT pure cosine similarity.
                "score": score,

                "id": doc["id"],

                "collection":
                    doc["collection"],

                "record":
                    doc["full_record"]
            })

        return results
