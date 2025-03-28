// Initialize variables
let map;
let markers = [];
let nextRentalId = 2; // Start with 2 since we have 1 in the HTML
let routePolylines = []; // To store route polylines instead of directionsRenderers

// Initialize when the page loads
document.addEventListener('DOMContentLoaded', () => {
    initMap();
    setupEventListeners();
});

// Initialize Google Map
function initMap() {
    // Default center (can be adjusted)
    const defaultCenter = { lat: 40.7128, lng: -74.0060 }; // NYC
    
    // Create map instance
    map = new google.maps.Map(document.getElementById('map'), {
        center: defaultCenter,
        zoom: 12,
        mapTypeControl: true,
        fullscreenControl: true,
        streetViewControl: true,
        zoomControl: true
    });
    
    // Initialize autocomplete for the office location
    const officeInput = document.getElementById('office-location');
    const officeAutocomplete = new google.maps.places.Autocomplete(officeInput);
    
    // Add place_changed listener to handle office selection
    officeAutocomplete.addListener('place_changed', function() {
        const place = officeAutocomplete.getPlace();
        if (place.formatted_address) {
            officeInput.value = place.formatted_address;
        }
    });
    
    // Initialize autocomplete for the first rental
    initRentalAutocomplete(document.querySelector('.rental-location'));
}

// Set up all event listeners
function setupEventListeners() {
    // Add rental button
    document.getElementById('add-rental').addEventListener('click', addRental);
    
    // Remove rental buttons (for the initial one and all future ones)
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('remove-rental')) {
            const rentalDiv = e.target.closest('.rental-input');
            rentalDiv.remove();
        }
    });
    
    // Calculate routes button
    document.getElementById('calculate-routes').addEventListener('click', calculateRoutes);
    
    // Leave by checkbox
    const leaveByCheckbox = document.getElementById('leave-by-checkbox');
    const departureTimeInput = document.getElementById('departure-time');
    
    leaveByCheckbox.addEventListener('change', function() {
        // Enable/disable departure time input based on checkbox state
        departureTimeInput.disabled = !this.checked;
        
        // If checked and no time is set, default to current time plus 1 hour
        if (this.checked && !departureTimeInput.value) {
            const now = new Date();
            now.setHours(now.getHours() + 1);
            
            // Round minutes to nearest 15 min increment
            const minutes = now.getMinutes();
            const roundedMinutes = Math.round(minutes / 15) * 15;
            now.setMinutes(roundedMinutes % 60); // Modulo 60 to handle case of 60 minutes
            
            // Adjust hour if minutes were rounded up to next hour
            if (roundedMinutes === 60) {
                now.setHours(now.getHours() + 1);
            }
            
            // Format for datetime-local input (YYYY-MM-DDThh:mm)
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');
            const hours = String(now.getHours()).padStart(2, '0');
            const adjustedMinutes = String(now.getMinutes()).padStart(2, '0');
            
            departureTimeInput.value = `${year}-${month}-${day}T${hours}:${adjustedMinutes}`;
        }
    });
    
    // Add keyboard event listeners for enter key
    document.getElementById('office-location').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            document.querySelector('.rental-location').focus();
        }
    });
    
    // Add keyboard event for the initial rental input
    document.querySelector('.rental-location').addEventListener('keypress', handleRentalKeypress);
    
    // Event delegation for dynamically added rental inputs
    document.addEventListener('keypress', (e) => {
        if (e.target.classList.contains('rental-location') && e.key === 'Enter') {
            handleRentalKeypress(e);
        }
    });
}

// Handle Enter key on rental inputs
function handleRentalKeypress(e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        const currentRentalDiv = e.target.closest('.rental-input');
        const nextRentalDiv = currentRentalDiv.nextElementSibling;
        
        if (nextRentalDiv && nextRentalDiv.classList.contains('rental-input')) {
            nextRentalDiv.querySelector('.rental-location').focus();
        } else {
            // If this is the last rental input, add a new one and focus on it
            addRental();
            const newInput = document.querySelector('.rental-input:last-child .rental-location');
            if (newInput) {
                newInput.focus();
            }
        }
    }
}

// Add a new rental input
function addRental() {
    const rentalsContainer = document.getElementById('rental-inputs');
    
    // Create new rental input div
    const rentalDiv = document.createElement('div');
    rentalDiv.className = 'rental-input';
    rentalDiv.dataset.id = nextRentalId++;
    
    // Create input and button elements
    rentalDiv.innerHTML = `
        <input type="text" class="rental-location" placeholder="Enter rental address">
        <button class="remove-rental">Remove</button>
    `;
    
    // Add to container
    rentalsContainer.appendChild(rentalDiv);
    
    // Initialize autocomplete for the new input
    initRentalAutocomplete(rentalDiv.querySelector('.rental-location'));
}

