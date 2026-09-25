(() => {
  'use strict';

  const slideFiles = [
    '01-title.html',
    '02-project.html',
    '03-system.html',
    // '04-flows.html',
    '05-frontend.html',
    // '06-frontend-flow.html',
    '07-backend.html',
    '08-model.html',
    // '10-engine.html',
    '10a-engine.html',
    '10b-grid.html',
    '10c-clock.html',
    '10d-entities.html',
    '10i-state_machine.html',
    '10j-match_runner.html',
    '10o-heuristics_overview.html',
    '10f-heuristics_decision.html',
    '10g-heuristics_pass_move.html',
    '10h-heuristics_shot_rebound.html',
    '10l-heuristics_move.html',
    '10m-heuristics_rebound.html',
    '14-ingestion.html',
    '14a-fetch.html',
    '14b-positions.html',
    '14c-derive.html',
    '14d-contract.html',
    '15-integration.html',
    '16-bridge-strategy.html',
    '17-bridge-contract.html',
    '18-llm-narration.html',
    // '19-status.html',
    // '20-next.html',
    '21-close.html',
    // 'a1-shrinkage.html',
    // 'a2-action-probabilities.html',
    // 'a3-heuristic-limitations.html',
  ];
  const baseUrl = new URL('./', document.currentScript.src);
  const track = document.getElementById('track');

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = () => reject(new Error(`Could not load ${src}`));
      document.body.appendChild(script);
    });
  }

  async function start() {
    const fragments = await Promise.all(slideFiles.map(async (file) => {
      const url = new URL(`slides/${file}`, baseUrl);
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) throw new Error(`Could not load ${file}: ${response.status}`);
      return response.text();
    }));

    track.innerHTML = fragments.join('\n');
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/mermaid/10.9.1/mermaid.min.js');
    await loadScript(new URL('../app.js', baseUrl).href);
  }

  start().catch((error) => {
    const message = document.createElement('p');
    message.setAttribute('role', 'alert');
    message.textContent = `The slides could not be loaded. Serve the repository over HTTP and reload. ${error.message}`;
    track.replaceChildren(message);
    console.error(error);
  });
})();
