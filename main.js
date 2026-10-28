
/*
  The Archives
  Automatic GitHub sound discovery
  Pitch Only + Pitch and Speed
*/

(() => {
  'use strict';

  const REPO_OWNER = 'Deepinthots';
  const REPO_NAME = 'soundboard-pwa';
  const SOUND_FOLDER = 'public/sounds';

  const API_URL =
    `https://api.github.com/repos/${REPO_OWNER}/` +
    `${REPO_NAME}/contents/${SOUND_FOLDER}?ref=main`;

  const SOUND_CACHE_KEY =
    'the-archives-sound-list-v1';

  const root = new URL('./', document.baseURI);
  const $ = id => document.getElementById(id);

  let sounds = [];

  let mode = 'pitch';
  let position = 0;

  let activeAudio = null;
  let activePlayer = null;
  let activeEffect = null;

  let sequence = 0;
  let statusTimer;

  /*
    SOUND DISCOVERY
  */

  function buildSound(filename) {
    const name = filename.replace(/\.mp3$/i, '');

    return {
      name,
      artist: 'Office',
      url: new URL(
        `public/sounds/${encodeURIComponent(filename)}`,
        root
      ).href
    };
  }

  function getSavedSounds() {
    try {
      const saved = JSON.parse(
        localStorage.getItem(SOUND_CACHE_KEY)
      );

      if (!Array.isArray(saved)) {
        return [];
      }

      return saved
        .filter(filename =>
          typeof filename === 'string' &&
          /\.mp3$/i.test(filename)
        )
        .map(buildSound);

    } catch (error) {
      console.warn(
        'Unable to read saved sound list:',
        error
      );

      return [];
    }
  }

  function saveSounds(filenames) {
    try {
      localStorage.setItem(
        SOUND_CACHE_KEY,
        JSON.stringify(filenames)
      );

    } catch (error) {
      console.warn(
        'Unable to save sound list:',
        error
      );
    }
  }

  async function discoverSounds() {
    const response = await fetch(API_URL, {
      cache: 'no-store',
      headers: {
        Accept: 'application/vnd.github+json'
      }
    });

    if (!response.ok) {
      throw new Error(
        `GitHub API returned HTTP ${response.status}`
      );
    }

    const data = await response.json();

    if (!Array.isArray(data)) {
      throw new Error(
        'GitHub returned an unexpected folder listing'
      );
    }

    const filenames = data
      .filter(item =>
        item.type === 'file' &&
        typeof item.name === 'string' &&
        /\.mp3$/i.test(item.name)
      )
      .map(item => item.name);

    filenames.sort((a, b) =>
      a.localeCompare(b, undefined, {
        numeric: true,
        sensitivity: 'base'
      })
    );

    return filenames;
  }

  async function loadSoundList() {
    // Show the saved collection immediately
    // while checking GitHub for current files.
    sounds = getSavedSounds();

    window.OFFICE_SOUNDS = sounds;

    render();

    try {
      const filenames = await discoverSounds();

      sounds = filenames.map(buildSound);

      window.OFFICE_SOUNDS = sounds;

      // Replace the saved list only after
      // successful discovery.
      saveSounds(filenames);

      render();

      console.info(
        `The Archives: loaded ${sounds.length} sounds`
      );

    } catch (error) {
      console.warn(
        'Automatic sound discovery failed:',
        error
      );

      if (sounds.length === 0) {
        showStatus(
          'Could not load sound list. Check connection.'
        );
      } else {
        console.info(
          'Using previously saved sound list.'
        );
      }
    }
  }

  /*
    STATUS MESSAGES
  */

  function showStatus(message) {
    const el = $('status');

    if (!el) return;

    el.textContent = message;
    el.className = 'status show';

    clearTimeout(statusTimer);

    statusTimer = setTimeout(() => {
      el.className = 'status';
    }, 5000);
  }

  /*
    PITCH SETTINGS
  */

  function rateFromPosition(p) {
    return p <= 0
      ? 1 + (p / 100) * 0.75
      : 1 + (p / 100) * 2;
  }

  function semitonesFromPosition(p) {
    return Math.round(p * 12 / 100);
  }

  /*
    STOP PREVIOUS AUDIO
  */

  function stopCurrent() {
    sequence++;

    if (activeAudio) {
      const audio = activeAudio;
      activeAudio = null;

      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    }

    if (activePlayer) {
      const player = activePlayer;
      activePlayer = null;

      player.onstop = () => {};

      try {
        player.stop();
      } catch (error) {
        // Player may not have started yet.
      }

      player.dispose();
    }

    if (activeEffect) {
      const effect = activeEffect;
      activeEffect = null;

      effect.dispose();
    }
  }

  /*
    ADJUST THE SLIDER
  */

  function setPosition(value) {
    const parsed = Number(value);

    if (!Number.isFinite(parsed)) {
      return;
    }

    position = Math.max(
      -100,
      Math.min(100, Math.round(parsed))
    );

    const slider = $('pitch-slider');

    if (slider) {
      slider.value = String(position);
    }

    const display = $('pitch-value');

    if (display) {
      if (mode === 'pitch') {
        const semitones =
          semitonesFromPosition(position);

        display.textContent =
          `${semitones > 0 ? '+' : ''}${semitones} st`;

      } else {
        display.textContent =
          `${rateFromPosition(position).toFixed(2)}×`;
      }
    }

    // Change currently playing audio.
    if (activeAudio && mode === 'speed') {
      activeAudio.playbackRate =
    rateFromPosition(position);
}

    if (activeEffect) {
      activeEffect.pitch =
        semitonesFromPosition(position);
    }
  }

  /*
    SWITCH PLAYBACK MODES
  */

  function setMode(nextMode) {
    if (
      nextMode !== 'pitch' &&
      nextMode !== 'speed'
    ) {
      return;
    }

    // Fall back to native playback
    // if Tone.js did not load.
    if (
      nextMode === 'pitch' &&
      (!window.Tone || !window.Tone.PitchShift)
    ) {
      nextMode = 'speed';

      showStatus(
        'Pitch-only processing unavailable. Using Pitch + Speed.'
      );
    }

    if (mode !== nextMode) {
      stopCurrent();
    }

    mode = nextMode;

    document.querySelectorAll(
      '[data-playback-mode]'
    ).forEach(button => {
      const selected =
        button.dataset.playbackMode === mode;

      button.classList.toggle(
        'selected',
        selected
      );

      button.setAttribute(
        'aria-pressed',
        String(selected)
      );
    });

    const labels = $('pitch-labels');

    if (labels && labels.children.length >= 3) {
      labels.children[0].textContent =
        mode === 'pitch'
          ? '-12 st Deep'
          : '0.25× Slow';

      labels.children[1].textContent =
        'Normal';

      labels.children[2].textContent =
        mode === 'pitch'
          ? '+12 st High'
          : '3.00× Fast';
    }

    setPosition(0);
  }

  /*
    CREATE SOUND BUTTONS
  */

  function render() {
    const container = $('sounds-container');

    if (!container) return;

    const search = $('search-input');

    const query = (
      search?.value || ''
    ).trim().toLowerCase();

    const filtered = sounds.filter(sound =>
      sound.name.toLowerCase().includes(query)
    );

    const count = $('sound-count');

    if (count) {
      count.textContent = String(sounds.length);
    }

    container.replaceChildren();

    if (sounds.length === 0) {
      const loading = document.createElement('div');

      loading.className = 'loading';
      loading.textContent = 'Loading sounds...';

      container.appendChild(loading);
      return;
    }

    if (filtered.length === 0) {
      const empty = document.createElement('div');

      empty.className = 'loading';
      empty.textContent = 'No sounds found';

      container.appendChild(empty);
      return;
    }

    for (const sound of filtered) {
      const button = document.createElement('button');

      button.type = 'button';
      button.className = 'sound-button';

      const name = document.createElement('div');

      name.className = 'sound-name';
      name.textContent = sound.name;

      const artist = document.createElement('div');

      artist.className = 'sound-artist';
      artist.textContent = sound.artist;

      button.append(name, artist);

      button.addEventListener(
        'click',
        () => play(sound)
      );

      container.appendChild(button);
    }
  }

  /*
    PLAY AUDIO
  */

  async function play(sound) {
    stopCurrent();

    const thisSequence = sequence;

    /*
      MODE 1: PITCH + SPEED
      Uses native browser audio.
    */

    if (mode === 'speed') {
      const audio = new Audio(sound.url);

      activeAudio = audio;

      if ('preservesPitch' in audio) {
        audio.preservesPitch = false;
      }

      if ('mozPreservesPitch' in audio) {
        audio.mozPreservesPitch = false;
      }

      if ('webkitPreservesPitch' in audio) {
        audio.webkitPreservesPitch = false;
      }

      audio.playbackRate =
        rateFromPosition(position);

      audio.addEventListener('error', () => {
        if (activeAudio === audio) {
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
        if (thisSequence !== sequence) {
          return;
        }

        console.error(
          'Playback error:',
          sound.url,
          error
        );

        showStatus(
          `Could not play: ${sound.name}`
        );

        activeAudio = null;
      }

      return;
    }

    /*
      MODE 2: PITCH ONLY
      Preserves playback duration.

      Uses browser fetch and decoding
      instead of Tone.Player.load(url).

      This prevents the double-encoding
      errors we fixed previously.
    */


try {
  if (!window.Tone || !Tone.PitchShift) {
    showStatus('Pitch-only library unavailable.');
    return;
  }

  await Tone.start();

  if (thisSequence !== sequence) return;

  // Use the browser's MP3 player rather than
  // decodeAudioData(), which fails on some files.
  const audio = new Audio();

  audio.preload = 'auto';
  audio.crossOrigin = 'anonymous';
  audio.src = sound.url;
  audio.playbackRate = 1;
  audio.preservesPitch = true;

  activeAudio = audio;

  // Create the pitch-shifting effect.
  const effect = new Tone.PitchShift({
    pitch: semitonesFromPosition(position),
    wet: 1
  }).toDestination();

  activeEffect = effect;

  // Route the browser's audio playback
  // through Tone.js.
  const source = Tone.getContext()
    .rawContext.createMediaElementSource(audio);

  Tone.connect(source, effect);

  audio.addEventListener('ended', () => {
    if (activeAudio !== audio) return;

    activeAudio = null;
    activeEffect = null;

    source.disconnect();

    setTimeout(() => {
      effect.dispose();
    }, 350);

  }, { once: true });

  await audio.play();

} catch (error) {
  if (thisSequence !== sequence) return;

  console.error(
    'Pitch-only playback error:',
    sound.url,
    error
  );

  showStatus(`Could not play: ${sound.name}`);

  stopCurrent();
}

  }

  /*
    INITIALIZE THE ARCHIVES
  */

  function init() {
    document.title = 'The Archives';

    $('search-input')?.addEventListener(
      'input',
      render
    );

    $('pitch-slider')?.addEventListener(
      'input',
      event => setPosition(event.target.value)
    );

    $('pitch-reset')?.addEventListener(
      'click',
      () => setPosition(0)
    );

    document.querySelectorAll(
      '[data-playback-mode]'
    ).forEach(button => {
      button.addEventListener(
        'click',
        () => setMode(
          button.dataset.playbackMode
        )
      );
    });

    // Press S to focus the search box.
    document.addEventListener(
      'keydown',
      event => {
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
      }
    );

    const syncConnection = () => {
      $('offline-indicator')?.classList.toggle(
        'show',
        !navigator.onLine
      );
    };

    window.addEventListener(
      'online',
      () => {
        syncConnection();
        loadSoundList();
      }
    );

    window.addEventListener(
      'offline',
      syncConnection
    );

    syncConnection();

    // Initialize the selected playback mode.
    setMode('pitch');

    // Discover MP3s automatically.
    loadSoundList();

    // Keep existing online-only behavior.
    // Offline caching will be handled later.
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations()
        .then(registrations => {
          for (const registration of registrations) {
            if (registration.scope.startsWith(root.href)) {
              registration.unregister();
            }
          }
        })
        .catch(error => {
          console.warn(
            'Service worker cleanup failed:',
            error
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