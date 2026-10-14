import { useRef, useState } from 'react';
import { ScanLine, CheckCircle } from 'lucide-react';
import GlassCard from '../../components/GlassCard';
import Toast from '../../components/Toast';
import SkillsTagInput from '../../components/SkillsTagInput';
import { API_BASE_URL } from '../../config/api';

const OCR_FILL = {
  full_name: 'Priya Sharma',
  location: 'Mumbai, Maharashtra, India',
  skills: ['Emergency Medicine', 'Triage', 'Field Coordination'],
  availability: 'immediate',
  contact_email: 'priya.sharma@example.org',
  phone: '+91 98200 11234',
  role_preference: 'specialist',
};

const LABEL = 'block text-zinc-400 text-[11px] font-semibold uppercase tracking-widest mb-1.5';
const INPUT =
  'bg-white/5 border border-[rgba(255,255,255,0.08)] rounded-[12px] px-4 py-3 text-white text-sm placeholder-zinc-600 focus:outline-none focus:border-[#34D399]/50 transition w-full';
const INPUT_ERROR =
  'bg-white/5 border border-red-500/50 rounded-[12px] px-4 py-3 text-white text-sm placeholder-zinc-600 focus:outline-none transition w-full';

const ROLES = [
  { value: 'volunteer', label: 'Volunteer' },
  { value: 'coordinator', label: 'Coordinator' },
  { value: 'specialist', label: 'Specialist' },
];

const EMPTY_FORM = {
  full_name: '',
  location: '',
  skills: [],
  availability: 'immediate',
  role_preference: 'volunteer',
  contact_email: '',
  phone: '',
};

