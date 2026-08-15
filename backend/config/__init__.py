import os
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

class Settings(BaseModel):
    openai_api_key: str = os.getenv("OPENAI_API_KEY", "")
    brain_model: str = "gpt-4o-mini"
    artist_model: str = "gpt-image-1"
    
settings = Settings()
