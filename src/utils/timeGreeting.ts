export type TimeGreetingPeriod = 'morning' | 'afternoon' | 'evening' | 'night';

/** Local device hour → greeting period (5–11 morning, 12–17 afternoon, 18–21 evening, else night). */
export function timeGreetingPeriod(hour: number): TimeGreetingPeriod {
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 18) return 'afternoon';
  if (hour >= 18 && hour < 22) return 'evening';
  return 'night';
}

export function timeGreetingI18nKey(period: TimeGreetingPeriod): string {
  return `home.greeting${period.charAt(0).toUpperCase()}${period.slice(1)}` as
    | 'home.greetingMorning'
    | 'home.greetingAfternoon'
    | 'home.greetingEvening'
    | 'home.greetingNight';
}

export function timeReadyLiftI18nKey(period: TimeGreetingPeriod): string {
  return `home.readyLift${period.charAt(0).toUpperCase()}${period.slice(1)}` as
    | 'home.readyLiftMorning'
    | 'home.readyLiftAfternoon'
    | 'home.readyLiftEvening'
    | 'home.readyLiftNight';
}
