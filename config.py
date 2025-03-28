import os
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# API Key (in production, this should come from environment variables)
GOOGLE_MAPS_API_KEY = "AIzaSyCATazwBMqRCNtl7QXsurmOc2UwxB8Wjlg"

# API Endpoints
ROUTES_API_URL = "https://routes.googleapis.com/directions/v2:computeRoutes"

class Config:
    """Base configuration."""
    DEBUG = False
    TESTING = False
    
class DevelopmentConfig(Config):
    """Development configuration."""
    DEBUG = True

class ProductionConfig(Config):
    """Production configuration."""
    DEBUG = False

# Set configuration based on environment
config = DevelopmentConfig 