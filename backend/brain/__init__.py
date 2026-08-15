import json
from openai import AsyncOpenAI
from pydantic import BaseModel
from typing import List
from logger import get_logger

logger = get_logger()

class SceneOutput(BaseModel):
    scene: int
    lyrics: str
    prompt: str
    character: str
    mood: str
    environment: str
    camera: str
    filename: str

class BrainEstimatorOutput(BaseModel):
    estimated_scenes: int
    estimated_tokens: int
    estimated_cost_usd: float

class Brain:
    def __init__(self, api_key: str, model: str = "gpt-4o-mini"): # Mapping gpt-5-mini to available real model if needed
        self.client = AsyncOpenAI(api_key=api_key)
        self.model = model

    async def estimate(self, lyrics: str, num_scenes: str = "auto") -> BrainEstimatorOutput:
        logger.info("Estimating lyrics...")
        words = len(lyrics.split())
        
        if str(num_scenes).lower() != "auto" and str(num_scenes).isdigit():
            est_scenes = int(num_scenes)
        else:
            # Rough heuristic: ~15 words per scene
            est_scenes = max(1, words // 15)
        
        # Token calculation heuristic: words * 1.3
        est_tokens = int(words * 1.3) + 1000 # padding for system prompt
        
        # Cost heuristic: DALL-E 3 is ~$0.04/image, gpt-4o-mini is negligible
        est_cost = est_scenes * 0.04

        return BrainEstimatorOutput(
            estimated_scenes=est_scenes,
            estimated_tokens=est_tokens,
            estimated_cost_usd=round(est_cost, 2)
        )

    async def generate_character_profile(self, lyrics: str) -> str:
        logger.info("Generating character profile...")
        prompt = f"""
        Read the following lyrics and extract any recurring characters, their physical descriptions, and the overall setting/environment.
        If no specific character is mentioned, invent a fitting main character and describe them in detail (Name, Hair, Age, Clothes, Accessories, Eye Color, Body Type, Personality).
        This character reference profile will be used to ensure visual consistency across multiple image generations. Ensure the ethnicity matches the cultural context of the lyrics (e.g., if the context feels Indian, generate an Indian character).
        
        Lyrics:
        {lyrics}
        """
        
        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "system", "content": "You are a creative director."}, {"role": "user", "content": prompt}]
            )
            return response.choices[0].message.content
        except Exception as e:
            logger.error(f"Failed to generate character profile: {e}")
            return "Default protagonist, cinematic lighting, realistic style."

    async def analyze_lyrics(self, lyrics: str, character_profile: str, style: str, num_scenes: str = "auto") -> List[SceneOutput]:
        logger.info("Analyzing lyrics into scenes...")
        
        scene_constraint = ""
        if str(num_scenes).lower() != "auto" and str(num_scenes).isdigit():
            scene_constraint = f"\nCRITICAL INSTRUCTION: You MUST break the lyrics into EXACTLY {num_scenes} scenes. Return a JSON array with EXACTLY {num_scenes} objects. No more, no less."

        system_prompt = f"""
        You are an expert Director and Cinematographer. 
        Your task is to take song lyrics and split them into logical scenes (1-3 lines per scene).
        For each scene, generate a highly detailed cinematic prompt for an AI image generator.{scene_constraint}
        
        CRITICAL INSTRUCTION: You MUST use the provided Character Reference Profile to describe the main subject in every scene's prompt so they look consistent.
        Maintain story continuity and environment context between scenes.
        IMPORTANT: Each scene prompt must include identical physical descriptions from the character reference profile. Append "[Style: {style}, Continuity: Use identical character features from profile]" to the end of every prompt.
        
        Character Reference Profile & Setting:
        {character_profile}
        
        Requested Style: {style}
        
        Output JSON format ONLY:
        [
          {{
            "scene": 1,
            "lyrics": "...",
            "prompt": "...",
            "character": "...",
            "mood": "...",
            "environment": "...",
            "camera": "...",
            "filename": "001_short_name"
          }}
        ]
        """
        
        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": lyrics}
                ],
                response_format={ "type": "json_object" } # Ensure JSON response
            )
            # The model might return {"scenes": [...] } or just the array if strict JSON wasn't fully adhered. 
            # We'll try to parse it robustly.
            content = response.choices[0].message.content
            parsed = json.loads(content)
            
            scenes = parsed if isinstance(parsed, list) else parsed.get("scenes", parsed.get("Scenes", []))
            
            result = []
            for s in scenes:
                result.append(SceneOutput(**s))
            return result
        except Exception as e:
            logger.error(f"Failed to analyze lyrics: {e}")
            raise e
