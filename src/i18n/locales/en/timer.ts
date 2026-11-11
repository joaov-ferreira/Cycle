/** English `timer` namespace (source catalog): the rest timer bar (SPEC-v3 §1.2). */
export const timer = {
  /** Visible label of the bar when there is room for one. */
  rest: 'Rest',
  /** Accessible name of the countdown, e.g. `Rest: 1 minute 30 seconds`. */
  restAccessible: 'Rest: {{time}}',
  minutes: { one: '{{count}} minute', other: '{{count}} minutes' },
  seconds: { one: '{{count}} second', other: '{{count}} seconds' },
  over: 'Rest over',
  minus15: '−15 s',
  plus15: '+15 s',
  minus15Accessible: 'Shorten rest by 15 seconds',
  plus15Accessible: 'Extend rest by 15 seconds',
  skip: 'Skip',
  skipAccessible: 'Skip rest',
};
