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

/** Start-OTP entered — trip underway. Carries an "End ride" button so the rider
 *  can reveal the end OTP (rentals) when they reach their destination. */
export function buildStarted(booking: any, language?: SupportedLanguage): BuiltMessage {
  const s = t(language);
  return {
    text: s.flexiRideStarted,
    buttons: [[{ text: s.flexiEndRideButton, data: `flexi_end_otp:${booking?.id}` }]],
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

  const fareLine = fare != null ? s.flexiFareFinal(fare, km) : s.flexiFareUnavailable;
  return {
    text: s.flexiRideEnded(fareLine),
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
