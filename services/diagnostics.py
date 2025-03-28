import requests
from config import GOOGLE_MAPS_API_KEY, logger

def check_api_key_permissions():
    """
    Check if the API key has all necessary permissions enabled
    
    Returns:
        dict: Results of API key tests
    """
    results = {}
    
    # Define APIs to test
    apis_to_test = [
        {
            "name": "Maps JavaScript API",
            "test_url": f"https://maps.googleapis.com/maps/api/js?key={GOOGLE_MAPS_API_KEY}&callback=initMap",
            "method": "GET"
        },
        {
            "name": "Geocoding API",
            "test_url": f"https://maps.googleapis.com/maps/api/geocode/json?address=New+York&key={GOOGLE_MAPS_API_KEY}",
            "method": "GET"
        },
        {
            "name": "Directions API (Legacy)",
            "test_url": f"https://maps.googleapis.com/maps/api/directions/json?origin=New+York&destination=Boston&key={GOOGLE_MAPS_API_KEY}",
            "method": "GET"
        },
        {
            "name": "Routes API",
            "test_url": "https://routes.googleapis.com/directions/v2:computeRoutes",
            "method": "POST",
            "headers": {
                "Content-Type": "application/json",
                "X-Goog-Api-Key": GOOGLE_MAPS_API_KEY,
                "X-Goog-FieldMask": "routes.duration"
            },
            "payload": {
                "origin": {
                    "location": {
                        "latLng": {
                            "latitude": 40.7128,
                            "longitude": -74.0060
                        }
                    }
                },
                "destination": {
                    "location": {
                        "latLng": {
                            "latitude": 42.3601,
                            "longitude": -71.0589
                        }
                    }
                },
                "travelMode": "DRIVE"
            }
        }
    ]
    
    # Test each API
    for api in apis_to_test:
        logger.info(f"Testing API: {api['name']}")
        
        try:
            if api['method'] == 'GET':
                response = requests.get(api['test_url'])
            else:  # POST
                response = requests.post(
                    api['test_url'], 
                    headers=api.get('headers', {}),
                    json=api.get('payload', {})
                )
            
            status_code = response.status_code
            content = response.text[:500]  # First 500 chars of response to keep logs manageable
            
            results[api['name']] = {
                "status": status_code,
                "success": 200 <= status_code < 300 or status_code == 303,  # 303 is special case for JS API
                "message": content
            }
            
            logger.info(f"API {api['name']} returned status {status_code}")
            
        except Exception as e:
            results[api['name']] = {
                "status": "Error",
                "success": False,
                "message": str(e)
            }
            logger.exception(f"Error testing API {api['name']}")
    
    return results 