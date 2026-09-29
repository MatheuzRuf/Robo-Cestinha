export const mockBracketData = {
  sessionCode: '#RC-7842-OAK',
  onlineTeams: { current: 8, total: 8 },
  overview: {
    titleKey: 'bracket_tree.overview.title',
    descriptionKey: 'bracket_tree.overview.description',
    statusKey: 'bracket_tree.overview.status',
    facts: [
      {
        id: 'format',
        labelKey: 'bracket_tree.overview.facts.format.label',
        valueKey: 'bracket_tree.overview.facts.format.value',
      },
      {
        id: 'regulation',
        labelKey: 'bracket_tree.overview.facts.regulation.label',
        valueKey: 'bracket_tree.overview.facts.regulation.value',
      },
      {
        id: 'shotClock',
        labelKey: 'bracket_tree.overview.facts.shot_clock.label',
        valueKey: 'bracket_tree.overview.facts.shot_clock.value',
      },
      {
        id: 'prizePool',
        labelKey: 'bracket_tree.overview.facts.prize_pool.label',
        valueKey: 'bracket_tree.overview.facts.prize_pool.value',
      },
    ],
  },
  stage: {
    labelKey: 'bracket_tree.stage.label',
    currentStageKey: 'bracket_tree.stage.current',
    syncKey: 'bracket_tree.stage.sync',
  },
  rounds: [
    {
      id: 'quarterfinals',
      titleKey: 'bracket_tree.rounds.quarterfinals.title',
      summaryKey: 'bracket_tree.rounds.quarterfinals.summary',
      matches: [
        {
          id: 'qf-1',
          number: 'QF-1',
          venue: 'ARENA 01',
          status: 'complete',
          statusKey: 'bracket_tree.match.status.final',
          teams: [
            { teamKey: 'chicago_steel', seed: 1, score: 84, winner: true },
            { teamKey: 'detroit_dynamos', seed: 8, score: 69, winner: false },
          ],
          detailKey: 'bracket_tree.match.details.quarterfinal_1',
          actionKey: 'bracket_tree.match.replay',
        },
        {
          id: 'qf-2',
          number: 'QF-2',
          venue: 'ARENA 02',
          status: 'complete',
          statusKey: 'bracket_tree.match.status.final',
          teams: [
            { teamKey: 'brooklyn_breakers', seed: 4, score: 79, winner: true },
            { teamKey: 'miami_surge', seed: 5, score: 76, winner: false },
          ],
          detailKey: 'bracket_tree.match.details.quarterfinal_2',
          actionKey: 'bracket_tree.match.replay',
        },
        {
          id: 'qf-3',
          number: 'QF-3',
          venue: 'ARENA 03',
          status: 'complete',
          statusKey: 'bracket_tree.match.status.final',
          teams: [
            { teamKey: 'austin_armadillos', seed: 2, score: 88, winner: true },
            { teamKey: 'pacific_waves', seed: 7, score: 82, winner: false },
          ],
          detailKey: 'bracket_tree.match.details.quarterfinal_3',
          actionKey: 'bracket_tree.match.replay',
        },
        {
          id: 'qf-4',
          number: 'QF-4',
          venue: 'ARENA 04',
          status: 'complete',
          statusKey: 'bracket_tree.match.status.final',
          teams: [
            { teamKey: 'seattle_circuit', seed: 3, score: 91, winner: true },
            { teamKey: 'atlanta_volts', seed: 6, score: 85, winner: false },
          ],
          detailKey: 'bracket_tree.match.details.quarterfinal_4',
          actionKey: 'bracket_tree.match.replay',
        },
      ],
    },
    {
      id: 'semifinals',
      titleKey: 'bracket_tree.rounds.semifinals.title',
      summaryKey: 'bracket_tree.rounds.semifinals.summary',
      matches: [
        {
          id: 'sf-1',
          number: 'SF-1',
          venue: 'COURT 01',
          status: 'live',
          statusKey: 'bracket_tree.match.status.live',
          gameClock: 'Q4 01:24',
          shotClock: '14s',
          teams: [
            { teamKey: 'chicago_steel', seed: 1, score: 78, winner: true },
            { teamKey: 'brooklyn_breakers', seed: 4, score: 74, winner: false },
          ],
          detailKey: 'bracket_tree.match.details.live',
          actionKey: 'bracket_tree.match.watch_stream',
        },
        {
          id: 'sf-2',
          number: 'SF-2',
          venue: 'COURT 02',
          status: 'upcoming',
          statusKey: 'bracket_tree.match.status.upcoming',
          teams: [
            { teamKey: 'austin_armadillos', seed: 2, score: null, winner: false },
            { teamKey: 'seattle_circuit', seed: 3, score: null, winner: false },
          ],
          detailKey: 'bracket_tree.match.details.upcoming',
          actionKey: 'bracket_tree.match.status.warmup',
        },
      ],
    },
  ],
  championship: {
    eyebrowKey: 'bracket_tree.championship.eyebrow',
    titleKey: 'bracket_tree.championship.title',
    descriptionKey: 'bracket_tree.championship.description',
    seriesKey: 'bracket_tree.championship.series',
    statusKey: 'bracket_tree.championship.pending',
    winnerSlots: ['bracket_tree.championship.semifinal_1', 'bracket_tree.championship.semifinal_2'],
  },
  stats: {
    titleKey: 'bracket_tree.stats.title',
    metaKey: 'bracket_tree.stats.meta',
    footnoteKey: 'bracket_tree.stats.footnote',
    columns: [
      'bracket_tree.stats.columns.team',
      'bracket_tree.stats.columns.ppg',
      'bracket_tree.stats.columns.fg',
      'bracket_tree.stats.columns.three_pt',
      'bracket_tree.stats.columns.steals',
      'bracket_tree.stats.columns.status',
    ],
    rows: [
      {
        teamKey: 'chicago_steel',
        seed: 1,
        values: ['84.0', '54.2%', '41.8%', '8.2'],
        statusKey: 'bracket_tree.stats.status.live_sf_1',
      },
      {
        teamKey: 'brooklyn_breakers',
        seed: 4,
        values: ['79.0', '49.0%', '38.4%', '9.5'],
        statusKey: 'bracket_tree.stats.status.live_sf_1',
      },
      {
        teamKey: 'austin_armadillos',
        seed: 2,
        values: ['88.0', '56.1%', '43.0%', '6.8'],
        statusKey: 'bracket_tree.stats.status.sf_2_ready',
      },
      {
        teamKey: 'seattle_circuit',
        seed: 3,
        values: ['91.0', '58.7%', '45.2%', '11.0'],
        statusKey: 'bracket_tree.stats.status.sf_2_ready',
      },
    ],
  },
  actionLog: {
    titleKey: 'bracket_tree.action_log.title',
    liveKey: 'bracket_tree.action_log.live',
    broadcasterKey: 'bracket_tree.action_log.broadcaster',
    audioKey: 'bracket_tree.action_log.audio',
    entries: [
      {
        id: '1',
        time: '01:24',
        teamKey: 'chicago_steel',
        player: 'T. Henderson',
        descriptionKey: 'bracket_tree.action_log.events.pull_up',
      },
      {
        id: '2',
        time: '01:42',
        teamKey: 'brooklyn_breakers',
        player: 'R. Santos',
        descriptionKey: 'bracket_tree.action_log.events.rebound',
      },
      {
        id: '3',
        time: '02:05',
        teamKey: 'chicago_steel',
        player: 'D. Cole',
        descriptionKey: 'bracket_tree.action_log.events.inbound',
      },
      {
        id: '4',
        time: '02:30',
        teamKey: 'brooklyn_breakers',
        player: 'K. Patel',
        descriptionKey: 'bracket_tree.action_log.events.three_pointer',
      },
    ],
  },
} as const;

export type BracketTeamKey =
  | 'chicago_steel'
  | 'detroit_dynamos'
  | 'brooklyn_breakers'
  | 'miami_surge'
  | 'austin_armadillos'
  | 'pacific_waves'
  | 'seattle_circuit'
  | 'atlanta_volts';
