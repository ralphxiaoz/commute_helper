import requests
import json
from datetime import datetime
from config import GOOGLE_MAPS_API_KEY, ROUTES_API_URL, logger

def calculate_route(origin, destination, travel_mode="DRIVE", routing_preference="TRAFFIC_AWARE", departure_time=None):
    """
    Calculate a route using the Google Routes API
    
    Args:
        origin (dict): Origin location with latLng containing latitude and longitude
        destination (dict): Destination location with latLng containing latitude and longitude
        travel_mode (str): Mode of travel (DRIVE, WALK, BICYCLE, TRANSIT, TWO_WHEELER)
        routing_preference (str): Routing preference (TRAFFIC_AWARE, TRAFFIC_UNAWARE)
        departure_time (str, optional): ISO 8601 formatted departure time
        
    Returns:
        dict: Response from the Routes API
    """
    try:
        # Validate travel mode
        valid_travel_modes = ["DRIVE", "WALK", "BICYCLE", "TRANSIT", "TWO_WHEELER"]
        if travel_mode not in valid_travel_modes:
            logger.error(f"Invalid travel mode: {travel_mode}")
            return {"error": f"Invalid travel mode: {travel_mode}. Must be one of {valid_travel_modes}"}, 400
        
        # Set up default field mask
        field_mask = "routes.duration,routes.distanceMeters,routes.polyline,routes.legs,routes.staticDuration"
        
        # Add transit-specific fields if using transit mode
        if travel_mode == "TRANSIT":
            field_mask += ",routes.legs.steps.transitDetails,routes.legs.stepsOverview"
        
        # Set up headers
        headers = {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": GOOGLE_MAPS_API_KEY,
            "X-Goog-FieldMask": field_mask
        }
        
        # Set up payload
        payload = {
            "origin": origin,
            "destination": destination,
            "travelMode": travel_mode,
            "polylineQuality": "HIGH_QUALITY"
        }
        
        # Add routing preference - handle transit mode differently
        if travel_mode == "TRANSIT":
            payload["transitPreferences"] = {
                "routingPreference": "LESS_WALKING"
            }
        else:
            # For non-motorized travel, don't use traffic preferences
            if travel_mode in ["WALK", "BICYCLE"]:
                # Walking and bicycling don't use traffic routing preferences
                pass
            else:
                # Either TRAFFIC_AWARE_OPTIMAL with departureTime or TRAFFIC_AWARE without
                if departure_time:
                    # When departure time is specified, use TRAFFIC_AWARE_OPTIMAL for most accurate results
                    payload["routingPreference"] = "TRAFFIC_AWARE_OPTIMAL"
                else:
                    # When no departure time, use TRAFFIC_AWARE for current traffic conditions
                    payload["routingPreference"] = "TRAFFIC_AWARE"
        
        # Add departure time if provided (required for transit, optional for other modes)
        if departure_time:
            payload["departureTime"] = departure_time
            logger.info(f"Using departure time: {departure_time}")
        else:
            logger.info("No departure time specified, using current time for traffic conditions")
        
        logger.info(f"Sending request to Routes API: {json.dumps(payload, indent=2)}")
        logger.info(f"With headers: {headers}")
        
        # Make the request
        response = requests.post(ROUTES_API_URL, headers=headers, json=payload)
        
        # Log response details
        logger.info(f"Routes API response status: {response.status_code}")
        logger.info(f"Routes API response content: {response.text[:500]}...")  # Log first 500 chars
        
        # Check for error status codes
        if response.status_code != 200:
            error_detail = response.json() if response.text else {"message": "No response content"}
            return {
                "error": f"Routes API returned status code {response.status_code}",
                "details": error_detail
            }, response.status_code
        
        # Return successful response
        return response.json(), 200
        
    except Exception as e:
        logger.exception("Error in Routes API call")
        return {"error": str(e)}, 500 