/**
 * Catalog groups. The bundled ids follow the original app's order, which is by starting
 * position; exercises added later carry an explicit `category` key instead.
 */
export const categories = [
  {key: 'back', title: 'Lying on your back', from: 1, to: 33},
  {key: 'side', title: 'Lying on your side', from: 34, to: 45},
  {key: 'fours', title: 'Kneeling & all fours', from: 46, to: 66},
  {key: 'stomach', title: 'Lying on your stomach', from: 67, to: 88},
  {key: 'neck', title: 'Neck & shoulders', from: 89, to: 101},
  {key: 'sitting', title: 'Sitting', from: 102, to: 110},
  {key: 'standing', title: 'Standing', from: 111, to: 999},
  // Groups for exercises added from the health plan (they declare their category explicitly).
  {key: 'warmup', title: 'Warm-up', from: 0, to: -1},
  {key: 'balance', title: 'Balance', from: 0, to: -1},
  {key: 'strength', title: 'Strength & equipment', from: 0, to: -1},
  {key: 'stretch', title: 'Stretches & breathing', from: 0, to: -1},
  {key: 'mine', title: 'My exercises', from: 1000, to: Number.MAX_SAFE_INTEGER},
] as const;

export function groupByCategory<T extends {id: number; category?: string}>(
  items: T[],
): {key: string; title: string; items: T[]}[] {
  return categories
    .map(category => ({
      key: category.key,
      title: category.title,
      items: items.filter(item =>
        item.category
          ? item.category === category.key
          : item.id >= category.from && item.id <= category.to,
      ),
    }))
    .filter(group => group.items.length > 0);
}
