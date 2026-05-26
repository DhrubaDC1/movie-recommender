import json
import re
from groq import AsyncGroq


SYSTEM_PROMPT = """You are a world-class cinematic expert and personalized film recommender.
You reason step by step before giving final rankings.
You always output valid JSON — nothing else after the JSON block."""

RANK_PROMPT = """A user has given you their film preferences:

LOVED: {liked}
DISLIKED: {disliked}

Here are {n} candidate films retrieved for them:

{candidates_block}

Task:
1. Think step by step about which films best match this user's taste based on what they loved and avoided.
2. Rank ALL candidates from best to worst fit.
3. For each, write a 2-sentence personalized explanation that explicitly references their liked or disliked films.

Output ONLY a JSON array (no markdown, no extra text):
[
  {{
    "rank": 1,
    "title": "Film Title",
    "explanation": "Two sentence personalized explanation."
  }},
  ...
]"""


class LLMEngine:
    def __init__(self, api_key: str, model: str = "llama-3.3-70b-versatile"):
        self.client = AsyncGroq(api_key=api_key)
        self.model = model

    async def rank_and_explain(
        self,
        liked: list[str],
        disliked: list[str],
        candidates: list[dict],
        num_results: int = 5,
    ) -> list[dict]:
        candidates_block = "\n".join(
            f"{i+1}. {c['title']} ({c.get('year', 'N/A')}) | "
            f"Genre: {c.get('genre', 'N/A')} | "
            f"IMDB: {c.get('imdb_rating', 'N/A')} | "
            f"Director: {c.get('director', 'N/A')} | "
            f"Stars: {c.get('stars', 'N/A')}"
            for i, c in enumerate(candidates)
        )

        prompt = RANK_PROMPT.format(
            liked=", ".join(liked) if liked else "None specified",
            disliked=", ".join(disliked) if disliked else "None specified",
            n=len(candidates),
            candidates_block=candidates_block,
        )

        response = await self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
            temperature=0.4,
            max_tokens=2048,
        )

        raw = response.choices[0].message.content.strip()
        ranked = self._parse_json(raw)
        return ranked[:num_results]

    def _parse_json(self, text: str) -> list[dict]:
        match = re.search(r"\[.*\]", text, re.DOTALL)
        if match:
            try:
                return json.loads(match.group())
            except json.JSONDecodeError:
                pass
        return []
