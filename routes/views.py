from flask import Blueprint, render_template
from config import GOOGLE_MAPS_API_KEY

# Create Blueprint
views = Blueprint('views', __name__)

@views.route('/')
def index():
    """Render the main application page."""
    return render_template('index.html', api_key=GOOGLE_MAPS_API_KEY)

@views.route('/debug')
def debug():
    """Render the debug page for API key testing."""
    return render_template('debug.html') 