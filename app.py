from flask import Flask
from routes.views import views
from routes.api import api
from config import config

def create_app(config_object=config):
    """
    Flask application factory function
    
    Args:
        config_object: Configuration object
        
    Returns:
        Flask application instance
    """
    app = Flask(__name__)
    app.config.from_object(config_object)
    
    # Register blueprints
    app.register_blueprint(views)
    app.register_blueprint(api)
    
    return app

if __name__ == '__main__':
    app = create_app()
    app.run(debug=True) 