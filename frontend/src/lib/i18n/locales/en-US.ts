export const enUS = {
  common: {
    close: 'Close',
    paste: 'Paste',
    sound: 'Sound',
    profile: 'Profile',
  },
  shell: {
    brand_title: 'ROBÔ CESTINHA',
    brand_subtitle: 'MULTIPLAYER TOURNAMENT BROADCAST',
    nav_home: 'HOME',
    nav_team_locker: 'TEAM LOCKER',
    nav_bracket_tree: 'BRACKET TREE',
    nav_live_broadcast: 'LIVE BROADCAST',
    online_teams: '{count}/{total} TEAMS ONLINE',
    session_code: '{code}',
    ticker_label: 'BROADCAST TICKER',
    ticker_text:
      'COURT 1: BROOKLYN BREAKERS LEAD AUSTIN ARMADILLOS 74-71 (Q4 01:24) // COURT 2: CHICAGO STEEL HOLD 104-98',
  },
  home: {
    hero: {
      line_1: 'LOCAL HARDWOOD.',
      line_2: 'INSTANT TOURNAMENTS.',
      subtitle: 'Create or join an 8-team simulated basketball tournament session.',
    },
    host: {
      title: 'HOST NEW SESSION',
      description: 'Configure quarter length and launch an 8-team single-elimination bracket.',
      sim_speed_label: 'SIMULATION SPEED',
      quarter_length_label: 'QUARTER LENGTH',
      auto_fill_title: 'AUTO-FILL REGIONAL AI CLUBS',
      auto_fill_description: 'Empty seeds filled with classic metro teams',
      cta: 'CREATE TOURNAMENT',
    },
    join: {
      title: 'JOIN ARENA',
      description:
        'Enter your tournament hash or full invite link to claim an unclaimed regional franchise or spectate hardwood live action.',
      input_label: 'SESSION PASSCODE OR URL',
      input_hint: 'FORMAT: #RC-XXXX-MET',
      input_placeholder: 'E.G. #RC-8812-BKN',
      featured_label: 'Featured:',
      cta: 'JOIN SESSION',
    },
    recent: {
      eyebrow: 'RECENT SESSIONS',
      heading: 'RECENT HARDWOOD SESSIONS',
      saved_note: 'Saved on this device.',
    },
    session_card: {
      resume_broadcast: 'RESUME BROADCAST',
      view_replay_bracket: 'VIEW REPLAY BRACKET',
      continue_lobby: 'CONTINUE LOBBY',
    },
    name_modal: {
      title: 'SET DISPLAY NAME',
      label: 'DISPLAY NAME',
      placeholder: 'E.G. ALEX',
      cta: 'SAVE AND CONTINUE',
    },
  },
  match_broadcast: {
    header: {
      live_label: 'LIVE FEED // COURT 01',
      game_meta: 'DIVISION A CHAMPIONSHIP SERIES · GAME 7',
      mode_live: 'LIVE SIM',
      mode_replay: 'REPLAY-BOX',
      latency_label: 'LATENCY: {value}ms',
    },
    scoreboard: { fouls_label: 'FOULS', timeouts_label: 'TIMEOUTS' },
    clock: { speed_label: 'SIMULATION SPEED', shot_clock: 'SHOT CLOCK', pause: 'PAUSE SIM', resume: 'RESUME SIM' },
    play_call: { label: 'PLAY CALL', probability_label: 'SHOT PROBABILITY', defense_label: 'DEFENSE' },
    timeline: { label: 'Q4 TIMELINE', previous: 'Previous play', play: 'Play timeline', next: 'Next play' },
    play_by_play: { title: 'PLAY-BY-PLAY', showing_last: 'SHOWING LAST {count}', full_log_link: 'VIEW FULL LOG' },
    commentary: {
      title: 'COMMENTARY',
      voice_label: 'VOICE SYNTH: CHUCK "CLUTCH" HARLAN',
      synth_active: 'SYNTH ACTIVE',
    },
    momentum: { title: 'MOMENTUM SHIFT ENGINE' },
  },
} as const;
