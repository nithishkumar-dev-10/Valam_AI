"""
app/utils/logger.py

Basic app-wide logger. Import as: from app.utils.logger import logger
"""

import logging

logger = logging.getLogger("valam_ai")
logger.setLevel(logging.INFO)

if not logger.handlers:
    handler = logging.StreamHandler()
    formatter = logging.Formatter(
        "%(asctime)s | %(levelname)s | %(name)s | %(message)s"
    )
    handler.setFormatter(formatter)
    logger.addHandler(handler)