// Initialize autocomplete for a rental input
function initRentalAutocomplete(inputElement) {
    const autocomplete = new google.maps.places.Autocomplete(inputElement);
    
    // Add place_changed listener to handle selection
    autocomplete.addListener('place_changed', function() {
        const place = autocomplete.getPlace();
        if (place.formatted_address) {
            inputElement.value = place.formatted_address;
            
            // Focus on the next input or button if available
            const currentRentalDiv = inputElement.closest('.rental-input');
            const nextRentalDiv = currentRentalDiv.nextElementSibling;
            
            if (nextRentalDiv && nextRentalDiv.classList.contains('rental-input')) {
                nextRentalDiv.querySelector('.rental-location').focus();
            } else {
                // If this is the last rental input, focus on Add more button
                document.getElementById('add-rental').focus();
            }
        }
    });
}

// Calculate routes between office and rentals
function calculateRoutes() {
    // Clear previous markers and routes
    clearMarkersAndRoutes();
    
    // Get office location
    const officeLocation = document.getElementById('office-location').value;
    if (!officeLocation) {
        alert('Please enter an office location');
        return;
    }
    
    // Get all rental locations
    const rentalInputs = document.querySelectorAll('.rental-location');
    const rentalLocations = Array.from(rentalInputs)
        .map(input => input.value)
        .filter(value => value.trim() !== '');
    
    if (rentalLocations.length === 0) {
        alert('Please enter at least one rental location');
        return;
    }
    
    // Show warning for beta travel modes
    const selectedMode = document.getElementById('travel-mode').value;
    const betaModes = ["WALK", "BICYCLE", "TWO_WHEELER"];
    
    if (betaModes.includes(selectedMode)) {
        // Display warning in the results panel
        const resultsContainer = document.getElementById('commute-results');
        const warningDiv = document.createElement('div');
        warningDiv.className = 'route-warning';
        warningDiv.innerHTML = `
            <div class="warning-icon">⚠️</div>
            <div class="warning-text">
                ${selectedMode === "WALK" ? "Walking" : selectedMode === "BICYCLE" ? "Bicycling" : "Two-wheeled vehicle"} 
                routes are in beta and might sometimes be missing clear sidewalks, pedestrian paths, or bicycling paths.
            </div>
        `;
        resultsContainer.appendChild(warningDiv);
    }
    
    // Geocode the office location
    geocodeAddress(officeLocation, (officeLatLng) => {
        // Add office marker
        addMarker(officeLatLng, 'office', 'Office');
        
        // Clear previous results
        document.getElementById('commute-results').innerHTML = '';
        
        // Calculate routes for each rental
        rentalLocations.forEach((rentalLocation, index) => {
            // Geocode the rental location
            geocodeAddress(rentalLocation, (rentalLatLng) => {
                // Add rental marker with the actual address
                addMarker(rentalLatLng, 'rental', rentalLocation);
                
                // Calculate route using Routes API with the actual address
                calculateRouteWithRoutesAPI(officeLatLng, rentalLatLng, rentalLocation);
            });
        });
    });
}

// Geocode an address to get its coordinates
function geocodeAddress(address, callback) {
    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ address: address }, (results, status) => {
        if (status === 'OK' && results[0]) {
            callback(results[0].geometry.location);
        } else {
            alert(`Geocoding failed for address: ${address}`);
        }
    });
}

// Add a marker to the map
function addMarker(position, type, label) {
    const markerOptions = {
        position: position,
        map: map,
        title: label,
        animation: google.maps.Animation.DROP
    };
    
    // Different icons for office and rentals
    if (type === 'office') {
        markerOptions.icon = {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 12,
            fillColor: '#4285F4',
            fillOpacity: 1,
            strokeWeight: 2,
            strokeColor: '#FFF'
        };
    } else {
        markerOptions.icon = {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 10,
            fillColor: '#DB4437',
            fillOpacity: 1,
            strokeWeight: 2,
            strokeColor: '#FFF'
        };
    }
    
    // Create marker
    const marker = new google.maps.Marker(markerOptions);
    
    // Create label
    const infoWindow = new google.maps.InfoWindow({
        content: `<div class="${type}-marker-label">${type === 'office' ? 'Office' : formatMarkerLabel(label)}</div>`,
        pixelOffset: new google.maps.Size(0, -5),
        disableAutoPan: true
    });
    
    // Open the info window immediately and keep it open
    infoWindow.open(map, marker);
    
    // Add click event to the marker
    marker.addListener('click', function() {
        // Close any open info windows first
        markers.forEach(m => {
            if (m.infoWindow) m.infoWindow.close();
        });
        
        // Open this marker's info window
        infoWindow.open(map, marker);
    });
    
    // Add to markers array
    markers.push({ marker, infoWindow });
    
    // Center and zoom map to include all markers
    if (markers.length > 1) {
        const bounds = new google.maps.LatLngBounds();
        markers.forEach(m => bounds.extend(m.marker.getPosition()));
        map.fitBounds(bounds);
    }
}

