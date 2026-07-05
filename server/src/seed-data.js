/**
 * Default reference data. Everything here is editable in the app afterwards —
 * these are starting points, not hardcoded truths (valuations and partner
 * lists shift every few months).
 *
 * Baseline cpp figures follow the ballpark of published valuations (e.g. The
 * Points Guy); cashback/portal cpp reflect common card tiers and should be
 * adjusted to the specific cards held.
 */

export const DEFAULT_VALUATIONS = [
  {
    currency: 'chase_ur',
    displayName: 'Chase Ultimate Rewards',
    baselineCpp: 2.05,
    cashbackCpp: 1.0,
    portalCpp: 1.25, // Sapphire Preferred tier; 1.5 for Sapphire Reserve
  },
  {
    currency: 'amex_mr',
    displayName: 'Amex Membership Rewards',
    baselineCpp: 2.0,
    cashbackCpp: 0.6,
    portalCpp: 1.0,
  },
  {
    currency: 'cap1_miles',
    displayName: 'Capital One Miles',
    baselineCpp: 1.85,
    cashbackCpp: 0.5,
    portalCpp: 1.0,
  },
];

// ratioFrom:ratioTo — issuer points : partner points. bonusPct is a
// manually-entered override for active transfer bonuses (PRD §6.4).
export const DEFAULT_TRANSFER_PARTNERS = [
  // Chase Ultimate Rewards
  { currency: 'chase_ur', partnerName: 'United MileagePlus', partnerType: 'airline', ratioFrom: 1, ratioTo: 1 },
  { currency: 'chase_ur', partnerName: 'World of Hyatt', partnerType: 'hotel', ratioFrom: 1, ratioTo: 1 },
  { currency: 'chase_ur', partnerName: 'Air Canada Aeroplan', partnerType: 'airline', ratioFrom: 1, ratioTo: 1 },
  { currency: 'chase_ur', partnerName: 'British Airways Avios', partnerType: 'airline', ratioFrom: 1, ratioTo: 1 },
  { currency: 'chase_ur', partnerName: 'Air France/KLM Flying Blue', partnerType: 'airline', ratioFrom: 1, ratioTo: 1 },
  { currency: 'chase_ur', partnerName: 'Virgin Atlantic Flying Club', partnerType: 'airline', ratioFrom: 1, ratioTo: 1 },
  { currency: 'chase_ur', partnerName: 'Southwest Rapid Rewards', partnerType: 'airline', ratioFrom: 1, ratioTo: 1 },
  { currency: 'chase_ur', partnerName: 'Singapore KrisFlyer', partnerType: 'airline', ratioFrom: 1, ratioTo: 1 },
  { currency: 'chase_ur', partnerName: 'Marriott Bonvoy', partnerType: 'hotel', ratioFrom: 1, ratioTo: 1 },
  { currency: 'chase_ur', partnerName: 'IHG One Rewards', partnerType: 'hotel', ratioFrom: 1, ratioTo: 1 },

  // Amex Membership Rewards
  { currency: 'amex_mr', partnerName: 'ANA Mileage Club', partnerType: 'airline', ratioFrom: 1, ratioTo: 1 },
  { currency: 'amex_mr', partnerName: 'Air Canada Aeroplan', partnerType: 'airline', ratioFrom: 1, ratioTo: 1 },
  { currency: 'amex_mr', partnerName: 'Air France/KLM Flying Blue', partnerType: 'airline', ratioFrom: 1, ratioTo: 1 },
  { currency: 'amex_mr', partnerName: 'British Airways Avios', partnerType: 'airline', ratioFrom: 1, ratioTo: 1 },
  { currency: 'amex_mr', partnerName: 'Delta SkyMiles', partnerType: 'airline', ratioFrom: 1, ratioTo: 1 },
  { currency: 'amex_mr', partnerName: 'Virgin Atlantic Flying Club', partnerType: 'airline', ratioFrom: 1, ratioTo: 1 },
  { currency: 'amex_mr', partnerName: 'Avianca LifeMiles', partnerType: 'airline', ratioFrom: 1, ratioTo: 1 },
  { currency: 'amex_mr', partnerName: 'Singapore KrisFlyer', partnerType: 'airline', ratioFrom: 1, ratioTo: 1 },
  { currency: 'amex_mr', partnerName: 'Qantas Frequent Flyer', partnerType: 'airline', ratioFrom: 1, ratioTo: 1 },
  { currency: 'amex_mr', partnerName: 'Hilton Honors', partnerType: 'hotel', ratioFrom: 1, ratioTo: 2 },
  { currency: 'amex_mr', partnerName: 'Marriott Bonvoy', partnerType: 'hotel', ratioFrom: 1, ratioTo: 1 },

  // Capital One Miles
  { currency: 'cap1_miles', partnerName: 'Air France/KLM Flying Blue', partnerType: 'airline', ratioFrom: 1, ratioTo: 1 },
  { currency: 'cap1_miles', partnerName: 'Air Canada Aeroplan', partnerType: 'airline', ratioFrom: 1, ratioTo: 1 },
  { currency: 'cap1_miles', partnerName: 'British Airways Avios', partnerType: 'airline', ratioFrom: 1, ratioTo: 1 },
  { currency: 'cap1_miles', partnerName: 'Turkish Miles&Smiles', partnerType: 'airline', ratioFrom: 1, ratioTo: 1 },
  { currency: 'cap1_miles', partnerName: 'Avianca LifeMiles', partnerType: 'airline', ratioFrom: 1, ratioTo: 1 },
  { currency: 'cap1_miles', partnerName: 'Virgin Red', partnerType: 'airline', ratioFrom: 1, ratioTo: 1 },
  { currency: 'cap1_miles', partnerName: 'Singapore KrisFlyer', partnerType: 'airline', ratioFrom: 1, ratioTo: 1 },
  { currency: 'cap1_miles', partnerName: 'Wyndham Rewards', partnerType: 'hotel', ratioFrom: 1, ratioTo: 1 },
  { currency: 'cap1_miles', partnerName: 'Choice Privileges', partnerType: 'hotel', ratioFrom: 1, ratioTo: 1 },
];
