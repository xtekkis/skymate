/**
 * Tracks how much AeroDataBox budget is left this cycle.
 *
 * The plan allows a few hundred units a month, which is fine for a demo and
 * nothing like enough for real traffic. Without this, running out produces a
 * wall of opaque upstream errors. With it, the app can say plainly that flight
 * data is finished for the month and stop spending requests trying.
 *
 * Every response carries the remaining count in a header, so there is nothing
 * to count ourselves and no state to keep between restarts beyond what the next
 * response will tell us.
 */

/** Stop here rather than at zero, so the last few units are not burned on retries. */
const RESERVE = 5;

let remaining = null;

/** Reads whatever the upstream response reported. Ignores anything unparseable. */
export function recordUnits(headerValue) {
  // Number(null) and Number('') are both 0, so an absent header would otherwise
  // read as an empty budget and disable flight data outright.
  if (headerValue === null || headerValue === undefined || headerValue === '') return remaining;

  const units = Number(headerValue);
  if (!Number.isFinite(units) || units < 0) return remaining;

  remaining = units;
  return remaining;
}

/**
 * Unknown means we have not called upstream yet this process, and refusing on
 * a guess would be worse than trying once and reading the header.
 */
export function hasBudget() {
  return remaining === null || remaining > RESERVE;
}

export function unitsRemaining() {
  return remaining;
}

export function resetQuota() {
  remaining = null;
}

export { RESERVE };
