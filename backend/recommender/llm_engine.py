import asyncio
import json
import re

import groq as groq_lib
from groq import AsyncGroq


SYSTEM_PROMPT = """You are a world-class cinematic expert and personalized film recommender.
You reason step by step before giving final rankings.
You always output valid JSON — nothing else after the JSON block."""

RANK_PROMPT = """A user has given you their film preferences:

LOVED: {liked}
DISLIKED: {disliked}
PREFERRED LANGUAGES: {languages}

Here are {n} candidate films retrieved for them:

{candidates_block}

Task:
1. Think step by step about which films best match this user's taste based on what they loved and avoided.
2. If language preferences are specified, prioritise films in those languages when quality is otherwise equal.
3. Rank ALL candidates from best to worst fit.
4. For each, write a 2-sentence personalized explanation that explicitly references their liked or disliked films.

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
    def __init__(
        self,
        api_key: str,
        model: str = "llama-3.1-8b-instant",   # 30k TPM on free tier vs 12k for 70b
    ):
        self.client = AsyncGroq(api_key=api_key)
        self.model = model

    async def rank_and_explain(
        self,
        liked: list[str],
        disliked: list[str],
        candidates: list[dict],
        num_results: int = 5,
        languages: list[str] | None = None,
    ) -> list[dict]:
        candidates_block = "\n".join(
            f"{i+1}. {c['title']} ({c.get('year', 'N/A')}) | "
            f"Genre: {c.get('genre', 'N/A')} | "
            f"IMDB: {c.get('imdb_rating', 'N/A')} | "
            f"Director: {c.get('director', 'N/A')}"
            for i, c in enumerate(candidates)
        )

        prompt = RANK_PROMPT.format(
            liked=", ".join(liked) if liked else "None specified",
            disliked=", ".join(disliked) if disliked else "None specified",
            languages=", ".join(languages) if languages else "Any",
            n=len(candidates),
            candidates_block=candidates_block,
        )

        raw = await self._call_with_retry(prompt)
        ranked = self._parse_json(raw)
        return ranked[:num_results]

    async def _call_with_retry(self, prompt: str, max_attempts: int = 3) -> str:
        for attempt in range(max_attempts):
            try:
                response = await self.client.chat.completions.create(
                    model=self.model,
                    messages=[
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user", "content": prompt},
                    ],
                    temperature=0.4,
                    max_tokens=1024,
                )
                return response.choices[0].message.content.strip()

            except groq_lib.RateLimitError as e:
                if attempt == max_attempts - 1:
                    raise
                wait = self._parse_retry_delay(str(e), default=15.0)
                print(f"[LLM] Rate limit hit — waiting {wait:.1f}s then retrying (attempt {attempt + 1}/{max_attempts})")
                await asyncio.sleep(wait)

            except groq_lib.APIStatusError as e:
                # Transient server errors — short backoff
                if attempt == max_attempts - 1 or e.status_code < 500:
                    raise
                wait = 2 ** attempt
                print(f"[LLM] Server error {e.status_code} — retrying in {wait}s")
                await asyncio.sleep(wait)

        return ""

    @staticmethod
    def _parse_retry_delay(error_msg: str, default: float = 15.0) -> float:
        """Extract 'Please try again in X.Xs' from Groq error messages."""
        match = re.search(r"try again in (\d+(?:\.\d+)?)s", error_msg)
        if match:
            return float(match.group(1)) + 1.0  # +1s buffer
        return default

    @staticmethod
    def _parse_json(text: str) -> list[dict]:
        match = re.search(r"\[.*\]", text, re.DOTALL)
        if match:
            try:
                return json.loads(match.group())
            except json.JSONDecodeError:
                pass
        return []
