import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const assetDir = path.join(root, 'assets', 'exercises');
const outFile = path.join(root, 'src', 'data', 'exercises.ts');

const files = fs
  .readdirSync(assetDir)
  .filter(file => file.toLowerCase().endsWith('.gif'))
  .sort((a, b) => idFromFile(a) - idFromFile(b));

const imports = files
  .map(file => {
    const id = idFromFile(file);
    return `const exercise${id} = require('../../assets/exercises/${escapePath(file)}');`;
  })
  .join('\n');

const rows = files
  .map(file => {
    const id = idFromFile(file);
    const name = file.replace(/^\d{3}\s+/, '').replace(/\.gif$/i, '');
    return `  { id: ${id}, name: ${JSON.stringify(name)}, asset: exercise${id} },`;
  })
  .join('\n');

const source = `import type { ImageSourcePropType } from 'react-native';

export type Exercise = {
  id: number;
  name: string;
  asset: ImageSourcePropType;
};

${imports}

export const exercises: Exercise[] = [
${rows}
];

export const exercisesById = new Map(exercises.map(exercise => [exercise.id, exercise]));

export const exerciseLabel = (id: number): string => String(id).padStart(3, '0');
`;

fs.writeFileSync(outFile, source, 'utf8');

function idFromFile(file) {
  return Number.parseInt(file.slice(0, 3), 10);
}

function escapePath(file) {
  return file.replace(/\\/g, '/').replace(/'/g, "\\'");
}
