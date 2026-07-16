// Time-of-day aware greetings shown on the home screen.
//
// Instead of a single static welcome line, maxAI opens with a greeting that
// fits the current hour and a short, rotating subline in Max's voice. The
// subline is picked deterministically from the time bucket so it stays stable
// within a render but feels fresh across visits.

export type TimeOfDay = 'night' | 'morning' | 'afternoon' | 'evening';

export function getTimeOfDay(date: Date = new Date()): TimeOfDay {
  const h = date.getHours();
  if (h < 5) return 'night';
  if (h < 12) return 'morning';
  if (h < 18) return 'afternoon';
  if (h < 22) return 'evening';
  return 'night';
}

const HERO: Record<TimeOfDay, string> = {
  night: 'Working late',
  morning: 'Good morning',
  afternoon: 'Good afternoon',
  evening: 'Good evening',
};

// Short sublines per time of day. Kept quiet, warm and free of filler.
const SUBLINES: Record<TimeOfDay, string[]> = {
  night: [
    'The quiet hours are good for deep work. Where should we start?',
    "Burning the midnight oil — I'm right here with you.",
    "Can't sleep, or just in the zone? Either way, let's get to it.",
    'A calm night for focused thinking. What’s on your mind?',
  ],
  morning: [
    'A fresh start. What are we working on first?',
    "Let's make the morning count. Where do you want to begin?",
    'Coffee in hand? Tell me what today needs.',
    'Ready when you are. What’s first on the list?',
  ],
  afternoon: [
    'What are we working on this afternoon?',
    'Midday momentum — how can I help?',
    'Pick up where you left off, or start something new?',
    'Let’s keep things moving. What do you need?',
  ],
  evening: [
    'Winding down or wrapping up? I can help with both.',
    'How can I help you close out the day?',
    'A good evening for tying up loose ends. Where to?',
    'Still going strong — what can I take off your plate?',
  ],
};

export interface Greeting {
  hero: string;
  subline: string;
  timeOfDay: TimeOfDay;
}

// Deterministic pseudo-random pick keyed to the day + time bucket, so the
// subline is stable across re-renders but varies day to day.
export function getGreeting(name?: string | null, date: Date = new Date()): Greeting {
  const timeOfDay = getTimeOfDay(date);
  const firstName = name?.trim().split(/\s+/)[0];
  const hero = firstName ? `${HERO[timeOfDay]}, ${firstName}` : HERO[timeOfDay];

  const pool = SUBLINES[timeOfDay];
  const dayIndex = Math.floor(date.getTime() / (1000 * 60 * 60 * 24));
  const subline = pool[dayIndex % pool.length];

  return { hero, subline, timeOfDay };
}
