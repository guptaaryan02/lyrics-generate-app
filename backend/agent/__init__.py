import asyncio
from typing import Dict, Any
from brain import Brain, SceneOutput
from artist import ImageProvider
from storage import StorageManager
from logger import get_logger

logger = get_logger()

class AgentState:
    IDLE = "idle"
    ESTIMATING = "estimating"
    ANALYZING = "analyzing"
    GENERATING = "generating"
    PAUSED = "paused"
    COMPLETED = "completed"
    ERROR = "error"

class AgentManager:
    def __init__(self, brain: Brain, artist: ImageProvider, storage: StorageManager):
        self.brain = brain
        self.artist = artist
        self.storage = storage
        
        self.state = AgentState.IDLE
        self.current_scene_idx = 0
        self.scenes: list[SceneOutput] = []
        self.character_profile = ""
        self.logs = []
        self.completed_images = []
        
        # Stats
        self.images_created = 0
        self.failed_count = 0
        self.start_time = None
        
        self._pause_event = asyncio.Event()
        self._pause_event.set() # Set means NOT paused initially
        self._cancel_flag = False

    def get_status(self) -> Dict[str, Any]:
        return {
            "state": self.state,
            "current_scene": self.current_scene_idx + 1 if self.scenes else 0,
            "total_scenes": len(self.scenes),
            "images_created": self.images_created,
            "failed_count": self.failed_count,
            "current_scene_data": self.scenes[self.current_scene_idx].dict() if self.scenes and self.current_scene_idx < len(self.scenes) else None,
            "completed_images": self.completed_images,
            "logs": self.logs[-10:] # last 10 logs
        }

    def _log(self, message: str):
        logger.info(message)
        self.logs.append(message)

    async def start(self, lyrics: str, style: str, aspect_ratio: str = "1024x1024", num_scenes: str = "auto"):
        self.state = AgentState.ANALYZING
        self._cancel_flag = False
        self._pause_event.set()
        self.completed_images = []
        self.aspect_ratio = aspect_ratio
        
        self.storage.initialize_project()
        self.storage.save_lyrics(lyrics)
        
        try:
            self._log("Generating character profile...")
            self.character_profile = await self.brain.generate_character_profile(lyrics)
            
            self._log("Analyzing lyrics into scenes...")
            self.scenes = await self.brain.analyze_lyrics(lyrics, self.character_profile, style, num_scenes)
            self._log(f"Found {len(self.scenes)} scenes.")
            
            # Start generation loop
            asyncio.create_task(self._generation_loop())
            
        except Exception as e:
            self._log(f"Error during analysis: {e}")
            self.state = AgentState.ERROR

    async def _generation_loop(self):
        self.state = AgentState.GENERATING
        
        while self.current_scene_idx < len(self.scenes):
            if self._cancel_flag:
                self.state = AgentState.IDLE
                self._log("Generation cancelled.")
                return

            await self._pause_event.wait()
            
            scene = self.scenes[self.current_scene_idx]
            import re
            safe_lyrics = re.sub(r'[^a-zA-Z0-9 ]', '', scene.lyrics)
            safe_lyrics = safe_lyrics.replace(' ', '_')[:40].strip('_')
            if not safe_lyrics:
                safe_lyrics = "scene"
            scene.filename = f"{scene.scene:03d}_{safe_lyrics}"
            
            self._log(f"Processing scene {scene.scene} ({scene.filename})...")
            
            self.storage.save_prompt(scene.filename, scene.prompt)
            
            success = False
            for attempt in range(3):
                try:
                    self._log(f"Generating image for scene {scene.scene} (Attempt {attempt+1})...")
                    image_url = await self.artist.generate_image(scene.prompt, size=self.aspect_ratio)
                    self._log("Image generated, downloading...")
                    
                    saved = await self.storage.save_image_from_url(scene.filename, image_url)
                    if saved:
                        success = True
                        self.images_created += 1
                        self.completed_images.append(scene.filename)
                        break
                    else:
                        raise Exception("Download failed")
                except Exception as e:
                    self._log(f"Failed attempt {attempt+1}: {e}")
                    await asyncio.sleep(2) # Backoff
            
            if not success:
                self._log(f"Scene {scene.scene} failed completely.")
                self.failed_count += 1
                
            self.current_scene_idx += 1
            
            # Save progress
            self.storage.save_progress({
                "current_scene_idx": self.current_scene_idx,
                "scenes": [s.dict() for s in self.scenes],
                "character_profile": self.character_profile,
                "images_created": self.images_created,
                "failed_count": self.failed_count
            })
            
        self.state = AgentState.COMPLETED
        self._log("Generation completed!")

    def pause(self):
        self.state = AgentState.PAUSED
        self._pause_event.clear()
        self._log("Paused.")

    def resume(self):
        self.state = AgentState.GENERATING
        self._pause_event.set()
        self._log("Resumed.")

    def cancel(self):
        self._cancel_flag = True
        self.state = AgentState.IDLE
        self._pause_event.set() # Unblock if paused
        self._log("Generation cancellation requested.")
