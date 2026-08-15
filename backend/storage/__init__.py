import os
import json
import aiohttp
from logger import get_logger

logger = get_logger()

class StorageManager:
    def __init__(self, base_path: str):
        self.base_path = base_path
        self.images_path = os.path.join(base_path, "Images")
        self.prompts_path = os.path.join(base_path, "Prompts")
        self.logs_path = os.path.join(base_path, "Logs")
        self.progress_file = os.path.join(base_path, "Progress.json")
        self.lyrics_file = os.path.join(base_path, "Lyrics.txt")

    def initialize_project(self):
        os.makedirs(self.images_path, exist_ok=True)
        os.makedirs(self.prompts_path, exist_ok=True)
        os.makedirs(self.logs_path, exist_ok=True)
        logger.info(f"Initialized project storage at {self.base_path}")

    def save_lyrics(self, lyrics: str):
        with open(self.lyrics_file, "w", encoding="utf-8") as f:
            f.write(lyrics)

    def save_prompt(self, filename: str, prompt: str):
        filepath = os.path.join(self.prompts_path, f"{filename}.txt")
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(prompt)
        logger.debug(f"Saved prompt: {filename}")

    async def save_image_from_url(self, filename: str, url: str) -> bool:
        filepath = os.path.join(self.images_path, f"{filename}.png")
        url_str = str(url)
        try:
            if url_str.startswith("base64:"):
                import base64
                b64_data = url_str.split("base64:")[1]
                content = base64.b64decode(b64_data)
                with open(filepath, "wb") as f:
                    f.write(content)
                logger.info(f"Saved base64 image: {filename}.png")
                return True
            else:
                async with aiohttp.ClientSession() as session:
                    async with session.get(url_str) as response:
                        if response.status == 200:
                            content = await response.read()
                            with open(filepath, "wb") as f:
                                f.write(content)
                            logger.info(f"Saved downloaded image: {filename}.png")
                            return True
                        else:
                            logger.error(f"Failed to download image, status: {response.status}")
                            return False
        except Exception as e:
            logger.error(f"Error saving image: {e}")
            return False

    def save_progress(self, progress_data: dict):
        with open(self.progress_file, "w", encoding="utf-8") as f:
            json.dump(progress_data, f, indent=4)

    def load_progress(self) -> dict:
        if os.path.exists(self.progress_file):
            with open(self.progress_file, "r", encoding="utf-8") as f:
                return json.load(f)
        return {}
