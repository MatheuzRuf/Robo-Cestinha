export const mockMatchData = {
  ticker: 'COURT 01: CHICAGO STEEL LEAD BROOKLYN BREAKERS 86-80 (Q4 01:36) // LIVE SIMULATION ACTIVE',
  gameMeta: 'DIVISION A CHAMPIONSHIP SERIES · GAME 7',
  home: {
    abbreviation: 'CS',
    name: 'CHICAGO STEEL',
    score: 86,
    seed: 'SEED #1',
    possession: true,
    fouls: { current: 3, max: 5 },
    timeouts: { remaining: 1, total: 3 },
  },
  away: {
    abbreviation: 'BB',
    name: 'BROOKLYN BREAKERS',
    score: 80,
    seed: 'SEED #2',
    possession: false,
    fouls: { current: 4, max: 5 },
    timeouts: { remaining: 2, total: 3 },
  },
  playCall: 'HORNS CORNER SNAP',
  shotProbability: 68,
  defensiveScheme: '2-3 DROP ZONE',
  quarter: '4TH QUARTER',
  gameClock: '01:36',
  shotClock: '08',
  commentary: [
    {
      id: 'commentary-1',
      gameClock: '[01:42 Q4]',
      text: 'Steel are slowing the floor and forcing Brooklyn to defend every possession.',
    },
    { id: 'commentary-2', gameClock: '[01:51 Q4]', text: 'That is textbook late-game execution from Chicago.' },
    { id: 'commentary-3', gameClock: '[02:04 Q4]', text: 'The next stop could decide the entire championship series.' },
  ],
  playByPlay: [
    { id: '1', gameClock: '[01:42 Q4]', type: '3-POINT ATTEMPT', description: 'M. Carter misses from the left wing.' },
    { id: '2', gameClock: '[01:51 Q4]', type: 'REBOUND', description: 'J. Brooks secures the defensive rebound.' },
    { id: '3', gameClock: '[02:04 Q4]', type: 'PERSONAL FOUL', description: 'Brooklyn called for a reach-in foul.' },
    { id: '4', gameClock: '[02:18 Q4]', type: 'STEAL', description: 'R. Ellis jumps the passing lane.' },
    { id: '5', gameClock: '[02:32 Q4]', type: '2-POINT MADE', description: 'A. Reed finishes through contact.' },
  ],
  momentum: {
    runLabel: '2-MINUTE CLUTCH RUN',
    runDelta: '+6 CHICAGO RUN',
    homePoints: 6,
    awayPoints: 0,
    stats: [
      ['FG%', '54.2'],
      ['PAINT PTS', '38'],
      ['FAST BREAK PTS', '12'],
    ],
  },
};

export type Speed = 1 | 1.5 | 2;
export type TeamSummary = typeof mockMatchData.home;
export type PlayByPlayLogEntry = (typeof mockMatchData.playByPlay)[number];
export type CommentaryEntry = (typeof mockMatchData.commentary)[number];
