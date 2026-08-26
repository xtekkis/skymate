/**
 * Rebuilds server/data/airports.json from OurAirports.
 *
 * Source: https://davidmegginson.github.io/ourairports-data/airports.csv
 * Licence: public domain.
 *
 * Bundling this takes airport lookup off the AeroDataBox quota entirely.
 * Autocomplete is the highest-frequency call in the app and its data is the
 * most static, so paying per keystroke for it made no sense.
 *
 * Run with: node scripts/build-airports.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const SOURCE = 'https://davidmegginson.github.io/ourairports-data/airports.csv';

/** Minimal CSV reader: this file quotes any field containing a comma. */
function parseRow(line) {
  const cells = [];
  let cell = '';
  let quoted = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (quoted) {
      if (char === '"' && line[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      cells.push(cell);
      cell = '';
    } else {
      cell += char;
    }
  }

  cells.push(cell);
  return cells;
}

const response = await fetch(SOURCE);
if (!response.ok) throw new Error(`OurAirports returned ${response.status}`);

const lines = (await response.text()).split('\n');
const header = parseRow(lines[0]);
const col = Object.fromEntries(header.map((name, index) => [name, index]));

const airports = [];

for (const line of lines.slice(1)) {
  if (!line.trim()) continue;
  const cells = parseRow(line);

  const iata = (cells[col.iata_code] ?? '').trim().toUpperCase();
  // No code means it cannot be searched or queried, and no scheduled service
  // means nobody is flying there from a booking.
  if (!/^[A-Z]{3}$/.test(iata)) continue;
  if ((cells[col.scheduled_service] ?? '').trim() !== 'yes') continue;

  airports.push({
    iata,
    name: (cells[col.name] ?? '').trim(),
    municipality: (cells[col.municipality] ?? '').trim() || undefined,
    country: (cells[col.iso_country] ?? '').trim(),
  });
}

airports.sort((a, b) => a.iata.localeCompare(b.iata));

const outDir = path.join(process.cwd(), 'data');
fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, 'airports.json');
fs.writeFileSync(outFile, JSON.stringify(airports));

const bytes = fs.statSync(outFile).size;
console.log(`wrote ${airports.length} airports, ${(bytes / 1024).toFixed(0)} kB`);
console.log('sample:', JSON.stringify(airports.find((a) => a.iata === 'LHR')));
console.log('        ', JSON.stringify(airports.find((a) => a.iata === 'JFK')));
