from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
import sys

# Ensure parent directory is in path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config import settings
from brain import Brain, BrainEstimatorOutput
from artist import OpenAIImageProvider
from storage import StorageManager
from agent import AgentManager

app = FastAPI(title="AI Lyrics-to-Image Agent API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Allow frontend
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global instances (in a real app, these might be per-session or injected)
brain_instance = Brain(api_key=settings.openai_api_key or "dummy_key", model=settings.brain_model)
artist_instance = OpenAIImageProvider(api_key=settings.openai_api_key or "dummy_key")
# Using a default local output folder for simplicity
storage_instance = StorageManager(base_path=os.path.join(os.getcwd(), "OutputProject"))
agent = AgentManager(brain=brain_instance, artist=artist_instance, storage=storage_instance)

class GenerateRequest(BaseModel):
    lyrics: str
    style: str
    api_mode: str = "b2r"
    custom_api_key: str = ""
    output_dir: str = ""
    api_base_url: str = ""
    image_model: str = "gpt-image-1"
    aspect_ratio: str = "1024x1024"
    num_scenes: str = "auto"

class EstimateRequest(BaseModel):
    lyrics: str
    api_mode: str = "b2r"
    custom_api_key: str = ""
    num_scenes: str = "auto"

@app.post("/estimate", response_model=BrainEstimatorOutput)
async def estimate(req: EstimateRequest):
    api_key_to_use = req.custom_api_key if req.api_mode == "custom" and req.custom_api_key else settings.openai_api_key
    if not api_key_to_use:
        raise HTTPException(status_code=400, detail="OpenAI API Key not configured")
        
    from openai import AsyncOpenAI
    brain_instance.client = AsyncOpenAI(api_key=api_key_to_use)
    
    try:
        return await brain_instance.estimate(req.lyrics, req.num_scenes)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/start")
async def start_generation(req: GenerateRequest, background_tasks: BackgroundTasks):
    api_key_to_use = req.custom_api_key if req.api_mode == "custom" and req.custom_api_key else settings.openai_api_key
    if not api_key_to_use:
        raise HTTPException(status_code=400, detail="OpenAI API Key not configured")
        
    from openai import AsyncOpenAI
    base_url = req.api_base_url.strip() if req.api_base_url and req.api_base_url.strip() else None
    
    brain_instance.client = AsyncOpenAI(api_key=api_key_to_use, base_url=base_url)
    artist_instance.client = AsyncOpenAI(api_key=api_key_to_use, base_url=base_url)
    artist_instance.model = req.image_model.strip() if req.image_model.strip() else "gpt-image-1"

    if agent.state in ["analyzing", "generating"]:
        raise HTTPException(status_code=400, detail="Generation already in progress")
    
    # Update storage if a custom directory is provided
    if req.output_dir.strip():
        agent.storage = StorageManager(base_path=req.output_dir.strip())
    else:
        agent.storage = StorageManager(base_path=os.path.join(os.getcwd(), "OutputProject"))
    
    # We pass the async start method to run in background
    # Note: Agent start sets state immediately, then runs loop
    background_tasks.add_task(agent.start, req.lyrics, req.style, req.aspect_ratio, req.num_scenes)
    return {"status": "started"}

@app.get("/status")
def get_status():
    return agent.get_status()

@app.post("/pause")
def pause():
    agent.pause()
    return {"status": "paused"}

@app.post("/resume")
def resume():
    agent.resume()
    return {"status": "resumed"}

@app.post("/cancel")
def cancel():
    agent.cancel()
    return {"status": "cancelled"}

from fastapi.responses import FileResponse

@app.get("/download/{filename}")
def download_image(filename: str):
    import os
    filepath = os.path.join(agent.storage.images_path, f"{filename}.png")
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(path=filepath, filename=f"{filename}.png", media_type="image/png")

from fastapi.staticfiles import StaticFiles
frontend_dist = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "frontend", "out")
if os.path.exists(frontend_dist):
    app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="frontend")
