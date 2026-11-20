import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {gunzipSync} from 'node:zlib';

function readRecords(name) {
  const file = join(process.cwd(), 'data', 'hong-kong-football', name + '.json.gz');
  return JSON.parse(gunzipSync(readFileSync(file)).toString('utf8'));
}

export const archiveSheets = readRecords('archiveSheets');
export const otherCompetitions = readRecords('otherCompetitions');
export const players = readRecords('players');
export const playerHistory = readRecords('playerHistory');
export const pastSeasons = readRecords('pastSeasons');
export const matchData = readRecords('matchData');
export const moreFixtures = readRecords('moreFixtures');
