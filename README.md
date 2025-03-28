# Commute_Helper

A web application to help users compare commute times between potential rental locations and their office.

## Features

- Interactive Google Map showing office and rental locations
- Add and remove multiple rental locations
- Calculate and visualize commute routes
- Display commute times and distances
- Autocomplete address inputs

## Setup Instructions

1. Clone this repository
2. Install dependencies
   ```
   pip install -r requirements.txt
   ```
3. Get a Google Maps API key:
   - Go to the [Google Cloud Console](https://console.cloud.google.com/)
   - Create a project
   - Enable the following APIs:
     - Maps JavaScript API
     - Directions API
     - Places API
     - Geocoding API
   - Create an API key
   - Restrict the API key to the APIs listed above

4. Edit the `app.py` file and replace `"YOUR_GOOGLE_MAPS_API_KEY"` with your actual API key

5. Run the application:
   ```
   python app.py
   ```

6. Open your browser and navigate to `http://localhost:5000`

## Usage

1. Enter your destination in the "To" field
2. Enter starting points in the "From" fields
3. Add additional starting points by clicking "Add more"
4. Remove starting points by clicking the "Remove" button next to an entry
5. Click "Calculate Routes" to visualize commute routes and times
6. View commute results in the results panel

## Technologies Used

- Backend: Python, Flask
- Frontend: HTML, CSS, JavaScript
- Maps API: Google Maps JavaScript API, Directions API, Places API, Geocoding API 