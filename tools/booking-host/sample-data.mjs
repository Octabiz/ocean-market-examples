// Sample page data for previewing booking themes, in the shapes Octabiz passes to booking pages
// (octabiz.ai/developers/docs/booking-themes → "Pages you can override"). An example can swap in
// its own sample business and service with a preview.json next to theme.json (never uploaded).

export const SAMPLE = {
  org: { name: 'Harbor Wellness', initial: 'H', phone: '+1 (416) 555-0142', termsUrl: '#', privacyUrl: '#', hideBranding: false },
  service: {
    id: 'svc_sample',
    slug: 'slow-flow',
    name: 'Slow flow for beginners',
    description: 'A gentle hour of breath and movement for anyone new to yoga. Mats and blocks are ready for you, so just bring yourself.',
    highlights: ['Breathing you can use any time of day', 'Five poses that loosen a stiff back', 'How to pick the right class next'],
    durationMin: 60,
    location: { type: 'in_person', label: '12 Harbor St, Studio 2', address: '12 Harbor St, Studio 2' },
    price: { amount: 25, currency: 'USD', upfront: false },
    priceText: '$25',
    cover: null,
    host: { name: 'Maya Rivera' },
    cutoffText: 'Change or cancel online up to 1 day before.',
    minNoticeHours: 12,
    advanceDays: 60,
  },
  guest: { name: 'Sara Ahmadi', email: 'sara@northtown.co' },
  confirmationMessage: 'Arrive five minutes early. There is free parking behind the studio.',
};

/** The fields every booking asks for, before the business's questions and the theme's own. */
export const GUEST_FIELDS = [
  { id: 'name', type: 'text', label: 'Name', required: true, maxLength: 120 },
  { id: 'email', type: 'email', label: 'Email', required: true },
];

/** A question the sample business added itself (Bookings → Services → Questions). */
export const BUSINESS_FIELDS = [
  { id: 'q_notes', type: 'textarea', label: 'Anything we should know?', maxLength: 1000 },
];
