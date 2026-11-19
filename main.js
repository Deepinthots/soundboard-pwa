
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
  let activeRouting = null;
  let activeSound = null;
  let activeReverse = false;
  let echoLevel = 0;
  let voiceFilter = 'off';
  let loopEnabled = false; // Intentionally resets to Off on every visit.
  const pendingTails = new Set();

  const REVERB_STORAGE_KEY = 'archives-reverb-level-v1';
  let reverbLevel = 0;
  try {
    const stored = Number(localStorage.getItem(REVERB_STORAGE_KEY));
    if (Number.isFinite(stored)) reverbLevel = Math.max(0, Math.min(100, stored));
  } catch (error) {
    console.warn('Reverb preference unavailable:', error);
  }


  let sequence = 0;
  let statusTimer;

  /*
    SITE-WIDE ANONYMOUS PLAY COUNTS
    Configure once by pasting your Apps Script /exec URL below.
    Works with regular sound buttons and numpad playback.
  */
  const STATS_API_URL = 'https://script.google.com/macros/s/AKfycbwqfMnwwdO4mRRa8ud1GtgHwkSsyfZdGXBBtQNAQJf5pAX2LHnuknW7pYScDjmUOruO/exec';
  const statsConfigured = /^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec$/.test(STATS_API_URL);
  let sharedPlayCounts = {};
  let statsLoaded = false;
  let statsLoading = false;
  let statsRequestNumber = 0;

  // Submitting a POST with no-cors is required because Google Apps Script
  // does not provide CORS response headers. The opaque response cannot
  // confirm that Sheets actually saved the play. Check the sheet to verify.
  function recordPlay(sound) {
    if (!statsConfigured) return;
    const eventId = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    fetch(STATS_API_URL, {
      method: 'POST',
      mode: 'no-cors',
      keepalive: true,
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      body: JSON.stringify({ sound: sound.name, eventId })
    }).catch(error => {
      console.warn('Anonymous play event could not be sent:', error);
    });
  }

  function currentStats() {
    const records = sounds.map(sound => ({
      name: sound.name,
      plays: sharedPlayCounts[sound.name] || 0
    }));
    // Also expose any deleted sounds that had previous plays.
    for (const [name, plays] of Object.entries(sharedPlayCounts)) {
      if (!records.some(item => item.name === name)) {
        records.push({ name, plays, removed: true });
      }
    }
    const sort = $('stats-sort')?.value || 'least';
    records.sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name);
      const difference = sort === 'most' ? b.plays - a.plays : a.plays - b.plays;
      return difference || a.name.localeCompare(b.name);
    });
    return records;
  }

  function renderStats() {
    const panel = $('archives-stats');
    if (!panel || panel.hidden) return;
    const summary = $('stats-summary');
    if (!statsConfigured) {
      summary.textContent = 'Setup required: paste your Google Apps Script /exec URL into main.js.';
      $('stats-rows').replaceChildren();
      return;
    }
    if (statsLoading && !statsLoaded) {
      summary.textContent = 'Loading shared play counts…';
      return;
    }
    if (!statsLoaded) {
      summary.textContent = 'Could not load shared play counts. Use Refresh to try again.';
      return;
    }
    const records = currentStats();
    const total = records.reduce((sum, item) => sum + item.plays, 0);
    const current = records.filter(item => !item.removed);
    const unused = current.filter(item => item.plays === 0).length;
    summary.textContent =
      `${total.toLocaleString()} plays across all visitors · ${current.length} current sounds · ${unused} never played`;
    const body = $('stats-rows');
    body.replaceChildren();
    for (const item of records) {
      const row = document.createElement('tr');
      const name = document.createElement('td');
      const plays = document.createElement('td');
      name.textContent = item.name + (item.removed ? ' (removed)' : '');
      plays.textContent = String(item.plays);
      row.append(name, plays);
      body.appendChild(row);
    }
  }

  function exportStatsCSV() {
    if (!statsLoaded) {
      showStatus('Load the shared statistics before exporting.');
      return;
    }
    const escapeCell = value => {
      let text = String(value);
      // Prevent names from being interpreted as spreadsheet formulas.
      if (/^\s*[=+\-@]/.test(text)) text = "'" + text;
      return '"' + text.replace(/"/g, '""') + '"';
    };
    const rows = [['Sound', 'Plays'], ...currentStats().map(item => [item.name, item.plays])];
    const csv = '\uFEFF' + rows.map(row => row.map(escapeCell).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'the-archives-sitewide-play-counts.csv';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // Google ContentService JSON is cross-origin, so use its documented
  // read-only JSONP mechanism. The callback is a fixed, validated name.
  function loadSharedStats() {
    if (!statsConfigured || statsLoading) {
      renderStats();
      return;
    }
    statsLoading = true;
    renderStats();
    const requestNumber = ++statsRequestNumber;
    const callbackName = '__archivesStatsCallback_' + requestNumber;
    const script = document.createElement('script');
    const url = new URL(STATS_API_URL);
    url.searchParams.set('prefix', callbackName);
    url.searchParams.set('_t', String(Date.now()));
    let finished = false;
    let timeout;

    function finish(ok) {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      script.remove();
      delete window[callbackName];
      statsLoading = false;
      if (!ok) console.warn('Could not retrieve shared statistics from Apps Script.');
      renderStats();
    }

    window[callbackName] = response => {
      if (!response || response.ok !== true || !Array.isArray(response.sounds)) {
        finish(false);
        return;
      }
      const counts = {};
      for (const entry of response.sounds) {
        if (typeof entry.name === 'string' && Number.isSafeInteger(entry.plays) && entry.plays >= 0) {
          counts[entry.name] = entry.plays;
        }
      }
      sharedPlayCounts = counts;
      statsLoaded = true;
      finish(true);
    };

    script.onerror = () => finish(false);
    timeout = setTimeout(() => finish(false), 15000);
    script.src = url.href;
    document.head.appendChild(script);
  }

  function initStats() {
    const panel = $('archives-stats');
    if (!panel) return;
    panel.hidden = new URLSearchParams(location.search).get('stats') !== '1';
    if (panel.hidden) return;
    $('stats-sort')?.addEventListener('change', renderStats);
    $('stats-export')?.addEventListener('click', exportStatsCSV);
    $('stats-refresh')?.addEventListener('click', loadSharedStats);
    $('stats-close')?.addEventListener('click', () => {
      panel.hidden = true;
      const url = new URL(location.href);
      url.searchParams.delete('stats');
      history.replaceState(null, '', url.href);
    });
    loadSharedStats();
  }

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
      renderStats();

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
    SHARED REVERB PROCESSING
    Uses the browser's native ConvolverNode after optional pitch shifting.
    Neither playback mode uses MP3 decodeAudioData().
  */

  let cachedImpulse = null;
  let cachedImpulseContext = null;

  function getReverbImpulse(context) {
    if (cachedImpulse && cachedImpulseContext === context) return cachedImpulse;
    const length = Math.ceil(context.sampleRate * 4.5);
    const buffer = context.createBuffer(2, length, context.sampleRate);
    for (let channel = 0; channel < 2; channel++) {
      const data = buffer.getChannelData(channel);
      for (let i = 0; i < length; i++) {
        const t = i / length;
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 1.6);
      }
    }
    cachedImpulse = buffer;
    cachedImpulseContext = context;
    return buffer;
  }

  function applyReverbLevel(routing) {
    if (!routing) return;
    const level = reverbLevel / 100;
    const now = routing.context.currentTime;
    routing.dry.gain.setTargetAtTime(1 - 0.78 * level, now, .015);
    routing.wet.gain.setTargetAtTime(Math.pow(level, 0.85), now, .015);
  }

  function applyEchoLevel(routing) {
    if (!routing) return;
    const level = echoLevel / 100;
    const now = routing.context.currentTime;
    // Bounded feedback: even at 100%, less than half the delayed signal
    // returns to the delay. The compressor also helps tame overlapping tails.
    routing.echoWet.gain.setTargetAtTime(0.65 * level, now, .015);
    routing.echoFeedback.gain.setTargetAtTime(0.38 * level, now, .015);
  }

  function setReverb(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return;
    reverbLevel = Math.max(0, Math.min(100, Math.round(parsed)));
    if ($('reverb-slider')) $('reverb-slider').value = String(reverbLevel);
    if ($('reverb-value')) $('reverb-value').textContent = `${reverbLevel}%`;
    applyReverbLevel(activeRouting);
    try { localStorage.setItem(REVERB_STORAGE_KEY, String(reverbLevel)); }
    catch (_) { /* Settings still work without storage. */ }
  }

  function setEcho(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return;
    echoLevel = Math.max(0, Math.min(100, Math.round(parsed)));
    if ($('echo-slider')) $('echo-slider').value = String(echoLevel);
    if ($('echo-value')) $('echo-value').textContent = `${echoLevel}%`;
    applyEchoLevel(activeRouting);
  }

  function setVoiceFilter(value) {
    if (!['off', 'wobble'].includes(value)) return;
    voiceFilter = value;
    if ($('voice-filter')) $('voice-filter').value = value;
    // Rebuild the routing at the next play; avoids unsafe graph rewiring.
    // Changing the dropdown during playback restarts that clip with the new filter.
    if ((activeAudio || activePlayer) && activeSound) {
      play(activeSound, { reverse: activeReverse });
    }
  }

  function setLoop(enabled) {
    loopEnabled = Boolean(enabled);
    if ($('loop-toggle')) $('loop-toggle').checked = loopEnabled;
    if (activeAudio) activeAudio.loop = loopEnabled;
    if (activePlayer) activePlayer.loop = loopEnabled;
  }

  function setPlaybackLabel(name = 'Stopped') {
    if ($('playing-label')) $('playing-label').textContent = name;
  }

  function resetAllEffects() {
    setPosition(0);
    setReverb(0);
    setEcho(0);
    setVoiceFilter('off');
  }

  // Each audio instance has exactly one effects chain. Repeats reuse it.
  function makeAudioRouting(audio, pitchEffect = null, providedSource = null) {
    const context = Tone.getContext().rawContext;
    const nodes = [];
    const oscillators = [];
    const node = (value) => { nodes.push(value); return value; };
    const source = node(providedSource || context.createMediaElementSource(audio));
    let input = source;

    if (pitchEffect) {
      Tone.connect(source, pitchEffect);
      input = pitchEffect;
    }

    function connect(a, b) { Tone.connect(a, b); }

    // Gentle Wobble is the only optional voice filter in v1.0.
    // The original sound remains audible for clarity.
    if (voiceFilter === 'wobble') {
      // Gentle wow/flutter: ~2 ms delay modulation, blended with clean.
      // Previously 8 ms, which made the original sound unrecognizable.
      const clean = node(context.createGain());
      clean.gain.value = 0.45;
      const vibrato = node(context.createDelay(0.05));
      vibrato.delayTime.value = 0.009;
      const lfo = context.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = 4.1;
      const depth = node(context.createGain());
      depth.gain.value = 0.002;
      lfo.connect(depth); depth.connect(vibrato.delayTime);
      lfo.start(); oscillators.push(lfo);
      const warped = node(context.createGain());
      warped.gain.value = 0.55;
      const mix = node(context.createGain());
      connect(input, clean); clean.connect(mix);
      connect(input, vibrato); vibrato.connect(warped); warped.connect(mix);
      input = mix;
    }

    const dry = node(context.createGain());
    const wet = node(context.createGain());
    const convolver = node(context.createConvolver());
    convolver.buffer = getReverbImpulse(context);
    const echoDelay = node(context.createDelay(1.0));
    echoDelay.delayTime.value = 0.29;
    const echoFeedback = node(context.createGain());
    const echoWet = node(context.createGain());
    const limiter = node(context.createDynamicsCompressor());
    limiter.threshold.value = -12;
    limiter.knee.value = 4;
    limiter.ratio.value = 18;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.20;
    const output = node(context.createGain());
    output.gain.value = 0.83;

    connect(input, dry);
    connect(input, convolver);
    connect(input, echoDelay);
    dry.connect(limiter);
    convolver.connect(wet);
    wet.connect(limiter);
    echoDelay.connect(echoWet);
    echoWet.connect(limiter);
    echoDelay.connect(echoFeedback);
    echoFeedback.connect(echoDelay);
    limiter.connect(output);
    output.connect(context.destination);

    let disposed = false;
    const routing = {
      context, dry, wet, echoWet, echoFeedback,
      dispose() {
        if (disposed) return;
        disposed = true;
        for (const lfo of oscillators) {
          try { lfo.stop(); } catch (_) {}
          try { lfo.disconnect(); } catch (_) {}
        }
        for (const item of nodes) {
          try { item.disconnect(); } catch (_) {}
        }
        pendingTails.delete(routing);
      }
    };
    applyReverbLevel(routing);
    applyEchoLevel(routing);
    return routing;
  }

  /*
    STOP PREVIOUS AUDIO
  */

  function stopCurrent() {
    sequence++;
    activeSound = null;
    activeReverse = false;
    setPlaybackLabel();
    for (const tail of [...pendingTails]) tail.dispose();

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

      // Reversed audio uses a native AudioBufferSourceNode.
      player.onended = null;
      try { player.stop(); } catch (_) { /* Already ended. */ }
      try { player.disconnect(); } catch (_) {}
    }

    if (activeRouting) {
      activeRouting.dispose();
      activeRouting = null;
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

    if (activePlayer && mode === 'speed') {
      activePlayer.playbackRate.value = rateFromPosition(position);
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
    PERSONAL NUMPAD BINDINGS
    Drag from the sound list, click or press numpad to play.
    Each visitor's assignments stay in their own browser.
  */

  const NUMPAD_KEY = 'archives-numpad-bindings-v1';
  const NUMPAD_SOUND_TYPE = 'application/x-archives-sound';
  const NUMPAD_SLOT_TYPE = 'application/x-archives-slot';
  let numpadBindings = {};

  function readNumpadBindings() {
    try {
      const stored = JSON.parse(localStorage.getItem(NUMPAD_KEY) || '{}');
      if (!stored || typeof stored !== 'object' || Array.isArray(stored)) return;
      for (let n = 1; n <= 9; n++) {
        if (typeof stored[n] === 'string') numpadBindings[n] = stored[n];
      }
    } catch (error) {
      console.warn('Unable to read numpad assignments:', error);
    }
  }

  function saveNumpadBindings() {
    try {
      localStorage.setItem(NUMPAD_KEY, JSON.stringify(numpadBindings));
    } catch (error) {
      console.warn('Unable to save numpad assignments:', error);
    }
  }

  function getNumpadSound(key) {
    return sounds.find(sound => sound.name === numpadBindings[key]);
  }

  function renderNumpad() {
    document.querySelectorAll('.numpad-slot').forEach(slot => {
      const key = slot.dataset.numpad;
      const assignedName = numpadBindings[key];
      const sound = getNumpadSound(key);

      const number = document.createElement('span');
      number.className = 'slot-number';
      number.textContent = 'NUM ' + key;

      const label = document.createElement('span');
      label.className = 'slot-name';
      label.textContent = sound
        ? sound.name
        : assignedName ? 'Unavailable: ' + assignedName : 'Empty';

      slot.replaceChildren(number, label);
      slot.classList.toggle('assigned', Boolean(assignedName));
      slot.draggable = Boolean(sound);
      slot.title = sound
        ? sound.name + ' (click to play; right-click to clear)'
        : 'Drop a sound here to assign Numpad ' + key;
      slot.setAttribute('aria-label',
        'Numpad ' + key + ': ' + (assignedName || 'empty'));
    });
  }

  function bindSoundToNumpad(key, name) {
    const sound = sounds.find(item => item.name === name);
    if (!sound) return;
    numpadBindings[key] = sound.name;
    saveNumpadBindings();
    renderNumpad();
  }

  let assignmentMenu = null;
  let assignmentTrigger = null;

  function closeNumpadAssignment() {
    if (!assignmentMenu) return;
    assignmentMenu.remove();
    assignmentMenu = null;
    assignmentTrigger?.focus({ preventScroll: true });
    assignmentTrigger = null;
  }

  function askNumpadAssignment(sound, event) {
    closeNumpadAssignment();
    assignmentTrigger = event.currentTarget;

    const menu = document.createElement('div');
    menu.className = 'numpad-assignment-menu';
    menu.setAttribute('role', 'dialog');
    menu.setAttribute('aria-label', `Assign ${sound.name} to numpad`);

    const heading = document.createElement('div');
    heading.className = 'numpad-assignment-title';
    heading.textContent = `Assign “${sound.name}” to…`;

    const grid = document.createElement('div');
    grid.className = 'numpad-assignment-grid';
    for (const key of ['7', '8', '9', '4', '5', '6', '1', '2', '3']) {
      const option = document.createElement('button');
      option.type = 'button';
      option.className = 'numpad-assignment-option';
      const number = document.createElement('strong');
      number.textContent = key;
      const existing = document.createElement('small');
      existing.textContent = numpadBindings[key] || 'Empty';
      option.append(number, existing);
      option.title = numpadBindings[key]
        ? `Replace ${numpadBindings[key]} on Numpad ${key}`
        : `Assign to empty Numpad ${key}`;
      option.addEventListener('click', () => {
        bindSoundToNumpad(key, sound.name);
        closeNumpadAssignment();
      });
      grid.appendChild(option);
    }
    menu.append(heading, grid);
    document.body.appendChild(menu);
    assignmentMenu = menu;

    const rect = menu.getBoundingClientRect();
    const x = event.clientX || assignmentTrigger.getBoundingClientRect().left;
    const y = event.clientY || assignmentTrigger.getBoundingClientRect().bottom;
    menu.style.left = `${Math.max(8, Math.min(x, window.innerWidth - rect.width - 8))}px`;
    menu.style.top = `${Math.max(8, Math.min(y, window.innerHeight - rect.height - 8))}px`;
    grid.querySelector('button')?.focus({ preventScroll: true });
  }

  document.addEventListener('pointerdown', event => {
    if (assignmentMenu && !assignmentMenu.contains(event.target)) {
      closeNumpadAssignment();
    }
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && assignmentMenu) {
      event.preventDefault();
      closeNumpadAssignment();
    }
  });

  function initNumpad() {
    readNumpadBindings();

    document.querySelectorAll('.numpad-slot').forEach(slot => {
      const key = slot.dataset.numpad;

      slot.addEventListener('click', event => {
        const sound = getNumpadSound(key);
        if (sound) play(sound, { reverse: event.shiftKey });
      });

      slot.addEventListener('contextmenu', event => {
        event.preventDefault();
        delete numpadBindings[key];
        saveNumpadBindings();
        renderNumpad();
      });

      slot.addEventListener('dragstart', event => {
        const sound = getNumpadSound(key);
        if (!sound || !event.dataTransfer) {
          event.preventDefault();
          return;
        }
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData(NUMPAD_SLOT_TYPE, key);
        event.dataTransfer.setData('text/plain', sound.name);
      });

      slot.addEventListener('dragover', event => {
        if (!event.dataTransfer) return;
        const types = Array.from(event.dataTransfer.types);
        if (!types.includes(NUMPAD_SLOT_TYPE) &&
            !types.includes(NUMPAD_SOUND_TYPE)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = types.includes(NUMPAD_SLOT_TYPE)
          ? 'move' : 'copy';
        slot.classList.add('drag-over');
      });

      slot.addEventListener('dragleave', () => {
        slot.classList.remove('drag-over');
      });

      slot.addEventListener('drop', event => {
        event.preventDefault();
        slot.classList.remove('drag-over');
        const transfer = event.dataTransfer;
        if (!transfer) return;

        const fromKey = transfer.getData(NUMPAD_SLOT_TYPE);
        if (fromKey && /^[1-9]$/.test(fromKey)) {
          if (fromKey === key || !numpadBindings[fromKey]) return;
          const oldTarget = numpadBindings[key];
          numpadBindings[key] = numpadBindings[fromKey];
          if (oldTarget) numpadBindings[fromKey] = oldTarget;
          else delete numpadBindings[fromKey];
          saveNumpadBindings();
          renderNumpad();
          return;
        }

        const name = transfer.getData(NUMPAD_SOUND_TYPE);
        if (name) bindSoundToNumpad(key, name);
      });

      slot.addEventListener('dragend', () => {
        document.querySelectorAll('.numpad-slot').forEach(item =>
          item.classList.remove('drag-over'));
      });
    });

    $('numpad-clear-all')?.addEventListener('click', () => {
      if (!Object.keys(numpadBindings).length) return;
      if (!window.confirm('Clear all numpad assignments?')) return;
      numpadBindings = {};
      saveNumpadBindings();
      renderNumpad();
    });

    document.addEventListener('keydown', event => {
      if (event.repeat || event.ctrlKey || event.altKey || event.metaKey) return;
      const target = event.target;
      if (target instanceof HTMLInputElement ||
          target instanceof HTMLTextAreaElement ||
          target instanceof HTMLSelectElement ||
          target?.isContentEditable) return;
      if (!/^Numpad[1-9]$/.test(event.code)) return;
      const key = event.code.slice(-1);
      const sound = getNumpadSound(key);
      if (!sound) return;
      event.preventDefault();
      play(sound, { reverse: event.shiftKey });
    });

    renderNumpad();
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
    renderNumpad();
    renderStats();

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
      button.draggable = true;
      button.title = 'Click to play · Shift+click to reverse · Right-click to assign to numpad';
      button.addEventListener('dragstart', event => {
        if (!event.dataTransfer) return;
        event.dataTransfer.effectAllowed = 'copy';
        event.dataTransfer.setData(NUMPAD_SOUND_TYPE, sound.name);
        event.dataTransfer.setData('text/plain', sound.name);
      });
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
        event => {
          play(sound, { reverse: event.shiftKey });
        }
      );

      button.addEventListener('contextmenu', event => {
        event.preventDefault();
        askNumpadAssignment(sound, event);
      });

      container.appendChild(button);
    }
  }

  /*
    PLAY AUDIO
  */

  // True reverse: reverse the PCM samples, not pitch or echo.
  // The browser's decodeAudioData API cannot decode every MP3 that
  // an HTMLAudioElement can play. If a file fails, explain it rather
  // than quietly playing the wrong direction.
  async function getReversedBuffer(sound, context) {
    const response = await fetch(sound.url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const bytes = await response.arrayBuffer();
    const original = await context.decodeAudioData(bytes);
    const backwards = context.createBuffer(
      original.numberOfChannels,
      original.length,
      original.sampleRate
    );
    for (let channel = 0; channel < original.numberOfChannels; channel++) {
      const from = original.getChannelData(channel);
      const to = backwards.getChannelData(channel);
      for (let i = 0, j = from.length - 1; i < from.length; i++, j--) {
        to[i] = from[j];
      }
    }
    return backwards;
  }

  function retainEffectTail(routing, effect) {
    const tail = {
      dispose() {
        routing?.dispose();
        effect?.dispose();
        pendingTails.delete(tail);
      }
    };
    pendingTails.add(tail);
    setTimeout(() => tail.dispose(), 6000);
  }

  async function play(sound, { reverse = false } = {}) {
    // Loop belongs to the currently playing clip only. Even if Loop
    // was checked, clicking a sound or using a numpad key turns it Off.
    setLoop(false);
    stopCurrent();
    activeReverse = reverse;
    const thisSequence = sequence;
    let audio = null;
    let player = null;
    let routing = null;
    let effect = null;
    try {
      if (!window.Tone || !Tone.getContext) {
        throw new Error('The effects library is unavailable.');
      }
      await Tone.start();
      if (thisSequence !== sequence) return;

      const reversed = reverse;
      const context = Tone.getContext().rawContext;

      if (reversed) {
        // Decode only for Reverse; normal/Wobble audio keeps the
        // native browser playback path that works with unusual MP3s.
        const buffer = await getReversedBuffer(sound, context);
        if (thisSequence !== sequence) return;
        player = context.createBufferSource();
        player.buffer = buffer;
        player.loop = loopEnabled;
        player.playbackRate.value = mode === 'speed'
          ? rateFromPosition(position) : 1;
        activePlayer = player;
        activeSound = sound;
      } else {
        audio = new Audio();
        audio.preload = 'auto';
        audio.crossOrigin = 'anonymous';
        audio.src = sound.url;
        audio.loop = loopEnabled;
        audio.playbackRate = mode === 'speed' ? rateFromPosition(position) : 1;
        audio.preservesPitch = mode === 'pitch';
        if ('mozPreservesPitch' in audio) audio.mozPreservesPitch = mode === 'pitch';
        if ('webkitPreservesPitch' in audio) audio.webkitPreservesPitch = mode === 'pitch';
        activeAudio = audio;
        activeSound = sound;
      }

      if (mode === 'pitch') {
        if (!Tone.PitchShift) throw new Error('Pitch-only processing unavailable.');
        effect = new Tone.PitchShift({
          pitch: semitonesFromPosition(position), wet: 1
        });
        activeEffect = effect;
      }
      routing = makeAudioRouting(audio, effect, player);
      activeRouting = routing;

      const finish = () => {
        if (thisSequence !== sequence) return;
        if (reversed && activePlayer !== player) return;
        if (!reversed && activeAudio !== audio) return;
        activeAudio = null;
        activePlayer = null;
        activeSound = null;
        activeReverse = false;
        activeRouting = null;
        activeEffect = null;
        setPlaybackLabel();
        retainEffectTail(routing, effect);
      };

      if (reversed) {
        player.onended = finish;
        player.start(0);
      } else {
        audio.addEventListener('ended', finish, { once: true });
        await audio.play();
      }
      if (thisSequence === sequence) {
        setPlaybackLabel(sound.name);
        // Only count the initial start, never each loop iteration.
        recordPlay(sound);
      }
    } catch (error) {
      if (thisSequence !== sequence) {
        if (audio && activeAudio !== audio || player && activePlayer !== player) {
          routing?.dispose();
          effect?.dispose();
        }
        return;
      }
      console.error('Sound playback error:', sound.url, error);
      showStatus(reverse
        ? `Reverse couldn't decode ${sound.name}. Try re-exporting that MP3.`
        : `Could not play: ${sound.name}`);
      stopCurrent();
    }
  }

  /*
    INITIALIZE THE ARCHIVES
  */

  function init() {
    document.title = 'The Archives';
    initStats();
    initNumpad();
    setReverb(reverbLevel);
    $('reverb-slider')?.addEventListener('input', event => setReverb(event.target.value));
    $('reverb-reset')?.addEventListener('click', () => setReverb(0));
    setEcho(0);
    setVoiceFilter('off');
    setLoop(false);
    setPlaybackLabel();
    $('echo-slider')?.addEventListener('input', event => setEcho(event.target.value));
    $('echo-reset')?.addEventListener('click', () => setEcho(0));
    $('voice-filter')?.addEventListener('change', event => setVoiceFilter(event.target.value));
    $('effects-reset-all')?.addEventListener('click', resetAllEffects);
    $('loop-toggle')?.addEventListener('change', event => setLoop(event.target.checked));
    $('sound-stop')?.addEventListener('click', stopCurrent);


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
