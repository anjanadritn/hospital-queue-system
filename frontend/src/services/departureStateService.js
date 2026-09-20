/**
 * Smart Patient Departure Engine - State Evaluation Service
 *
 * Implements authoritative departure state transitions based on current time:
 * - BEFORE_DEPARTURE: current_time < recommended_departure_time
 * - LEAVE_NOW: current_time >= recommended_departure_time AND current_time < expected_hospital_arrival_time
 * - URGENT: current_time >= expected_hospital_arrival_time AND patient not verified as arrived
 * - VERY_LATE: current_time >= arrival_deadline AND patient not arrived
 * - ARRIVED_OR_TERMINAL: patient is verified arrived or consultation completed/cancelled/missed
 *
 * Important distinction:
 * 1. Recommended departure time = when patient should leave.
 * 2. Expected hospital arrival/deadline = when patient should reach hospital.
 * 3. 2-minute late-arrival rule = queue reordering after arrival deadline passes.
 */

export const DEPARTURE_STATES = {
  BEFORE_DEPARTURE: 'BEFORE_DEPARTURE',
  LEAVE_NOW: 'LEAVE_NOW',
  URGENT: 'URGENT',
  VERY_LATE: 'VERY_LATE',
  ARRIVED_OR_TERMINAL: 'ARRIVED_OR_TERMINAL'
};

/**
 * Parses an ISO string or a 12-hour/24-hour time string with an optional base date into epoch ms.
 */
export function parseIsoOrTime(isoStr, timeStr, baseDateStr) {
  if (isoStr) {
    const t = new Date(isoStr).getTime();
    if (!isNaN(t)) return t;
  }
  if (!timeStr) return null;

  const match = String(timeStr).trim().match(/(\d+):(\d+)(?::(\d+))?\s*(AM|PM)?/i);
  if (!match) return null;

  let [_, hours, mins, secs, meridiem] = match;
  let h = parseInt(hours, 10);
  const m = parseInt(mins, 10);
  const s = secs ? parseInt(secs, 10) : 0;

  if (meridiem) {
    const med = meridiem.toUpperCase();
    if (med === 'PM' && h < 12) h += 12;
    if (med === 'AM' && h === 12) h = 0;
  }

  let d;
  if (baseDateStr) {
    const parts = String(baseDateStr).split('T')[0].split('-');
    if (parts.length === 3) {
      d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    } else {
      d = new Date(baseDateStr);
    }
  } else {
    d = new Date();
  }

  d.setHours(h, m, s, 0);
  return d.getTime();
}

/**
 * Determines whether the patient has arrived or is in a terminal queue status
 */
export function isPatientArrivedOrTerminal(travelInfo) {
  if (!travelInfo) return false;

  if (travelInfo.arrived_at_hospital === true || travelInfo.verified_by_admin === true) {
    return true;
  }

  const status = String(travelInfo.status || '').toLowerCase();
  const terminalStatuses = [
    'arrived',
    'in_consultation',
    'consulting',
    'completed',
    'cancelled',
    'missed',
    'missed_consultation',
    'no_show'
  ];

  return terminalStatuses.includes(status);
}

/**
 * Evaluates the authoritative departure state from current time.
 * @param {Object} travelInfo - Queue entry or travel information object
 * @param {number} nowMs - Current time in epoch milliseconds (defaults to Date.now())
 * @returns {string} One of DEPARTURE_STATES
 */
export function getDepartureState(travelInfo, nowMs = Date.now()) {
  if (!travelInfo) return DEPARTURE_STATES.BEFORE_DEPARTURE;

  // 1. Arrived or terminal patient: no departure urgency
  if (isPatientArrivedOrTerminal(travelInfo)) {
    return DEPARTURE_STATES.ARRIVED_OR_TERMINAL;
  }

  const baseDate = travelInfo.consultation_date;

  // Recommended departure time (when patient should leave)
  const depMs = parseIsoOrTime(
    travelInfo.recommended_departure_iso,
    travelInfo.recommended_departure_time,
    baseDate
  );

  // Expected hospital arrival time (when patient should reach hospital)
  let arrMs = parseIsoOrTime(
    travelInfo.expected_hospital_arrival_iso || travelInfo.expected_arrival_iso,
    travelInfo.expected_hospital_arrival || travelInfo.expected_arrival_time,
    baseDate
  );

  // 2-minute arrival deadline (queue reordering threshold)
  let deadlineMs = parseIsoOrTime(
    travelInfo.arrival_deadline_iso,
    travelInfo.arrival_deadline_time,
    baseDate
  );

  const travelDurationMin = Number(
    travelInfo.travel_time_min ||
    travelInfo.travel_time_minutes ||
    15
  );

  // Derive arrival if missing
  if (!arrMs && depMs) {
    arrMs = depMs + (travelDurationMin * 60 * 1000);
  }

  // Derive deadline if missing (arrival + 2 mins)
  if (!deadlineMs && arrMs) {
    deadlineMs = arrMs + (2 * 60 * 1000);
  }

  // VERY_LATE: current_time >= arrival_deadline AND patient has NOT arrived
  if (deadlineMs && nowMs >= deadlineMs) {
    return DEPARTURE_STATES.VERY_LATE;
  }

  // URGENT: current_time >= expected_hospital_arrival_time AND patient has NOT been verified as arrived
  if (arrMs && nowMs >= arrMs) {
    return DEPARTURE_STATES.URGENT;
  }

  // LEAVE_NOW: current_time >= recommended_departure_time AND current_time < expected_hospital_arrival_time
  if (depMs && nowMs >= depMs) {
    return DEPARTURE_STATES.LEAVE_NOW;
  }

  // BEFORE_DEPARTURE: current_time < recommended_departure_time
  return DEPARTURE_STATES.BEFORE_DEPARTURE;
}
