
/* Office Soundboard — static GitHub Pages version, no build step required. */
(() => {
  'use strict';

  const files = [
    '5 Farter Death Punch', 'A Question, Billy', 'AH', 'AHHHH',
    'Billy Fanfare', 'Billy Hum 1', 'Billy Hum 2', 'Billy Hum 3',
    'Billy Laugh 1', 'Boner1', 'Bully Maguire', 'Defeated Billy',
    'DIP-PY', 'Downward Fart', 'Dry Mop', 'Goat Ray', 'GOO!',
    'HHHHHHHHUUUUUOOOO', 'HHHUUUOO', 'Humming Billy Laugh', 'HUO',
    'Inflected Billy', 'JEW JEW', 'Jurrassic Lomo', 'No but Yes',
    'Peckham Laugh', 'PENQUITOS', 'PERFECT!', 'Pop Fart',
    'SarcastiBilly', 'Soft Billy', 'TIIIIOOOTTS',
    'Usual Suspects Billy', 'Wet Fart', 'Ya (boner!)',
    'Yes but No', "You're losing it, Billy", 'Yyyyeeaaaaaaah'
  ];

  // Resolve URLs relative to this document.
  // GitHub Pages publishes /public directly.
  const root = new URL('./', document.baseURI);

  const sounds = files.map(name => ({
    name,
    artist: 'Office',
    url: new URL(
      `public/sounds/${encodeURIComponent(name)}.mp3`,
      root
    ).href
  }));

  window.OFFICE_SOUNDS = sounds;

  const $ = id => document.getElementById(id);
  let activeAudio = null;
  let statusTimer;

  function showStatus(message, type = 'error') {
    const el = $('status');
    if (!el) return;

    el.textContent = message;
    el.className = `status show ${type}`;

    clearTimeout(statusTimer);

    statusTimer = setTimeout(() => {
      el.className = 'status';
    }, 5000);
  }

  function render() {
    const container = $('sounds-container');
    const search = $('search-input');

    if (!container) return;

    const query = (search?.value || '')
      .trim()
      .toLowerCase();

    const filtered = sounds.filter(sound =>
      sound.name.toLowerCase().includes(query)
    );

    $('sound-count').textContent = String(sounds.length);
    container.replaceChildren();

    if (!filtered.length) {
      const empty = document.createElement('div');
      empty.className = 'loading';
      empty.textContent = '✗ NO SOUNDS FOUND ✗';

      container.appendChild(empty);
      return;
    }

    for (const sound of filtered) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'sound-button';

      const name = document.createElement('div');
      name.className = 'sound-name';
      name.textContent = sound.name;

      const artist = document.createElement('div');
      artist.className = 'sound-artist';
      artist.textContent = sound.artist;

      btn.append(name, artist);

      btn.addEventListener('click', () => play(sound));
      container.appendChild(btn);
    }
  }

  async function play(sound) {
    if (activeAudio) {
      activeAudio.pause();
      activeAudio.currentTime = 0;
    }

    const audio = new Audio(sound.url);
    activeAudio = audio;

    audio.addEventListener('error', () => {
      if (activeAudio === audio) {
        console.error(
          'Could not load:',
          sound.url,
          audio.error
        );

        showStatus(
          `✗ FILE NOT FOUND OR UNPLAYABLE: ${sound.name} ✗`
        );
      }
    }, { once: true });

    try {
      await audio.play();
    } catch (error) {
      console.error(
        'Playback failed:',
        sound.url,
        error
      );

      if (activeAudio === audio) {
        showStatus(
          error.name === 'NotAllowedError'
            ? '⚠ TAP TO ENABLE AUDIO ⚠'
            : `✗ COULD NOT PLAY: ${sound.name} ✗`
        );
      }
    }
  }

  function init() {
    document.title = '🔊 Office Soundboard';

    $('search-input')?.addEventListener('input', render);

    document.addEventListener('keydown', event => {
      const target = event.target;

      if (
        event.key.toLowerCase() === 's' &&
        !(target instanceof HTMLInputElement) &&
        !(target instanceof HTMLTextAreaElement) &&
        !event.ctrlKey &&
        !event.metaKey
      ) {
        event.preventDefault();
        $('search-input')?.focus();
      }
    });

    const offline = $('offline-indicator');

    const updateConnection = () => {
      if (offline) {
        offline.classList.toggle(
          'show',
          !navigator.onLine
        );
      }
    };

    window.addEventListener('online', updateConnection);
    window.addEventListener('offline', updateConnection);

    updateConnection();
    render();

    // Do not register the existing service worker.
    // This version prioritizes reliable online playback.
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations()
        .then(regs => {
          for (const reg of regs) {
            if (reg.scope.startsWith(root.href)) {
              reg.unregister();
            }
          }
        })
        .catch(err => {
          console.warn(
            'Could not unregister previous service worker:',
            err
          );
        });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener(
      'DOMContentLoaded',
      init,
      { once: true }
    );
  } else {
    init();
  }
})();
