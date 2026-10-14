import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import GlassCard from '../../components/GlassCard';
import Toast from '../../components/Toast';
import { useAuth } from '../../context/AuthContext';
import { redirectByRole } from '../../utils/roleRedirect';
import { API_BASE_URL } from '../../config/api';

// Fix Leaflet default marker icon broken in Vite asset pipeline
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

const LABEL = 'block text-zinc-400 text-[11px] font-semibold uppercase tracking-widest mb-1.5';
const INPUT =
  'bg-white/5 border border-[rgba(255,255,255,0.08)] rounded-[12px] px-4 py-3 text-white text-sm placeholder-zinc-600 focus:outline-none focus:border-[#34D399]/50 transition w-full';
const INPUT_ERROR =
  'bg-white/5 border border-red-500/50 rounded-[12px] px-4 py-3 text-white text-sm placeholder-zinc-600 focus:outline-none transition w-full';

const EMPTY_FORM = {
  reporter_name: '',
  needs_description: '',
  estimated_people_affected: '',
  volunteers_needed: '1',
  contact_email: '',
};

export default function NeedsIntake() {
  const { currentUser, role } = useAuth();
  const navigate = useNavigate();

  // OCR state
  const [ocrState, setOcrState] = useState('idle'); // idle | scanning | done | error
  const [previewUrl, setPreviewUrl] = useState(null);
  const requestIdRef = useRef(0);
  const fileInputRef = useRef(null);

  // Form state
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [errors, setErrors] = useState({});
  const [submitState, setSubmitState] = useState('idle'); // idle | loading | done
  const [toast, setToast] = useState(null);
  const [cancelWarning, setCancelWarning] = useState(false);

  // Map / location state
  const [formCoords, setFormCoords] = useState({ lat: 19.2952, lng: 72.8544 }); // Mira Bhayandar default
  const [mapSearchQuery, setMapSearchQuery] = useState('');
  const [mapSearchError, setMapSearchError] = useState(null);
  const [searchResults, setSearchResults] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const debounceRef = useRef(null);

  // ── Geocoding ─────────────────────────────────────────────────────────────

  const searchAndFlyTo = async (query) => {
    setMapSearchError(null);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`,
        {
          headers: { 'User-Agent': 'SmartRelief/1.0' },
          signal: controller.signal,
        }
      );
      clearTimeout(timeoutId);
      const results = await res.json();
      if (results.length > 0) {
        const lat = parseFloat(results[0].lat);
        const lng = parseFloat(results[0].lon);
        setFormCoords({ lat, lng });
        mapRef.current?.setView([lat, lng], 14);
      } else {
        setMapSearchError('Location not found — drag the pin manually');
      }
    } catch {
      clearTimeout(timeoutId);
      setMapSearchError('Search unavailable — drag the pin manually');
    }
  };

  // ── Live Autocomplete ──────────────────────────────────────────────────────

  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (mapSearchQuery.length < 3) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(mapSearchQuery)}&format=json&addressdetails=1&limit=5`,
          {
            headers: { 'User-Agent': 'SmartRelief/1.0' },
            signal: controller.signal,
          }
        );
        clearTimeout(timeoutId);
        const results = await res.json();
        setSearchResults(results);
        setShowDropdown(results.length > 0);
      } catch {
        clearTimeout(timeoutId);
        setSearchResults([]);
        setShowDropdown(false);
      }
    }, 500);

    return () => clearTimeout(debounceRef.current);
  }, [mapSearchQuery]);

  // ── Cancel ────────────────────────────────────────────────────────────────

  const handleCancel = () => {
    const isDirty = Object.entries(form).some(([k, v]) => {
      if (k === 'contact_email') return false;
      return String(v ?? '').trim().length > 0;
    });
    if (isDirty) {
      setCancelWarning(true);
      setTimeout(() => redirectByRole(role, navigate), 2000);
    } else {
      redirectByRole(role, navigate);
    }
  };

  // Auto-populate contact_email from logged-in user
  useEffect(() => {
    if (currentUser?.email) {
      setForm((prev) => ({ ...prev, contact_email: currentUser.email }));
    }
  }, [currentUser?.email]);

  // ── OCR ───────────────────────────────────────────────────────────────────

  const encodeToBase64 = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const myId = ++requestIdRef.current;
    setPreviewUrl(URL.createObjectURL(file));
    setOcrState('scanning');
    try {
      const base64 = await encodeToBase64(file);
      const res = await fetch(`${API_BASE_URL}/api/needs/ocr`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_base64: base64 }),
      });
      if (requestIdRef.current !== myId) return;
      if (res.ok) {
        const data = await res.json();
        
        // Strict key alias binding across model response variations
        const reporterName = data.reporter_name || '';
        const description = data.needs_description || data.description || '';
        const locationName = data.location_name || data.location || '';
        const peopleAffected =
          data.people_affected || data.headcount || data.estimated_people_affected || '';
        const volunteersNeeded = data.volunteers_needed || '';

        // Only show "Extraction complete" if at least needs_description or location_name is non-empty
        const hasContent = description.trim().length > 0 || locationName.trim().length > 0;
        if (!hasContent) {
          setOcrState('error');
          setToast({
            type: 'error',
            message: 'Could not extract emergency details from this image. Please fill details manually.',
          });
          return;
        }

        // Auto-fill all extracted input fields
        setForm((f) => ({
          ...f,
          ...(reporterName ? { reporter_name: reporterName } : {}),
          ...(description ? { needs_description: description } : {}),
          ...(peopleAffected ? { estimated_people_affected: String(peopleAffected) } : {}),
          ...(volunteersNeeded ? { volunteers_needed: String(volunteersNeeded) } : {}),
        }));

        // Automatically trigger Nominatim OpenStreetMap geocoding so map pin flies to extracted location
        if (locationName) {
          setMapSearchQuery(locationName);
          searchAndFlyTo(locationName);
        }

        setOcrState('done');
      } else {
        const errData = await res.json().catch(() => null);
        const errMsg = errData?.detail || 'OCR extraction failed.';
        setOcrState('error');
        setToast({
          type: 'error',
          message: typeof errMsg === 'string' ? errMsg : JSON.stringify(errMsg),
        });
      }
    } catch {
      if (requestIdRef.current !== myId) return;
      setOcrState('error');
      setToast({
        type: 'error',
        message: 'Could not connect to OCR service. Please ensure backend is running.',
      });
    }
  };

  const handleFileDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer?.files?.[0];
    if (file) handleFileChange({ target: { files: [file] } });
  };

  // ── Form helpers ──────────────────────────────────────────────────────────

  const set = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const validate = () => {
    const errs = {};
    if (!form.reporter_name || form.reporter_name.trim().length < 2)
      errs.reporter_name = 'Reporter name must be at least 2 characters.';
    if (!form.needs_description || form.needs_description.trim().length < 10)
      errs.needs_description = 'Description must be at least 10 characters.';
    return errs;
  };

  const handleSubmit = async () => {
    const errs = validate();
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }
    setErrors({});
    setSubmitState('loading');

    // Silent AI scorer
    let ai_score = null;
    let computed_urgency = null;
    let urgency_override = false;
    let keyword_hits = [];

    try {
      const scoreRes = await fetch(`${API_BASE_URL}/api/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: form.needs_description,
          claimed_urgency: 'medium',
          people_affected: form.estimated_people_affected
            ? parseInt(form.estimated_people_affected, 10)
            : 1,
        }),
      });
      if (scoreRes.ok) {
        const scoreData = await scoreRes.json();
        ai_score = scoreData.normalized_score ?? null;
        computed_urgency = scoreData.computed_urgency ?? 'medium';
        urgency_override = scoreData.override_flag ?? false;
        keyword_hits = scoreData.keyword_hits ?? [];
      } else {
        computed_urgency = 'medium';
      }
    } catch {
      computed_urgency = 'medium';
    }

    let idToken = null;
    if (currentUser) {
      try { idToken = await currentUser.getIdToken(); } catch { /* non-fatal */ }
    }

    const reporterName = form.reporter_name.trim() || currentUser?.displayName || '';
    const contactEmail = form.contact_email.trim() || currentUser?.email || null;

    const locationText = (mapSearchQuery.trim() || `Pin: ${formCoords.lat.toFixed(5)}, ${formCoords.lng.toFixed(5)}`).slice(0, 190);

    const body = {
      reporter_name: reporterName,
      location: locationText,
      urgency: computed_urgency,
      needs_description: form.needs_description.trim(),
      ...(contactEmail ? { contact_email: contactEmail } : {}),
      ...(form.estimated_people_affected
        ? { estimated_people_affected: Math.max(1, parseInt(form.estimated_people_affected, 10) || 1) }
        : {}),
      volunteers_needed: Math.max(1, parseInt(form.volunteers_needed, 10) || 1),
      ai_score,
      computed_urgency,
      urgency_override,
      keyword_hits,
      // user_uid is set server-side from the verified token; omit from payload
      // Map always has a position — never null
      latitude: parseFloat(formCoords.lat),
      longitude: parseFloat(formCoords.lng),
    };

    try {
      const res = await fetch(`${API_BASE_URL}/api/needs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
        },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (res.status === 201) {
        setSubmitState('done');
      } else {
        setSubmitState('idle');
        const errMsg = data?.detail
          ? typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail)
          : `Server returned ${res.status}`;
        setToast({ type: 'error', message: errMsg });
      }
    } catch {
      setSubmitState('idle');
      setToast({ type: 'error', message: 'Could not reach the server. Is the backend running?' });
    }
  };

  const btnLabel =
    submitState === 'loading'
      ? 'Submitting...'
      : submitState === 'done'
      ? '✓ Need Reported Successfully'
      : 'Submit Need Report';

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-4 sm:p-8 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold text-white tracking-[-0.05em]">
          Report a Need
        </h1>
        <p className="text-zinc-500 text-sm mt-1">
          Submit a humanitarian need for smart prioritization and volunteer matching.
        </p>
      </div>

      {submitState === 'done' ? (
        <GlassCard className="rounded-[24px] p-10 text-center flex flex-col items-center">
          <div className="w-16 h-16 rounded-full bg-[#34D399]/20 flex items-center justify-center mb-6">
            <CheckCircle size={32} className="text-[#34D399]" />
          </div>
          <h2 className="text-2xl font-extrabold text-white tracking-[-0.05em] mb-2">Need Reported Successfully</h2>
          <p className="text-zinc-400 text-sm mb-8 max-w-md">
            Your humanitarian need has been received, prioritized by our AI, and pushed to available volunteers.
          </p>
          <div className="flex items-center justify-center gap-4 w-full max-w-sm mx-auto">
            <button
              onClick={() => {
                setPreviewUrl(null);
                setOcrState('idle');
                setSubmitState('idle');
                setForm({ ...EMPTY_FORM, contact_email: currentUser?.email ?? '' });
                setMapSearchQuery('');
                setMapSearchError(null);
                setFormCoords({ lat: 19.2952, lng: 72.8544 });
              }}
              className="flex-1 py-3 rounded-full bg-[#34D399] text-[#09090B] font-bold text-sm hover:bg-[#10B981] transition"
            >
              Submit Another Request
            </button>
            <button
              onClick={() => redirectByRole(role, navigate)}
              className="flex-1 py-3 rounded-full border border-[rgba(255,255,255,0.1)] text-white font-bold text-sm hover:bg-white/5 transition"
            >
              Return to Dashboard
            </button>
          </div>
        </GlassCard>
      ) : (
        <>
          {/* Upload Zone */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleFileDrop}
            onClick={() => fileInputRef.current?.click()}
            className="rounded-[16px] border-2 border-dashed border-[rgba(255,255,255,0.10)] bg-white/[0.03] p-8 text-center transition hover:border-[#34D399]/40 cursor-pointer mb-8 relative"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleFileChange}
            />

            {previewUrl && (
              <img
                src={previewUrl}
                alt="Selected preview"
                className="w-24 h-24 object-cover rounded-[10px] mx-auto mb-4 border border-white/10"
              />
            )}

            {ocrState === 'idle' && (
              <>
                {!previewUrl && (
                  <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-3">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                    </svg>
                  </div>
                )}
                <p className="text-zinc-300 text-sm font-medium">Take Photo or Upload Image</p>
                <p className="text-zinc-600 text-xs mt-1">AI will extract the need details automatically</p>
              </>
            )}

            {ocrState === 'scanning' && (
              <>
                <div className="w-8 h-8 rounded-full border-2 border-[#34D399] border-t-transparent animate-spin mx-auto mb-3" />
                <p className="text-[#34D399] text-sm font-medium">Extracting details…</p>
              </>
            )}

            {ocrState === 'done' && (
              <>
                <CheckCircle size={24} className="mx-auto text-[#34D399] mb-2" />
                <p className="text-[#34D399] text-sm font-semibold">Extraction complete</p>
                <p className="text-zinc-500 text-xs mt-0.5">Tap to select a different image</p>
              </>
            )}

            {ocrState === 'error' && (
              <p className="text-red-400 text-sm">
                Could not extract text from this image — please fill in the details manually
              </p>
            )}
          </div>

          {/* AI success banner */}
          {ocrState === 'done' && (
            <div className="flex items-start gap-3 bg-[#34D399]/10 border border-[#34D399]/30 rounded-[12px] px-4 py-3 mb-6">
              <CheckCircle size={16} className="text-[#34D399] mt-0.5 shrink-0" />
              <p className="text-[#34D399] text-sm flex-1">
                AI extracted the details below — please review before submitting
              </p>
              <button
                onClick={(e) => { e.stopPropagation(); setOcrState('idle'); }}
                className="text-[#34D399]/60 hover:text-[#34D399] text-xs font-medium transition shrink-0"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Form fields */}
          <div className="relative">
            {ocrState === 'scanning' && (
              <div className="absolute inset-0 bg-black/40 rounded-[24px] z-10 flex items-center justify-center backdrop-blur-sm">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-8 h-8 rounded-full border-2 border-[#34D399] border-t-transparent animate-spin" />
                  <p className="text-[#34D399] text-sm font-medium">Extracting details…</p>
                </div>
              </div>
            )}
            <GlassCard className="rounded-[24px] p-4 sm:p-8">
              <div className="space-y-6">

                {/* Reporter Name */}
                <div>
                  <label className={LABEL}>Reporter Name</label>
                  <input
                    type="text"
                    value={form.reporter_name}
                    onChange={set('reporter_name')}
                    placeholder="Full name of the reporter"
                    className={errors.reporter_name ? INPUT_ERROR : INPUT}
                  />
                  {errors.reporter_name && (
                    <p className="text-red-400 text-xs mt-1">{errors.reporter_name}</p>
                  )}
                </div>

                {/* Location — Map Picker */}
                <div>
                  <label className={LABEL}>Location</label>

                  {/* Search row */}
                  <div className="relative mb-2">
                    <input
                      type="text"
                      value={mapSearchQuery}
                      onChange={(e) => setMapSearchQuery(e.target.value)}
                      onFocus={() => {
                        if (searchResults.length > 0) setShowDropdown(true);
                      }}
                      onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
                      placeholder="Search area..."
                      className={INPUT}
                      autoComplete="off"
                    />

                    {showDropdown && searchResults.length > 0 && (
                      <ul className="absolute top-full left-0 right-0 z-[1000] bg-[#18181B] border border-[rgba(255,255,255,0.10)] rounded-[14px] overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.4)] mt-1 max-h-48 overflow-y-auto">
                        {searchResults.map((result, idx) => (
                          <li
                            key={result.place_id || idx}
                            className="px-4 py-3 text-sm text-zinc-300 hover:bg-white/8 hover:text-white cursor-pointer transition border-b border-white/5 last:border-0 truncate"
                            onMouseDown={() => {
                              const lat = parseFloat(result.lat);
                              const lon = parseFloat(result.lon);
                              setFormCoords({ lat, lng: lon });
                              mapRef.current?.setView([lat, lon], 14);
                              setMapSearchQuery(result.display_name);
                              setSearchResults([]);
                              setShowDropdown(false);
                              setMapSearchError(null);
                            }}
                          >
                            {result.display_name}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {mapSearchError && (
                    <p className="text-zinc-500 text-xs mb-2">{mapSearchError}</p>
                  )}

                  {/* Map container — scrollWheelZoom off to avoid hijacking mobile scroll */}
                  <div className="rounded-[16px] overflow-hidden relative z-0">
                    <MapContainer
                      style={{ height: '250px', width: '100%' }}
                      center={[formCoords.lat, formCoords.lng]}
                      zoom={13}
                      scrollWheelZoom={window.innerWidth > 768}
                      ref={mapRef}
                    >
                      <TileLayer
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                      />
                      <Marker
                        position={[formCoords.lat, formCoords.lng]}
                        draggable={true}
                        ref={markerRef}
                        eventHandlers={{
                          dragend: () => {
                            const pos = markerRef.current?.getLatLng();
                            if (pos) setFormCoords({ lat: pos.lat, lng: pos.lng });
                          },
                        }}
                      >
                        <Popup>Drag to place pin exactly</Popup>
                      </Marker>
                    </MapContainer>
                  </div>

                  {/* Read-only coordinate confirmation */}
                  <p className="text-zinc-500 text-xs mt-2">
                    📍 {formCoords.lat.toFixed(5)}, {formCoords.lng.toFixed(5)}
                  </p>
                </div>

                {/* Needs Description */}
                <div>
                  <label className={LABEL}>Needs Description</label>
                  <textarea
                    rows={4}
                    value={form.needs_description}
                    onChange={set('needs_description')}
                    placeholder="Describe the situation, resources needed, and any access constraints..."
                    className={errors.needs_description ? INPUT_ERROR : INPUT}
                  />
                  {errors.needs_description && (
                    <p className="text-red-400 text-xs mt-1">{errors.needs_description}</p>
                  )}
                </div>

                {/* Estimated People */}
                <div>
                  <label className={LABEL}>Estimated People Affected</label>
                  <input
                    type="number"
                    min={1}
                    value={form.estimated_people_affected}
                    onChange={set('estimated_people_affected')}
                    placeholder="e.g. 150"
                    className={INPUT}
                  />
                </div>

                {/* Volunteers Needed */}
                <div>
                  <label className={LABEL}>Volunteers Needed</label>
                  <p className="text-zinc-600 text-[10px] mb-1.5">How many volunteers does this mission require?</p>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={form.volunteers_needed}
                    onChange={set('volunteers_needed')}
                    placeholder="1"
                    className={INPUT}
                  />
                </div>

                {/* Contact Email */}
                <div>
                  <label className={LABEL}>Contact Email</label>
                  <input
                    type="email"
                    value={form.contact_email}
                    onChange={set('contact_email')}
                    placeholder="Optional — for follow-up communications"
                    className={INPUT}
                  />
                </div>

                {/* Submit + Cancel */}
                <div className="flex flex-col gap-2">
                  <button
                    onClick={handleSubmit}
                    disabled={submitState === 'loading' || submitState === 'done'}
                    className="w-full py-3.5 rounded-full bg-[#34D399] text-[#09090B] font-bold text-sm hover:bg-[#10B981] transition disabled:opacity-50 cursor-pointer"
                  >
                    {btnLabel}
                  </button>
                  <button
                    onClick={handleCancel}
                    disabled={submitState === 'loading'}
                    className="w-full py-3 rounded-full border border-[rgba(255,255,255,0.08)] text-zinc-400 font-semibold text-sm hover:text-white hover:border-white/20 transition disabled:opacity-40 cursor-pointer"
                  >
                    Cancel
                  </button>
                  {cancelWarning && (
                    <p className="text-yellow-400 text-xs text-center mt-1 animate-pulse">
                      Progress will be lost. Navigating to your dashboard…
                    </p>
                  )}
                </div>

              </div>
            </GlassCard>
          </div>
        </>
      )}

      {/* Toast */}
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