export default function VolunteerIntake() {
  const [ocrState, setOcrState] = useState('idle');
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef(null);

  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [errors, setErrors] = useState({});
  const [submitState, setSubmitState] = useState('idle');
  const [toast, setToast] = useState(null);

  // ── OCR Mock ──────────────────────────────────────────────────────────────

  const triggerScan = () => {
    if (ocrState !== 'idle') return;
    setTimeout(() => {
      setOcrState('scanning');
      setProgress(0);
      setTimeout(() => setProgress(100), 50);
      setTimeout(() => {
        setForm((prev) => ({
          ...prev,
          full_name: OCR_FILL.full_name,
          location: OCR_FILL.location,
          skills: OCR_FILL.skills,
          availability: OCR_FILL.availability,
          contact_email: OCR_FILL.contact_email,
          phone: OCR_FILL.phone,
          role_preference: OCR_FILL.role_preference,
        }));
        setOcrState('done');
      }, 2000);
    }, 300);
  };

  const handleFileDrop = (e) => {
    e.preventDefault();
    triggerScan();
  };
  const handleFileChange = () => triggerScan();

  // ── Form helpers ──────────────────────────────────────────────────────────

  const set = (field) => (e) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const validate = () => {
    const errs = {};
    if (!form.full_name || form.full_name.trim().length < 2)
      errs.full_name = 'Full name must be at least 2 characters.';
    if (!form.location || form.location.trim().length < 3)
      errs.location = 'Location must be at least 3 characters.';
    if (!form.skills || form.skills.length < 1)
      errs.skills = 'Add at least one skill.';
    if (!form.contact_email || !form.contact_email.includes('@'))
      errs.contact_email = 'Please enter a valid email address.';
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

    const body = {
      full_name: form.full_name.trim(),
      location: form.location.trim(),
      skills: form.skills,
      availability: form.availability,
      contact_email: form.contact_email.trim(),
      role_preference: form.role_preference,
      ...(form.phone ? { phone: form.phone.trim() } : {}),
    };

    try {
      const res = await fetch(`${API_BASE_URL}/api/volunteers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (res.status === 201) {
        setSubmitState('done');
        setToast({
          type: 'success',
          message: 'Volunteer registered and added to the matching pool.',
        });
        setTimeout(() => {
          setForm({ ...EMPTY_FORM });
          setOcrState('idle');
          setProgress(0);
          setSubmitState('idle');
        }, 2500);
      } else if (res.status === 409) {
        setSubmitState('idle');
        setToast({ type: 'error', message: 'A profile with this email already exists.' });
      } else {
        setSubmitState('idle');
        setToast({ type: 'error', message: data.detail || 'An error occurred.' });
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
      ? '✓ Volunteer Registered Successfully'
      : 'Register Volunteer';

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-8 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold text-white tracking-[-0.05em]">
          Register a Volunteer
        </h1>
        <p className="text-zinc-500 text-sm mt-1">
          Add a volunteer to the SmartRelief matching pool.
        </p>
      </div>

      {/* OCR Drop Zone */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleFileDrop}
        onClick={() => ocrState === 'idle' && fileInputRef.current?.click()}
        className="rounded-[16px] border-2 border-dashed border-[rgba(255,255,255,0.10)] bg-white/[0.03] p-8 text-center transition hover:border-[#34D399]/40 cursor-pointer mb-8"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.pdf"
          className="hidden"
          onChange={handleFileChange}
        />

        {ocrState === 'idle' && (
          <>
            <ScanLine size={28} className="mx-auto text-zinc-500" />
            <p className="text-zinc-300 text-sm font-medium mt-3">
              Drag &amp; drop a field form or photo
            </p>
            <p className="text-zinc-600 text-xs mt-1">
              PNG, JPG, PDF · SmartRelief OCR will auto-fill the form below
            </p>
          </>
        )}

        {ocrState === 'scanning' && (
          <>
            <div className="w-8 h-8 rounded-full border-2 border-[#34D399] border-t-transparent animate-spin mx-auto" />
            <p className="text-[#34D399] text-sm font-medium mt-3">Scanning document...</p>
            <div className="mt-4 h-1 rounded-full bg-white/10 overflow-hidden max-w-xs mx-auto">
              <div
                className="h-full bg-[#34D399] rounded-full transition-all duration-[2000ms] ease-linear"
                style={{ width: `${progress}%` }}
              />
            </div>
          </>
        )}

        {ocrState === 'done' && (
          <>
            <CheckCircle size={28} className="mx-auto text-[#34D399]" />
            <p className="text-[#34D399] text-sm font-semibold mt-2">
              Scan complete — form auto-filled
            </p>
            <p className="text-zinc-500 text-xs">
              Review and edit the fields below before submitting.
            </p>
          </>
        )}
      </div>

      {/* Form */}
      <GlassCard className="rounded-[24px] p-8">
        <div className="space-y-6">
          {/* Full Name */}
          <div>
            <label className={LABEL}>Full Name</label>
            <input
              type="text"
              value={form.full_name}
              onChange={set('full_name')}
              placeholder="Volunteer's full name"
              className={errors.full_name ? INPUT_ERROR : INPUT}
            />
            {errors.full_name && (
              <p className="text-red-400 text-xs mt-1">{errors.full_name}</p>
            )}
          </div>

          {/* Location */}
          <div>
            <label className={LABEL}>Location</label>
            <input
              type="text"
              value={form.location}
              onChange={set('location')}
              placeholder="City, Region, Country"
              className={errors.location ? INPUT_ERROR : INPUT}
            />
            {errors.location && (
              <p className="text-red-400 text-xs mt-1">{errors.location}</p>
            )}
          </div>

          {/* Skills Tag Input */}
          <div>
            <label className={LABEL}>Skills</label>
            <SkillsTagInput
              value={form.skills}
              onChange={(skills) => setForm((prev) => ({ ...prev, skills }))}
              error={errors.skills}
            />
            {errors.skills && (
              <p className="text-red-400 text-xs mt-1">{errors.skills}</p>
            )}
          </div>

          {/* Availability */}
          <div>
            <label className={LABEL}>Availability</label>
            <select
              value={form.availability}
              onChange={set('availability')}
              className={`appearance-none ${INPUT}`}
            >
              <option className="bg-slate-900 text-white" value="immediate">⚡ Immediate — Can deploy within hours</option>
              <option className="bg-slate-900 text-white" value="within_24h">🕐 Within 24 hours</option>
              <option className="bg-slate-900 text-white" value="within_week">📅 Within this week</option>
              <option className="bg-slate-900 text-white" value="flexible">🔄 Flexible — Based on mission</option>
            </select>
          </div>

          {/* Role Preference — pill toggle */}
          <div>
            <label className={LABEL}>Role Preference</label>
            <div className="flex gap-2">
              {ROLES.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, role_preference: r.value }))}
                  className={`flex-1 py-2.5 rounded-full text-sm font-semibold transition cursor-pointer ${
                    form.role_preference === r.value
                      ? 'bg-[#34D399] text-[#09090B]'
                      : 'bg-white/5 text-zinc-400 border border-[rgba(255,255,255,0.08)] hover:text-white'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {/* Contact Email */}
          <div>
            <label className={LABEL}>Contact Email</label>
            <input
              type="email"
              value={form.contact_email}
              onChange={set('contact_email')}
              placeholder="volunteer@organisation.org"
              className={errors.contact_email ? INPUT_ERROR : INPUT}
            />
            {errors.contact_email && (
              <p className="text-red-400 text-xs mt-1">{errors.contact_email}</p>
            )}
          </div>

          {/* Phone */}
          <div>
            <label className={LABEL}>Phone <span className="normal-case text-zinc-600 font-normal">(optional)</span></label>
            <input
              type="tel"
              value={form.phone}
              onChange={set('phone')}
              placeholder="+1 555 000 0000"
              className={INPUT}
            />
          </div>

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={submitState === 'loading' || submitState === 'done'}
            className="w-full py-3.5 rounded-full bg-[#34D399] text-[#09090B] font-bold text-sm hover:bg-[#10B981] transition disabled:opacity-50 cursor-pointer"
          >
            {btnLabel}
          </button>
        </div>
      </GlassCard>

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
