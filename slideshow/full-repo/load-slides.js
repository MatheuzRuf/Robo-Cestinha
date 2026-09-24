(() => {
  'use strict';

  const slideFiles = [
    '01-title.html',
    '02-project.html',
    '03-system.html',
    '04-flows.html',
    '05-frontend.html',
    '06-frontend-flow.html',
    '07-backend.html',
    '08-model.html',
    '09-patterns.html',
    '10-engine.html',
    '11-state-machine.html',
    '12-heuristics.html',
    '13-limitations.html',
    '14-ingestion.html',
    '15-status.html',
    '16-integration.html',
    '17-next.html',
    '18-close.html',
    'a1-shrinkage.html',
    'a2-action-probabilities.html',
    'a3-heuristic-limitations.html',
    'a4-references.html',
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
      const response = await fetch(url);
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
