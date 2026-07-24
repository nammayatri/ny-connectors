import { t, SupportedLanguage } from '../i18n';

// ---------------------------------------------------------------------------
// Shared Flexi message builders + ride-stage classifier.
//
// Used by BOTH the engine's in-handler driver poll and the background
// RideTracker, so the "driver on the way" card and the progress messages have
// a single source of truth. Builders are pure: they take a raw NY booking and
// a language, and return the text (+ optional buttons) to send.
// ---------------------------------------------------------------------------

export interface BuiltMessage {
  text: string;
  buttons?: { text: string; data: string }[][];
}

// The ride's position in its lifecycle, derived from the raw NY booking.
//   assigned  — driver accepted (rideList populated), not yet arrived
//   arrived   — driverArrivalTime set, ride still NEW
//   started   — ride INPROGRESS (start-OTP entered)
//   completed — ride COMPLETED (final fare available)
//   cancelled — ride/booking CANCELLED
//   none      — booking exists but no driver assigned yet
export type RideStage =
  | 'assigned' | 'arrived' | 'started' | 'completed' | 'cancelled' | 'none';

function num(v: any): number | undefined {
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : undefined;
}

// Normalize a phone number so WhatsApp auto-linkifies it into a tap-to-dial
// link. WhatsApp only reliably linkifies +CC international form, so a bare
// 10-digit Indian mobile becomes +91XXXXXXXXXX. Landline-form numbers (a masked
// exophone starting with 0) are returned as-is (best-effort fallback).
export function formatDialable(phone?: string): string | undefined {
  if (!phone) return undefined;
  const d = phone.replace(/[^0-9]/g, '');
  if (!d) return undefined;
  if (d.length === 10) return `+91${d}`;
  if (d.length === 12 && d.startsWith('91')) return `+${d}`;
  if (d.startsWith('0')) return phone;
  return `+${d}`;
}

// ---------------------------------------------------------------------------
// Fare rate-card line — the pre-booking fare shown at the pickup-confirm prompt
// and re-stated in the "finding an auto" message. Computed from a quote's
// `quoteFareBreakup` map (EasyBooking zeroes `quoteDetails`, so the breakup is
// the only source of the real base/per-km/night-shift values).
// ---------------------------------------------------------------------------
interface FareParts { base?: number; perKm?: number; nightMult?: number; nightWindow?: string }

// Whole-hour → 12-hour clock label, e.g. 22 → "10PM", 5 → "5AM", 0 → "12AM".
function fmtHour(h: number): string {
  const hr = ((Math.round(h) % 24) + 24) % 24;
  const period = hr < 12 ? 'AM' : 'PM';
  const h12 = hr % 12 === 0 ? 12 : hr % 12;
  return `${h12}${period}`;
}

// Round a money value to at most 2 decimals — kills IEEE-754 addition artifacts
// (46.1 + 3.2 === 49.300000000000004) that would otherwise render to the rider.
const money2 = (n: number): number => Math.round(n * 100) / 100;

// True when the current IST wall-clock falls inside [startSec, endSec) seconds-of-day,
// handling a window that wraps midnight (start > end, e.g. 22:00 → 05:00). India has
// no DST, so a fixed +5:30 offset is exact.
function isWithinISTWindow(startSec?: number, endSec?: number): boolean {
  if (startSec == null || endSec == null) return false;
  const IST_OFFSET_MS = 330 * 60 * 1000; // UTC+5:30
  const sec = ((Math.floor((Date.now() + IST_OFFSET_MS) / 1000) % 86400) + 86400) % 86400;
  return startSec <= endSec ? sec >= startSec && sec < endSec : sec >= startSec || sec < endSec;
}

function fareParts(breakup?: Record<string, number>): FareParts {
  if (!breakup) return {};
  const b = breakup.BASE_FARE;
  const d = breakup.DEAD_KILOMETER_FARE;
  const base = b != null || d != null ? money2((b ?? 0) + (d ?? 0)) : undefined;
  const start = breakup.NIGHT_SHIFT_START_TIME_IN_SECONDS;
  const end = breakup.NIGHT_SHIFT_END_TIME_IN_SECONDS;
  // Only surface the night surcharge when the rider is CURRENTLY inside the window —
  // a daytime rider shouldn't see a night line for a charge they won't pay. Passing
  // undefined mult/window makes the i18n builder omit the line entirely.
  const nightNow = isWithinISTWindow(start, end);
  const nightWindow = nightNow && start != null && end != null
    ? `${fmtHour(start / 3600)}–${fmtHour(end / 3600)}` : undefined;
  return {
    base,
    perKm: breakup.EXTRA_PER_KM_FARE,
    nightMult: nightNow ? breakup.NIGHT_SHIFT_CHARGE : undefined,
    nightWindow,
  };
}

/** Render the fare rate-card line for a quote's breakup, or undefined when there
 *  is no base/per-km rate to show (a lone night multiplier is meaningless). */
