import { addCategory } from "../src/logic";
import { type State, emptyState } from "../src/model";

export const T0 = new Date(2026, 9, 15, 12, 0, 0).getTime();
export const MIN = 60_000;
export const HOUR = 60 * MIN;

/** State with one category named "Work"; returns [state, categoryId]. */
export function withCategory(name = "Work"): [State, string] {
  const s = addCategory(emptyState(), name, "#2f81f7");
  return [s, s.categories[0].id];
}
