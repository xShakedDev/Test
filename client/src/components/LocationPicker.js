import React, { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents, Polyline, Circle } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default marker icon in React-Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

const LocationMarker = ({ position, setPosition }) => {
  useMapEvents({
    click(e) {
      setPosition(e.latlng);
    },
  });

  return position === null ? null : (
    <Marker position={position}></Marker>
  );
};

const UserLocationMarker = ({ position, accuracy }) => {
  const icon = L.divIcon({
    className: 'user-location-marker',
    html: '<div style="background-color: #3b82f6; width: 14px; height: 14px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 8px rgba(0,0,0,0.4);"></div>',
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });

  return position ? (
    <>
      <Marker position={position} icon={icon} interactive={false} title="המיקום שלך" />
      {accuracy && <Circle center={position} radius={accuracy} pathOptions={{ color: '#3b82f6', weight: 1, opacity: 0.4, fillOpacity: 0.1 }} />}
    </>
  ) : null;
};

const MapController = ({ center, shouldFlyTo, onFlyToComplete }) => {
  const map = useMap();
  
  useEffect(() => {
    if (center && shouldFlyTo) {
      map.flyTo(center, 16);
      onFlyToComplete();
    }
  }, [center, shouldFlyTo, map, onFlyToComplete]);
  
  return null;
};

const LocationPicker = ({ initialLocation, onLocationSelect, userLocation }) => {
  const [position, setPosition] = useState(initialLocation || null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [shouldFlyTo, setShouldFlyTo] = useState(!!initialLocation);

  const defaultCenter = useMemo(() => ({ lat: 32.0853, lng: 34.7818 }), []); // Tel Aviv center as default

  useEffect(() => {
    if (initialLocation) {
      setPosition(initialLocation);
      // Don't fly to initial location automatically to avoid jumping on edit load if not desired,
      // but usually we do want to show the location. Let's keep it false unless it changes.
    }
  }, [initialLocation]);

  const handlePositionChange = (newPos) => {
    setPosition(newPos);
    onLocationSelect(newPos);
    // Do NOT set shouldFlyTo here, as this is called from map click
  };

  const handleSearch = async (e) => {
    // If called from form submit
    if (e && e.preventDefault) e.preventDefault();
    
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setSearchError('');
    setSearchResults([]);

    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=5`);
      const data = await response.json();

      if (data && data.length > 0) {
        if (data.length === 1) {
          const { lat, lon, display_name } = data[0];
          const newPos = { lat: parseFloat(lat), lng: parseFloat(lon), address: display_name };
          setPosition(newPos);
          onLocationSelect(newPos);
          setShouldFlyTo(true); // Fly to searched location
        } else {
          setSearchResults(data);
        }
      } else {
        setSearchError('לא נמצאו תוצאות');
      }
    } catch (error) {
      console.error('Search error:', error);
      setSearchError('שגיאה בחיפוש');
    } finally {
      setIsSearching(false);
    }
  };

  const selectResult = (result) => {
    const { lat, lon, display_name } = result;
    const newPos = { lat: parseFloat(lat), lng: parseFloat(lon), address: display_name };
    setPosition(newPos);
    onLocationSelect(newPos);
    setSearchResults([]);
    setSearchQuery(display_name);
    setShouldFlyTo(true); // Fly to selected result
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault(); // Prevent form submission if inside a form
      handleSearch();
    }
  };

  return (
    <div className="location-picker-container">
      <div className="location-search">
        <div className="search-form">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="חפש כתובת או עיר..."
            className="location-search-input"
          />
          <button 
            type="button" 
            onClick={handleSearch} 
            disabled={isSearching} 
            className="btn btn-primary"
          >
            {isSearching ? 'מחפש...' : 'חפש'}
          </button>
        </div>
        {searchError && <div className="search-error">{searchError}</div>}
        
        {searchResults.length > 0 && (
          <ul className="search-results">
            {searchResults.map((result, index) => (
              <li key={index} onClick={() => selectResult(result)}>
                {result.display_name}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="map-container" style={{ height: '300px', width: '100%', borderRadius: '8px', overflow: 'hidden', marginTop: '10px', border: '1px solid #ddd' }}>
        <MapContainer center={position || defaultCenter} zoom={13} scrollWheelZoom={true} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <LocationMarker position={position} setPosition={handlePositionChange} />
          {userLocation && (
            <UserLocationMarker 
              position={{ lat: userLocation.latitude, lng: userLocation.longitude }}
              accuracy={userLocation.accuracy}
            />
          )}
          {userLocation && position && typeof position.lat === 'number' && typeof position.lng === 'number' && (
            <Polyline 
              positions={[
                [userLocation.latitude, userLocation.longitude],
                [position.lat, position.lng]
              ]}
              color="#3b82f6"
              dashArray="10, 10"
              opacity={0.6}
            />
          )}
          <MapController 
            center={position} 
            shouldFlyTo={shouldFlyTo} 
            onFlyToComplete={() => setShouldFlyTo(false)} 
          />
        </MapContainer>
      </div>
      
      <div className="location-info" style={{ marginTop: '10px', fontSize: '0.9rem', color: '#666' }}>
        {position && typeof position.lat === 'number' && typeof position.lng === 'number' ? (
          <>
            <strong>מיקום נבחר:</strong> {position.lat.toFixed(5)}, {position.lng.toFixed(5)}
            {position.address && <div><small>{position.address}</small></div>}
          </>
        ) : (
          'לחץ על המפה לבחירת מיקום'
        )}
      </div>
    </div>
  );
};

export default LocationPicker;

