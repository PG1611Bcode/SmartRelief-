/**
 * Generates a WhatsApp SOS emergency dispatch share link
 * formatted with live emergency details and Google Maps coordinate link.
 */
export function getWhatsAppEmergencyUrl(need) {
  if (!need) return '';
  const desc = need.needs_description || need.description || 'Assistance requested.';
  const urgency = (need.computed_urgency || need.urgency || 'HIGH').toUpperCase();
  const score = need.urgency_score != null ? ` (Urgency Score: ${need.urgency_score})` : '';
  const location = need.location || 'Emergency Site';
  const people = need.people_affected ?? need.headcount ?? need.estimated_people_affected ?? 1;
  const status = (need.status || 'open').toUpperCase();

  const mapLink = (need.lat && need.lng)
    ? `https://www.google.com/maps?q=${need.lat},${need.lng}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`;

  const text = [
    `🚨 *SMARTRELIEF EMERGENCY SOS ALERT* 🚨`,
    ``,
    `*Urgency:* ${urgency}${score}`,
    `*Status:* ${status}`,
    `*Location:* ${location}`,
    `*Live Map Pin:* ${mapLink}`,
    `*People Affected:* ~${people}`,
    `*Details:* ${desc}`,
    ``,
    `Coordinate & Respond via SmartRelief.`
  ].join('\n');

  return `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
}
