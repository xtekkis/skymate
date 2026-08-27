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
const RUNWAYS = 'https://davidmegginson.github.io/ourairports-data/runways.csv';

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

const [response, runwayResponse] = await Promise.all([fetch(SOURCE), fetch(RUNWAYS)]);
if (!response.ok) throw new Error(`OurAirports returned ${response.status}`);
if (!runwayResponse.ok) throw new Error(`OurAirports runways returned ${runwayResponse.status}`);

const runwayText = await runwayResponse.text();
const lines = (await response.text()).split('\n');
const header = parseRow(lines[0]);
const col = Object.fromEntries(header.map((name, index) => [name, index]));

/**
 * Total usable runway feet per airport, keyed by ident.
 *
 * This is the only importance signal in the data. Two airports can both be
 * "large" and both match a two letter query, and runway length is what
 * separates Heathrow at 24,800 ft from Lome at 9,847 ft.
 */
const runwayFeet = new Map();
{
  const rLines = runwayText.split('\n');
  const rCol = Object.fromEntries(parseRow(rLines[0]).map((name, index) => [name, index]));

  for (const line of rLines.slice(1)) {
    if (!line.trim()) continue;
    const cells = parseRow(line);
    if ((cells[rCol.closed] ?? '').trim() === '1') continue;

    const feet = Number(cells[rCol.length_ft]);
    if (!Number.isFinite(feet) || feet <= 0) continue;

    const ident = (cells[rCol.airport_ident] ?? '').trim();
    runwayFeet.set(ident, (runwayFeet.get(ident) ?? 0) + feet);
  }
}

const airports = [];

for (const line of lines.slice(1)) {
  if (!line.trim()) continue;
  const cells = parseRow(line);

  const iata = (cells[col.iata_code] ?? '').trim().toUpperCase();
  // No code means it cannot be searched or queried, and no scheduled service
  // means nobody is flying there from a booking.
  if (!/^[A-Z]{3}$/.test(iata)) continue;
  if ((cells[col.scheduled_service] ?? '').trim() !== 'yes') continue;

  // Size is what makes a two-letter query useful: several airports can match
  // 'lo' equally well, and the one someone means is almost always the big one.
  const type = (cells[col.type] ?? '').trim();
  const size = type === 'large_airport' ? 'large' : type === 'medium_airport' ? 'medium' : 'small';

  airports.push({
    iata,
    name: (cells[col.name] ?? '').trim(),
    municipality: (cells[col.municipality] ?? '').trim() || undefined,
    country: (cells[col.iso_country] ?? '').trim(),
    size,
    scale: runwayFeet.get((cells[col.ident] ?? '').trim()) ?? 0,
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
