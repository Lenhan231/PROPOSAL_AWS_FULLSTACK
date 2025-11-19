import json
import logging
from datetime import datetime
from typing import Any, Optional


class StructuredLogger:
    """Structured logging for Lambda"""
    
    def __init__(self, name: str):
        self.logger = logging.getLogger(name)
        self.logger.setLevel(logging.INFO)
    
    def log(
        self,
        level: str,
        message: str,
        request_id: str,
        user_id: Optional[str] = None,
        action: Optional[str] = None,
        **kwargs
    ):
        """Log structured message"""
        log_data = {
            "timestamp": datetime.utcnow().isoformat(),
            "level": level,
            "message": message,
            "requestId": request_id,
            "userId": user_id,
            "action": action,
            **kwargs
        }
        
        log_method = getattr(self.logger, level.lower(), self.logger.info)
        log_method(json.dumps(log_data))
    
    def info(self, message: str, request_id: str, **kwargs):
        self.log("INFO", message, request_id, **kwargs)
    
    def error(self, message: str, request_id: str, **kwargs):
        self.log("ERROR", message, request_id, **kwargs)
    
    def debug(self, message: str, request_id: str, **kwargs):
        self.log("DEBUG", message, request_id, **kwargs)
