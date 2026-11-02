/* Tiny synthesized sound effects — no audio files needed. */
(function (root) {
  'use strict';
  let ac = null;
  let master = null;
  let muted = false;
  try { muted = localStorage.getItem('tj-muted') === '1'; } catch (e) { /* ignore */ }

  function ctx() {
    if (!ac) {
      try {
        ac = new (window.AudioContext || window.webkitAudioContext)();
        master = ac.createGain();
        master.gain.value = 0.6;
        master.connect(ac.destination);
      } catch (e) { return null; }
    }
    if (ac.state === 'suspended') ac.resume();
    return ac;
  }

  function tone(freq, dur, o = {}) {
    if (muted) return;
    const a = ctx(); if (!a) return;
    const t = a.currentTime + (o.delay || 0);
    const osc = a.createOscillator();
    const gain = a.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(freq, t);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + dur);
    if (o.vibrato) {
      const lfo = a.createOscillator();
      const lg = a.createGain();
      lfo.frequency.value = o.vibrato;
      lg.gain.value = freq * 0.06;
      lfo.connect(lg).connect(osc.frequency);
      lfo.start(t); lfo.stop(t + dur);
    }
    const v = o.vol || 0.2;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(v, t + Math.min(0.02, dur / 4));
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(master);
    osc.start(t); osc.stop(t + dur + 0.05);
  }

  function noise(dur, o = {}) {
    if (muted) return;
    const a = ctx(); if (!a) return;
    const t = a.currentTime + (o.delay || 0);
    const len = Math.max(1, Math.floor(a.sampleRate * dur));
    const buf = a.createBuffer(1, len, a.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = a.createBufferSource();
    src.buffer = buf;
    const filter = a.createBiquadFilter();
    filter.type = o.filter || 'lowpass';
    filter.frequency.setValueAtTime(o.freq || 1200, t);
    if (o.to) filter.frequency.exponentialRampToValueAtTime(o.to, t + dur);
    const gain = a.createGain();
    const v = o.vol || 0.3;
    gain.gain.setValueAtTime(v, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter).connect(gain).connect(master);
    src.start(t); src.stop(t + dur + 0.05);
  }

  const Sound = {
    get muted() { return muted; },
    setMuted(m) {
      muted = m;
      try { localStorage.setItem('tj-muted', m ? '1' : '0'); } catch (e) { /* ignore */ }
    },
    unlock() { if (!muted) ctx(); },
    select() { tone(520, 0.07, { type: 'triangle', vol: 0.15 }); },
    place() {
      tone(440, 0.08, { type: 'triangle', vol: 0.2 });
      tone(880, 0.1, { type: 'triangle', vol: 0.18, delay: 0.06 });
    },
    rotate() { tone(700, 0.06, { type: 'square', vol: 0.06, to: 900 }); },
    clear() { tone(500, 0.12, { type: 'triangle', vol: 0.15, to: 200 }); },
    whistle() {
      tone(784, 0.35, { type: 'square', vol: 0.06, vibrato: 7 });
      tone(988, 0.35, { type: 'square', vol: 0.05, vibrato: 7 });
      tone(784, 0.45, { type: 'square', vol: 0.06, vibrato: 7, delay: 0.4 });
      tone(988, 0.45, { type: 'square', vol: 0.05, vibrato: 7, delay: 0.4 });
    },
    chug() { noise(0.09, { freq: 900, vol: 0.06, filter: 'bandpass' }); },
    crash() {
      noise(0.6, { freq: 2500, to: 200, vol: 0.45 });
      tone(160, 0.4, { type: 'sawtooth', vol: 0.15, to: 50 });
      tone(1200, 0.08, { type: 'square', vol: 0.05, delay: 0.1 });
      tone(900, 0.08, { type: 'square', vol: 0.05, delay: 0.22 });
    },
    splash() {
      noise(0.8, { freq: 3000, to: 300, vol: 0.35, filter: 'bandpass' });
      tone(300, 0.25, { type: 'sine', vol: 0.2, to: 900 });
      tone(500, 0.2, { type: 'sine', vol: 0.12, to: 1400, delay: 0.15 });
    },
    bonk() {
      tone(420, 0.3, { type: 'sine', vol: 0.35, to: 90 });
      noise(0.12, { freq: 800, vol: 0.2 });
    },
    baa() {
      tone(330, 0.55, { type: 'sawtooth', vol: 0.09, vibrato: 11 });
      tone(335, 0.55, { type: 'triangle', vol: 0.08, vibrato: 9 });
    },
    boing() { tone(200, 0.35, { type: 'sine', vol: 0.25, to: 700 }); },
    dizzy() {
      for (let i = 0; i < 5; i++) tone(600 + (i % 2) * 200, 0.1, { type: 'triangle', vol: 0.12, delay: i * 0.1 });
    },
    pickup() {
      tone(660, 0.08, { type: 'triangle', vol: 0.18 });
      tone(880, 0.08, { type: 'triangle', vol: 0.18, delay: 0.07 });
      tone(1320, 0.12, { type: 'triangle', vol: 0.15, delay: 0.14 });
    },
    missed() {
      tone(500, 0.18, { type: 'triangle', vol: 0.18 });
      tone(400, 0.25, { type: 'triangle', vol: 0.18, delay: 0.18 });
    },
    poof() { noise(0.25, { freq: 1800, to: 400, vol: 0.15 }); },
    win() {
      const notes = [523, 659, 784, 1047, 784, 1047];
      notes.forEach((f, i) => tone(f, 0.18, { type: 'triangle', vol: 0.2, delay: i * 0.12 }));
      tone(1319, 0.5, { type: 'triangle', vol: 0.18, delay: notes.length * 0.12 });
    },
  };

  root.Sound = Sound;
})(window);
