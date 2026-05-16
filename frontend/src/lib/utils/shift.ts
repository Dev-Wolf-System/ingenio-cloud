import { addDays, addHours, differenceInMinutes, startOfDay } from 'date-fns';
import { fromZonedTime, toZonedTime } from 'date-fns-tz';

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

function bounds(now: Date): { name: ShiftName; displayName: string; start: Date; end: Date } {
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
    elapsedMinutes: Math.max(0, elapsed),
    remainingMinutes: Math.max(0, total - elapsed),
    progress: Math.min(1, Math.max(0, elapsed / total)),
  };
}
