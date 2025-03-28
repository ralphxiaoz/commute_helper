from flask import Blueprint, request, jsonify
from services.maps_service import calculate_route
from services.diagnostics import check_api_key_permissions
from config import logger

# Create Blueprint
api = Blueprint('api', __name__, url_prefix='/api')

@api.route('/route', methods=['POST'])
def route():
    """Calculate a route using the Google Routes API."""
    try:
        # Get request data
        data = request.json
        logger.info(f"Received route request: {data}")
        
        # Call the maps service to calculate the route
        response, status_code = calculate_route(
            origin=data.get('origin'),
            destination=data.get('destination'),
            travel_mode=data.get('travelMode', 'DRIVE'),
            routing_preference=data.get('routingPreference', 'TRAFFIC_AWARE'),
            departure_time=data.get('departureTime')
        )
        
        return jsonify(response), status_code
        
    except Exception as e:
        logger.exception("Error processing route request")
        return jsonify({"error": str(e)}), 500

@api.route('/check-key', methods=['GET'])
def check_key():
    """Check if the API key has all required permissions."""
    try:
        # Call the diagnostics service to check the API key
        results = check_api_key_permissions()
        return jsonify(results)
        
    except Exception as e:
        logger.exception("Error checking API key")
        return jsonify({"error": str(e)}), 500 