import 'leaflet/dist/leaflet.css';
import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { auth } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../config/api';

// Fix Leaflet default marker icon issue in Webpack/Vite
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

const URGENCY_COLORS = {
  low: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
  medium: 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20',
  high: 'bg-orange-500/10 text-orange-400 border border-orange-500/20',
  critical: 'bg-red-500/10 text-red-400 border border-red-500/20',
};

function MapUpdater({ isActive }) {
  const map = useMap();
  useEffect(() => {
    if (isActive) {
      setTimeout(() => {
        map.invalidateSize();
      }, 100);
    }
  }, [isActive, map]);
  return null;
}

export default function LiveMap({ isActive }) {
  const { currentUser } = useAuth();
  const [needs, setNeeds] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchNeeds = async () => {
      const user = auth.currentUser;
      if (!user) {
        setError('Authentication required');
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        const idToken = await user.getIdToken();
        const res = await fetch(`${API_BASE_URL}/api/needs?limit=500&sort=created_at`, {
          headers: { Authorization: `Bearer ${idToken}` },
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        // Filter needs: exclude completed and resolved
        setNeeds((data.needs ?? []).filter((n) => n.status !== 'completed' && n.status !== 'resolved'));
        setIsLoading(false);
      } catch (err) {
        console.error('[LiveMap] Fetch failed:', err);
        setError('Failed to load map data');
        setIsLoading(false);
      }
    };

    fetchNeeds();
  }, []);

  if (isLoading) {
    return <div className="animate-pulse text-zinc-400 text-sm p-8 text-center">Loading map data...</div>;
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-[500px] bg-zinc-900/40 rounded-[24px] border border-[rgba(255,255,255,0.08)]">
        <p className="text-zinc-500 text-sm">{error}</p>
      </div>
    );
  }

  if (needs.length === 0) {
    return (
      <div className="flex items-center justify-center h-[500px] bg-zinc-900/40 rounded-[24px] border border-[rgba(255,255,255,0.08)]">
        <p className="text-zinc-500 text-sm">No needs with location data available</p>
      </div>
    );
  }

  return (
    <div className="h-[600px] w-full rounded-[24px] overflow-hidden border border-[rgba(255,255,255,0.08)] relative z-0">
      <MapContainer
        center={[20.5937, 78.9629]}
        zoom={5}
        style={{ height: '100%', width: '100%' }}
        className="z-0"
      >
        <MapUpdater isActive={isActive} />
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        {(() => {
          const standardIcon = L.divIcon({
            className: '',
            html: '<div style="background-color: #EF4444; width: 24px; height: 24px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>',
            iconSize: [24, 24],
            iconAnchor: [12, 12],
          });

          const ownedIcon = L.divIcon({
            className: '',
            html: '<div style="background-color: #34D399; width: 30px; height: 30px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; color: #09090B; font-size: 16px;">⭐</div>',
            iconSize: [30, 30],
            iconAnchor: [15, 15],
          });

          return needs.map((need) => {
            const isMine = need.contact_email === currentUser?.email;
            const urgencyKey = (need.urgency ?? 'low').toLowerCase();
            const description = need.needs_description ?? 'Untitled Need';
            const truncated = description.length > 100 ? `${description.slice(0, 100)}…` : description;

            const lat = need.latitude;
            const lng = need.longitude;

            if (lat == null || lng == null) {
              return null;
            }

            return (
              <Marker key={need.id} position={[lat, lng]} icon={isMine ? ownedIcon : standardIcon}>
                <Popup>
                  {isMine && <h3 style={{ color: '#34D399', fontWeight: 'bold', marginBottom: '6px' }}>⭐ YOUR REQUEST</h3>}
                  <div className="text-sm">
                    <div className="flex items-center gap-2 mb-2">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${URGENCY_COLORS[urgencyKey] ?? URGENCY_COLORS.low}`}>
                      {urgencyKey}
                    </span>
                  </div>
                  <p className="font-semibold text-zinc-900 mb-1">{need.location ?? 'Unknown Location'}</p>
                  <p className="text-zinc-700 text-xs mb-2">{truncated}</p>
                  {need.estimated_people_affected && (
                    <p className="text-zinc-600 text-xs">
                      ~{need.estimated_people_affected.toLocaleString()} people affected
                    </p>
                  )}
                  {typeof need.latitude === 'number' && typeof need.longitude === 'number' && (
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${need.latitude},${need.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-[#34D399] text-[#09090B] font-semibold text-xs px-3 py-1.5 rounded-full hover:bg-[#10B981] transition inline-block mt-3"
                    >
                      Get Directions
                    </a>
                  )}
                </div>
              </Popup>
            </Marker>
          );
          });
        })()}
      </MapContainer>
    </div>
  );
}
