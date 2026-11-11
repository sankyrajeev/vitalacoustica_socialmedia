// Find when a word is spoken, so animation can land exactly on it.
// Returns the start time of the first word in the beat matching `re`, or `fallback`.
export function wordAt(beat, re, fallback) {
  const w = beat.words.find(x => re.test(x.w.toLowerCase()));
  return w ? w.s : (fallback ?? beat.speech);
}
