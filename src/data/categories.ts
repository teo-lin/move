/** Catalog groups, by starting position (the bundled ids follow the original app's order). */
export const categories = [
  {key: 'back', title: 'Lying on your back', from: 1, to: 33},
  {key: 'side', title: 'Lying on your side', from: 34, to: 45},
  {key: 'fours', title: 'Kneeling & all fours', from: 46, to: 66},
  {key: 'stomach', title: 'Lying on your stomach', from: 67, to: 88},
  {key: 'neck', title: 'Neck & shoulders', from: 89, to: 101},
  {key: 'sitting', title: 'Sitting', from: 102, to: 110},
  {key: 'standing', title: 'Standing', from: 111, to: 999},
  {key: 'mine', title: 'My exercises', from: 1000, to: Number.MAX_SAFE_INTEGER},
] as const;

export function groupByCategory<T extends {id: number}>(
  items: T[],
): {key: string; title: string; items: T[]}[] {
  return categories
    .map(category => ({
      key: category.key,
      title: category.title,
      items: items.filter(item => item.id >= category.from && item.id <= category.to),
    }))
    .filter(group => group.items.length > 0);
}
