/**
 * Price breakdown: what a base price usually covers, what is often billed on top,
 * and one-time fees, for each type of care.
 *
 * These are the usual patterns for each type of care, not one place's own fee sheet.
 * When a place publishes its fees, put them on that place's JSON file as
 *   "fees": { "included": [...], "extra": [[name, how it is charged], ...], "oneTime": [...], "source": "..." }
 * and they replace the general list for that place.
 */
import { fmt } from './util.js';

const NURSING = {
  unit: 'a day', unitNote: 'Nursing homes quote a daily rate. A 30-day month is shown.',
  included: [
    'A shared or private room',
    'Three meals a day and snacks',
    '24-hour nursing care',
    'Help with bathing, dressing, eating and the toilet',
    'Laundry and housekeeping',
    'Planned activities'
  ],
  extra: [
    ['Private room', 'a higher daily rate than a shared room'],
    ['Prescription drugs', 'billed to Medicare Part D or to you'],
    ['Therapy (physical, speech, occupational)', 'billed to Medicare or insurance'],
    ['Incontinence supplies', 'some homes bill them separately'],
    ['Phone, cable TV and internet in the room', 'monthly'],
    ['Hair salon and barber', 'each visit'],
    ['Rides to outside doctor visits', 'each trip']
  ],
  oneTime: ['An admission deposit or the first month paid ahead (private pay)'],
  payers: [
    '<b>Medicaid</b> pays the daily rate once someone qualifies. The resident pays most of their monthly income toward it and keeps a small allowance.',
    '<b>Medicare</b> pays for up to 100 days of skilled care after a hospital stay of 3 days or more: days 1 to 20 in full, then a daily co-pay. It does not pay for long-term care. <a href="https://www.medicare.gov/coverage/skilled-nursing-facility-snf-care" target="_blank" rel="noopener">Medicare rules</a>'
  ]
};

const ASSISTED = {
  unit: 'a month',
  included: [
    'An apartment or suite',
    'Three meals a day',
    'Housekeeping and laundry',
    'Activities and outings',
    'Staff on site day and night'
  ],
  extra: [
    ['Level-of-care fee', 'monthly, set by how much help someone needs; often the biggest extra'],
    ['Medication management', 'monthly'],
    ['Incontinence care and supplies', 'monthly or per item'],
    ['Second-person fee for couples', 'monthly'],
    ['Rides to appointments', 'each trip, past a set number'],
    ['Hair salon, cable TV and phone', 'each visit or monthly']
  ],
  oneTime: ['A community or move-in fee', 'A new care assessment when needs change, which can raise the level-of-care fee'],
  payers: [
    '<b>Private pay</b> covers most assisted living and memory care.',
    '<b>Nebraska Medicaid</b> may help through the Aged & Disabled waiver, but only at places that accept it, and it does not pay for room and meals.',
    '<b>Long-term care insurance</b> often pays a daily amount after a waiting period. Call the insurer before moving in.'
  ]
};

const MEMORY = {
  ...ASSISTED,
  extra: [['Memory care fee', 'monthly, on top of the assisted living rate, where both are offered'], ...ASSISTED.extra]
};

const HOME = {
  unit: 'an hour',
  included: [
    'The caregiver\'s time in the home',
    'The agency\'s payroll, insurance and background checks',
    'A backup caregiver when the usual one is out'
  ],
  extra: [
    ['Weekend and holiday hours', 'a higher hourly rate'],
    ['Overnight or live-in care', 'priced by the shift or the day'],
    ['Visits shorter than the minimum', 'billed as the minimum, often 3 to 4 hours'],
    ['Mileage for errands in the caregiver\'s car', 'per mile']
  ],
  oneTime: ['An in-home assessment visit at some agencies'],
  payers: [
    '<b>Private pay</b> covers most non-medical home care.',
    '<b>Long-term care insurance</b> and <b>VA Aid & Attendance</b> can pay for it.',
    '<b>Nebraska Medicaid</b> may help through the Aged & Disabled waiver with agencies that accept it.'
  ]
};

const HOME_HEALTH = {
  unit: 'a visit',
  included: ['Nurse or therapist visits a doctor has ordered', 'Care plan and supplies for that care'],
  extra: [['Help with daily living beyond the ordered visits', 'billed hourly by a non-medical agency']],
  oneTime: [],
  payers: ['<b>Medicare</b> pays in full for home health a doctor orders when someone is homebound. Medicaid and most insurance plans also cover it.']
};

export function feeGuide(p) {
  const base = p.kind === 'homecare' ? (p.type === 'medical' ? HOME_HEALTH : HOME)
    : p.type === 'nursing' ? NURSING : p.type === 'memory' ? MEMORY : ASSISTED;
  if (!p.fees) return { ...base, confirmed: false };
  return {
    ...base, confirmed: true, source: p.fees.source || '',
    included: p.fees.included || base.included, extra: p.fees.extra || base.extra, oneTime: p.fees.oneTime || base.oneTime
  };
}

/** The base price as a line, with a per-day figure for nursing homes. */
export function baseLine(p) {
  if (p.kind === 'homecare') {
    if (p.type === 'medical') return { big: 'Billed per visit', small: 'Usually paid by Medicare or insurance' };
    return { big: `$${p.priceLow}–$${p.priceHigh} an hour`, small: 'Estimated Lincoln-area agency rate' };
  }
  if (p.type === 'nursing') {
    return { big: `$${fmt(p.priceLow)}–$${fmt(p.priceHigh)} a month`, small: `About $${fmt(p.priceLow / 30)}–$${fmt(p.priceHigh / 30)} a day. Nebraska average; this home does not publish its rate.` };
  }
  if (p.priceEstimated) return { big: `About $${fmt(p.priceLow)} a month`, small: 'Lincoln average for this type of care. This community does not publish its price.' };
  return { big: `From $${fmt(p.priceLow)} a month`, small: 'Published starting price, before care fees' };
}

/** Short list of the usual extras, for the compare table. */
export const extrasShort = p => feeGuide(p).extra.slice(0, 3).map(e => e[0]).join(', ');

/** Questions that get the full price in writing before anyone signs. */
export const FEE_QUESTIONS = [
  'Can you send us every fee in writing, including care levels?',
  'What would make our monthly bill go up?',
  'How much did your prices go up last year?',
  'What is charged when someone moves out or passes away mid-month?'
];
