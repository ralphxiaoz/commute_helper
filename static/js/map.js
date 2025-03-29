// Initialize variables
let map;
let markers = [];
let nextRentalId = 2; // Start with 2 since we have 1 in the HTML
let routePolylines = []; // To store route polylines instead of directionsRenderers

// Initialize when the page loads
document.addEventListener('DOMContentLoaded', () => {
    initMap();
    setupEventListeners();
    updateRemoveButton(); // Initialize remove button visibility
});

// Initialize Google Map
function initMap() {
    // Default center (used as fallback if geolocation fails)
    const defaultCenter = { lat: 40.7128, lng: -74.0060 }; // NYC
    
    // Create map instance with default center first
    map = new google.maps.Map(document.getElementById('map'), {
        center: defaultCenter,
        zoom: 12,
        mapTypeControl: true,
        fullscreenControl: true,
        streetViewControl: true,
        zoomControl: true
    });
    
    // Show a notification that we're getting location
    showLocationNotification("Getting your location...");
    
    // Try to get user's current location
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            // Success callback
            (position) => {
                const userLocation = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };
                
                // Recenter map to user location
                map.setCenter(userLocation);
                map.setZoom(13); // A better zoom level for a local area
                
                // Add a marker at the user's location
                const marker = new google.maps.Marker({
                    position: userLocation,
                    map: map,
                    title: "Your Location",
                    icon: {
                        path: google.maps.SymbolPath.CIRCLE,
                        scale: 10,
                        fillColor: '#0F9D58',
                        fillOpacity: 1,
                        strokeWeight: 2,
                        strokeColor: '#FFF'
                    }
                });
                
                // Add info window for the user's location
                const infoWindow = new google.maps.InfoWindow({
                    content: `<div class="your-location-marker">Your Location</div>`,
                    pixelOffset: new google.maps.Size(0, -5),
                    disableAutoPan: true
                });
                
                infoWindow.open(map, marker);
                
                // Update notification
                showLocationNotification("Using your current location");
            },
            // Error callback
            (error) => {
                console.log("Geolocation error:", error);
                
                // Show error notification based on error type
                if (error.code === error.PERMISSION_DENIED) {
                    showLocationNotification("Location access denied. Using default location.", true);
                } else if (error.code === error.POSITION_UNAVAILABLE) {
                    showLocationNotification("Location information unavailable. Using default location.", true);
                } else if (error.code === error.TIMEOUT) {
                    showLocationNotification("Location request timed out. Using default location.", true);
                } else {
                    showLocationNotification("Unknown error getting location. Using default location.", true);
                }
                
                // Keep the default NYC center if there's an error
            },
            // Options
            {
                enableHighAccuracy: true,
                timeout: 5000,
                maximumAge: 0
            }
        );
    } else {
        // Browser doesn't support geolocation
        showLocationNotification("Your browser doesn't support geolocation. Using default location.", true);
    }
    
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
    
    // Remove rental button (the main one in the header)
    document.getElementById('remove-rental').addEventListener('click', () => {
        const rentalInputs = document.querySelectorAll('.rental-input');
        if (rentalInputs.length <= 1) {
            return; // Don't remove if there's only one rental input
        }
        
        // Get the last non-primary rental input and remove it
        const lastRental = rentalInputs[rentalInputs.length - 1];
        if (!lastRental.classList.contains('primary-rental')) {
            lastRental.remove();
            updateRemoveButton();
        }
    });
    
    // Calculate routes button
    document.getElementById('calculate-routes').addEventListener('click', calculateRoutes);
    
    // Leave by checkbox
    const leaveByCheckbox = document.getElementById('leave-by-checkbox');
    const departureDate = document.getElementById('departure-date');
    const departureHour = document.getElementById('departure-hour');
    const departureMinute = document.getElementById('departure-minute');
    const departureAmPm = document.getElementById('departure-ampm');
    
    leaveByCheckbox.addEventListener('change', function() {
        // Enable/disable departure time inputs based on checkbox state
        departureDate.disabled = !this.checked;
        departureHour.disabled = !this.checked;
        departureMinute.disabled = !this.checked;
        departureAmPm.disabled = !this.checked;
        
        // If checked and no time is set, default to current time plus 1 hour
        if (this.checked) {
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
            
            // Format for date input (YYYY-MM-DD)
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');
            departureDate.value = `${year}-${month}-${day}`;
            
            // Set hour (1-12 format)
            let hours = now.getHours();
            const ampm = hours >= 12 ? 'PM' : 'AM';
            hours = hours % 12;
            hours = hours ? hours : 12; // Convert 0 to 12
            departureHour.value = String(hours).padStart(2, '0');
            
            // Set minutes (00, 15, 30, 45)
            departureMinute.value = String(roundedMinutes % 60).padStart(2, '0');
            
            // Set AM/PM
            departureAmPm.value = ampm;
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
    
    // Create input elements with consistent classes (no remove button)
    rentalDiv.innerHTML = `
        <div class="input-with-label">
            <input type="color" class="rental-color" value="${getRandomColor()}">
            <input type="text" class="rental-location address-input" placeholder="Enter starting address">
            <input type="text" class="rental-label location-label" placeholder="label">
        </div>
    `;
    
    // Add to container
    rentalsContainer.appendChild(rentalDiv);
    
    // Initialize autocomplete for the new input
    initRentalAutocomplete(rentalDiv.querySelector('.rental-location'));
    
    // Show the main remove button when we have more than one rental input
    updateRemoveButton();
}

// Helper function to show/hide the remove button based on number of rental inputs
function updateRemoveButton() {
    const rentalInputs = document.querySelectorAll('.rental-input');
    const removeButton = document.getElementById('remove-rental');
    
    if (rentalInputs.length > 1) {
        // Show the remove button when there's more than one rental input
        removeButton.style.display = 'block';
    } else {
        // Hide the remove button if there's only one rental input
        removeButton.style.display = 'none';
    }
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

// Calculate routes between starting points and destination
function calculateRoutes() {
    // Clear previous markers and routes
    clearMarkersAndRoutes();
    
    // Get destination location
    const officeLocation = document.getElementById('office-location').value;
    const officeLabel = document.getElementById('office-label').value;
    
    if (!officeLocation) {
        alert('Please enter a destination address');
        return;
    }
    
    // Get all starting point locations and their labels
    const rentalInputs = document.querySelectorAll('.rental-input');
    const rentalData = Array.from(rentalInputs)
        .map(div => {
            const locationInput = div.querySelector('.rental-location');
            const labelInput = div.querySelector('.rental-label');
            const colorInput = div.querySelector('.rental-color');
            return {
                address: locationInput.value.trim(),
                label: labelInput.value.trim(),
                color: colorInput.value
            };
        })
        .filter(data => data.address !== '');
    
    if (rentalData.length === 0) {
        alert('Please enter at least one starting address');
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
    
    // Geocode the destination location
    geocodeAddress(officeLocation, (officeLatLng) => {
        // Add destination marker with custom label if provided
        const displayOfficeLabel = officeLabel || officeLocation;
        addMarker(officeLatLng, 'office', displayOfficeLabel, officeLocation);
        
        // Clear previous results
        document.getElementById('commute-results').innerHTML = '';
        
        // Calculate routes for each starting point
        rentalData.forEach((rental, index) => {
            // Geocode the starting point location
            geocodeAddress(rental.address, (rentalLatLng) => {
                // Add starting point marker with custom label if provided
                const displayLabel = rental.label || rental.address;
                addMarker(rentalLatLng, 'rental', displayLabel, rental.address, rental.color);
                
                // Calculate route using Routes API
                calculateRouteWithRoutesAPI(officeLatLng, rentalLatLng, displayLabel, rental.address, displayOfficeLabel, officeLocation, rental.color);
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
            alert(`Address not found: ${address}`);
        }
    });
}

// Add a marker to the map
function addMarker(position, type, label, address, color = null) {
    const markerOptions = {
        position: position,
        map: map,
        title: label,
        animation: google.maps.Animation.DROP
    };
    
    // Different icons for destination and starting points
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
            fillColor: color || getRandomColor(),
            fillOpacity: 1,
            strokeWeight: 2,
            strokeColor: '#FFF'
        };
    }
    
    // Create marker
    const marker = new google.maps.Marker(markerOptions);
    
    // Create label
    const infoWindow = new google.maps.InfoWindow({
        content: `<div class="${type}-marker-label">${label}</div>`,
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

// Calculate route between destination and starting point
function calculateRouteWithRoutesAPI(officeLatLng, rentalLatLng, rentalLabel, rentalAddress, officeLabel, officeLocation, rentalColor) {
    console.log("Calculating route from", rentalLabel, "to", officeLabel);
    
    // Get departure time and travel mode from the UI
    const departureDate = document.getElementById('departure-date');
    const departureHour = document.getElementById('departure-hour');
    const departureMinute = document.getElementById('departure-minute');
    const departureAmPm = document.getElementById('departure-ampm');
    const travelModeSelect = document.getElementById('travel-mode');
    const leaveByCheckbox = document.getElementById('leave-by-checkbox');
    const selectedMode = travelModeSelect.value;
    
    // For transit mode, departure time is required
    if (selectedMode === "TRANSIT" && !leaveByCheckbox.checked) {
        console.error("Transit mode requires departure time");
        displayRouteError(rentalLabel, officeLabel, "Departure time is required for public transit routes");
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
    if (leaveByCheckbox.checked && departureDate.value) {
        // Convert the time components to a JavaScript Date
        const dateValue = departureDate.value;
        let hours = parseInt(departureHour.value);
        const minutes = parseInt(departureMinute.value);
        const ampm = departureAmPm.value;
        
        // Convert to 24-hour format
        if (ampm === 'PM' && hours < 12) {
            hours += 12;
        } else if (ampm === 'AM' && hours === 12) {
            hours = 0;
        }
        
        // Create a date object
        const selectedDateTime = new Date(`${dateValue}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`);
        requestBody.departureTime = selectedDateTime.toISOString();
    } else if (selectedMode === "TRANSIT") {
        // For transit without specified time, use current time + 1 hour as default
        const now = new Date();
        now.setHours(now.getHours() + 1);
        requestBody.departureTime = now.toISOString();
    }
    // For driving without "Leave by" checked, use current traffic without specifying departureTime
    
    console.log("Route request body:", requestBody);
    
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
            console.log("Routes API returned data");
            processRoutesAPIResponse(data, rentalLabel, officeLabel, rentalColor);
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
            console.log("Falling back to mock implementation due to error");
            alert(errorMsg);
            
            // Fallback to mock implementation if there's an error
            mockRoutesAPIRequest(requestBody, rentalLabel, officeLatLng, rentalLatLng, rentalAddress, officeLabel, officeLocation, rentalColor);
        } else {
            console.error("Unexpected Routes API response:", JSON.stringify(data, null, 2));
            console.log("Falling back to mock implementation due to unexpected response");
            alert(`Could not calculate route for ${rentalLabel}. Please try again.`);
            // Fallback to mock implementation
            mockRoutesAPIRequest(requestBody, rentalLabel, officeLatLng, rentalLatLng, rentalAddress, officeLabel, officeLocation, rentalColor);
        }
    })
    .catch(error => {
        console.error("Error calling Routes API:", error);
        console.log("Falling back to mock implementation due to network error");
        alert(`Network error when calculating route for ${rentalLabel}. Please check your connection and try again.`);
        // Fallback to mock implementation
        mockRoutesAPIRequest(requestBody, rentalLabel, officeLatLng, rentalLatLng, rentalAddress, officeLabel, officeLocation, rentalColor);
    });
}

// Process the response from the Routes API
function processRoutesAPIResponse(response, rentalLabel, officeLabel, rentalColor) {
    console.log("Processing route response for:", rentalLabel, "to", officeLabel);
    console.log("Response:", response);
    
    if (!response.routes || response.routes.length === 0) {
        console.error(`No route found for ${rentalLabel} to ${officeLabel}`);
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
            strokeColor: rentalColor || getRandomColor(),
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
        
        // Display the information with traffic and transit details if available
        console.log("Displaying route info:", rentalLabel, officeLabel, durationText, distanceText);
        displayRouteInfo(rentalLabel, officeLabel, durationText, distanceText, trafficText + transitText, rentalColor);
    } else {
        console.error("Missing duration or distance data in route:", route);
    }
}

// This simulates what should be a proper server-side API call
function mockRoutesAPIRequest(requestBody, rentalLabel, officeLatLng, rentalLatLng, rentalAddress, officeLabel, officeLocation, rentalColor) {
    console.log("Using mock routes request for:", rentalLabel, "to", officeLabel);
    
    // Set up a request for the Google Maps Directions Service
    const request = {
        origin: rentalLatLng,
        destination: officeLatLng,
        travelMode: google.maps.TravelMode[requestBody.travelMode]
    };
    
    // Add departure time if specified
    if (requestBody.departureTime) {
        const travelMode = google.maps.TravelMode[requestBody.travelMode];
        
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
                strokeColor: rentalColor || getRandomColor(),
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
            console.log("Mock route successful:", rentalLabel, officeLabel, duration, distance);
            displayRouteInfo(rentalLabel, officeLabel, duration, distance, additionalInfo, rentalColor);
        } else {
            console.error("Mock route error:", status, "for", rentalLabel, "to", officeLabel);
            displayRouteError(rentalLabel, officeLabel, `Could not calculate route: ${status}`);
        }
    });
}

// Display route information in the results panel
function displayRouteInfo(rentalLabel, officeLabel, duration, distance, additionalInfo = '', rentalColor = null) {
    const resultsContainer = document.getElementById('commute-results');
    const resultDiv = document.createElement('div');
    resultDiv.className = 'commute-result';
    
    // Add a colored indicator if a color is provided
    const colorStyle = rentalColor ? 
        `border-left: 3px solid ${rentalColor}; padding-left: 10px;` : 
        '';
    
    resultDiv.innerHTML = `
        <div style="${colorStyle}">
        <strong>${rentalLabel} to ${officeLabel}</strong><br>
        Commute time: ${duration}<br>
        Distance: ${distance}${additionalInfo ? additionalInfo : ''}
        </div>
    `;
    resultsContainer.appendChild(resultDiv);
}

// Display route error in the results panel
function displayRouteError(rentalLabel, officeLabel, errorMessage) {
    const resultsContainer = document.getElementById('commute-results');
    const resultDiv = document.createElement('div');
    resultDiv.className = 'commute-result error';
    resultDiv.innerHTML = `
        <strong>${rentalLabel} to ${officeLabel}</strong><br>
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
// Note: This is kept for backward compatibility but no longer used for labels
function formatMarkerLabel(address) {
    // If it's already a short label like "Destination", return as is
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
// Note: This is kept for backward compatibility but no longer used for labels
function formatResultLabel(address) {
    // If it's already a short label like "Destination", return as is
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

// Helper function to show location notifications
function showLocationNotification(message, isError = false) {
    // Remove any existing notification
    const existingNotification = document.querySelector('.location-notification');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    // Create new notification
    const notification = document.createElement('div');
    notification.className = `location-notification${isError ? ' error' : ''}`;
    notification.textContent = message;
    
    // Add to map container
    document.getElementById('map-container').appendChild(notification);
    
    // Remove after 5 seconds (animation will fade it out first)
    setTimeout(() => {
        notification.remove();
    }, 5000);
} 