// Calculate route between office and rental using Google Routes API
function calculateRouteWithRoutesAPI(officeLatLng, rentalLatLng, rentalLabel) {
    // Get departure time and travel mode from the UI
    const departureTimeInput = document.getElementById('departure-time');
    const travelModeSelect = document.getElementById('travel-mode');
    const leaveByCheckbox = document.getElementById('leave-by-checkbox');
    const selectedMode = travelModeSelect.value;
    
    // For transit mode, departure time is required
    if (selectedMode === "TRANSIT" && (!leaveByCheckbox.checked || !departureTimeInput.value)) {
        displayRouteError(rentalLabel, "Departure time is required for public transit routes");
        return;
    }
    
    // Prepare the request body for the Routes API
    const requestBody = {
        origin: {
            location: {
                latLng: {
                    latitude: rentalLatLng.lat(),
                    longitude: rentalLatLng.lng()
                }
            }
        },
        destination: {
            location: {
                latLng: {
                    latitude: officeLatLng.lat(),
                    longitude: officeLatLng.lng()
                }
            }
        },
        travelMode: selectedMode,
        polylineQuality: "HIGH_QUALITY"
    };
    
    // Add routing preference based on travel mode
    if (selectedMode === "TRANSIT") {
        requestBody.transitPreferences = {
            routingPreference: "LESS_WALKING"
        };
    } else {
        // For traffic-based modes, use TRAFFIC_AWARE_OPTIMAL for the most accurate results
        requestBody.routingPreference = "TRAFFIC_AWARE_OPTIMAL";
    }
    
    // Add departure time only if "Leave by" is checked
    if (leaveByCheckbox.checked && departureTimeInput.value) {
        const selectedDateTime = new Date(departureTimeInput.value);
        requestBody.departureTime = selectedDateTime.toISOString();
    } else if (selectedMode === "TRANSIT") {
        // For transit without specified time, use current time + 1 hour as default
        const now = new Date();
        now.setHours(now.getHours() + 1);
        requestBody.departureTime = now.toISOString();
    }
    // For driving without "Leave by" checked, use current traffic without specifying departureTime
    
    // Call our server-side API endpoint
    fetch('/api/route', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
    })
    .then(response => {
        // Check if the response itself is OK
        if (!response.ok) {
            console.error(`HTTP error! Status: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        if (data.routes && data.routes.length > 0) {
            processRoutesAPIResponse(data, rentalLabel);
        } else if (data.error) {
            console.error("Routes API Error:", data.error);
            
            // More detailed error info in the console
            if (data.details) {
                console.error("Error details:", JSON.stringify(data.details, null, 2));
            }
            
            // Display more helpful error message to the user
            let errorMsg = `Could not calculate route for ${rentalLabel}: ${data.error}`;
            if (data.details && data.details.error && data.details.error.message) {
                errorMsg += `\nDetails: ${data.details.error.message}`;
            }
            alert(errorMsg);
            
            // Fallback to mock implementation if there's an error
            mockRoutesAPIRequest(requestBody, rentalLabel, officeLatLng, rentalLatLng);
        } else {
            console.error("Unexpected Routes API response:", JSON.stringify(data, null, 2));
            alert(`Unexpected response format from Routes API for ${rentalLabel}`);
            // Fallback to mock implementation
            mockRoutesAPIRequest(requestBody, rentalLabel, officeLatLng, rentalLatLng);
        }
    })
    .catch(error => {
        console.error("Error calling Routes API:", error);
        alert(`Network error when calculating route for ${rentalLabel}: ${error.message}`);
        // Fallback to mock implementation
        mockRoutesAPIRequest(requestBody, rentalLabel, officeLatLng, rentalLatLng);
    });
}

// Process the response from the Routes API
function processRoutesAPIResponse(response, rentalLabel) {
    if (!response.routes || response.routes.length === 0) {
        alert(`No route found for ${rentalLabel}`);
        return;
    }
    
    const route = response.routes[0];
    
    // Draw the polyline
    if (route.polyline && route.polyline.encodedPolyline) {
        const decodedPath = google.maps.geometry.encoding.decodePath(route.polyline.encodedPolyline);
        
        const routePolyline = new google.maps.Polyline({
            path: decodedPath,
            geodesic: true,
            strokeColor: getRandomColor(),
            strokeOpacity: 0.8,
            strokeWeight: 5,
            map: map
        });
        
        // Store the polyline for later cleanup
        routePolylines.push(routePolyline);
    }
    
    // Extract duration and distance information
    if (route.duration && route.distanceMeters) {
        // Format the duration
        const durationSeconds = parseInt(route.duration.replace('s', ''));
        const hours = Math.floor(durationSeconds / 3600);
        const minutes = Math.floor((durationSeconds % 3600) / 60);
        let durationText = '';
        
        if (hours > 0) {
            durationText = `${hours} hour${hours > 1 ? 's' : ''}`;
            if (minutes > 0) {
                durationText += ` ${minutes} min`;
            }
        } else {
            durationText = `${minutes} min`;
        }
        
        // Format the distance
        const distanceMeters = parseInt(route.distanceMeters);
        const distanceKm = (distanceMeters / 1000).toFixed(1);
        const distanceMiles = (distanceKm * 0.621371).toFixed(1);
        const distanceText = `${distanceMiles} mi (${distanceKm} km)`;
        
        // Check for traffic details
        let trafficText = '';
        
        // Display static duration (without traffic) if available
        if (route.staticDuration) {
            const staticDurationSeconds = parseInt(route.staticDuration.replace('s', ''));
            const staticHours = Math.floor(staticDurationSeconds / 3600);
            const staticMinutes = Math.floor((staticDurationSeconds % 3600) / 60);
            let staticDurationText = '';
            
            if (staticHours > 0) {
                staticDurationText = `${staticHours} hour${staticHours > 1 ? 's' : ''}`;
                if (staticMinutes > 0) {
                    staticDurationText += ` ${staticMinutes} min`;
                }
            } else {
                staticDurationText = `${staticMinutes} min`;
            }
            
            // Calculate traffic delay
            const trafficDelaySeconds = durationSeconds - staticDurationSeconds;
            
            if (trafficDelaySeconds > 0) {
                const delayMinutes = Math.ceil(trafficDelaySeconds / 60);
                trafficText = `<br><span class="traffic-delay">+${delayMinutes} min due to traffic</span>`;
            } else if (trafficDelaySeconds < 0) {
                // In some cases, with good traffic conditions, this could be negative
                const fasterMinutes = Math.ceil(Math.abs(trafficDelaySeconds) / 60);
                trafficText = `<br><span class="traffic-good">${fasterMinutes} min faster than usual</span>`;
            } else {
                trafficText = `<br><span class="traffic-normal">Normal traffic conditions</span>`;
            }
        } else if (document.getElementById('travel-mode').value !== "TRANSIT") {
            // If staticDuration isn't available but we're using a traffic-aware mode
            trafficText = `<br><span class="traffic-info">Traffic conditions applied</span>`;
        }
        
        // Check for transit details
        let transitText = '';
        if (route.legs && route.legs.length > 0) {
            const leg = route.legs[0];
            if (leg.steps) {
                // Count transit segments
                const transitSteps = leg.steps.filter(step => 
                    step.transitDetails && step.transitDetails.transitLine);
                
                if (transitSteps.length > 0) {
                    transitText = `<br>Transit: ${transitSteps.length} segment${transitSteps.length > 1 ? 's' : ''}`;
                    
                    // Add details for each transit line
                    transitSteps.forEach((step, index) => {
                        const line = step.transitDetails.transitLine;
                        if (line && line.nameShort) {
                            transitText += `<br>- ${line.nameShort} ${line.name || ''}`;
                        }
                    });
                }
            }
        }
        
        // Display the information with traffic and transit details if available
        displayRouteInfo(rentalLabel, durationText, distanceText, trafficText + transitText);
    }
}

// This simulates what should be a proper server-side API call
function mockRoutesAPIRequest(requestBody, rentalLabel, officeLatLng, rentalLatLng) {
    // For now, we'll use the existing Google Maps JS SDK to calculate a route
    // This is a fallback until we implement the proper Routes API integration
    
    // Map our travel mode to Google Maps travel mode
    let travelMode = google.maps.TravelMode.DRIVING;
    switch (requestBody.travelMode) {
        case "BICYCLE":
            travelMode = google.maps.TravelMode.BICYCLING;
            break;
        case "WALK":
            travelMode = google.maps.TravelMode.WALKING;
            break;
        case "TWO_WHEELER":
            // Fallback to BICYCLING for TWO_WHEELER since Maps JS API doesn't have this mode
            travelMode = google.maps.TravelMode.BICYCLING;
            break;
        case "TRANSIT":
            travelMode = google.maps.TravelMode.TRANSIT;
            break;
    }
    
    const request = {
        origin: rentalLatLng,
        destination: officeLatLng,
        travelMode: travelMode
    };
    
    // Add departure time if specified in the original request
    if (requestBody.departureTime) {
        if (travelMode === google.maps.TravelMode.TRANSIT) {
            request.transitOptions = {
                departureTime: new Date(requestBody.departureTime)
            };
        } else {
            request.drivingOptions = {
                departureTime: new Date(requestBody.departureTime)
            };
        }
    }
    
    const directionsService = new google.maps.DirectionsService();
    
    directionsService.route(request, (result, status) => {
        if (status === 'OK') {
            // Draw the route on the map
            const routePath = result.routes[0].overview_path;
            const routePolyline = new google.maps.Polyline({
                path: routePath,
                geodesic: true,
                strokeColor: getRandomColor(),
                strokeOpacity: 0.8,
                strokeWeight: 5,
                map: map
            });
            
            // Store the polyline to clear it later
            routePolylines.push(routePolyline);
            
            // Extract route information
            const route = result.routes[0].legs[0];
            const duration = route.duration.text;
            const distance = route.distance.text;
            
            // Add traffic info if departure time was specified
            let additionalInfo = '';
            if (requestBody.departureTime) {
                additionalInfo = '<br><span class="traffic-info">Estimated time for specified departure</span>';
            }
            
            // Display in results panel
            displayRouteInfo(rentalLabel, duration, distance, additionalInfo);
        } else {
            displayRouteError(rentalLabel, `Could not calculate route: ${status}`);
        }
    });
}

// Display route information in the results panel
function displayRouteInfo(rentalLabel, duration, distance, additionalInfo = '') {
    const resultsContainer = document.getElementById('commute-results');
    const resultDiv = document.createElement('div');
    resultDiv.className = 'commute-result';
    resultDiv.innerHTML = `
        <strong>${formatResultLabel(rentalLabel)}</strong><br>
        Commute time: ${duration}<br>
        Distance: ${distance}${additionalInfo ? additionalInfo : ''}
    `;
    resultsContainer.appendChild(resultDiv);
}

// Display route error in the results panel
function displayRouteError(rentalLabel, errorMessage) {
    const resultsContainer = document.getElementById('commute-results');
    const resultDiv = document.createElement('div');
    resultDiv.className = 'commute-result error';
    resultDiv.innerHTML = `
        <strong>${formatResultLabel(rentalLabel)}</strong><br>
        <span class="error-message">${errorMessage}</span>
    `;
    resultsContainer.appendChild(resultDiv);
}

// Clear all markers and routes
function clearMarkersAndRoutes() {
    // Clear markers
    markers.forEach(m => {
        m.marker.setMap(null);
        m.infoWindow.close();
    });
    markers = [];
    
    // Clear routes
    routePolylines.forEach(polyline => {
        polyline.setMap(null);
    });
    routePolylines = [];
    
    // Clear results
    document.getElementById('commute-results').innerHTML = '';
}

// Generate random color for route lines
function getRandomColor() {
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) {
        color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
}

// Helper function to format address for display in map markers (very short)
function formatMarkerLabel(address) {
    // If it's already a short label like "Office", return as is
    if (address.length < 10) return address;
    
    // Format the address to make it compact for markers
    const parts = address.split(',');
    
    // For map markers: just show house number and street
    if (parts.length >= 1) {
        return parts[0].trim();
    }
    
    return address;
}

// Helper function to format address for display in result panels (more detailed)
function formatResultLabel(address) {
    // If it's already a short label like "Office", return as is
    if (address.length < 10) return address;
    
    // Format the address for result panels
    const parts = address.split(',');
    
    // For results: show street address and city
    if (parts.length >= 3) {
        const streetAddress = parts[0].trim();
        const cityOrArea = parts[1].trim();
        return `${streetAddress}, ${cityOrArea}`;
    }
    
    return address;
} 