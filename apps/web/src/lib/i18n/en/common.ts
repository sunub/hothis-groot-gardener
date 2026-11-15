/** Words shared by every screen. Use the same word for the same thing everywhere. */
export const common = {
  app_name: 'Space Garden Simulator',
  crop_name: "'Outredgeous' red romaine lettuce",
  metric: {
    plant_health: 'Plant health',
    root_moisture: 'Root moisture',
    humidity: 'Chamber humidity',
    fan: 'Fan',
    light: 'Lighting',
  },
  zone: {
    danger_low: 'Danger (low)',
    caution_low: 'Caution (low)',
    normal: 'Normal',
    caution_high: 'Caution (high)',
    danger_high: 'Danger (high)',
  },
  fan_level: { low: 'Low', high: 'High' },
  light_level: { low: 'Low', medium: 'Medium', high: 'High' },
  growth_stage: {
    germination: 'Germination',
    growth: 'Growth',
    pre_harvest: 'Before harvest',
    harvest: 'Harvest',
  },
  verdict: {
    appropriate: 'Appropriate',
    partial: 'Partial',
    inappropriate: 'Inappropriate',
  },
  value_type: {
    measured: 'Recorded',
    game_value: 'Game value',
  },
  value_type_help: {
    measured: 'Taken from the cited source.',
    game_value: 'Set by the team for game balance. Not a NASA value.',
  },
  source: {
    label: 'Source',
    quote_label: 'Source sentence',
    none: 'No recorded source. This option exists for the game only.',
  },
  disclaimer: {
    simulation:
      'This is a training simulation. Plant state numbers and their changes are game values, not measurements.',
    not_diagnostic:
      'This tool does not diagnose plants or people, and it does not record any health data about people.',
  },
  nav: { label: 'Main', home: 'Home', sources: 'Evidence and sources' },
  language: { label: 'Language', en: 'English', ko: '한국어' },
  day_label: 'Day',
  cultivation_day_label: 'Cultivation day',
} as const;
