import assert from 'node:assert/strict';
import test from 'node:test';
import { sampleCommentaryFrames } from '../src/pages/MatchBroadcast/commentaryFrameSampling.ts';
import { FactExtractor } from '../src/pages/MatchBroadcast/factExtractor.ts';
import { serializeCommentarySnapshot } from '../src/pages/MatchBroadcast/commentarySnapshotPayload.ts';

const teams = {
  home: 'home',
  away: 'away',
};

function stats({ home = 0, away = 0, playerPoints = {}, playerFouls = {}, teamFouls = {} } = {}) {
  return {
    score: { home, away },
    teamIds: teams,
    teamNames: { home: 'Warriors', away: 'Celtics' },
    teamFouls,
    playerNames: { curry: 'Curry', lebron: 'LeBron' },
    playerTeamIds: { curry: 'home', lebron: 'home' },
    playerPoints,
    playerFouls,
  };
}

function event(iteration, sequence, type, teamId, playerId, pointsScored) {
  return {
    iteration,
    sequence,
    type,
    teamId,
    playerId,
    targetPlayerId: null,
    data: pointsScored === undefined ? {} : { pointsScored },
  };
}

const extractor = new FactExtractor();

test('samples 1.5 times the previous commentary checkpoints', () => {
  const frames = Array.from({ length: 100 }, (_, index) => index);
  const sampled = sampleCommentaryFrames(frames);

  assert.equal(sampled.length, 30);
  assert.equal(sampled[0], frames[0]);
  assert.equal(sampled.at(-1), frames.at(-1));
  assert.ok(sampled.every((frame, index) => index === 0 || frame > sampled[index - 1]));
});

test('extracts cumulative scorer and recent scoring facts from full history', () => {
  const history = Array.from({ length: 10 }, (_, index) => event(21 + index, index, 'shot_made', 'home', 'lebron', 2));
  history.push(event(30, 20, 'shot_made', 'away', '', 2));
  const facts = extractor.extract(history, 30, 100, stats({ home: 20, away: 2, playerPoints: { lebron: 20 } }));

  assert.ok(['hot', 'top'].includes(facts[0]?.kind));
  assert.ok(facts[0]?.text.includes('20'));
  assert.ok(facts.every(({ text }) => /^[\x20-\x7e]+$/.test(text) && text.length <= 60));
});

test('extracts an unanswered scoring run with its exact point total', () => {
  const history = [
    event(22, 1, 'shot_made', 'home', 'curry', 2),
    event(25, 2, 'shot_made', 'home', 'curry', 3),
    event(29, 3, 'shot_made', 'home', 'curry', 4),
  ];
  const facts = extractor.extract(history, 30, 100, stats({ home: 9 }));

  assert.ok(facts.some(({ kind, text }) => kind === 'run' && text.includes('9')));
});

test('extracts streak, cold, fouls, and turnover facts from the recent window', () => {
  const history = [];
  let sequence = 0;
  for (let frame = 22; frame <= 25; frame += 1) {
    history.push(event(frame, sequence++, 'shot_attempted', 'home', 'curry'));
    history.push(
      event(
        frame,
        sequence++,
        frame === 25 ? 'shot_missed' : 'shot_made',
        'home',
        'curry',
        frame === 25 ? undefined : 2,
      ),
    );
  }
  for (let frame = 21; frame <= 23; frame += 1) {
    history.push(event(frame, sequence++, 'turnover', 'home', 'curry'));
  }

  const facts = extractor.extract(
    history,
    30,
    100,
    stats({
      home: 6,
      playerPoints: { curry: 6 },
      playerFouls: { curry: 4 },
      teamFouls: { home: 5 },
    }),
  );
  const kinds = new Set(facts.map(({ kind }) => kind));

  assert.ok(kinds.has('streak'));
  assert.ok(kinds.has('cold'));
  assert.ok(kinds.has('fouls'));
  assert.ok(kinds.has('turnovers'));
});

test('counts lead changes in the recent frame window', () => {
  const history = [
    event(1, 1, 'shot_made', 'home', 'curry', 2),
    event(21, 2, 'shot_made', 'away', 'lebron', 3),
    event(22, 3, 'shot_made', 'home', 'curry', 4),
    event(23, 4, 'shot_made', 'away', 'lebron', 4),
  ];
  const facts = extractor.extract(history, 30, 100, stats({ home: 6, away: 7 }));

  assert.ok(facts.some(({ kind, text }) => kind === 'lead' && text.includes('3')));
});

test('includes endgame and close facts together', () => {
  const facts = extractor.extract([], 90, 100, stats({ home: 40, away: 38 }));

  assert.ok(facts.some(({ kind }) => kind === 'endgame'));
  assert.ok(facts.some(({ kind, text }) => kind === 'close' && text.includes('2')));
});

test('caps facts and ignores future or malformed events', () => {
  const history = [
    null,
    event(100, 1, 'shot_made', 'home', 'curry', 50),
    ...Array.from({ length: 200 }, (_, index) =>
      event(index % 90, index + 2, 'turnover', index % 2 ? 'home' : 'away', '', 0),
    ),
  ];
  const facts = extractor.extract(
    history,
    90,
    100,
    stats({
      home: 40,
      away: 38,
      playerPoints: { lebron: 20 },
      playerFouls: { lebron: 5 },
      teamFouls: { home: 6, away: 5 },
    }),
  );

  assert.ok(facts.length <= FactExtractor.MAX_FACTS);
  assert.ok(facts.every(({ text }) => text.length <= 60 && !/["']/.test(text)));
  assert.ok(!facts.some(({ kind, text }) => kind === 'hot' && text.includes('50')));
});

test('serializes facts under compact keys and omits the local TopFact alias', () => {
  const payload = serializeCommentarySnapshot({
    f: 30,
    tf: 100,
    ev: [],
    st: { sc: { h: 20, a: 2 }, tf: {}, pp: {}, pf: {} },
    facts: [{ kind: 'hot', text: 'LeBron: 8 pts in last 10 frames' }],
    topFact: { kind: 'hot', text: 'LeBron: 8 pts in last 10 frames' },
  });

  assert.deepEqual(payload.fx, [{ k: 'hot', t: 'LeBron: 8 pts in last 10 frames' }]);
  assert.equal('facts' in payload, false);
  assert.equal('topFact' in payload, false);
});
