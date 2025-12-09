import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import GateHistory from './GateHistory';
import CallerIdValidation from './CallerIdValidation';
import LocationPicker from './LocationPicker'; // Import LocationPicker
import { MapContainer, TileLayer, Marker, Popup, useMap, Circle, Polyline } from 'react-leaflet';
import L from 'leaflet';
import { isSessionExpired, handleSessionExpiration, authenticatedFetch } from '../utils/auth';

// Calculate distance between two points in meters (Haversine formula)
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

function formatDistance(meters) {
  if (meters < 1000) {
    return `${Math.round(meters)} מ'`;
  }
  return `${(meters / 1000).toFixed(1)} ק"מ`;
}

// Gate Icon for Map - using site logo
// Create icon once and reuse to prevent constant updates
let gateIconInstance = null;
const getGateIcon = () => {
  if (!gateIconInstance) {
    // Use absolute URL to ensure logo loads correctly on all platforms
    const logoUrl = `${window.location.origin}/logo.png`;
    gateIconInstance = L.divIcon({
      className: 'gate-map-icon',
      html: `<div style="background-color: white; width: 32px; height: 32px; border-radius: 50%; border: 1px solid #000000; display: flex; align-items: center; justify-content: center; padding: 2px; box-shadow: 0 2px 4px rgba(0,0,0,0.3); position: relative; overflow: hidden; cursor: pointer; pointer-events: auto;"><img src="${logoUrl}" alt="Gate" style="width: 28px; height: 28px; object-fit: contain; display: block; pointer-events: none;" onerror="this.style.display='none'; this.parentElement.style.backgroundColor='#2563eb';" /></div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });
  }
  return gateIconInstance;
};

// Map Controller to fit bounds - only once on initial load
const GatesMapController = ({ gates, userLocation, initialFitDone, setInitialFitDone }) => {
  const map = useMap();
  const hasFittedRef = useRef(false);
  
  useEffect(() => {
    // Only fit bounds once on initial load - never again
    if (hasFittedRef.current || initialFitDone) return;
    
    if (gates.length === 0) return;
    
    const gatesWithLocation = gates.filter(g => g.location && g.location.latitude && g.location.longitude);
    if (gatesWithLocation.length === 0) return;
    
    const bounds = gatesWithLocation.map(g => [g.location.latitude, g.location.longitude]);
    if (userLocation) {
      bounds.push([userLocation.latitude, userLocation.longitude]);
    }
    
    if (bounds.length > 0) {
      // Small delay to ensure map is fully loaded
      setTimeout(() => {
        if (!hasFittedRef.current) {
          map.fitBounds(bounds, { padding: [50, 50] });
          hasFittedRef.current = true;
          if (setInitialFitDone) setInitialFitDone(true);
        }
      }, 100);
    }
  }, [gates, userLocation, initialFitDone, map, setInitialFitDone]); // Dependencies included, but hasFittedRef ensures it only runs once
  
  return null;
};

// Gates Map View Component
const GatesMapView = ({ gates, userLocation, onGateClick, handleOpenGateClick, cooldowns, isSubmitting, autoOpenedGates }) => {
  const [initialFitDone, setInitialFitDone] = useState(false);
  const [selectedGateForRoute, setSelectedGateForRoute] = useState(null);
  const [routeCoordinates, setRouteCoordinates] = useState([]);
  const fetchingRouteRef = useRef(false);
  const fetchTimeoutRef = useRef(null);
  const gatesWithLocation = gates.filter(g => g.location && g.location.latitude && g.location.longitude);
  const defaultCenter = { lat: 32.0853, lng: 34.7818 }; // Tel Aviv center as default
  
  const center = gatesWithLocation.length > 0 
    ? { lat: gatesWithLocation[0].location.latitude, lng: gatesWithLocation[0].location.longitude }
    : defaultCenter;

  // Fetch route when gate is selected
  useEffect(() => {
    if (!selectedGateForRoute || !userLocation) {
      setRouteCoordinates([]);
      return;
    }

    // Clear any pending timeout
    if (fetchTimeoutRef.current) {
      clearTimeout(fetchTimeoutRef.current);
    }

    // Debounce the fetch to avoid rapid re-fetching
    fetchTimeoutRef.current = setTimeout(() => {
      // Prevent concurrent requests
      if (fetchingRouteRef.current) {
        return;
      }

      const fetchRoute = async () => {
        fetchingRouteRef.current = true;
        
        try {
          const url = `https://router.project-osrm.org/route/v1/driving/${userLocation.longitude},${userLocation.latitude};${selectedGateForRoute.location.longitude},${selectedGateForRoute.location.latitude}?overview=full&geometries=geojson`;
          
          // Create a fetch with timeout (5 seconds)
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000);
          
          try {
            const response = await fetch(url, { signal: controller.signal });
            clearTimeout(timeoutId);
            
            if (!response.ok) {
              throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
              const coordinates = data.routes[0].geometry.coordinates.map(coord => [coord[1], coord[0]]); // Convert [lng, lat] to [lat, lng]
              setRouteCoordinates(coordinates);
            } else {
              // Fallback to straight line if route fails
              setRouteCoordinates([
                [userLocation.latitude, userLocation.longitude],
                [selectedGateForRoute.location.latitude, selectedGateForRoute.location.longitude]
              ]);
            }
          } catch (fetchError) {
            clearTimeout(timeoutId);
            
            // Only log non-abort errors (timeouts are expected when service is unavailable)
            if (fetchError.name !== 'AbortError') {
              // Silently fallback - user will see straight line route
            }
            
            // Fallback to straight line on error (timeout, network error, etc.)
            setRouteCoordinates([
              [userLocation.latitude, userLocation.longitude],
              [selectedGateForRoute.location.latitude, selectedGateForRoute.location.longitude]
            ]);
          }
        } catch (error) {
          // Fallback to straight line on any other error
          setRouteCoordinates([
            [userLocation.latitude, userLocation.longitude],
            [selectedGateForRoute.location.latitude, selectedGateForRoute.location.longitude]
          ]);
        } finally {
          fetchingRouteRef.current = false;
        }
      };

      fetchRoute();
    }, 300); // 300ms debounce

    // Cleanup function
    return () => {
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
    };
  }, [selectedGateForRoute, userLocation]);

  return (
    <div style={{ width: '100%', height: '100%', borderRadius: '12px', overflow: 'hidden', border: '1px solid #e5e7eb' }}>
      <MapContainer 
        center={center} 
        zoom={13} 
        scrollWheelZoom={true} 
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {/* User Location Marker */}
        {userLocation && (
          <>
            <Marker 
              position={[userLocation.latitude, userLocation.longitude]}
              icon={L.divIcon({
                className: 'user-location-marker',
                html: '<div style="background-color: #3b82f6; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 10px rgba(0,0,0,0.4);"></div>',
                iconSize: [20, 20],
                iconAnchor: [10, 10],
              })}
            >
              <Popup>
                <div style={{ textAlign: 'right', direction: 'rtl' }}>
                  <strong>המיקום שלך</strong>
                </div>
              </Popup>
            </Marker>
            {userLocation.accuracy && (
              <Circle 
                center={[userLocation.latitude, userLocation.longitude]} 
                radius={userLocation.accuracy} 
                pathOptions={{ color: '#3b82f6', weight: 1, opacity: 0.4, fillOpacity: 0.1 }} 
              />
            )}
          </>
        )}
        
        {/* Gate Markers */}
        {gatesWithLocation.map(gate => {
          const distance = userLocation 
            ? calculateDistance(
                userLocation.latitude,
                userLocation.longitude,
                gate.location.latitude,
                gate.location.longitude
              )
            : null;
          
          return (
            <Marker
              key={gate.id}
              position={[gate.location.latitude, gate.location.longitude]}
              icon={getGateIcon()}
              eventHandlers={{
                click: (e) => {
                  // Prevent event bubbling and default behavior using Leaflet's method
                  L.DomEvent.stop(e.originalEvent || e);
                  
                  // Set selected gate for route display
                  setSelectedGateForRoute(gate);
                  
                  // Open popup without panning the map
                  const marker = e.target;
                  if (marker) {
                    // Close any other open popups first
                    const map = marker._map;
                    if (map) {
                      map.closePopup();
                    }
                    
                    // Use setTimeout to ensure marker is ready and map is updated
                    setTimeout(() => {
                      if (marker && typeof marker.openPopup === 'function') {
                        try {
                          marker.openPopup();
                        } catch (err) {
                          console.error('Error opening popup:', err);
                          // Fallback: try opening popup directly
                          if (marker._popup) {
                            marker._popup.openOn(marker._map);
                          }
                        }
                      }
                    }, 50);
                  }
                  // Note: onGateClick is only called from the "View Details" button in the popup, not here
                },
                mousedown: (e) => {
                  // Prevent map drag when clicking marker
                  if (e.originalEvent) {
                    e.originalEvent.stopPropagation();
                  }
                }
              }}
            >
              <Popup autoPan={false} closeOnClick={false}>
                <div style={{ textAlign: 'right', direction: 'rtl', minWidth: '150px' }} className="leaflet-popup-content-wrapper-fixed">
                  <strong style={{ fontSize: '1.1rem', marginBottom: '0.5rem', display: 'block' }}>
                    {gate.name}
                  </strong>
                  {distance !== null && (
                    <div style={{ color: '#2563eb', marginTop: '0.5rem', marginBottom: '0.5rem' }}>
                      מרחק: {formatDistance(distance)}
                    </div>
                  )}
                  {gate.location.address && (
                    <div style={{ fontSize: '0.85rem', color: '#666', marginTop: '0.5rem', marginBottom: '0.5rem' }}>
                      {gate.location.address}
                    </div>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.75rem' }}>
                    {/* Open Gate Button */}
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation(); // Prevent popup from closing
                        if (handleOpenGateClick) {
                          handleOpenGateClick(gate);
                        }
                      }}
                      onTouchStart={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      onTouchEnd={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (handleOpenGateClick) {
                          handleOpenGateClick(gate);
                        }
                      }}
                      disabled={(() => {
                        return isSubmitting || cooldowns[gate.id];
                      })()}
                      style={{
                        width: '100%',
                        padding: '0.75rem 1rem',
                        backgroundColor: (() => {
                          return cooldowns[gate.id] ? '#9ca3af' : '#2563eb';
                        })(),
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: (() => {
                          return isSubmitting || cooldowns[gate.id] ? 'not-allowed' : 'pointer';
                        })(),
                        fontSize: '0.9rem',
                        fontWeight: '500',
                        transition: 'background-color 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem',
                        opacity: (() => {
                          return isSubmitting || cooldowns[gate.id] ? 0.6 : 1;
                        })(),
                        touchAction: 'manipulation',
                        WebkitTapHighlightColor: 'transparent',
                        zIndex: 1000,
                        position: 'relative'
                      }}
                      onMouseEnter={(e) => {
                        if (!isSubmitting && !cooldowns[gate.id]) {
                          e.currentTarget.style.backgroundColor = '#1d4ed8';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isSubmitting && !cooldowns[gate.id]) {
                          e.currentTarget.style.backgroundColor = '#2563eb';
                        }
                      }}
                    >
                      {isSubmitting ? (
                        <>
                          <div className="loading-spinner-small" style={{ width: '14px', height: '14px' }}></div>
                          <span>פותח...</span>
                        </>
                      ) : (() => {
                        const gateId = gate._id || gate.id;
                        if (cooldowns[gate.id]) {
                          return (
                            <>
                              <svg style={{ width: '16px', height: '16px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <span>אנא המתן {cooldowns[gate.id]} שניות</span>
                            </>
                          );
                        } else if (autoOpenedGates?.[gateId]) {
                          return (
                            <>
                              <svg style={{ width: '16px', height: '16px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                              </svg>
                              <span>פתח ידנית (נפתח אוטומטית)</span>
                            </>
                          );
                        } else {
                          return (
                            <>
                              <svg style={{ width: '16px', height: '16px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                              </svg>
                              <span>פתח שער</span>
                            </>
                          );
                        }
                      })()}
                    </button>
                    
                    {/* View Details Button - Only show on mobile */}
                    {onGateClick && (
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setSelectedGateForRoute(gate);
                          if (onGateClick) onGateClick(gate);
                        }}
                        onTouchStart={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                        onTouchEnd={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setSelectedGateForRoute(gate);
                          if (onGateClick) onGateClick(gate);
                        }}
                      style={{
                        width: '100%',
                        padding: '0.5rem 1rem',
                        backgroundColor: 'transparent',
                        color: '#2563eb',
                        border: '1px solid #2563eb',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                        fontWeight: '500',
                        transition: 'background-color 0.2s',
                        touchAction: 'manipulation',
                        WebkitTapHighlightColor: 'transparent',
                        zIndex: 1000,
                        position: 'relative'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#eff6ff';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      פתח פרטים
                    </button>
                    )}
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
        
        {/* Route Polyline */}
        {routeCoordinates.length > 0 && userLocation && selectedGateForRoute && (
          <Polyline
            positions={routeCoordinates}
            pathOptions={{
              color: '#2563eb',
              weight: 4,
              opacity: 0.7,
              dashArray: '10, 10'
            }}
          />
        )}
        
        <GatesMapController 
          gates={gatesWithLocation} 
          userLocation={userLocation} 
          initialFitDone={initialFitDone}
          setInitialFitDone={setInitialFitDone}
        />
      </MapContainer>
    </div>
  );
};

// Sortable Gate Card Component
const SortableGateCard = ({ gate, user, isMobile, editingGate, newGateData, handleInputChange, handleLocationSelect, handleSubmit, handleCancel, isSubmitting, verifiedCallers, cooldowns, handleOpenGateClick, handleEdit, handleDelete, handleGateSelect, isEditMode, userLocation, toggleAutoOpen, autoOpenSettings, autoOpenedGates, handleUpdateAutoOpenRadius, autoOpenRadius }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: String(gate.id), disabled: !!editingGate || !isEditMode });

  // Local state for radius slider to prevent lag
  const gateId = gate._id || gate.id;
  const userRadius = autoOpenRadius?.[gateId] || gate.location?.autoOpenRadius || 50;
  const [localRadius, setLocalRadius] = useState(userRadius);
  
  // Update local radius when user settings or gate prop changes
  useEffect(() => {
    const newRadius = autoOpenRadius?.[gateId] || gate.location?.autoOpenRadius || 50;
    setLocalRadius(newRadius);
  }, [autoOpenRadius, gateId, gate.location?.autoOpenRadius]);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    cursor: isMobile ? 'pointer' : 'default',
  };

  // Format distance helper
  const getDistanceText = () => {
    if (!userLocation || !gate.location || !gate.location.latitude) return null;
    
    const distance = calculateDistance(
      userLocation.latitude,
      userLocation.longitude,
      gate.location.latitude,
      gate.location.longitude
    );
    
    return formatDistance(distance);
  };
  
  const distanceText = getDistanceText();

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`gate-card ${isMobile ? 'gate-card-mobile' : ''} ${isDragging ? 'gate-card-dragging' : ''}`}
      onClick={isMobile ? () => handleGateSelect(gate) : undefined}
    >
      {isMobile ? (
        // Mobile: Compact card with just gate name
        <div className="gate-card-mobile-content">
          {/* Row 1: Drag handle - Only show in edit mode */}
          {isEditMode && (
            <div
              className="gate-drag-handle-mobile"
              {...attributes}
              {...listeners}
              onClick={(e) => e.stopPropagation()}
              onTouchStart={(e) => {
                e.stopPropagation();
                // Prevent scrolling while dragging
                document.body.style.overflow = 'hidden';
              }}
              onTouchEnd={(e) => {
                e.stopPropagation();
                // Re-enable scrolling after drag
                document.body.style.overflow = '';
              }}
            >
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
              </svg>
            </div>
          )}

          {/* Row 2: Gate name */}
          <div style={{ display: 'flex', flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'center', width: '100%' }}>
            <h3 style={{ margin: 0, lineHeight: '1.4', fontSize: '1.1rem', fontWeight: '600', color: 'var(--color-gray-900)', textAlign: 'center' }}>{gate.name}</h3>
          </div>

          {/* Row 3: Distance */}
          {distanceText && (
            <div style={{ display: 'flex', flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'center', width: '100%' }}>
              <span style={{ 
                fontSize: '0.75rem', 
                color: '#2563eb', 
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.25rem',
                fontWeight: '600'
              }}>
                <svg style={{ width: '12px', height: '12px', flexShrink: 0 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {distanceText}
              </span>
            </div>
          )}

          {/* Row 4: Icon + Open Button + Arrow */}
          {isMobile && (
            <div className="gate-bottom-row-mobile" style={{ justifyContent: 'center', alignItems: 'center', width: '100%', gap: '0.5rem' }}>
              <svg className="gate-icon-mobile" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
              </svg>
              <div className="gate-status" style={{ flex: 1, display: 'flex', justifyContent: 'center', maxWidth: '100%' }}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenGateClick(gate);
                  }}
                  disabled={(() => {
                    return isSubmitting || cooldowns[gate.id];
                  })()}
                  style={{
                    width: '100%',
                    padding: '0.5rem 1rem',
                    fontSize: '0.85rem',
                    backgroundColor: (() => {
                      return cooldowns[gate.id] ? '#9ca3af' : '#2563eb';
                    })(),
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: (() => {
                      return isSubmitting || cooldowns[gate.id] ? 'not-allowed' : 'pointer';
                    })(),
                    fontWeight: '600',
                    opacity: (() => {
                      return isSubmitting || cooldowns[gate.id] ? 0.6 : 1;
                    })()
                  }}
                >
                  {isSubmitting ? 'פותח...' : (() => {
                    const gateId = gate._id || gate.id;
                    if (cooldowns[gate.id]) {
                      return `${cooldowns[gate.id]}s`;
                    } else if (autoOpenedGates?.[gateId]) {
                      return 'נפתח';
                    } else {
                      return 'פתח';
                    }
                  })()}
                </button>
              </div>
              <div className="gate-arrow" style={{ flexShrink: 0 }}>
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          )}
        </div>
      ) : (
        // Desktop: Full card (edit form is shown outside the grid, only on mobile it's inline)
        <>
          {editingGate && editingGate.id === gate.id && isMobile ? (
            <div className="form-container" onClick={(e) => e.stopPropagation()}>
              <div className="gate-edit-header">
                <h3>ערוך שער</h3>
              </div>
              <form onSubmit={handleSubmit}>
                <div className="form-grid">
                  <div className="form-group">
                    <label htmlFor="name">שם השער:</label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      className="form-input"
                      value={newGateData.name}
                      onChange={handleInputChange}
                      required
                      disabled={isSubmitting}
                    />
                    <small>שם ייחודי לזיהוי השער במערכת</small>
                  </div>

                  <div className="form-group">
                    <label htmlFor="phoneNumber">מספר טלפון:</label>
                    <input
                      type="tel"
                      id="phoneNumber"
                      name="phoneNumber"
                      className="form-input"
                      value={newGateData.phoneNumber}
                      onChange={handleInputChange}
                      required
                      disabled={isSubmitting}
                    />
                    <small>מספר הטלפון של השער (למשל: 03-1234567)</small>
                  </div>

                  <div className="form-group">
                    <label htmlFor="authorizedNumber">מספר מורשה:</label>
                    <select
                      id="authorizedNumber"
                      name="authorizedNumber"
                      className="form-select"
                      value={newGateData.authorizedNumber}
                      onChange={handleInputChange}
                      required
                      disabled={isSubmitting}
                    >
                      <option value="">בחר מספר מורשה</option>
                      {verifiedCallers.map(caller => (
                        <option key={caller.phoneNumber} value={caller.phoneNumber}>
                          {caller.phoneNumber} {caller.friendlyName ? `(${caller.friendlyName})` : ''}
                        </option>
                      ))}
                    </select>
                    <small>בחר מספר טלפון מורשה מ-Twilio לפתיחת השער</small>
                  </div>

                  <div className="form-group">
                    <label htmlFor="password">סיסמה (אופציונלי)</label>
                    <input
                      type="password"
                      id="password"
                      name="password"
                      className="form-input"
                      value={newGateData.password}
                      onChange={handleInputChange}
                      disabled={isSubmitting}
                    />
                    <small>סיסמה להגנה על השער (ריק = ללא הגנה)</small>
                  </div>

                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label>מיקום השער (אופציונלי)</label>
                    <small>לחץ על המפה או חפש כתובת לבחירת מיקום לפתיחה אוטומטית</small>
                  </div>
                </div>
                <div className="location-picker-wrapper" style={{ gridColumn: '1 / -1', marginTop: '0.5rem' }}>
                  <LocationPicker
                    initialLocation={newGateData.location ? { lat: newGateData.location.latitude, lng: newGateData.location.longitude, address: newGateData.location.address } : null}
                    onLocationSelect={handleLocationSelect}
                    userLocation={userLocation}
                  />
                </div>

                <div className="form-actions">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handleCancel(); }}
                    className="btn btn-secondary"
                    disabled={isSubmitting}
                  >
                    ביטול
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? 'שומר...' : 'עדכן'}
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <>
              <div className="gate-header">
                <h3>{gate.name}</h3>
                <div className="gate-actions-header">
                  {isEditMode && (
                    <div
                      className="gate-drag-handle"
                      {...attributes}
                      {...listeners}
                      title="גרור לשינוי סדר"
                      onClick={(e) => e.stopPropagation()}
                      onMouseDown={(e) => {
                        // Prevent scrolling while dragging
                        document.body.style.overflow = 'hidden';
                      }}
                      onMouseUp={(e) => {
                        // Re-enable scrolling after drag
                        document.body.style.overflow = '';
                      }}
                    >
                      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                      </svg>
                    </div>
                  )}
                  {user?.role === 'admin' && (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEdit(gate);
                        }}
                        className="btn btn-primary btn-small"
                      >
                        ערוך
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(gate.id, gate.name);
                        }}
                        className="btn btn-danger btn-small"
                      >
                        מחק
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="gate-info">
                <p><strong>מספר טלפון:</strong> {gate.phoneNumber}</p>
                {userLocation && gate.location && gate.location.latitude && (
                  <p><strong>מרחק:</strong> {formatDistance(calculateDistance(userLocation.latitude, userLocation.longitude, gate.location.latitude, gate.location.longitude))}</p>
                )}
              </div>

              <div className="gate-authorized">
                <h4>
                  <svg className="icon-small" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  מספר מורשה לפתיחה
                </h4>
                <div className="authorized-numbers">
                  <span className="authorized-number">
                    {user?.role === 'admin'
                      ? gate.authorizedNumber
                      : '***********'}
                  </span>
                </div>
              </div>

              {/* Gate Location Map - Desktop */}
              {gate.location && gate.location.latitude && gate.location.longitude && (
                <div style={{ marginBottom: '1rem', marginTop: '1rem' }}>
                  <h4 style={{ marginBottom: '0.5rem', fontSize: '0.95rem', fontWeight: '600', color: '#374151', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <svg style={{ width: '18px', height: '18px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                    </svg>
                    מיקום השער
                  </h4>
                  <div style={{ height: '200px', width: '100%', borderRadius: '8px', overflow: 'hidden', border: '1px solid #e5e7eb' }}>
                    <MapContainer
                      center={[gate.location.latitude, gate.location.longitude]}
                      zoom={15}
                      scrollWheelZoom={false}
                      style={{ height: '100%', width: '100%' }}
                      zoomControl={false}
                    >
                      <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      />
                      <Marker position={[gate.location.latitude, gate.location.longitude]} icon={getGateIcon()}>
                        <Popup>{gate.name}</Popup>
                      </Marker>
                    </MapContainer>
                  </div>
                </div>
              )}

              <div className="gate-actions">
                <div className="gate-open-section">
                  {/* Cooldown indicator */}
                  {cooldowns[gate.id] && (
                    <div className="cooldown-indicator">
                      <svg className="cooldown-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>אנא המתן {cooldowns[gate.id]} שניות לפני פתיחת השער שוב!</span>
                    </div>
                  )}
                  
                  {/* Auto-opened indicator */}
                  {(() => {
                    const gateId = gate._id || gate.id;
                    return autoOpenedGates[gateId] && !cooldowns[gate.id] ? (
                      <div className="cooldown-indicator" style={{ backgroundColor: '#eff6ff', color: '#1e40af', border: '1px solid #dbeafe' }}>
                        <svg className="cooldown-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        <span>השער נפתח אוטומטית - ניתן לפתוח ידנית</span>
                      </div>
                    ) : null;
                  })()}

                  {/* Auto Open Toggle - Desktop */}
                  {gate.location && gate.location.latitude && (
                    <>
                      <div className="auto-open-toggle" style={{ marginBottom: '1rem', padding: '1rem', background: '#f0f9ff', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <svg style={{ width: '20px', height: '20px', color: '#2563eb' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          <span style={{ fontWeight: '600', color: '#1e40af' }}>פתיחה אוטומטית בהגעה</span>
                        </div>
                        <label className="switch" style={{ position: 'relative', display: 'inline-block', width: '50px', height: '24px' }}>
                          <input 
                            type="checkbox" 
                            checked={!!autoOpenSettings[gate.id]} 
                            onChange={() => toggleAutoOpen(gate.id)}
                            style={{ opacity: 0, width: 0, height: 0 }}
                          />
                          <span className="slider round" style={{ 
                            position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0, 
                            backgroundColor: !!autoOpenSettings[gate.id] ? '#2563eb' : '#ccc', 
                            transition: '.4s', borderRadius: '34px' 
                          }}>
                            <span style={{ 
                              position: 'absolute', content: '""', height: '16px', width: '16px', 
                              left: !!autoOpenSettings[gate.id] ? '4px' : '30px', bottom: '4px', 
                              backgroundColor: 'white', transition: '.4s', borderRadius: '50%' 
                            }}></span>
                          </span>
                        </label>
                      </div>
                      
                      {/* Auto Open Radius Range Slider - Desktop */}
                      {!!autoOpenSettings[gate.id] && (
                        <div className="auto-open-radius-setting" style={{ marginBottom: '1rem', padding: '1rem', background: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                            <label style={{ fontWeight: '600', color: '#374151', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <svg style={{ width: '18px', height: '18px', color: '#6b7280' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                              </svg>
                              טווח פתיחה אוטומטית
                            </label>
                            <span style={{ fontWeight: '600', color: '#2563eb', fontSize: '1rem' }}>
                              {localRadius} מ'
                            </span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="1000"
                            step="10"
                            value={localRadius}
                            onChange={(e) => {
                              const newRadius = parseInt(e.target.value);
                              // Update local state immediately for responsive UI
                              setLocalRadius(newRadius);
                              // The handleUpdateAutoOpenRadius will update the server with debounce
                              handleUpdateAutoOpenRadius({
                                ...gate,
                                location: {
                                  ...gate.location,
                                  autoOpenRadius: newRadius
                                }
                              }, newRadius);
                            }}
                            style={{
                              width: '100%',
                              height: '8px',
                              borderRadius: '4px',
                              background: '#e5e7eb',
                              outline: 'none',
                              WebkitAppearance: 'none',
                              appearance: 'none'
                            }}
                          />
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', fontSize: '0.75rem', color: '#6b7280' }}>
                            <span>0 מ'</span>
                            <span>1000 מ'</span>
                          </div>
                          <small style={{ display: 'block', marginTop: '0.5rem', color: '#6b7280', fontSize: '0.8rem' }}>
                            השער יפתח אוטומטית כשתגיע למרחק של עד {localRadius} מטר מהשער
                          </small>
                        </div>
                      )}
                    </>
                  )}

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenGateClick(gate);
                    }}
                    disabled={(() => {
                      return isSubmitting || cooldowns[gate.id];
                    })()}
                    className={`btn ${(() => {
                      return cooldowns[gate.id] ? 'btn-secondary cooldown' : 'btn-primary';
                    })()} gate-open-btn`}
                  >
                    {isSubmitting ? (
                      <>
                        <div className="loading-spinner-small"></div>
                        <span>פותח...</span>
                      </>
                    ) : (() => {
                      const gateId = gate._id || gate.id;
                      if (cooldowns[gate.id]) {
                        return (
                          <>
                            <svg className="btn-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span>אנא המתן {cooldowns[gate.id]} שניות לפני פתיחת השער שוב!</span>
                          </>
                        );
                      } else if (autoOpenedGates[gateId]) {
                        return (
                          <>
                            <svg className="btn-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                            <span>פתח ידנית (נפתח אוטומטית)</span>
                          </>
                        );
                      } else {
                        return (
                          <>
                            <svg className="btn-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                            </svg>
                            <span>פתח שער</span>
                          </>
                        );
                      }
                    })()}
                  </button>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
};

const GateDashboard = ({ user, token }) => {
  const [gates, setGates] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [showAddGate, setShowAddGate] = useState(false);
  const [editingGate, setEditingGate] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showCallerIdValidation, setShowCallerIdValidation] = useState(false);
  const [newGateData, setNewGateData] = useState({
    name: '',
    phoneNumber: '',
    authorizedNumber: '',
    password: '',
    location: null,
    autoOpenRadius: 50 // Default 50 meters
  });
  const [verifiedCallers, setVerifiedCallers] = useState([]);
  const [cooldowns, setCooldowns] = useState({});
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [selectedGate, setSelectedGate] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [activeTab, setActiveTab] = useState('gates'); // 'gates' or 'map'
  const [settings, setSettings] = useState(null);
  const [userLocation, setUserLocation] = useState(null); // Add userLocation state
  const [locationPermissionRequested, setLocationPermissionRequested] = useState(false);
  const locationWatchIdRef = useRef(null); // Track watchPosition ID for cleanup
  
  // Auto-open settings and state
  const [autoOpenSettings, setAutoOpenSettings] = useState({});
  const [autoOpenRadius, setAutoOpenRadius] = useState({}); // Per-user radius settings
  const [autoOpenedGates, setAutoOpenedGates] = useState({}); // Track gates opened in current proximity session
  const [gatesInRangeState, setGatesInRangeState] = useState({}); // Track which gates user is currently in range of
  const [autoOpenNotification, setAutoOpenNotification] = useState(null); // Notification state
  const [showGateSelectionModal, setShowGateSelectionModal] = useState(false); // Modal for selecting gate when multiple are nearby
  const [nearbyGates, setNearbyGates] = useState([]); // Gates within range that need user selection
  const [pendingGateSelection, setPendingGateSelection] = useState(false); // Flag to prevent modal from showing repeatedly

  // Refs for scrolling to errors
  const errorRef = useRef(null);
  const successRef = useRef(null);
  
  // Refs to track state without causing re-renders (to prevent infinite loops)
  const gatesInRangeStateRef = useRef({});
  const showGateSelectionModalRef = useRef(false);
  const pendingGateSelectionRef = useRef(false);
  const autoOpenedGatesRef = useRef({}); // Track opened gates synchronously to prevent duplicate opens

  const toggleAutoOpen = async (gateId) => {
    const newSettings = {
      ...autoOpenSettings,
      [gateId]: !autoOpenSettings[gateId]
    };
    setAutoOpenSettings(newSettings);
    
    // Save to server
    try {
      const response = await authenticatedFetch('/api/auth/user/auto-open-settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          autoOpenSettings: newSettings
        })
      });

      if (!response.ok) {
        // Revert on error
        setAutoOpenSettings(autoOpenSettings);
        const data = await response.json();
        if (window.showSystemNotification) {
          window.showSystemNotification(`שגיאה בעדכון הגדרות: ${data.error || 'שגיאה לא ידועה'}`, 'error');
        }
      }
    } catch (error) {
      console.error('Error updating auto-open settings:', error);
      // Revert on error
      setAutoOpenSettings(autoOpenSettings);
      if (window.showSystemNotification) {
        window.showSystemNotification('שגיאת רשת בעדכון הגדרות', 'error');
      }
    }
  };

  const requestLocation = useCallback((showError = false) => {
    if (!navigator.geolocation) {
      if (showError) alert('הדפדפן שלך לא תומך במיקום');
      return;
    }

    setLocationPermissionRequested(true);
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy
        });
      },
      (error) => {
        console.error('Error getting user location:', error);
        if (showError) {
          let msg = 'שגיאה בקבלת מיקום:\n';
          switch(error.code) {
            case 1: // PERMISSION_DENIED
              msg += 'הגישה למיקום נחסמה. אנא בדוק את הגדרות הדפדפן ואשר גישה למיקום עבור אתר זה.';
              break;
            case 2: // POSITION_UNAVAILABLE
              msg += 'המיקום אינו זמין כרגע. וודא שה-GPS דלוק.';
              break;
            case 3: // TIMEOUT
              msg += 'הבקשה לקבלת מיקום לקחה יותר מדי זמן.';
              break;
            default:
              msg += error.message;
          }
          // Check for secure context issue (common on mobile)
          if (!window.isSecureContext && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
             msg += '\n\nשים לב: דפדפנים חוסמים גישה למיקום באתרים לא מאובטחים (HTTP). יש לגלוש דרך HTTPS או localhost.';
          }
          alert(msg);
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );

    // Also start watching for continuous updates
    // Clear any existing watch first
    if (locationWatchIdRef.current !== null) {
      navigator.geolocation.clearWatch(locationWatchIdRef.current);
    }
    
    locationWatchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        setUserLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy
        });
      },
      (error) => {
        console.error('Error watching user location:', error);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, []);

  // Try to get location automatically if permission already granted
  useEffect(() => {
    if (!navigator.geolocation || locationPermissionRequested) return;

    // Check if geolocation permission is already granted
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: 'geolocation' }).then((result) => {
        if (result.state === 'granted') {
          // Permission already granted, get location automatically
          setLocationPermissionRequested(true);
          navigator.geolocation.getCurrentPosition(
            (position) => {
              setUserLocation({
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy
              });
              
              // Start watching for continuous updates
              if (locationWatchIdRef.current !== null) {
                navigator.geolocation.clearWatch(locationWatchIdRef.current);
              }
              
              locationWatchIdRef.current = navigator.geolocation.watchPosition(
                (position) => {
                  setUserLocation({
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    accuracy: position.coords.accuracy
                  });
                },
                (error) => {
                  console.error('Error watching user location:', error);
                },
                { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
              );
            },
            (error) => {
              // Silent fail - permission might have been revoked
              console.log('Auto location request failed:', error.message);
            },
            { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
          );
        } else if (result.state === 'prompt') {
          // Permission not yet requested, but we can try (some browsers allow this)
          // Only try if it's a secure context
          if (window.isSecureContext || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            setLocationPermissionRequested(true);
            navigator.geolocation.getCurrentPosition(
              (position) => {
                setUserLocation({
                  latitude: position.coords.latitude,
                  longitude: position.coords.longitude,
                  accuracy: position.coords.accuracy
                });
                
                // Start watching for continuous updates
                if (locationWatchIdRef.current !== null) {
                  navigator.geolocation.clearWatch(locationWatchIdRef.current);
                }
                
                locationWatchIdRef.current = navigator.geolocation.watchPosition(
                  (position) => {
                    setUserLocation({
                      latitude: position.coords.latitude,
                      longitude: position.coords.longitude,
                      accuracy: position.coords.accuracy
                    });
                  },
                  (error) => {
                    console.error('Error watching user location:', error);
                  },
                  { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
                );
              },
              (error) => {
                // Silent fail - user might deny or it might not be available
                console.log('Auto location request failed:', error.message);
              },
              { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
            );
          }
        }
        // If state is 'denied', do nothing - wait for user action
      }).catch(() => {
        // Permissions API not supported, try anyway in secure context
        if (window.isSecureContext || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
          setLocationPermissionRequested(true);
          navigator.geolocation.getCurrentPosition(
            (position) => {
              setUserLocation({
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy
              });
              
              // Start watching for continuous updates
              if (locationWatchIdRef.current !== null) {
                navigator.geolocation.clearWatch(locationWatchIdRef.current);
              }
              
              locationWatchIdRef.current = navigator.geolocation.watchPosition(
                (position) => {
                  setUserLocation({
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    accuracy: position.coords.accuracy
                  });
                },
                (error) => {
                  console.error('Error watching user location:', error);
                },
                { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
              );
            },
            (error) => {
              // Silent fail
              console.log('Auto location request failed:', error.message);
            },
            { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
          );
        }
      });
    } else {
      // Permissions API not supported, try anyway in secure context
      if (window.isSecureContext || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        setLocationPermissionRequested(true);
        navigator.geolocation.getCurrentPosition(
          (position) => {
            setUserLocation({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy
            });
            
            // Start watching for continuous updates
            if (locationWatchIdRef.current !== null) {
              navigator.geolocation.clearWatch(locationWatchIdRef.current);
            }
            
            locationWatchIdRef.current = navigator.geolocation.watchPosition(
              (position) => {
                setUserLocation({
                  latitude: position.coords.latitude,
                  longitude: position.coords.longitude,
                  accuracy: position.coords.accuracy
                });
              },
              (error) => {
                console.error('Error watching user location:', error);
              },
              { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
            );
          },
          (error) => {
            // Silent fail
            console.log('Auto location request failed:', error.message);
          },
          { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
        );
      }
    }
  }, [locationPermissionRequested]);

  // Cleanup watchPosition on unmount
  useEffect(() => {
    return () => {
      if (locationWatchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(locationWatchIdRef.current);
      }
    };
  }, []);

  // Drag and drop sensors - use TouchSensor for mobile, PointerSensor for desktop
  const sensors = useSensors(
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 50, // Very short delay for immediate response
        tolerance: 10, // Allow more movement before canceling
      },
    }),
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Check if device is mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const fetchGates = useCallback(async () => {
    try {
      const response = await authenticatedFetch('/api/gates');

      if (response.ok) {
        const data = await response.json();
        setGates(data.gates || []);
        setError('');
      } else {
        const errorData = await response.json();
        if (isSessionExpired(errorData)) {
          handleSessionExpiration();
          return;
        }
        const msg = errorData.error || 'שגיאה בטעינת שערים';
        setError(msg);
        if (window.showSystemNotification) window.showSystemNotification(msg, 'error');
        scrollToMessage('error');
      }
    } catch (error) {
      console.error('Error fetching gates:', error);
      const msg = 'שגיאת רשת';
      setError(msg);
      if (window.showSystemNotification) window.showSystemNotification(msg, 'error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchVerifiedCallers = useCallback(async () => {
    try {
      const response = await authenticatedFetch('/api/twilio/verified-callers');

      if (response.ok) {
        const data = await response.json();
        setVerifiedCallers(data.callerIds || []);
      } else {
        const errorData = await response.json();
        console.error('Error fetching verified callers:', errorData);
      }
    } catch (error) {
      console.error('Error fetching verified callers:', error);
    }
  }, []);

  useEffect(() => {
    fetchGates();
    if (user?.role === 'admin') {
      fetchVerifiedCallers();
    }
  }, [fetchGates, fetchVerifiedCallers, user]);

  // Auto-refresh functionality based on admin settings
  useEffect(() => {
    let refreshInterval;

    const setupAutoRefresh = async () => {
      try {
        const response = await authenticatedFetch('/api/settings/current');
        if (response.ok) {
          const data = await response.json();
          const { autoRefreshInterval } = data.settings;

          if (autoRefreshInterval && autoRefreshInterval > 0) {
            refreshInterval = setInterval(() => {
              fetchGates();
              if (user?.role === 'admin') {
                fetchVerifiedCallers();
              }
            }, autoRefreshInterval * 60 * 1000); // Convert minutes to milliseconds
          }
        }
      } catch (error) {
        console.error('Error fetching auto-refresh settings:', error);
      }
    };

    setupAutoRefresh();

    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
    };
  }, [fetchGates, fetchVerifiedCallers, user]);

  // Clear messages after 3 seconds
  useEffect(() => {
    if (successMessage || error) {
      const timer = setTimeout(() => {
        setSuccessMessage('');
        setError('');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage, error]);

  // Function to scroll to error or success message
  const scrollToMessage = useCallback((type) => {
    const ref = type === 'error' ? errorRef : successRef;
    if (ref.current) {
      ref.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'nearest'
      });
    }
  }, []);

  // Fetch settings once on mount
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await authenticatedFetch('/api/settings/current');
        if (response.ok) {
          const data = await response.json();
          setSettings(data.settings);
          setNotificationsEnabled(data.settings?.enableNotifications || false);
        }
      } catch (error) {
        console.error('Error fetching settings:', error);
      }
    };

    fetchSettings();
  }, []);

  // Fetch user auto-open settings from server
  useEffect(() => {
    const fetchAutoOpenSettings = async () => {
      try {
        const response = await authenticatedFetch('/api/auth/user/auto-open-settings');
        if (response.ok) {
          const data = await response.json();
          let settings = data.autoOpenSettings || {};
          let radius = data.autoOpenRadius || {};
          
          // Ensure all gates with location are enabled by default
          // This will be updated after gates are loaded
          setAutoOpenSettings(settings);
          setAutoOpenRadius(radius);
        } else {
          // If error, try to load from localStorage as fallback (for migration)
          try {
            const saved = localStorage.getItem('gateAutoOpenSettings');
            if (saved) {
              const parsed = JSON.parse(saved);
              setAutoOpenSettings(parsed);
              // Migrate to server
              await authenticatedFetch('/api/auth/user/auto-open-settings', {
                method: 'PUT',
                headers: {
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  autoOpenSettings: parsed
                })
              });
              // Clear localStorage after migration
              localStorage.removeItem('gateAutoOpenSettings');
            }
          } catch (e) {
            console.error('Error loading from localStorage:', e);
          }
        }
      } catch (error) {
        console.error('Error fetching auto-open settings:', error);
        // Fallback to localStorage if server fails
        try {
          const saved = localStorage.getItem('gateAutoOpenSettings');
          if (saved) {
            setAutoOpenSettings(JSON.parse(saved));
          }
        } catch (e) {
          console.error('Error loading from localStorage:', e);
        }
      }
    };

    if (token) {
      fetchAutoOpenSettings();
    }
  }, [token]);

  // Ensure all gates are enabled by default after gates are loaded
  useEffect(() => {
    if (gates.length > 0 && token) {
      const gatesWithLocation = gates.filter(g => g.location && g.location.latitude && g.location.longitude);
      let updatedSettings = { ...autoOpenSettings };
      let hasChanges = false;
      
      // Enable all gates with location by default if not already set
      gatesWithLocation.forEach(gate => {
        const gateId = gate._id || gate.id;
        if (updatedSettings[gateId] === undefined) {
          updatedSettings[gateId] = true; // Default to enabled
          hasChanges = true;
        }
      });
      
      // Save to server if there are changes
      if (hasChanges) {
        setAutoOpenSettings(updatedSettings);
        // Save to server in background
        authenticatedFetch('/api/auth/user/auto-open-settings', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            autoOpenSettings: updatedSettings
          })
        }).catch(error => {
          console.error('Error saving default auto-open settings:', error);
        });
      }
    }
    // Only run when gates change, not when autoOpenSettings changes (to avoid infinite loop)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gates, token]);

  // Calculate cooldowns and update timer every second
  useEffect(() => {
    let cooldownInterval;

    const calculateCooldowns = () => {
      const now = Date.now();
      // Use settings or default to 30 seconds
      const gateCooldownSeconds = settings?.gateCooldownSeconds || 30;
      const COOLDOWN_MS = gateCooldownSeconds * 1000;

      const newCooldowns = {};
      gates.forEach(gate => {
        if (gate.lastOpenedAt) {
          const timeSinceLastOpen = now - new Date(gate.lastOpenedAt).getTime();
          if (timeSinceLastOpen < COOLDOWN_MS) {
            newCooldowns[gate.id] = Math.ceil((COOLDOWN_MS - timeSinceLastOpen) / 1000);
          }
        }
      });

      setCooldowns(newCooldowns);
    };

    // Calculate initial cooldowns
    calculateCooldowns();

    // Update timer every second
    cooldownInterval = setInterval(calculateCooldowns, 1000);

    return () => {
      if (cooldownInterval) {
        clearInterval(cooldownInterval);
      }
    };
  }, [gates, settings]);


  const handleOpenGateClick = (gate) => {
    if (gate.password) {
      // Show password prompt for protected gates
      const password = prompt(`הכנס סיסמה לפתיחת השער "${gate.name}":`);
      if (password !== null) { // User didn't cancel
        handleOpenGate(gate, password);
      }
    } else {
      // Open gate directly for unprotected gates
      handleOpenGate(gate, '');
    }
  };

  const handleGateSelect = (gate) => {
    if (isMobile) {
      setSelectedGate(gate);
    } else {
      // On desktop, also select the gate to show details
      setSelectedGate(gate);
    }
  };

  const handleBackToGates = () => {
    setSelectedGate(null);
  };

  const handleOpenGate = useCallback(async (gate, password = '', autoOpened = false) => {
    try {
      setIsSubmitting(true);
      const response = await authenticatedFetch(`/api/gates/${gate.id}/open`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ password, autoOpened })
      });

      const data = await response.json();

      if (response.ok) {
        const msg = `פותח שער "${gate.name}" באמצעות שיחת טלפון`;
        setSuccessMessage(msg);
        if (window.showSystemNotification) window.showSystemNotification(`שער "${gate.name}" נפתח בהצלחה`, 'success');
        scrollToMessage('success');

        // Optimistically update gate lastOpenedAt to trigger cooldown immediately
        setGates(prevGates => prevGates.map(g =>
          g.id === gate.id
            ? { ...g, lastOpenedAt: new Date().toISOString() }
            : g
        ));

        // Background fetch to ensure consistency
        fetchGates();
      } else {
        if (isSessionExpired(data)) {
          handleSessionExpiration();
          return;
        }

        // Handle specific error cases
        if (response.status === 503 && data.error === 'המערכת בתחזוקה') {
          const msg = `המערכת בתחזוקה: ${data.message || 'נסה שוב מאוחר יותר'}`;
          setError(msg);
          if (window.showSystemNotification) window.showSystemNotification(msg, 'warning');

        } else if (response.status === 429) {
          if (data.error === 'דילאי פעיל') {
            const msg = data.message || `אנא המתן ${data.remainingTime} שניות לפני פתיחת השער שוב!`;
            setError(msg);
            // Update cooldown with remaining time
            if (data.remainingTime) {
              setCooldowns(prev => ({
                ...prev,
                [gate.id]: data.remainingTime
              }));
            }
            if (window.showSystemNotification) window.showSystemNotification(msg, 'warning');
          } else if (data.error === 'חריגה ממספר הניסיונות') {
            const msg = `חריגה ממספר הניסיונות: ${data.message}`;
            setError(msg);
            if (window.showSystemNotification) window.showSystemNotification(msg, 'error');
          } else {
            const msg = data.error || 'יותר מדי בקשות - נסה שוב מאוחר יותר';
            setError(msg);
            if (window.showSystemNotification) window.showSystemNotification(msg, 'warning');
          }
        } else if (response.status === 402 && data.error === 'יתרת Twilio נמוכה') {
          const msg = data.message || 'לשקד תכף נגמר הכסף תפקידו לו';
          setError(msg);
          if (window.showSystemNotification) window.showSystemNotification(msg, 'warning');
        } else {
          const msg = data.error || 'שגיאה בפתיחת השער';
          setError(msg);
          if (window.showSystemNotification) window.showSystemNotification(msg, 'error');
        }

        scrollToMessage('error');
      }
    } catch (error) {
      console.error('Error opening gate:', error);
      const msg = 'שגיאת רשת';
      setError(msg);
      if (window.showSystemNotification) window.showSystemNotification('שגיאת רשת בפתיחת השער', 'error');
    } finally {
      setIsSubmitting(false);
    }
  }, [fetchGates, scrollToMessage]);

  // Handle Auto-Open Logic
  useEffect(() => {
    if (!userLocation || !gates.length) return;

    const checkAutoOpen = () => {
      const gatesInRange = [];
      const newGatesInRangeState = {};

      for (const gate of gates) {
        if (gate.location && gate.location.latitude && gate.location.longitude) {
          const gateId = gate._id || gate.id;
          const isEnabled = autoOpenSettings[gateId];
          
          if (!isEnabled) continue; // Skip if auto-open is not enabled for this gate

          // Calculate straight line distance
          const distance = calculateDistance(
            userLocation.latitude,
            userLocation.longitude,
            gate.location.latitude,
            gate.location.longitude
          );

          // Use user's custom radius if set, otherwise use gate default (50m)
          const userRadius = autoOpenRadius[gateId] || gate.location?.autoOpenRadius || 50;
          const radius = userRadius;
          const isNear = distance <= radius;
          
          // Track current range state
          if (isNear) {
            newGatesInRangeState[gateId] = true;
          }
          
          // Check if user just entered range (was not in range before, but is now)
          // Use ref to get current value without causing re-render
          const wasInRange = gatesInRangeStateRef.current[gateId];
          const justEnteredRange = isNear && !wasInRange;
          
          // Check for auto-open - only if user just entered range and gate hasn't been opened in this session
          // Use ref to check synchronously and prevent duplicate opens
          if (justEnteredRange && !autoOpenedGatesRef.current[gateId] && !autoOpenedGates[gateId] && !cooldowns[gateId]) {
            gatesInRange.push({ gate, distance, gateId });
          }
          
          // Reset auto-open state when user moves away from range
          const resetDistance = 150; // Fixed 150 meters
          if (distance > resetDistance) {
            // User moved away - reset state for this gate
            if (autoOpenedGates[gateId] || autoOpenedGatesRef.current[gateId]) {
              setAutoOpenedGates(prev => {
                const newState = { ...prev };
                delete newState[gateId];
                return newState;
              });
              // Also reset ref
              delete autoOpenedGatesRef.current[gateId];
            }
            // Remove from in-range state
            delete newGatesInRangeState[gateId];
          }
        }
      }

      // Update gates in range state (both state and ref)
      setGatesInRangeState(newGatesInRangeState);
      gatesInRangeStateRef.current = newGatesInRangeState;

      // If multiple gates in range, show selection modal (only if not already showing)
      // Use ref to check current value without causing re-render
      if (gatesInRange.length > 1 && !showGateSelectionModalRef.current && !pendingGateSelectionRef.current) {
        setNearbyGates(gatesInRange);
        setShowGateSelectionModal(true);
        setPendingGateSelection(true);
        showGateSelectionModalRef.current = true;
        pendingGateSelectionRef.current = true;
      } 
      // If only one gate in range, open it automatically
      else if (gatesInRange.length === 1) {
        const { gate, distance, gateId } = gatesInRange[0];
        
        // Double-check that gate hasn't been opened already (prevent duplicate opens)
        if (autoOpenedGatesRef.current[gateId] || autoOpenedGates[gateId]) {
          return; // Gate already opened, skip
        }
        
        // Mark as opened immediately in ref to prevent duplicate opens
        autoOpenedGatesRef.current[gateId] = true;
        
        console.log(`Auto-opening gate ${gate.name} (Distance: ${distance}m)`);
        handleOpenGate(gate, gate.password || '', true);
        
        // Mark as opened in state (for UI display)
        setAutoOpenedGates(prev => ({ ...prev, [gateId]: true }));
        
        // Show auto-open notification
        setAutoOpenNotification({ gateName: gate.name });
        setTimeout(() => setAutoOpenNotification(null), 5000);
      }
      
      // Reset pending flag if no gates in range
      if (gatesInRange.length === 0) {
        setPendingGateSelection(false);
        pendingGateSelectionRef.current = false;
      }
    };

    checkAutoOpen();
  }, [userLocation, gates, autoOpenSettings, autoOpenedGates, cooldowns, handleOpenGate]);

  // Sync refs with state when state changes externally
  useEffect(() => {
    gatesInRangeStateRef.current = gatesInRangeState;
  }, [gatesInRangeState]);

  useEffect(() => {
    showGateSelectionModalRef.current = showGateSelectionModal;
  }, [showGateSelectionModal]);

  useEffect(() => {
    pendingGateSelectionRef.current = pendingGateSelection;
  }, [pendingGateSelection]);

  // Sync autoOpenedGatesRef with state when state changes externally
  useEffect(() => {
    autoOpenedGatesRef.current = { ...autoOpenedGates };
  }, [autoOpenedGates]);

  // Calculate the closest gate to user location
  const closestGate = useMemo(() => {
    if (!userLocation || !gates.length) return null;
    
    let closest = null;
    let minDistance = Infinity;
    
    for (const gate of gates) {
      if (!gate.location || !gate.location.latitude || !gate.location.longitude) continue;
      
      const distance = calculateDistance(
        userLocation.latitude,
        userLocation.longitude,
        gate.location.latitude,
        gate.location.longitude
      );
      
      if (distance < minDistance) {
        minDistance = distance;
        closest = { gate, distance };
      }
    }
    
    return closest;
  }, [userLocation, gates]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewGateData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleLocationSelect = (location) => {
    setNewGateData(prev => ({
      ...prev,
      location: {
        latitude: location.lat,
        longitude: location.lng,
        address: location.address,
        autoOpenRadius: prev.location?.autoOpenRadius || 50
      }
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const url = editingGate
        ? `/api/gates/${editingGate.id}`
        : '/api/gates';

      const method = editingGate ? 'PUT' : 'POST';

      const response = await authenticatedFetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newGateData)
      });

      const data = await response.json();

      if (response.ok) {
        const msg = editingGate
          ? `שער "${newGateData.name}" עודכן בהצלחה!`
          : `שער "${newGateData.name}" נוסף בהצלחה!`;
        setSuccessMessage(msg);
        if (window.showSystemNotification) window.showSystemNotification(editingGate ? `שער "${newGateData.name}" עודכן בהצלחה` : `שער "${newGateData.name}" נוסף בהצלחה`, 'success');
        scrollToMessage('success');

        setShowAddGate(false);
        setEditingGate(null);
        setNewGateData({
          name: '',
          phoneNumber: '',
          authorizedNumber: '',
          password: '',
          location: null
        });
        await fetchGates();
      } else {
        if (isSessionExpired(data)) {
          handleSessionExpiration();
          return;
        }
        const msg = data.error || 'שגיאה בשמירת השער';
        setError(msg);
        if (window.showSystemNotification) window.showSystemNotification(`שגיאה בשמירת השער: ${data.error || 'שגיאה לא ידועה'}`, 'error');
        scrollToMessage('error');
      }
    } catch (error) {
      console.error('Error saving gate:', error);
      const msg = 'שגיאת רשת';
      setError(msg);
      if (window.showSystemNotification) window.showSystemNotification('שגיאת רשת בשמירת השער', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (gate) => {
    setEditingGate(gate);
    setNewGateData({
      name: gate.name,
      phoneNumber: gate.phoneNumber,
      authorizedNumber: gate.authorizedNumber,
      password: gate.password || '',
      location: gate.location || null
    });
  };

  const handleDelete = async (gateId, gateName) => {
    if (!window.confirm(`האם אתה בטוח שברצונך למחוק את השער "${gateName}"?`)) {
      return;
    }

    try {
      const response = await authenticatedFetch(`/api/gates/${gateId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        const msg = `שער "${gateName}" נמחק בהצלחה!`;
        setSuccessMessage(msg);
        if (window.showSystemNotification) window.showSystemNotification(`שער "${gateName}" נמחק בהצלחה`, 'info');
        scrollToMessage('success');

        await fetchGates();
      } else {
        const data = await response.json();
        const msg = data.error || 'שגיאה במחיקת השער';
        setError(msg);
        if (window.showSystemNotification) window.showSystemNotification(`שגיאה במחיקת השער: ${data.error || 'שגיאה לא ידועה'}`, 'error');
        scrollToMessage('error');
      }
    } catch (error) {
      console.error('Error deleting gate:', error);
      const msg = 'שגיאת רשת';
      setError(msg);
      if (window.showSystemNotification) window.showSystemNotification('שגיאת רשת במחיקת השער', 'error');
    }
  };

  const handleCancel = () => {
    setShowAddGate(false);
    setEditingGate(null);
    setNewGateData({
      name: '',
      phoneNumber: '',
      authorizedNumber: '',
      password: ''
    });
  };

  // Debounce timer ref for radius updates
  const radiusUpdateTimerRef = useRef({});

  const handleUpdateAutoOpenRadius = useCallback(async (gate, newRadius) => {
    try {
      // Ensure radius is within valid range (0-1000)
      const radius = Math.max(0, Math.min(1000, parseInt(newRadius) || 50));
      
      // Clear any pending update for this gate
      if (radiusUpdateTimerRef.current[gate.id]) {
        clearTimeout(radiusUpdateTimerRef.current[gate.id]);
      }
      
      // Update local state immediately using functional update
      setAutoOpenRadius(prev => {
        const newRadiusSettings = {
          ...prev,
          [gate.id]: radius
        };

        // Debounce the server update to avoid too many requests
        radiusUpdateTimerRef.current[gate.id] = setTimeout(async () => {
          try {
            const response = await authenticatedFetch('/api/auth/user/auto-open-settings', {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                autoOpenRadius: newRadiusSettings
              })
            });

            if (response.ok) {
              const data = await response.json();
              // Update with server response
              setAutoOpenRadius(data.autoOpenRadius || newRadiusSettings);
            } else {
              const data = await response.json();
              // Revert the local state change on error using functional update
              setAutoOpenRadius(prevState => {
                const reverted = { ...prevState };
                delete reverted[gate.id];
                return reverted;
              });
              if (window.showSystemNotification) {
                window.showSystemNotification(`שגיאה בעדכון טווח פתיחה: ${data.error || 'שגיאה לא ידועה'}`, 'error');
              }
            }
          } catch (error) {
            console.error('Error updating auto-open radius:', error);
            // Revert the local state change on error using functional update
            setAutoOpenRadius(prevState => {
              const reverted = { ...prevState };
              delete reverted[gate.id];
              return reverted;
            });
            if (window.showSystemNotification) {
              window.showSystemNotification('שגיאת רשת בעדכון טווח פתיחה', 'error');
            }
          }
        }, 300); // 300ms debounce

        return newRadiusSettings;
      });
    } catch (error) {
      console.error('Error in handleUpdateAutoOpenRadius:', error);
    }
  }, [authenticatedFetch]);

  const handleDragEnd = async (event) => {
    const { active, over } = event;

    // Re-enable scrolling after drag ends
    document.body.style.overflow = '';

    if (!over || active.id === over.id) {
      return;
    }

    try {
      // Convert active.id and over.id back to numbers for comparison
      const activeId = typeof active.id === 'string' ? parseInt(active.id, 10) : active.id;
      const overId = typeof over.id === 'string' ? parseInt(over.id, 10) : over.id;

      const oldIndex = gates.findIndex(g => g.id === activeId);
      const newIndex = gates.findIndex(g => g.id === overId);

      if (oldIndex === -1 || newIndex === -1) return;

      // Update local state immediately for better UX
      const newGates = arrayMove(gates, oldIndex, newIndex);
      setGates(newGates);

      // Prepare order updates - ensure gateId is a number
      const gateOrders = newGates
        .filter(gate => {
          // Filter out invalid gates
          if (!gate || gate.id == null) {
            console.warn('Filtering out invalid gate:', gate);
            return false;
          }
          return true;
        })
        .map((gate, index) => {
          // Convert gate.id to number - handle both string and number
          let gateId;
          if (typeof gate.id === 'number') {
            gateId = gate.id;
          } else if (typeof gate.id === 'string') {
            gateId = parseInt(gate.id, 10);
          } else {
            gateId = Number(gate.id);
          }

          // Ensure it's a valid number
          if (isNaN(gateId) || gateId === null || gateId === undefined) {
            console.error('Invalid gate.id:', gate.id, 'type:', typeof gate.id);
            return null;
          }

          return {
            gateId: Number(gateId), // Ensure it's a number
            order: Number(index) // Ensure order is a number
          };
        })
        .filter(item => item !== null); // Remove any null entries

      // Validate all gateIds are valid numbers
      const hasInvalidIds = gateOrders.some(item => isNaN(item.gateId) || item.gateId == null);
      if (hasInvalidIds) {
        console.error('Invalid gate IDs found:', gateOrders, 'Original gates:', newGates);
        const msg = 'שגיאה: מזהה שער לא תקין';
        setError(msg);
        if (window.showSystemNotification) window.showSystemNotification(msg, 'error');
        await fetchGates();
        return;
      }


      const response = await authenticatedFetch('/api/gates/reorder', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ gateOrders })
      });

      if (response.ok) {
        if (window.showSystemNotification) window.showSystemNotification('סדר השערים עודכן בהצלחה', 'success');
      } else {
        const data = await response.json().catch(() => ({ error: 'שגיאה לא ידועה' }));
        if (isSessionExpired(data)) {
          handleSessionExpiration();
          return;
        }
        const msg = data.error || 'שגיאה בעדכון סדר השערים';
        console.error('Reorder error:', data);
        setError(msg);
        if (window.showSystemNotification) window.showSystemNotification(msg, 'error');
        // Refresh gates to restore original order
        await fetchGates();
      }
    } catch (error) {
      console.error('Error reordering gates:', error);
      const msg = 'שגיאת רשת בעדכון סדר השערים';
      setError(msg);
      if (window.showSystemNotification) window.showSystemNotification(msg, 'error');
      // Refresh gates to restore original order
      await fetchGates();
    }
  };

  if (isLoading) {
    return (
      <div className="loading">
        <div className="loading-content">
          <div className="loading-spinner"></div>
          <p>טוען שערים...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      {/* Dashboard Header */}
      <div className="dashboard-header">
        <div>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            width: '100%',
            marginBottom: '2rem',
            padding: '1rem',
            perspective: '1000px'
          }}>
            <div style={{
              position: 'relative',
              transformStyle: 'preserve-3d',
              transition: 'transform 0.3s ease'
            }}>
              <div style={{
                width: '150px',
                height: '150px',
                borderRadius: '50%',
                border: '5px solid #000000',
                padding: '12px',
                boxSizing: 'border-box',
                background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
                boxShadow: '0 12px 24px rgba(0, 0, 0, 0.2), 0 6px 12px rgba(0, 0, 0, 0.15), inset 0 2px 4px rgba(255, 255, 255, 0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transform: 'translateZ(20px)'
              }}>
                <img 
                  src={`${process.env.PUBLIC_URL || ''}/logo.png`} 
                  alt="שערים" 
                  style={{ 
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                    borderRadius: '50%'
                  }}
                />
              </div>
            </div>
          </div>
          <p>
            {user?.role === 'admin'
              ? 'ניהול שערים במערכת - הוסף, ערוך ומחק שערים'
              : isEditMode
                ? 'גרור את השערים כדי לשנות את הסדר שלהם'
                : 'לשינוי סדר השערים לחץ על כפתור "עריכה"'
          }
          </p>
          
          {/* Tabs Navigation */}
          <div className="tabs-container" style={{ 
            display: 'flex', 
            gap: '0.5rem', 
            marginTop: '1rem',
            borderBottom: '2px solid #e5e7eb',
            paddingBottom: '0.5rem'
          }}>
            <button
              onClick={() => setActiveTab('gates')}
              className={`tab-button ${activeTab === 'gates' ? 'active' : ''}`}
              style={{
                padding: '0.75rem 1.5rem',
                border: 'none',
                background: activeTab === 'gates' ? '#2563eb' : 'transparent',
                color: activeTab === 'gates' ? 'white' : '#6b7280',
                borderRadius: '8px 8px 0 0',
                cursor: 'pointer',
                fontWeight: activeTab === 'gates' ? '600' : '400',
                transition: 'all 0.2s',
                fontSize: '1rem'
              }}
            >
              <svg style={{ width: '18px', height: '18px', display: 'inline-block', marginLeft: '6px', verticalAlign: 'middle' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
              רשימה
            </button>
            <button
              onClick={() => setActiveTab('map')}
              className={`tab-button ${activeTab === 'map' ? 'active' : ''}`}
              style={{
                padding: '0.75rem 1.5rem',
                border: 'none',
                background: activeTab === 'map' ? '#2563eb' : 'transparent',
                color: activeTab === 'map' ? 'white' : '#6b7280',
                borderRadius: '8px 8px 0 0',
                cursor: 'pointer',
                fontWeight: activeTab === 'map' ? '600' : '400',
                transition: 'all 0.2s',
                fontSize: '1rem'
              }}
            >
              <svg style={{ width: '18px', height: '18px', display: 'inline-block', marginLeft: '6px', verticalAlign: 'middle' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
              מפה
            </button>
          </div>
          {!userLocation && !locationPermissionRequested && (
            <div className="location-request-banner" style={{ 
              marginTop: '10px', 
              padding: '8px 12px', 
              backgroundColor: '#eff6ff', 
              borderRadius: '6px', 
              border: '1px solid #dbeafe',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '0.9rem',
              color: '#1e40af'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg style={{ width: '16px', height: '16px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span>הפעל מיקום להצגת מרחקים ופתיחה אוטומטית</span>
              </div>
              <button 
                onClick={() => requestLocation(true)}
                style={{
                  backgroundColor: '#2563eb',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '4px 12px',
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  fontWeight: '500'
                }}
              >
                הפעל
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons - Outside header, above gates */}
      <div className="dashboard-actions-bar">
        <div className="admin-actions" style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
          <button
            onClick={() => setIsEditMode(!isEditMode)}
            className={`btn ${isEditMode ? 'btn-secondary' : 'btn-primary'}`}
            disabled={showAddGate || showCallerIdValidation}
          >
            <svg className="btn-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            <span>{isEditMode ? 'סיים עריכה' : 'עריכה'}</span>
          </button>

          {user?.role === 'admin' && (
            <>
              <button
                onClick={() => {
                  setShowAddGate(false);
                  setEditingGate(null);
                  setShowCallerIdValidation(true);
                }}
                className={`btn ${showCallerIdValidation ? 'btn-secondary' : 'btn-primary'}`}
              >
                <svg className="btn-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                <span>אימות מספר</span>
              </button>

              <button
                onClick={() => {
                  setEditingGate(null);
                  setNewGateData({ name: '', phoneNumber: '', authorizedNumber: '', password: '' });
                  setShowCallerIdValidation(false);
                  setShowAddGate(true);
                }}
                className={`btn ${showAddGate ? 'btn-secondary' : 'btn-primary'}`}
              >
                <svg className="btn-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                <span>הוסף שער</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Error Message - Only show if notifications are disabled */}
      {error && !notificationsEnabled && (
        <div className="error-message" ref={errorRef}>
          <span>{error}</span>
          <button onClick={() => setError('')}>✕</button>
        </div>
      )}

      {/* Success Message - Only show if notifications are disabled */}
      {successMessage && !notificationsEnabled && (
        <div className="success-message" ref={successRef}>
          <span>{successMessage}</span>
          <button onClick={() => setSuccessMessage('')}>✕</button>
        </div>
      )}

      {/* Add/Edit Gate Form */}
      {(showAddGate || (editingGate && !isMobile)) && (
        <div className="form-container">
          <div className="gate-edit-header">
            <h3>{editingGate ? 'ערוך שער' : 'הוסף שער חדש'}</h3>
          </div>
          {!editingGate && <p>מלא את הפרטים להוספת שער חדש למערכת</p>}

          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="form-group">
                <label htmlFor="name">שם השער:</label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  className="form-input"
                  value={newGateData.name}
                  onChange={handleInputChange}
                  required
                  disabled={isSubmitting}
                />
                <small>שם ייחודי לזיהוי השער במערכת</small>
              </div>

              <div className="form-group">
                <label htmlFor="phoneNumber">מספר טלפון:</label>
                <input
                  type="tel"
                  id="phoneNumber"
                  name="phoneNumber"
                  className="form-input"
                  value={newGateData.phoneNumber}
                  onChange={handleInputChange}
                  required
                  disabled={isSubmitting}
                />
                <small>מספר הטלפון של השער (למשל: 03-1234567)</small>
              </div>

              <div className="form-group">
                <label htmlFor="authorizedNumber">מספר מורשה:</label>
                <select
                  id="authorizedNumber"
                  name="authorizedNumber"
                  className="form-select"
                  value={newGateData.authorizedNumber}
                  onChange={handleInputChange}
                  required
                  disabled={isSubmitting}
                >
                  <option value="">בחר מספר מורשה</option>
                  {verifiedCallers.map(caller => (
                    <option key={caller.phoneNumber} value={caller.phoneNumber}>
                      {caller.phoneNumber} {caller.friendlyName ? `(${caller.friendlyName})` : ''}
                    </option>
                  ))}
                </select>
                <small>בחר מספר טלפון מורשה מ-Twilio לפתיחת השער</small>
              </div>

              <div className="form-group">
                <label htmlFor="password">סיסמה (אופציונלי)</label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  className="form-input"
                  value={newGateData.password}
                  onChange={handleInputChange}
                  disabled={isSubmitting}
                  autoComplete="off"
                />
                <small>סיסמה להגנה על השער (ריק = ללא הגנה)</small>
              </div>

              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label>מיקום השער (אופציונלי)</label>
                <small>לחץ על המפה או חפש כתובת לבחירת מיקום לפתיחה אוטומטית</small>
              </div>
            </div>
            <div className="location-picker-wrapper" style={{ gridColumn: '1 / -1', marginTop: '0.5rem' }}>
              <LocationPicker
                initialLocation={newGateData.location ? { lat: newGateData.location.latitude, lng: newGateData.location.longitude, address: newGateData.location.address } : null}
                onLocationSelect={handleLocationSelect}
              />
            </div>

            <div className="form-actions">
              <button
                type="button"
                onClick={handleCancel}
                className="btn btn-secondary"
                disabled={isSubmitting}
              >
                ביטול
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'שומר...' : (editingGate ? 'עדכן' : 'הוסף')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Mobile: Show selected gate details */}
      {isMobile && selectedGate && (
        <div className="mobile-gate-detail">
          <div className="mobile-gate-header">
            <button onClick={handleBackToGates} className="btn btn-secondary btn-back">
              <svg className="btn-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              חזור לשערים
            </button>
            <h2>{selectedGate.name}</h2>
          </div>

          {editingGate && selectedGate && editingGate.id === selectedGate.id && (
            <div className="mobile-gate-content">
              <div className="gate-header" style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3>ערוך שער</h3>
                <button
                  onClick={handleCancel}
                  className="btn btn-secondary btn-small"
                >
                  חזרה
                </button>
              </div>
              <form onSubmit={handleSubmit}>
                <div className="form-grid">
                  <div className="form-group">
                    <label htmlFor="name">שם השער:</label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      className="form-input"
                      value={newGateData.name}
                      onChange={handleInputChange}
                      required
                      disabled={isSubmitting}
                    />
                    <small>שם ייחודי לזיהוי השער במערכת</small>
                  </div>
                  <div className="form-group">
                    <label htmlFor="phoneNumber">מספר טלפון:</label>
                    <input
                      type="tel"
                      id="phoneNumber"
                      name="phoneNumber"
                      className="form-input"
                      value={newGateData.phoneNumber}
                      onChange={handleInputChange}
                      required
                      disabled={isSubmitting}
                    />
                    <small>מספר הטלפון של השער (למשל: 03-1234567)</small>
                  </div>
                  <div className="form-group">
                    <label htmlFor="authorizedNumber">מספר מורשה:</label>
                    <select
                      id="authorizedNumber"
                      name="authorizedNumber"
                      className="form-select"
                      value={newGateData.authorizedNumber}
                      onChange={handleInputChange}
                      required
                      disabled={isSubmitting}
                    >
                      <option value="">בחר מספר מורשה</option>
                      {verifiedCallers.map(caller => (
                        <option key={caller.phoneNumber} value={caller.phoneNumber}>
                          {caller.phoneNumber} {caller.friendlyName ? `(${caller.friendlyName})` : ''}
                        </option>
                      ))}
                    </select>
                    <small>בחר מספר טלפון מורשה מ-Twilio לפתיחת השער</small>
                  </div>
                  <div className="form-group">
                    <label htmlFor="password">סיסמה (אופציונלי)</label>
                    <input
                      type="password"
                      id="password"
                      name="password"
                      className="form-input"
                      value={newGateData.password}
                      onChange={handleInputChange}
                      disabled={isSubmitting}
                    />
                    <small>סיסמה להגנה על השער (ריק = ללא הגנה)</small>
                  </div>

                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label>מיקום השער (אופציונלי)</label>
                    <small>לחץ על המפה או חפש כתובת לבחירת מיקום לפתיחה אוטומטית</small>
                  </div>
                </div>
                <div className="location-picker-wrapper" style={{ gridColumn: '1 / -1', marginTop: '0.5rem' }}>
                  <LocationPicker
                    initialLocation={newGateData.location ? { lat: newGateData.location.latitude, lng: newGateData.location.longitude, address: newGateData.location.address } : null}
                    onLocationSelect={handleLocationSelect}
                    userLocation={userLocation}
                  />
                </div>
                <div className="form-actions">
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="btn btn-secondary"
                    disabled={isSubmitting}
                  >
                    חזרה
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? 'שומר...' : 'עדכן'}
                  </button>
                </div>
              </form>
            </div>
          )}
          {!(editingGate && selectedGate && editingGate.id === selectedGate.id) && (
            <div className="mobile-gate-content">
              <div className="gate-info">
                <p><strong>מספר טלפון:</strong> {selectedGate.phoneNumber}</p>
                {userLocation && selectedGate.location && selectedGate.location.latitude && (
                  <p style={{ marginTop: '0.5rem' }}>
                    <strong>מרחק:</strong> {formatDistance(calculateDistance(
                      userLocation.latitude,
                      userLocation.longitude,
                      selectedGate.location.latitude,
                      selectedGate.location.longitude
                    ))}
                  </p>
                )}
              </div>

              <div className="gate-authorized">
                <h4>
                  <svg className="icon-small" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  מספר מורשה לפתיחה
                </h4>
                <div className="authorized-numbers">
                  <span className="authorized-number">
                    {user?.role === 'admin'
                      ? selectedGate.authorizedNumber
                      : '***********'}
                  </span>
                </div>
              </div>

              {/* Gate Location Map - Mobile Selected Gate */}
              {selectedGate.location && selectedGate.location.latitude && selectedGate.location.longitude && (
                <div style={{ marginBottom: '1rem', marginTop: '1rem' }}>
                  <h4 style={{ marginBottom: '0.5rem', fontSize: '0.95rem', fontWeight: '600', color: '#374151', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <svg style={{ width: '18px', height: '18px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                    </svg>
                    מיקום השער
                  </h4>
                  <div style={{ height: '200px', width: '100%', borderRadius: '8px', overflow: 'hidden', border: '1px solid #e5e7eb' }}>
                    <MapContainer
                      center={[selectedGate.location.latitude, selectedGate.location.longitude]}
                      zoom={15}
                      scrollWheelZoom={false}
                      style={{ height: '100%', width: '100%' }}
                      zoomControl={false}
                    >
                      <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      />
                      <Marker position={[selectedGate.location.latitude, selectedGate.location.longitude]} icon={getGateIcon()}>
                        <Popup>{selectedGate.name}</Popup>
                      </Marker>
                    </MapContainer>
                  </div>
                </div>
              )}

              <div className="gate-actions">
                <div className="gate-open-section">
                  {/* Cooldown indicator */}
                  {cooldowns[selectedGate.id] && (
                    <div className="cooldown-indicator">
                      <svg className="cooldown-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>אנא המתן {cooldowns[selectedGate.id]} שניות לפני פתיחת השער שוב!</span>
                    </div>
                  )}
                  
                  {/* Auto-opened indicator */}
                  {(() => {
                    const gateId = selectedGate._id || selectedGate.id;
                    return autoOpenedGates[gateId] && !cooldowns[selectedGate.id] ? (
                      <div className="cooldown-indicator" style={{ backgroundColor: '#eff6ff', color: '#1e40af', border: '1px solid #dbeafe' }}>
                        <svg className="cooldown-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        <span>השער נפתח אוטומטית - ניתן לפתוח ידנית</span>
                      </div>
                    ) : null;
                  })()}

                  {/* Auto Open Toggle */}
                  {selectedGate.location && selectedGate.location.latitude && (
                    <>
                      <div className="auto-open-toggle" style={{ marginBottom: '1rem', padding: '1rem', background: '#f0f9ff', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <svg style={{ width: '20px', height: '20px', color: '#2563eb' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          <span style={{ fontWeight: '600', color: '#1e40af' }}>פתיחה אוטומטית בהגעה</span>
                        </div>
                        <label className="switch" style={{ position: 'relative', display: 'inline-block', width: '50px', height: '24px' }}>
                          <input 
                            type="checkbox" 
                            checked={!!autoOpenSettings[selectedGate.id]} 
                            onChange={() => toggleAutoOpen(selectedGate.id)}
                            style={{ opacity: 0, width: 0, height: 0 }}
                          />
                          <span className="slider round" style={{ 
                            position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0, 
                            backgroundColor: !!autoOpenSettings[selectedGate.id] ? '#2563eb' : '#ccc', 
                            transition: '.4s', borderRadius: '34px' 
                          }}>
                            <span style={{ 
                              position: 'absolute', content: '""', height: '16px', width: '16px', 
                              left: !!autoOpenSettings[selectedGate.id] ? '4px' : '30px', bottom: '4px', 
                              backgroundColor: 'white', transition: '.4s', borderRadius: '50%' 
                            }}></span>
                          </span>
                        </label>
                      </div>
                      
                      {/* Auto Open Radius Range Slider */}
                      {!!autoOpenSettings[selectedGate.id] && (
                        <div className="auto-open-radius-setting" style={{ marginBottom: '1rem', padding: '1rem', background: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                            <label style={{ fontWeight: '600', color: '#374151', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <svg style={{ width: '18px', height: '18px', color: '#6b7280' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                              </svg>
                              טווח פתיחה אוטומטית
                            </label>
                            <span style={{ fontWeight: '600', color: '#2563eb', fontSize: '1rem' }}>
                              {autoOpenRadius[selectedGate.id] || selectedGate.location?.autoOpenRadius || 50} מ'
                            </span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="1000"
                            step="10"
                            value={autoOpenRadius[selectedGate.id] || selectedGate.location?.autoOpenRadius || 50}
                            onChange={(e) => {
                              // Update display value immediately for responsive UI
                              const newRadius = parseInt(e.target.value);
                              // Update local state immediately
                              setAutoOpenRadius(prev => ({
                                ...prev,
                                [selectedGate.id]: newRadius
                              }));
                              // Save to server with debounce
                              handleUpdateAutoOpenRadius(selectedGate, newRadius);
                            }}
                            style={{
                              width: '100%',
                              height: '8px',
                              borderRadius: '4px',
                              background: '#e5e7eb',
                              outline: 'none',
                              WebkitAppearance: 'none',
                              appearance: 'none'
                            }}
                          />
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', fontSize: '0.75rem', color: '#6b7280' }}>
                            <span>0 מ'</span>
                            <span>1000 מ'</span>
                          </div>
                          <small style={{ display: 'block', marginTop: '0.5rem', color: '#6b7280', fontSize: '0.8rem' }}>
                            השער יפתח אוטומטית כשתגיע למרחק של עד {autoOpenRadius[selectedGate.id] || selectedGate.location?.autoOpenRadius || 50} מטר מהשער
                          </small>
                        </div>
                      )}
                    </>
                  )}

                  <button
                    onClick={() => handleOpenGateClick(selectedGate)}
                    disabled={(() => {
                      return isSubmitting || cooldowns[selectedGate.id];
                    })()}
                    className={`btn ${(() => {
                      return cooldowns[selectedGate.id] ? 'btn-secondary cooldown' : 'btn-primary';
                    })()} gate-open-btn`}
                  >
                    {isSubmitting ? (
                      <>
                        <div className="loading-spinner-small"></div>
                        <span>פותח...</span>
                      </>
                    ) : (() => {
                      const gateId = selectedGate._id || selectedGate.id;
                      if (cooldowns[selectedGate.id]) {
                        return (
                          <>
                            <svg className="btn-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span>אנא המתן {cooldowns[selectedGate.id]} שניות לפני פתיחת השער שוב!</span>
                          </>
                        );
                      } else if (autoOpenedGates[gateId]) {
                        return (
                          <>
                            <svg className="btn-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                            <span>פתח ידנית (נפתח אוטומטית)</span>
                          </>
                        );
                      } else {
                        return (
                          <>
                            <svg className="btn-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                            </svg>
                            <span>פתח שער</span>
                          </>
                        );
                      }
                    })()}
                  </button>
                </div>
              </div>

              {user?.role === 'admin' && (
                <div className="mobile-admin-actions">
                  <button
                    onClick={() => handleEdit(selectedGate)}
                    className="btn btn-primary"
                  >
                    ערוך שער
                  </button>
                  <button
                    onClick={() => handleDelete(selectedGate.id, selectedGate.name)}
                    className="btn btn-danger"
                  >
                    מחק שער
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* No Gates State */}
      {activeTab === 'gates' && !showAddGate && !selectedGate && !showCallerIdValidation && gates.length === 0 && (
        <div className="no-gates">
          <div className="no-gates-icon">🚪</div>
          <h3>אין שערים במערכת</h3>
          <p>
            {user?.role === 'admin'
              ? 'התחל על ידי הוספת שער ראשון למערכת'
              : 'אין שערים זמינים כרגע במערכת'
            }
          </p>
          {user?.role === 'admin' && (
            <button
              onClick={() => setShowAddGate(true)}
              className="btn btn-primary"
            >
              <svg className="btn-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              <span>הוסף שער ראשון</span>
            </button>
          )}
        </div>
      )}

      {/* Map View */}
      {activeTab === 'map' && !showAddGate && !showCallerIdValidation && (
        <div style={{ width: '100%', height: 'calc(100vh - 300px)', minHeight: '500px', marginTop: '1rem' }}>
          <GatesMapView 
            gates={gates.filter(gate => {
              // Filter gates based on user permissions
              if (user?.role === 'admin') return true;
              return user?.canAccessGate?.(gate.id) ?? true;
            })}
            userLocation={userLocation}
            onGateClick={(gate) => {
              // On mobile, select gate to show details
              // On desktop, just open popup (don't hide map)
              if (isMobile) {
                handleGateSelect(gate);
              }
            }}
            handleOpenGateClick={handleOpenGateClick}
            cooldowns={cooldowns}
            isSubmitting={isSubmitting}
            autoOpenedGates={autoOpenedGates}
          />
        </div>
      )}


      {/* Closest Gate - Display at the top */}
      {activeTab === 'gates' && !showAddGate && !selectedGate && !showCallerIdValidation && closestGate && (
        <div style={{
          marginBottom: '1.5rem',
          padding: '1rem',
          backgroundColor: '#f0f9ff',
          borderRadius: '12px',
          border: '2px solid #2563eb',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '0.5rem'
          }}>
            <h3 style={{
              margin: 0,
              fontSize: '1rem',
              fontWeight: '600',
              color: '#1e40af',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <svg style={{ width: '20px', height: '20px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              השער הקרוב
            </h3>
            <span style={{
              fontSize: '0.875rem',
              fontWeight: '600',
              color: '#2563eb',
              backgroundColor: 'white',
              padding: '0.25rem 0.75rem',
              borderRadius: '12px'
            }}>
              {formatDistance(closestGate.distance)}
            </span>
          </div>
          <SortableContext items={[String(closestGate.gate.id)]} strategy={rectSortingStrategy}>
            <SortableGateCard
              gate={closestGate.gate}
              user={user}
              isMobile={isMobile}
              editingGate={editingGate}
              newGateData={newGateData}
              handleInputChange={handleInputChange}
              handleLocationSelect={handleLocationSelect}
              handleSubmit={handleSubmit}
              handleCancel={handleCancel}
              isSubmitting={isSubmitting}
              verifiedCallers={verifiedCallers}
              cooldowns={cooldowns}
              handleOpenGateClick={handleOpenGateClick}
              handleEdit={handleEdit}
              handleDelete={handleDelete}
              handleGateSelect={handleGateSelect}
              isEditMode={false}
              userLocation={userLocation}
              toggleAutoOpen={toggleAutoOpen}
              autoOpenSettings={autoOpenSettings}
              autoOpenedGates={autoOpenedGates}
              handleUpdateAutoOpenRadius={handleUpdateAutoOpenRadius}
              autoOpenRadius={autoOpenRadius}
            />
          </SortableContext>
        </div>
      )}

      {/* Gates Grid - Show compact cards on mobile, full cards on desktop */}
      {activeTab === 'gates' && !showAddGate && !selectedGate && !showCallerIdValidation && (!editingGate || isMobile) && gates.length > 0 && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={() => {
            // Prevent scrolling while dragging
            document.body.style.overflow = 'hidden';
          }}
          onDragEnd={handleDragEnd}
          onDragCancel={() => {
            // Re-enable scrolling if drag is canceled
            document.body.style.overflow = '';
          }}
        >
          <SortableContext
            items={gates.map(g => String(g.id))}
            strategy={rectSortingStrategy}
          >
            <div className={`gates-grid ${isMobile ? 'gates-grid-mobile' : ''}`}>
              {gates.map(gate => (
                <SortableGateCard
                  key={gate.id}
                  gate={gate}
                  user={user}
                  isMobile={isMobile}
                  editingGate={editingGate}
                  newGateData={newGateData}
                  handleInputChange={handleInputChange}
                  handleLocationSelect={handleLocationSelect}
                  handleSubmit={handleSubmit}
                  handleCancel={handleCancel}
                  isSubmitting={isSubmitting}
                  verifiedCallers={verifiedCallers}
                  cooldowns={cooldowns}
                  handleOpenGateClick={handleOpenGateClick}
                  handleEdit={handleEdit}
                  handleDelete={handleDelete}
                  handleGateSelect={handleGateSelect}
                  isEditMode={isEditMode}
                  userLocation={userLocation}
                  toggleAutoOpen={toggleAutoOpen}
                  autoOpenSettings={autoOpenSettings}
                  autoOpenedGates={autoOpenedGates}
                  handleUpdateAutoOpenRadius={handleUpdateAutoOpenRadius}
                  autoOpenRadius={autoOpenRadius}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}


      {/* Gate History Modal */}
      {showHistory && (
        <GateHistory
          token={token}
          onClose={() => setShowHistory(false)}
        />
      )}

      {/* Caller ID Validation Modal */}
      {showCallerIdValidation && (
        <CallerIdValidation
          token={token}
          onClose={() => setShowCallerIdValidation(false)}
        />
      )}

      {/* Gate Selection Modal - when multiple gates are in range */}
      {showGateSelectionModal && nearbyGates.length > 0 && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          zIndex: 10000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem'
        }} onClick={() => {
          setShowGateSelectionModal(false);
          setPendingGateSelection(false);
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            padding: '2rem',
            maxWidth: '500px',
            width: '100%',
            maxHeight: '80vh',
            overflow: 'auto',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
          }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginTop: 0, marginBottom: '1rem', fontSize: '1.5rem', fontWeight: '600' }}>
              זוהו מספר שערים בקרבת מקום
            </h2>
            <p style={{ marginBottom: '1.5rem', color: '#666' }}>
              בחר איזה שער תרצה לפתוח:
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {nearbyGates
                .sort((a, b) => a.distance - b.distance)
                .map(({ gate, distance, gateId }) => (
                  <button
                    key={gateId}
                    onClick={() => {
                      // Mark as opened immediately in ref to prevent duplicate opens
                      autoOpenedGatesRef.current[gateId] = true;
                      
                      console.log(`Opening gate ${gate.name} (Distance: ${distance}m)`);
                      handleOpenGate(gate, gate.password || '', true);
                      
                      // Mark as opened in state (for UI display)
                      setAutoOpenedGates(prev => ({ ...prev, [gateId]: true }));
                      
                      // Show auto-open notification
                      setAutoOpenNotification({ gateName: gate.name });
                      setTimeout(() => setAutoOpenNotification(null), 5000);
                      
                      // Close modal
                      setShowGateSelectionModal(false);
                      setNearbyGates([]);
                      setPendingGateSelection(false);
                    }}
                    disabled={cooldowns[gateId]}
                    style={{
                      padding: '1rem',
                      border: '2px solid #e5e7eb',
                      borderRadius: '12px',
                      backgroundColor: cooldowns[gateId] ? '#f3f4f6' : 'white',
                      cursor: cooldowns[gateId] ? 'not-allowed' : 'pointer',
                      textAlign: 'right',
                      transition: 'all 0.2s',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '1rem'
                    }}
                    onMouseEnter={(e) => {
                      if (!cooldowns[gateId]) {
                        e.currentTarget.style.borderColor = '#2563eb';
                        e.currentTarget.style.backgroundColor = '#eff6ff';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!cooldowns[gateId]) {
                        e.currentTarget.style.borderColor = '#e5e7eb';
                        e.currentTarget.style.backgroundColor = 'white';
                      }
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: '600', fontSize: '1.1rem', marginBottom: '0.25rem' }}>
                        {gate.name}
                      </div>
                      <div style={{ fontSize: '0.9rem', color: '#666' }}>
                        מרחק: {formatDistance(distance)}
                      </div>
                      {cooldowns[gateId] && (
                        <div style={{ fontSize: '0.85rem', color: '#ef4444', marginTop: '0.25rem' }}>
                          אנא המתן {cooldowns[gateId]} שניות
                        </div>
                      )}
                    </div>
                    <svg style={{ width: '24px', height: '24px', flexShrink: 0, color: '#2563eb' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                ))}
            </div>
            <button
              onClick={() => {
                setShowGateSelectionModal(false);
                setNearbyGates([]);
                setPendingGateSelection(false);
              }}
              style={{
                marginTop: '1.5rem',
                padding: '0.75rem 1.5rem',
                border: 'none',
                borderRadius: '8px',
                backgroundColor: '#e5e7eb',
                color: '#374151',
                cursor: 'pointer',
                fontSize: '1rem',
                fontWeight: '500',
                width: '100%'
              }}
            >
              ביטול
            </button>
          </div>
        </div>
      )}

      {/* Auto-Open Notification Toast */}
      {autoOpenNotification && (
        <div style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          backgroundColor: '#10b981',
          color: 'white',
          padding: '1.5rem 2rem',
          borderRadius: '16px',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
          zIndex: 10001,
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          fontSize: '1.1rem',
          fontWeight: '600',
          animation: 'slideInUp 0.3s ease-out',
          maxWidth: '90%',
          textAlign: 'center'
        }}>
          <svg style={{ width: '24px', height: '24px', flexShrink: 0 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <span>זוהתה קרבה לשער {autoOpenNotification.gateName} - פותח אוטומטית!</span>
        </div>
      )}
    </div>
  );
};

export default GateDashboard;