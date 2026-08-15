from abc import ABC, abstractmethod
from openai import AsyncOpenAI
from config import settings
from logger import get_logger

logger = get_logger()

class ImageProvider(ABC):
    @abstractmethod
    async def generate_image(self, prompt: str, size: str = "1024x1024", quality: str = "standard") -> str:
        """Generates an image and returns the URL or base64 data."""
        pass

class OpenAIImageProvider(ImageProvider):
    def __init__(self, api_key: str):
        self.client = AsyncOpenAI(api_key=api_key)
        self.model = "gpt-image-1"

    async def generate_image(self, prompt: str, size: str = "1024x1024", quality: str = "medium") -> str:
        actual_size = size
        
        # Specific model fallback mapping because gpt-image-1 is highly restrictive
        if self.model == "gpt-image-1" and "x" in size:
            try:
                w, h = map(int, size.split("x"))
                if w > h:
                    actual_size = "1536x1024"
                elif h > w:
                    actual_size = "1024x1536"
                else:
                    actual_size = "1024x1024"
            except Exception:
                actual_size = "1024x1024"

        logger.info(f"Generating image with OpenAI using model {self.model} and size {actual_size} (requested {size})...")
        try:
            response = await self.client.images.generate(
                model=self.model,
                prompt=prompt,
                size=actual_size,
                quality=quality,
                n=1,
            )
            image_data = response.data[0]
            logger.info(f"Raw image response keys: {image_data.__dict__.keys()}")
            
            if hasattr(image_data, 'b64_json') and image_data.b64_json:
                return "base64:" + image_data.b64_json
            return image_data.url
        except Exception as e:
            logger.error(f"OpenAI Image generation failed: {e}")
            raise e
