import { addDays, addHours, differenceInMinutes, startOfDay } from 'date-fns';
import { format, fromZonedTime, toZonedTime } from 'date-fns-tz';

const TZ = 'America/Argentina/Buenos_Aires';

export type ShiftName = 'morning' | 'afternoon' | 'night';

export interface Shift {
  name: ShiftName;
  displayName: string;
  start: Date;
  end: Date;
  elapsedMinutes: number;
  remainingMinutes: number;
  progress: number;
}

function bounds(now: Date): {
  name: ShiftName;
  displayName: string;
  start: Date;
  end: Date;
} {
  const nowAR = toZonedTime(now, TZ);
  const hour = nowAR.getHours();
  const todayAR = startOfDay(nowAR);

  if (hour >= 5 && hour < 13) {
    return {
      name: 'morning',
      displayName: 'Turno Mañana',
      start: fromZonedTime(addHours(todayAR, 5), TZ),
      end: fromZonedTime(addHours(todayAR, 13), TZ),
    };
  }
  if (hour >= 13 && hour < 21) {
    return {
      name: 'afternoon',
      displayName: 'Turno Tarde',
      start: fromZonedTime(addHours(todayAR, 13), TZ),
      end: fromZonedTime(addHours(todayAR, 21), TZ),
    };
  }
  if (hour >= 21) {
    return {
      name: 'night',
      displayName: 'Turno Noche',
      start: fromZonedTime(addHours(todayAR, 21), TZ),
      end: fromZonedTime(addHours(addDays(todayAR, 1), 5), TZ),
    };
  }
  // hour < 5 → noche que empezó ayer
  return {
    name: 'night',
    displayName: 'Turno Noche',
    start: fromZonedTime(addHours(addDays(todayAR, -1), 21), TZ),
    end: fromZonedTime(addHours(todayAR, 5), TZ),
  };
}

export function getCurrentShift(now: Date = new Date()): Shift {
  const b = bounds(now);
  const elapsed = differenceInMinutes(now, b.start);
  const total = differenceInMinutes(b.end, b.start);
  return {
    ...b,
    elapsedMinutes: elapsed,
    remainingMinutes: total - elapsed,
    progress: elapsed / total,
  };
}

export function getPreviousShift(now: Date = new Date()): Shift {
  const current = getCurrentShift(now);
  const prevEnd = current.start;
  const prevStart = addHours(prevEnd, -8);
  let name: ShiftName;
  let displayName: string;
  if (current.name === 'morning') { name = 'night'; displayName = 'Turno Noche'; }
  else if (current.name === 'afternoon') { name = 'morning'; displayName = 'Turno Mañana'; }
  else { name = 'afternoon'; displayName = 'Turno Tarde'; }
  return {
    name,
    displayName,
    start: prevStart,
    end: prevEnd,
    elapsedMinutes: 480,
    remainingMinutes: 0,
    progress: 1,
  };
}

export function shiftDateKey(shift: Shift): string {
  return format(toZonedTime(shift.start, TZ), 'yyyy-MM-dd', { timeZone: TZ });
}
