/** The campaign uses one palette; the final victory unlocks black and gold. */
export const THEME_BACKGROUNDS = Object.freeze({
  basement:'#10191e',
  boss:'#090909',
});

export function progressionTheme(state){
  return state.won?'boss':'basement';
}
