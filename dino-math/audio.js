/* Dino Defenders: little paper sounds (made with Web Audio, no files) and read-aloud speech. */
window.DinoAudio = (() => {
  'use strict';
  let ac = null, muted = false, voice = null;
  try { muted = localStorage.getItem('dino-defenders-muted') === '1'; } catch (e) { /* storage unavailable */ }

  function ctx() {
    if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; } }
    if (ac.state === 'suspended') ac.resume();
    return ac;
  }
  function tone(f, t0, dur, type = 'sine', vol = 0.2, f2) {
    const a = ctx(); if (!a || muted) return;
    const t = a.currentTime + t0, o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(a.destination); o.start(t); o.stop(t + dur + 0.05);
  }
  function rustle(t0, dur, vol = 0.12, freq = 1800) {
    const a = ctx(); if (!a || muted) return;
    const t = a.currentTime + t0, n = Math.floor(a.sampleRate * dur), buf = a.createBuffer(1, n, a.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2);
    const src = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
    src.buffer = buf; f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 0.8; g.gain.value = vol;
    src.connect(f).connect(g).connect(a.destination); src.start(t);
  }
  const sfx = {
    tap() { tone(700, 0, 0.06, 'sine', 0.1); },
    key() { tone(880, 0, 0.05, 'triangle', 0.08); },
    pop() { tone(420, 0, 0.14, 'triangle', 0.16, 900); },
    flip() { rustle(0, 0.28, 0.14, 2200); },
    oops() { tone(392, 0, 0.16, 'sine', 0.14, 330); tone(330, 0.15, 0.24, 'sine', 0.12, 294); },
    yay() { [523, 659, 784].forEach((f, i) => tone(f, i * 0.07, 0.28, 'triangle', 0.15)); },
    star() { tone(988, 0, 0.09, 'sine', 0.1); tone(1319, 0.07, 0.2, 'sine', 0.09); },
    roar() { tone(160, 0, 0.3, 'sawtooth', 0.06, 90); rustle(0, 0.3, 0.06, 500); },
    burst() { rustle(0, 0.35, 0.16, 1200); tone(600, 0, 0.12, 'square', 0.04, 200); },
    whoosh() { rustle(0, 0.5, 0.1, 700); },
    fanfare() { [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.13, 0.45, 'triangle', 0.15)); tone(1047, 0.55, 0.6, 'sine', 0.1); },
  };

  function pickVoice() {
    if (!('speechSynthesis' in window)) return;
    const vs = speechSynthesis.getVoices();
    voice = vs.find((v) => /en-US/i.test(v.lang) && /Samantha|Google US|Aria|Jenny|Zira/i.test(v.name)) || vs.find((v) => /^en/i.test(v.lang)) || null;
  }
  if ('speechSynthesis' in window) { pickVoice(); speechSynthesis.addEventListener('voiceschanged', pickVoice); }
  function say(text) {
    if (!('speechSynthesis' in window) || !text) return;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text.replace(/×/g, ' times ').replace(/÷/g, ' divided by ').replace(/−/g, ' minus '));
      u.rate = 0.92; u.pitch = 1.1; if (voice) u.voice = voice;
      speechSynthesis.speak(u);
    } catch (e) { /* speech unavailable */ }
  }
  function hush() { try { if ('speechSynthesis' in window) speechSynthesis.cancel(); } catch (e) { /* ignore */ } }

  return {
    sfx, say, hush, unlock: ctx,
    get muted() { return muted; },
    setMuted(m) { muted = m; try { localStorage.setItem('dino-defenders-muted', m ? '1' : '0'); } catch (e) { /* ignore */ } },
  };
})();
