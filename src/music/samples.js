/** Bundled school exercises in worksheet order. */
export const SAMPLES = [
  { id: '01_bow_down_o_belinda.musicxml', label: 'Bow down, O Belinda' },
  { id: '02_under_arrest.musicxml', label: 'Under arrest!' },
  { id: '03_jim_along_josie.musicxml', label: 'Jim along Josie' },
  { id: '04_down_up.musicxml', label: 'Down up' },
  { id: '05_two_in_a_boat.musicxml', label: 'Two in a boat' },
  { id: '06_london_bridge.musicxml', label: 'London Bridge' },
  { id: '07_fast_lane.musicxml', label: 'Fast lane' },
  { id: '08_in_flight.musicxml', label: 'In flight' },
];

export const DEFAULT_SAMPLE = SAMPLES.find(({ id }) => id === '02_under_arrest.musicxml');
