// Theme toggle functionality
document.addEventListener('DOMContentLoaded', () => {
    const themeSwitch = document.getElementById('theme-switch');
    
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    
    themeSwitch.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
    });
});

// Prevent form submission
document.getElementById('search-form').addEventListener('submit', (e) => {
    e.preventDefault();
});

// Form validation
function validateForm() {
    const input = inputField.value.trim();
    if (input === '' || foodTypeSelect.selectedIndex === 0) {
        window.alert('Please enter an address and select a food type.');
        return false;
    }
    return true;
}

var currLat;
var currLong;
var usingCoords = false;

document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const checkBtn = document.getElementById('check-btn');
    const clearBtn = document.getElementById('clear-btn');
    const input = document.getElementById('input');
    const radiusInput = document.getElementById('radius');
    const resultsList = document.getElementById('shops-list');
    const resultsCount = document.getElementById('results-count');
    const coordsearch = document.getElementById('coordsearch');
    const addressInput = document.getElementById('address-input');
    const coordinatesInput = document.getElementById('coordinates-input');
    const foodTypeSelect = document.getElementById('foodType');
    const unitToggle = document.getElementById('unit-toggle');

    // Initialize visibility state
    addressInput.classList.remove('hidden');
    coordinatesInput.classList.add('hidden');

    // Toggle between address and coordinates inputs
    coordsearch.addEventListener('change', (e) => {
        if (e.target.checked) {
            addressInput.classList.add('hidden');
            coordinatesInput.classList.remove('hidden');
            input.value = ''; // Clear address input
        } else {
            addressInput.classList.remove('hidden');
            coordinatesInput.classList.add('hidden');
            document.getElementById('lat').value = ''; // Clear coordinate inputs
            document.getElementById('long').value = '';
        }
    });

    // Clear button functionality
    clearBtn.addEventListener('click', () => {
        input.value = '';
        radiusInput.value = '';
        document.getElementById('lat').value = '';
        document.getElementById('long').value = '';
        foodTypeSelect.selectedIndex = 0;
        resultsList.innerHTML = 'Results will go here...';
        coordsearch.checked = false;
        // Reset visibility
        addressInput.classList.remove('hidden');
        coordinatesInput.classList.add('hidden');
    });

    // Unit conversion functions
    function kmToMiles(km) {
        return km * 0.621371;
    }

    function milesToKm(miles) {
        return miles * 1.60934;
    }

    // Update radius placeholder based on unit selection
    unitToggle.addEventListener('change', (e) => {
        const isImperial = e.target.checked;
        radiusInput.placeholder = `Enter the search radius (${isImperial ? 'miles' : 'km'})`;
        
        // Convert existing value if present
        if (radiusInput.value) {
            radiusInput.value = isImperial ? 
                kmToMiles(parseFloat(radiusInput.value)).toFixed(1) : 
                milesToKm(parseFloat(radiusInput.value)).toFixed(1);
        }
    });

    async function findCoordinates(address) {
        try {
            const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`);
            if (!response.ok) throw new Error('Network response was not ok');
            const data = await response.json();
            
            if (data.length > 0) {
                return [data[0].lat, data[0].lon];
            }
            throw new Error('No coordinates found');
        } catch (error) {
            console.error('Error:', error);
            showError('Could not find location. Please check the address.');
            return null;
        }
    }

    async function findNearbyShops(lat, lon, radius) {
        const foodType = document.getElementById('foodType').value.toLowerCase();
        // Convert radius to km if it's in miles
        const radiusKm = unitToggle.checked ? milesToKm(radius) : radius;
        const radiusMeters = radiusKm * 1000;
        
        // Map food types to Overpass API tags
        const foodTypeQueries = {
            'sandwich': '["cuisine"="sandwich"]',
            'seafood': '["cuisine"~"seafood|sushi|fish"]',
            'salad': '["cuisine"~"salad|healthy"]',
            'pizza': '["cuisine"="pizza"]',
            'icecream': '["cuisine"="ice_cream"]',
            'burger': '["cuisine"="burger"]',
            'chicken': '["cuisine"~"chicken|wings"]',
            'coffee shop': '["amenity"="cafe"]',
            'donut': '["shop"="donut"]["cuisine"="donut"]',
            'bakery': '["shop"="bakery"]'
        };

        try {
            const query = `
                [out:json][timeout:25];
                (
                    // Search by cuisine tag
                    node${foodTypeQueries[foodType] || '["cuisine"~"' + foodType + '"]'}(around:${radiusMeters},${lat},${lon});
                    // Also search by shop type
                    node["shop"="${foodType}"](around:${radiusMeters},${lat},${lon});
                    // And by amenity for certain types
                    node["amenity"="restaurant"]["cuisine"~"${foodType}"](around:${radiusMeters},${lat},${lon});
                );
                out body;`;

            const response = await fetch('https://overpass-api.de/api/interpreter', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: 'data=' + encodeURIComponent(query)
            });

            if (!response.ok) throw new Error('Network response was not ok');
            const data = await response.json();
            return data.elements;
        } catch (error) {
            console.error('Error:', error);
            showError('Error fetching nearby locations. Please try again.');
            return [];
        }
    }

    function showError(message) {
        resultsList.innerHTML = `<li class="error">${message}</li>`;
        resultsCount.textContent = `Error: ${message}`;
    }

    function formatAddress(tags) {
        const parts = [];
        
        if (tags["addr:housenumber"]) parts.push(tags["addr:housenumber"]);
        if (tags["addr:street"]) parts.push(tags["addr:street"]);
        if (tags["addr:city"]) parts.push(tags["addr:city"]);
        if (tags["addr:state"]) parts.push(tags["addr:state"]);
        
        return parts.length > 0 ? parts.join(', ') : 'Address not available';
    }

    function showResults(shops) {
        resultsList.innerHTML = '';
        resultsCount.textContent = `Found ${shops.length} Results`;

        if (shops.length === 0) {
            resultsList.innerHTML = '<li>No shops found in this area.</li>';
            return;
        }

        const isImperial = unitToggle.checked;
        
        shops.forEach((shop, index) => {
            const name = shop.tags.name || 'Unnamed Location';
            const type = shop.tags.amenity || shop.tags.shop || 'Restaurant';
            const address = formatAddress(shop.tags);
            let distance = haversineDistance(currLat, currLong, shop.lat, shop.lon);
            
            // Convert distance if using imperial units
            if (isImperial) {
                distance = kmToMiles(distance);
            }
            
            // Format distance to handle NaN
            const formattedDistance = isNaN(distance) ? 
                'Distance unavailable' : 
                `${distance.toFixed(1)} ${isImperial ? 'miles' : 'km'}`;

            const li = document.createElement('li');
            li.innerHTML = `
                <strong>${index + 1}. ${name}</strong>
                <br>Type: ${type}
                <br>Address: ${address}
                <br>Distance: ${formattedDistance}
            `;
            resultsList.appendChild(li);
        });
    }

    checkBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        const isUsingCoords = coordsearch.checked;
        let isValid = false;
        let coords;

        if (isUsingCoords) {
            const lat = document.getElementById('lat').value.trim();
            const long = document.getElementById('long').value.trim();
            if (lat && long) {
                coords = [lat, long];
                isValid = true;
            } else {
                showError('Please enter both latitude and longitude');
            }
        } else {
            const address = input.value.trim();
            if (address) {
                coords = await findCoordinates(address);
                isValid = coords !== null;
            } else {
                showError('Please enter an address');
            }
        }

        if (isValid && coords) {
            const radius = parseFloat(radiusInput.value) || (unitToggle.checked ? 3.1 : 5); // Default to 5km or ~3.1 miles
            currLat = coords[0]; // Set current latitude
            currLong = coords[1]; // Set current longitude
            const shops = await findNearbyShops(coords[0], coords[1], radius);
            shops.sort((a, b) => {
                const distanceA = haversineDistance(currLat, currLong, a.lat, a.lon);
                const distanceB = haversineDistance(currLat, currLong, b.lat, b.lon);
                return distanceA - distanceB;
            });
            showResults(shops);
        }
    });
});

function haversineDistance(lat1, lon1, lat2, lon2) {
    const toRad = angle => (angle * Math.PI) / 180;
    const R = 6371; // Earth km radius

    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Returns km distance
}

