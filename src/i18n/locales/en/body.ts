/** English `body` namespace (source catalog): body tracking (SPEC-v3 §9). */
export const body = {
  title: 'Body',
  kindGroup: 'Measurement',
  kinds: {
    weight: 'Weight',
    bodyFat: 'Body fat',
    waist: 'Waist',
    chest: 'Chest',
    hips: 'Hips',
    arm: 'Arm',
    thigh: 'Thigh',
    calf: 'Calf',
  },
  periodGroup: 'Chart period',
  periods: {
    '4w': '4 weeks',
    '3m': '3 months',
    '6m': '6 months',
    '1y': '1 year',
    all: 'All',
  },
  form: {
    newEntry: 'New entry',
    editEntry: 'Edit entry',
    date: 'Date (YYYY-MM-DD)',
    value: 'Value',
  },
  errors: {
    date: {
      required: 'Enter a date',
      invalidDate: 'Use a real date as YYYY-MM-DD',
      inFuture: 'The date cannot be in the future',
    },
    value: {
      required: 'Enter a value',
      outOfRange: 'Use from {{min}} to {{max}} {{unit}}',
      tooManyDecimals: 'Use at most 2 decimal places',
    },
    save: 'The entry could not be saved',
    delete: 'The entry could not be deleted',
  },
  stats: {
    latest: 'Latest',
    change: 'Change',
    changeSince: '{{change}} since {{date}}',
    weekMean: '7-day average',
  },
  entries: {
    title: 'Entries',
    edit: 'Edit entry {{date}}, {{value}}',
    delete: 'Delete entry {{date}}',
  },
  empty: {
    title: 'No entries yet',
    message: 'Add the first {{kind}} measurement above.',
  },
  confirmDelete: {
    title: 'Delete this entry?',
    message: '{{date}}: {{value}} will be removed.',
  },
};
