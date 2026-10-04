// Sample page data for previewing booking themes, in the shapes Octabiz passes to booking pages
// (octabiz.ai/developers/docs/booking-themes → "Pages you can override").

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
    host: { name: 'Maya Rivera' },
    cutoffText: 'Change or cancel online up to 1 day before.',
    minNoticeHours: 12,
    advanceDays: 60,
  },
  guest: { name: 'Sara Ahmadi', email: 'sara@northtown.co' },
  confirmationMessage: 'Arrive five minutes early. There is free parking behind the studio.',
};
