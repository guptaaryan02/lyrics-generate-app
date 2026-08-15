import logging
import sys
import os
from datetime import datetime

os.makedirs("logs", exist_ok=True)
log_filename = f"logs/app_{datetime.now().strftime('%Y%m%d')}.log"

logger = logging.getLogger("LyricsAgent")
logger.setLevel(logging.DEBUG)

file_handler = logging.FileHandler(log_filename)
file_handler.setLevel(logging.DEBUG)

console_handler = logging.StreamHandler(sys.stdout)
console_handler.setLevel(logging.INFO)

formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
file_handler.setFormatter(formatter)
console_handler.setFormatter(formatter)

logger.addHandler(file_handler)
logger.addHandler(console_handler)

def get_logger():
    return logger
