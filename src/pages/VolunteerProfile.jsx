import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import VolunteerSidebar from '../components/VolunteerSidebar';
import GlassCard from '../components/GlassCard';
import Toast from '../components/Toast';
import { Loader2, MapPin, Check, Plus, X, Navigation, Menu } from 'lucide-react';
import { API_BASE_URL } from '../config/api';

const AVAILABLE_SKILLS = [
  'Medical',
  'First Aid',
  'Search & Rescue',
  'Firefighting',
  'Supply Delivery',
  'Swimming / Flood',
  'Transport',
];

export default function VolunteerProfile() {
  const { currentUser, roleLoading } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [location, setLocation] = useState('');
  const [coords, setCoords] = useState(null); // {lat, lng}
  const [skills, setSkills] = useState([]);
  const [customSkill, setCustomSkill] = useState('');

  // Location search & autocomplete
  const [searchResults, setSearchResults] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isLocationDirty, setIsLocationDirty] = useState(false);
  const debounceRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [toast, setToast] = useState(null);
  const [geoError, setGeoError] = useState('');

  // Load profile from Firestore & localStorage
  useEffect(() => {
    async function loadProfile() {
      if (roleLoading || !currentUser?.uid) return;
      try {
        // Fast fill from localStorage
        const cachedLat = localStorage.getItem('volunteer_lat');
        const cachedLng = localStorage.getItem('volunteer_lng');
        const cachedLoc = localStorage.getItem('volunteer_location');
        const cachedSkills = localStorage.getItem('volunteer_skills');

        if (cachedLat && cachedLng) {
          setCoords({ lat: parseFloat(cachedLat), lng: parseFloat(cachedLng) });
        }
        if (cachedLoc) setLocation(cachedLoc);
        if (cachedSkills) {
          try {
            const parsed = JSON.parse(cachedSkills);
            if (Array.isArray(parsed)) setSkills(parsed);
          } catch {}
        }

        const docSnap = await getDoc(doc(db, 'users', currentUser.uid));
        if (docSnap.exists()) {
          const data = docSnap.data();
          const docLoc = data.location || data.location_name;
          const docLat = data.lat ?? data.latitude;
          const docLng = data.lng ?? data.longitude;

          if (docLoc) setLocation(docLoc);
          if (docLat != null && docLng != null) {
            setCoords({ lat: parseFloat(docLat), lng: parseFloat(docLng) });
          }
          if (Array.isArray(data.skills) && data.skills.length > 0) {
            setSkills(data.skills);
          }
        }
      } catch (err) {
        console.error('Failed to load profile:', err);
        setToast({ type: 'error', message: 'Failed to load profile data.' });
      } finally {
        setLoading(false);
      }
    }
    loadProfile();
  }, [currentUser?.uid, roleLoading]);

  // Live autocomplete search via Nominatim
  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (!isLocationDirty || !location || location.trim().length < 3) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&limit=5&addressdetails=1&q=${encodeURIComponent(
            location
          )}`,
          { headers: { 'User-Agent': 'SmartRelief/1.0' } }
        );
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data || []);
          setShowDropdown(data && data.length > 0);
        }
      } catch {
        setSearchResults([]);
        setShowDropdown(false);
      }
    }, 450);

    return () => clearTimeout(debounceRef.current);
  }, [location, isLocationDirty]);

  // Reverse geocoding with granular street / suburb details
  const handleUseMyLocation = () => {
    setGeoError('');
    if (!navigator.geolocation) {
      setGeoError('Geolocation is not supported by your browser.');
      return;
    }

    setLocating(true);
    setToast({ type: 'success', message: 'Detecting GPS coordinates with high accuracy...' });

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        setCoords({ lat: latitude, lng: longitude });
        setIsLocationDirty(false);

        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
            { headers: { 'User-Agent': 'SmartRelief/1.0' } }
          );
          if (!res.ok) throw new Error('Reverse geocoding failed');
          const data = await res.json();

          let locStr = '';
          if (data.address) {
            const addr = data.address;
            const primary =
              addr.neighbourhood ||
              addr.suburb ||
              addr.road ||
              addr.building ||
              addr.residential;
            const secondary =
              addr.city || addr.town || addr.village || addr.county || '';
            const state = addr.state || '';
            const parts = [primary, secondary, state].filter(Boolean);
            if (parts.length > 0) {
              locStr = parts.join(', ');
            }
          }
          if (!locStr && data.display_name) {
            locStr = data.display_name
              .split(',')
              .slice(0, 3)
              .map((s) => s.trim())
              .join(', ');
          }

          const finalLoc =
            locStr || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
          setLocation(finalLoc);
          setToast({ type: 'success', message: `Location updated: ${finalLoc}` });
        } catch (err) {
          console.error(err);
          setGeoError('Could not determine address name. Manual entry available.');
          setLocation(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
          setToast(null);
        } finally {
          setLocating(false);
        }
      },
      (err) => {
        console.error(err);
        setGeoError('Geolocation denied or unavailable. Please type your location manually.');
        setLocating(false);
        setToast(null);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const selectSearchResult = (item) => {
    if (!item) return;
    const lat = parseFloat(item.lat);
    const lng = parseFloat(item.lon);
    if (!isNaN(lat) && !isNaN(lng)) {
      setCoords({ lat, lng });
    }
    const locName = item.display_name || item.name || '';
    setLocation(locName);
    setIsLocationDirty(false);
    setShowDropdown(false);
    setSearchResults([]);
  };

  // Skill toggle helpers
  const toggleSkill = (skill) => {
    setSkills((prev) =>
      prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]
    );
  };

  const addCustomSkill = () => {
    const trimmed = customSkill.trim();
    if (!trimmed) return;
    if (!skills.some((s) => s.toLowerCase() === trimmed.toLowerCase())) {
      setSkills((prev) => [...prev, trimmed]);
    }
    setCustomSkill('');
  };

  const removeSkill = (skillToRemove) => {
    setSkills((prev) => prev.filter((s) => s !== skillToRemove));
  };

  // Save changes handler
  const handleSave = async () => {
    if (!currentUser) return;
    setSaving(true);
    setGeoError('');

    try {
      let finalLat = coords?.lat;
      let finalLng = coords?.lng;
      const finalLoc = location.trim();

      // If user typed manually and didn't select an autocomplete item, forward-geocode via Nominatim
      if (finalLoc && (isLocationDirty || finalLat == null || finalLng == null)) {
        try {
          const geoRes = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(
              finalLoc
            )}`,
            { headers: { 'User-Agent': 'SmartRelief/1.0' } }
          );
          if (geoRes.ok) {
            const geoData = await geoRes.json();
            if (geoData && geoData.length > 0) {
              finalLat = parseFloat(geoData[0].lat);
              finalLng = parseFloat(geoData[0].lon);
              setCoords({ lat: finalLat, lng: finalLng });
              setIsLocationDirty(false);
            }
          }
        } catch (err) {
          console.warn('Forward geocoding error during save:', err);
        }
      }

      // 1. Persist to Firestore users/{uid} doc
      const userRef = doc(db, 'users', currentUser.uid);
      await setDoc(
        userRef,
        {
          location: finalLoc,
          location_name: finalLoc,
          lat: finalLat ?? null,
          lng: finalLng ?? null,
          latitude: finalLat ?? null,
          longitude: finalLng ?? null,
          skills: skills,
          updated_at: new Date().toISOString(),
        },
        { merge: true }
      );

      // 2. Persist to localStorage for immediate synchronous reads on VolunteerDash
      if (finalLat != null && finalLng != null) {
        localStorage.setItem('volunteer_lat', String(finalLat));
        localStorage.setItem('volunteer_lng', String(finalLng));
      }
      if (finalLoc) {
        localStorage.setItem('volunteer_location', finalLoc);
        localStorage.setItem('volunteer_location_name', finalLoc);
      }
      localStorage.setItem('volunteer_skills', JSON.stringify(skills));

      // 3. Persist to Backend API (MongoDB volunteers_collection)
      const idToken = await currentUser.getIdToken();
      const payload = {
        location: finalLoc,
        location_name: finalLoc,
        lat: finalLat,
        lng: finalLng,
        skills: skills,
      };

      await fetch(`${API_BASE_URL}/api/volunteers/profile`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify(payload),
      });

      setToast({
        type: 'success',
        message: 'Profile saved! Coordinates & skills synchronized with Radar.',
      });
    } catch (err) {
      console.error('Error saving profile:', err);
      setToast({ type: 'error', message: 'Failed to save profile. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen bg-[#09090B] items-center justify-center">
        <Loader2 className="animate-spin text-[#34D399]" size={32} />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#09090B] overflow-hidden">
      <VolunteerSidebar mobileOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
        {/* Mobile Header Bar (< md:) */}
        <div className="flex md:hidden items-center justify-between pb-4 mb-4 border-b border-white/6">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-[8px] bg-[#34D399] flex items-center justify-center flex-shrink-0">
              <span className="text-[#09090B] font-black text-xs">SR</span>
            </div>
            <span className="font-extrabold text-white text-sm tracking-tight">SmartRelief</span>
            <span className="text-[10px] font-semibold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-full">
              Profile
            </span>
          </div>
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="p-2 rounded-lg bg-white/5 border border-white/10 text-zinc-300 hover:text-white cursor-pointer"
            aria-label="Open mobile navigation menu"
          >
            <Menu size={18} />
          </button>
        </div>

        <div className="mb-8">
          <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-[-0.05em]">
            Profile & Settings
          </h1>
          <p className="text-zinc-500 text-xs sm:text-sm mt-1">
            Configure your exact radar anchor and responder skill-set for precision mission dispatch.
          </p>
        </div>

        <div className="max-w-2xl space-y-6">
          {/* Location & GPS Anchor Card */}
          <GlassCard className="rounded-[24px] p-4 sm:p-8 relative z-30">
            <h2 className="text-white font-bold text-base mb-1">Radar Location & Anchor</h2>
            <p className="text-zinc-500 text-xs mb-4">
              Enter your exact neighborhood or building so nearby crisis missions are calculated with pinpoint accuracy.
            </p>

            <div className="relative">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => {
                      setLocation(e.target.value);
                      setIsLocationDirty(true);
                    }}
                    onFocus={() => {
                      if (searchResults.length > 0) setShowDropdown(true);
                    }}
                    onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                    placeholder="e.g. Venkatesh Kunj, Bhayandar West"
                    className="w-full bg-white/5 border border-[rgba(255,255,255,0.08)] rounded-[12px] px-4 py-3 text-white text-sm focus:outline-none focus:border-[#34D399]/50 transition"
                  />
                  {/* Autocomplete suggestions dropdown */}
                  {showDropdown && searchResults.length > 0 && (
                    <ul className="absolute z-50 w-full shadow-2xl bg-slate-800 border border-slate-700 rounded-md top-full left-0 mt-1 max-h-56 overflow-y-auto">
                      {searchResults.map((item, idx) => (
                        <li
                          key={item.place_id || idx}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            selectSearchResult(item);
                          }}
                          onClick={() => selectSearchResult(item)}
                          className="px-4 py-2.5 text-xs text-zinc-200 hover:bg-slate-700 hover:text-white cursor-pointer transition border-b border-slate-700/60 last:border-0 truncate flex items-center gap-2"
                        >
                          <MapPin size={12} className="text-[#34D399] shrink-0" />
                          <span className="truncate">{item.display_name}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleUseMyLocation}
                  disabled={locating}
                  className="flex items-center justify-center gap-2 px-5 py-3 rounded-[12px] bg-white/5 border border-[rgba(255,255,255,0.08)] text-zinc-300 hover:text-white hover:bg-white/10 transition text-sm font-medium shrink-0 disabled:opacity-50 cursor-pointer"
                >
                  {locating ? (
                    <Loader2 size={16} className="animate-spin text-[#34D399]" />
                  ) : (
                    <Navigation size={16} className="text-[#34D399]" />
                  )}
                  Use My Location
                </button>
              </div>

              {geoError && <p className="text-yellow-500/80 text-xs mt-2">{geoError}</p>}

              {/* Exact Coordinates Pill */}
              {coords && (
                <div className="mt-3 flex items-center gap-2 text-xs text-zinc-400 bg-white/[0.03] border border-white/5 rounded-full px-3 py-1 w-fit">
                  <span className="inline-block w-2 h-2 rounded-full bg-[#34D399]" />
                  <span>
                    GPS Anchor:{' '}
                    <strong className="text-zinc-200">
                      {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
                    </strong>
                  </span>
                </div>
              )}
            </div>
          </GlassCard>

          {/* Responder Skills & Certifications Card */}
          <GlassCard className="rounded-[24px] p-4 sm:p-8 relative z-10">
            <h2 className="text-white font-bold text-base mb-1">
              Responder Skills & Certifications
            </h2>
            <p className="text-zinc-500 text-xs mb-4">
              Select your emergency capabilities to activate personalized AI matching on the "Recommended for Me" radar feed.
            </p>

            {/* Clickable toggle pills */}
            <div className="flex flex-wrap gap-2.5 mb-5">
              {AVAILABLE_SKILLS.map((skill) => {
                const isSelected = skills.includes(skill);
                return (
                  <button
                    key={skill}
                    type="button"
                    onClick={() => toggleSkill(skill)}
                    className={`px-4 py-2 rounded-full text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer select-none ${
                      isSelected
                        ? 'bg-[#34D399] text-[#09090B] shadow-[0_0_12px_rgba(52,211,153,0.3)]'
                        : 'bg-white/5 border border-white/10 text-zinc-400 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    {isSelected && <Check size={13} className="stroke-[3]" />}
                    {skill}
                  </button>
                );
              })}
            </div>

            {/* Add custom skill */}
            <div className="flex items-center gap-2 max-w-sm">
              <input
                type="text"
                value={customSkill}
                onChange={(e) => setCustomSkill(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addCustomSkill();
                  }
                }}
                placeholder="Add custom skill (e.g. HAM Radio)..."
                className="flex-1 bg-white/5 border border-white/10 rounded-[10px] px-3 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-[#34D399]/50"
              />
              <button
                type="button"
                onClick={addCustomSkill}
                className="px-3.5 py-2 rounded-[10px] bg-white/10 text-zinc-300 hover:text-white text-xs font-medium flex items-center gap-1 transition cursor-pointer"
              >
                <Plus size={13} /> Add
              </button>
            </div>

            {/* Selected custom skills chips */}
            {skills.filter((s) => !AVAILABLE_SKILLS.includes(s)).length > 0 && (
              <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-white/5">
                <span className="text-[11px] text-zinc-500 self-center">Other:</span>
                {skills
                  .filter((s) => !AVAILABLE_SKILLS.includes(s))
                  .map((s) => (
                    <span
                      key={s}
                      className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-1"
                    >
                      {s}
                      <button
                        type="button"
                        onClick={() => removeSkill(s)}
                        className="hover:text-white transition cursor-pointer"
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))}
              </div>
            )}
          </GlassCard>

          {/* Action Footer */}
          <div className="flex justify-end pt-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-[#34D399] text-[#09090B] px-8 py-3 rounded-full font-bold text-sm hover:bg-[#10B981] transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer shadow-lg shadow-[#34D399]/10"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : 'Save Changes'}
            </button>
          </div>
        </div>
      </main>

      {toast && (
        <Toast
          type={toast.type}
          message={toast.message}
          onDismiss={() => setToast(null)}
        />
      )}
    </div>
  );
}