export function buildFlexiFareLine(
  breakup: Record<string, number> | undefined, language?: SupportedLanguage,
): string | undefined {
  const p = fareParts(breakup);
  if (p.base == null && p.perKm == null) return undefined;
  return t(language).flexiFareBreakup(p.base, p.perKm, p.nightMult, p.nightWindow);
}

/** Classify a raw NY booking into a lifecycle stage. Order matters: terminal
 *  states are checked first, then start, arrival, and finally bare assignment. */
export function classifyStage(booking: any): RideStage {
  const ride = booking?.rideList?.[0];
  const bStatus = String(booking?.status || '').toUpperCase();
  const rStatus = String(ride?.status || '').toUpperCase();

  if (rStatus === 'CANCELLED' || bStatus === 'CANCELLED') return 'cancelled';
  if (rStatus === 'COMPLETED' || bStatus === 'COMPLETED' || ride?.rideEndTime) return 'completed';
  if (rStatus === 'INPROGRESS' || ride?.rideStartTime) return 'started';
  if (ride?.driverArrivalTime) return 'arrived';
  if (ride?.driverName || ride?.vehicleNumber || ride?.rideOtp) return 'assigned';
  return 'none';
}

/** The "auto found — driver on the way" card (assignment). */
export function buildDriverCard(booking: any, language?: SupportedLanguage): BuiltMessage {
  const s = t(language);
  const ride = booking?.rideList?.[0];
  const driverName = ride?.driverName || booking?.driverName || '';
  const vehicleNumber = ride?.vehicleNumber || booking?.vehicleNumber;
  // Prefer the driver's mobile for the tap-to-dial link; the masked exophone is
  // a landline-form fallback that WhatsApp won't linkify as a mobile.
  const dial = formatDialable(
    ride?.driverNumber || booking?.driverNumber || ride?.merchantExoPhone || booking?.merchantExoPhone,
  );
  const otp = ride?.rideOtp || booking?.rideOtp;
  const rating = ride?.rating ?? booking?.rating;
  const etaMin = ride?.etaMinutes ?? booking?.etaMinutes;

  const lines: string[] = [s.flexiFoundDriver(driverName)];
  if (rating != null && etaMin != null) lines.push(s.flexiDriverMeta(rating, etaMin));
  if (vehicleNumber) lines.push(s.vehicleLabel(vehicleNumber));
  if (otp) lines.push('', s.flexiOtpShare(otp));
  if (dial) lines.push('', s.flexiCallDriver(dial)); // the tappable +91 number IS the dialer
  lines.push('', s.flexiSafetyNote);

  return {
    text: lines.join('\n'),
    buttons: [[{ text: s.cancelRide, data: `cancel_confirm:${booking?.id}` }]],
  };
}

/** Driver reached the pickup point. Re-share the start OTP if present. */
export function buildArrived(booking: any, language?: SupportedLanguage): BuiltMessage {
  const s = t(language);
  const ride = booking?.rideList?.[0];
  const otp = ride?.rideOtp || booking?.rideOtp;
  return { text: s.flexiArrived(otp ? String(otp) : '') };
}

/** Start OTP entered — trip underway. EasyBooking (and ONE_WAY Regular) rides are
 *  driver-ended with no rider end OTP, so this is a plain "ride started" message —
 *  carrying an SOS button so safety help is one tap away during the trip. */
export function buildStarted(_booking: any, language?: SupportedLanguage): BuiltMessage {
  const s = t(language);
  return {
    text: s.rideStartedSimple,
    buttons: [[{ text: s.sosButton, data: 'sos_confirm' }]],
  };
}

/** Ride completed — surface the real final fare + distance when available. */
export function buildEnded(booking: any, language?: SupportedLanguage): BuiltMessage {
  const s = t(language);
  const ride = booking?.rideList?.[0];
  const fare = num(ride?.computedPrice)
    ?? num(ride?.computedPriceWithCurrency?.amount)
    ?? num(booking?.computedPrice);
  const distM = num(ride?.chargeableRideDistance)
    ?? num(ride?.chargeableRideDistanceWithUnit?.value);
  const km = distM != null ? Math.round(distM / 100) / 10 : undefined; // meters → km, 1dp

  // 🎉 Ride finished. / 💰 Give the driver ₹X cash/UPI / 📏 Y km / <app nudge>.
  // Distance line only when we have both a fare and a distance.
  const lines: string[] = [
    s.flexiRideFinishedHeader,
    fare != null ? s.flexiPayDriver(fare) : s.flexiFareUnavailable,
  ];
  if (fare != null && km != null) lines.push(s.flexiDistanceLine(km));
  lines.push('', s.appDownloadNudge);
  return {
    text: lines.join('\n'),
    buttons: [[{ text: s.flexiBookAnother, data: 'book' }]],
  };
}

/** Ride cancelled (by driver/system/rider). */
export function buildCancelled(_booking: any, language?: SupportedLanguage): BuiltMessage {
  const s = t(language);
  return {
    text: s.flexiRideCancelled,
    buttons: [[{ text: s.flexiBookAnother, data: 'book' }]],
  };
}
