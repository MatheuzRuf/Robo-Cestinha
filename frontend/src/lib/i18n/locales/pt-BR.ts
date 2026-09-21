export const ptBR = {
  common: {
    close: 'Fechar',
    paste: 'Colar',
    sound: 'Som',
    profile: 'Perfil',
  },
  shell: {
    brand_title: 'ROBÔ CESTINHA',
    brand_subtitle: 'TRANSMISSÃO MULTIJOGADOR DE TORNEIO',
    nav_home: 'INÍCIO',
    nav_team_locker: 'VESTIÁRIO',
    nav_bracket_tree: 'CHAVEAMENTO',
    nav_live_broadcast: 'TRANSMISSÃO AO VIVO',
    online_teams: '{count}/{total} TIMES ONLINE',
    session_code: '{code}',
    ticker_label: 'TICKER DA TRANSMISSÃO',
    ticker_text:
      'QUADRA 1: BROOKLYN BREAKERS NA FRENTE DOS AUSTIN ARMADILLOS 74-71 (Q4 01:24) // QUADRA 2: CHICAGO STEEL 104-98',
  },
  home: {
    hero: {
      line_1: 'LOCAL HARDWOOD.',
      line_2: 'TORNEIOS IMEDIATOS.',
      subtitle: 'Crie ou entre em uma sessão simulada de torneio de basquete com 8 equipes.',
    },
    host: {
      title: 'CRIAR NOVA SESSÃO',
      description: 'Configure a duração do quarto e inicie uma chave de eliminação simples com 8 equipes.',
      sim_speed_label: 'VELOCIDADE DA SIMULAÇÃO',
      quarter_length_label: 'DURAÇÃO DO QUARTO',
      auto_fill_title: 'PREENCHER CLUBES AI REGIONAIS',
      auto_fill_description: 'Vagas vazias preenchidas com times metropolitanos clássicos',
      cta: 'CRIAR TORNEIO',
    },
    join: {
      title: 'ENTRAR NA ARENA',
      description:
        'Digite o hash do torneio ou o link completo do convite para reivindicar uma franquia regional não ocupada ou assistir ao vivo.',
      input_label: 'CÓDIGO OU URL DA SESSÃO',
      input_hint: 'FORMATO: #RC-XXXX-MET',
      input_placeholder: 'EX.: #RC-8812-BKN',
      featured_label: 'Em destaque:',
      cta: 'ENTRAR NA SESSÃO',
    },
    recent: {
      eyebrow: 'SESSÕES RECENTES',
      heading: 'SESSÕES RECENTES DE HARDWOOD',
      saved_note: 'Salvo neste dispositivo.',
    },
    session_card: {
      resume_broadcast: 'RETOMAR TRANSMISSÃO',
      view_replay_bracket: 'VER CHAVEAMENTO',
      continue_lobby: 'CONTINUAR LOBBY',
    },
    name_modal: {
      title: 'DEFINIR NOME DE EXIBIÇÃO',
      label: 'NOME DE EXIBIÇÃO',
      placeholder: 'EX.: ALEX',
      cta: 'SALVAR E CONTINUAR',
    },
  },
  match_broadcast: {
    header: {
      live_label: 'TRANSMISSÃO AO VIVO // QUADRA 01',
      game_meta: 'SÉRIE DO CAMPEONATO DIVISÃO A · JOGO 7',
      mode_live: 'SIM AO VIVO',
      mode_replay: 'REPLAY-BOX',
      latency_label: 'LATÊNCIA: {value}ms',
    },
    scoreboard: { fouls_label: 'FALTAS', timeouts_label: 'TEMPOS' },
    clock: {
      speed_label: 'VELOCIDADE DA SIMULAÇÃO',
      shot_clock: 'RELÓGIO DE ATAQUE',
      pause: 'PAUSAR SIM',
      resume: 'RETOMAR SIM',
    },
    play_call: { label: 'JOGADA', probability_label: 'PROBABILIDADE DE ARREMESSO', defense_label: 'DEFESA' },
    timeline: {
      label: 'LINHA DO TEMPO Q4',
      previous: 'Jogada anterior',
      play: 'Reproduzir linha do tempo',
      next: 'Próxima jogada',
    },
    play_by_play: {
      title: 'JOGADA A JOGADA',
      showing_last: 'EXIBINDO AS ÚLTIMAS {count}',
      full_log_link: 'VER LOG COMPLETO',
    },
    commentary: {
      title: 'COMENTÁRIOS',
      voice_label: 'VOZ SINTÉTICA: CHUCK "CLUTCH" HARLAN',
      synth_active: 'SÍNTESE ATIVA',
    },
    momentum: { title: 'MOTOR DE MOMENTO' },
  },
} as const;
