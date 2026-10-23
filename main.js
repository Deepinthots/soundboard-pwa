
/* The Archives — static GitHub Pages soundboard */
(() => {
  'use strict';

  const files = [
    '5 Farter Death Punch',
    'A Question, Billy',
    'AH',
    'AHHHH',
    'Billy Fanfare',
    'Billy Hum 1',
    'Billy Hum 2',
    'Billy Hum 3',
    'Billy Laugh 1',
    'Boner1',
    'Bully Maguire',
    'Defeated Billy',
    'DIP-PY',
    'Downward Fart',
    'Dry Mop',
    'Goat Ray',
    'GOO!',
    'HHHHHHHHUUUUUOOOO',
    'HHHUUUOO',
    'Humming Billy Laugh',
    'HUO',
    'Inflected Billy',
    'JEW JEW',
    'Jurrassic Lomo',
    'No but Yes',
    'Peckham Laugh',
    'PENQUITOS',
    'PERFECT!',
    'Pop Fart',
    'SarcastiBilly',
    'Soft Billy',
    'TIIIIOOOTTS',
    'Usual Suspects Billy',
    'Wet Fart',
    'Ya (boner!)',
    'Yes but No',
    "You're losing it, Billy",
    'Yyyyeeaaaaaaah'
  ];

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
  let pitch = 1.0;

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

  function applyPitch(audio) {
    // Disable automatic pitch correction.
    // Pitch now rises or falls with playback speed.
    if ('preservesPitch' in audio) {
      audio.preservesPitch = false;
    }

    if ('mozPreservesPitch' in audio) {
      audio.mozPreservesPitch = false;
    }

    if ('webkitPreservesPitch' in audio) {
      audio.webkitPreservesPitch = false;
    }

    audio.playbackRate = pitch;
  }

  function setPitch(value) {
    const parsed = Number(value);

    if (!Number.isFinite(parsed)) return;

    pitch = Math.max(0.50, Math.min(3.0, parsed));

    const slider = $('pitch-slider');
    const display = $('pitch-value');

    if (slider) {
      slider.value = pitch.toFixed(2);
    }

    if (display) {
      display.textContent = `${pitch.toFixed(2)}×`;
    }

    // Changes pitch during playback too.
    if (activeAudio) {
      applyPitch(activeAudio);
    }
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

    const count = $('sound-count');
    if (count) count.textContent = String(sounds.length);

    container.replaceChildren();

    if (!filtered.length) {
      const empty = document.createElement('div');
      empty.className = 'loading';
      empty.textContent = 'No sounds found';
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

    // Apply the selected pitch before playback.
    applyPitch(audio);

    audio.addEventListener('error', () => {
      if (activeAudio === audio) {
        console.error(
          'Could not load:',
          sound.url,
          audio.error
        );
        showStatus(
          `Could not load: ${sound.name}`
        );
      }
    }, { once: true });

    audio.addEventListener('ended', () => {
      if (activeAudio === audio) {
        activeAudio = null;
      }
    }, { once: true });

    try {
      await audio.play();
    } catch (error) {
      // Starting another sound interrupts the previous
      // playback request. That is intentional.
      if (activeAudio !== audio) return;

      console.error(
        'Playback failed:',
        sound.url,
        error
      );

      if (error.name === 'NotAllowedError') {
        showStatus('Tap a sound to enable audio');
      } else {
        showStatus(
          `Could not play: ${sound.name}`
        );
      }

      activeAudio = null;
    }
  }

  function init() {
    document.title = 'The Archives';

    $('search-input')?.addEventListener(
      'input',
      render
    );

    // Pitch slider
    $('pitch-slider')?.addEventListener(
      'input',
      event => {
        setPitch(event.target.value);
      }
    );

    // Return pitch and playback speed to normal.
    $('pitch-reset')?.addEventListener(
      'click',
      () => setPitch(1.0)
    );

    setPitch(1.0);

    // S key focuses search.
    document.addEventListener('keydown', event => {
      const target = event.target;

      if (
        event.key.toLowerCase() === 's' &&
        !(target instanceof HTMLInputElement) &&
        !(target instanceof HTMLTextAreaElement) &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey
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

    // Keep the existing online-only playback behavior.
    // Do not register the old service worker.
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
            'Could not unregister service worker:',
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
