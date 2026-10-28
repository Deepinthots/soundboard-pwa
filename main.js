
/* The Archives — two playback modes; no NEW badges. */
(() => {
  'use strict';

  const files = [
    "5 Farter Death Punch",
    "Adjusting",
    "A Question, Billy",
    "AH",
    "AHHHH",
    "Billy Fanfare",
    "Billy Hum 1",
    "Billy Hum 2",
    "Billy Hum 3",
    "Billy Laugh 1",
    "Boner1",
    "BOOM",
    "Bully Maguire",
    "Dagger Beers",
    "Defeated Billy",
    "DIP-PY",
    "Downward Fart",
    "Dry Mop",
    "FAAAHH",
    "Goat Ray",
    "GOO!",
    "HHHHHHHHUUUUUOOOO",
    "HHHUUUOO",
    "Humming Billy Laugh",
    "HUO",
    "Inflected Billy",
    "JEW JEW",
    "Jurrassic Lomo",
    "L&O Extended",
    "L&O DUN DUN",
    "No but Yes",
    "Oh",
    "Oh Hey Look Deer",
    "Peckham Laugh",
    "PENQUITOS",
    "PERFECT!",
    "Pop Fart",
    "SarcastiBilly",
    "Soft Billy",
    "THATS ALOTTA NUTS",
    "TIIIIOOOTTS",
    "Usual Suspects Billy",
    "Wet Fart",
    "Ya (boner!)",
    "Yes but No",
    "You're losing it, Billy",
    "Yyyyeeaaaaaaah"
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

  let mode = 'pitch';
  let position = 0;

  let activeAudio = null;
  let activePlayer = null;
  let activeEffect = null;

  let sequence = 0;
  let statusTimer;

  function notify(message) {
    const el = $('status');

    if (!el) return;

    el.textContent = message;
    el.className = 'status show';

    clearTimeout(statusTimer);

    statusTimer = setTimeout(() => {
      el.className = 'status';
    }, 5000);
  }

  function rateFromPosition(p) {
    return p <= 0
      ? 1 + p / 100 * 0.5
      : 1 + p / 100 * 2;
  }

  function semitonesFromPosition(p) {
    return Math.round(p * 12 / 100);
  }

  function stopCurrent() {
    sequence++;

    if (activeAudio) {
      activeAudio.pause();
      activeAudio.removeAttribute('src');
      activeAudio.load();
      activeAudio = null;
    }

    if (activePlayer) {
      try {
        activePlayer.stop();
      } catch (_) {}

      activePlayer.dispose();
      activePlayer = null;
    }

    if (activeEffect) {
      activeEffect.dispose();
      activeEffect = null;
    }
  }

  function setPosition(value) {
    const n = Number(value);

    if (!Number.isFinite(n)) return;

    position = Math.max(
      -100,
      Math.min(100, Math.round(n))
    );

    if ($('pitch-slider')) {
      $('pitch-slider').value = String(position);
    }

    const display = $('pitch-value');

    if (display) {
      if (mode === 'pitch') {
        const st = semitonesFromPosition(position);

        display.textContent =
          `${st > 0 ? '+' : ''}${st} st`;
      } else {
        display.textContent =
          `${rateFromPosition(position).toFixed(2)}×`;
      }
    }

    if (activeAudio) {
      activeAudio.playbackRate =
        rateFromPosition(position);
    }

    if (activeEffect) {
      activeEffect.pitch =
        semitonesFromPosition(position);
    }
  }

  function setMode(next) {
    if (next !== 'pitch' && next !== 'speed') {
      return;
    }

    if (
      next === 'pitch' &&
      (!window.Tone || !window.Tone.PitchShift)
    ) {
      notify(
        'Pitch-only processing is unavailable. Using Pitch + Speed.'
      );

      next = 'speed';
    }

    if (mode !== next) {
      stopCurrent();
    }

    mode = next;

    for (
      const button of document.querySelectorAll(
        '[data-playback-mode]'
      )
    ) {
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
    }

    const labels = $('pitch-labels');

    if (labels) {
      labels.children[0].textContent =
        mode === 'pitch'
          ? '-12 st Deep'
          : '0.50× Slow';

      labels.children[1].textContent = 'Normal';

      labels.children[2].textContent =
        mode === 'pitch'
          ? '+12 st High'
          : '3.00× Fast';
    }

    setPosition(0);
  }

  function render() {
    const container = $('sounds-container');

    if (!container) return;

    const q = (
      $('search-input')?.value || ''
    ).trim().toLowerCase();

    const filtered = sounds.filter(sound =>
      sound.name.toLowerCase().includes(q)
    );

    if ($('sound-count')) {
      $('sound-count').textContent =
        String(sounds.length);
    }

    container.replaceChildren();

    if (!filtered.length) {
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

  async function play(sound) {
    stopCurrent();

    const thisSequence = sequence;

    // Original pitch + speed mode.
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
          notify(`Could not load: ${sound.name}`);
        }
      });

      audio.addEventListener('ended', () => {
        if (activeAudio === audio) {
          activeAudio = null;
        }
      }, { once: true });

      try {
        await audio.play();
      } catch (error) {
        if (thisSequence !== sequence) return;

        console.error(
          'Sound playback error',
          sound.url,
          error
        );

        notify(`Could not play: ${sound.name}`);
      }

      return;
    }

    // True pitch-only mode, powered by Tone.js.
    try {
      if (!window.Tone || !Tone.PitchShift) {
        notify(
          'Pitch-only library unavailable. Select Pitch + Speed.'
        );

        return;
      }

      // Unlock browser audio after the user clicks.
      await Tone.start();

      if (thisSequence !== sequence) return;

      const effect = new Tone.PitchShift({
        pitch: semitonesFromPosition(position),
        wet: 1
      }).toDestination();

      activeEffect = effect;

      const player = new Tone.Player();

      activePlayer = player;
      player.connect(effect);

      await player.load(sound.url);

      if (thisSequence !== sequence) return;

      player.start();

      player.onstop = () => {
        if (activePlayer !== player) return;

        activePlayer = null;
        activeEffect = null;

        // Let the effect finish naturally.
        setTimeout(() => {
          player.dispose();
          effect.dispose();
        }, 350);
      };

    } catch (error) {
      if (thisSequence !== sequence) return;

      console.error(
        'Pitch-only playback error',
        sound.url,
        error
      );

      notify(`Could not play: ${sound.name}`);

      stopCurrent();
    }
  }

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
        () => setMode(button.dataset.playbackMode)
      );
    });

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
      syncConnection
    );

    window.addEventListener(
      'offline',
      syncConnection
    );

    syncConnection();
    render();

    setMode('pitch');

    // Retain current online-only behavior.
    // Offline caching will be handled later.
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations()
        .then(regs => {
          for (const reg of regs) {
            if (reg.scope.startsWith(root.href)) {
              reg.unregister();
            }
          }
        })
        .catch(console.warn);
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
