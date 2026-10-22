// Пушок — плюшевый маскот панели. Моргает, следит глазами за курсором,
// по клику подпрыгивает и говорит что-нибудь приятное.

const PHRASES = [
  'Гав! Спасибо, что помогаешь 🐾',
  'Каждая миска корма — чья-то радость',
  'Не забудь почесать всех за ушком!',
  'Ты сегодня лучший волонтёр ✨',
  'Гуляем? Гуляем!',
  'Хвостики говорят тебе спасибо',
];

const SVG = `
<svg class="mascot__svg" viewBox="0 0 240 220" aria-hidden="true" focusable="false">
  <defs>
    <radialGradient id="mascot-body" cx="40%" cy="32%" r="78%">
      <stop offset="0" stop-color="#ffe6cf"/>
      <stop offset="0.55" stop-color="#ffbb92"/>
      <stop offset="1" stop-color="#f1916a"/>
    </radialGradient>
    <radialGradient id="mascot-ear" cx="50%" cy="25%" r="85%">
      <stop offset="0" stop-color="#ec9a74"/>
      <stop offset="1" stop-color="#c96c4a"/>
    </radialGradient>
    <filter id="mascot-fur" x="-10%" y="-10%" width="120%" height="120%">
      <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="4" result="noise"/>
      <feDisplacementMap in="SourceGraphic" in2="noise" scale="7" xChannelSelector="R" yChannelSelector="G"/>
    </filter>
  </defs>

  <ellipse cx="120" cy="208" rx="72" ry="9" fill="#b9714c" opacity="0.22"/>

  <g filter="url(#mascot-fur)">
    <ellipse cx="50" cy="100" rx="25" ry="46" transform="rotate(20 50 100)" fill="url(#mascot-ear)"/>
    <ellipse cx="190" cy="100" rx="25" ry="46" transform="rotate(-20 190 100)" fill="url(#mascot-ear)"/>
    <path d="M120 40 C172 40 204 80 204 130 C204 178 170 200 120 200 C70 200 36 178 36 130 C36 80 68 40 120 40 Z" fill="url(#mascot-body)"/>
    <path d="M104 44 C108 30 118 26 122 36 C126 26 136 30 134 44 Z" fill="#ffc6a2"/>
    <ellipse cx="120" cy="154" rx="42" ry="30" fill="#fff3e6" opacity="0.9"/>
  </g>

  <ellipse cx="72" cy="140" rx="13" ry="8" fill="#ff8a8a" opacity="0.45"/>
  <ellipse cx="168" cy="140" rx="13" ry="8" fill="#ff8a8a" opacity="0.45"/>

  <g class="mascot__eye">
    <circle cx="93" cy="112" r="20" fill="#fff" stroke="#f2c9b0" stroke-width="2"/>
    <g class="mascot__pupil">
      <circle cx="93" cy="114" r="10.5" fill="#2b1d17"/>
      <circle cx="96.5" cy="109.5" r="3.4" fill="#fff"/>
    </g>
  </g>
  <g class="mascot__eye">
    <circle cx="147" cy="112" r="20" fill="#fff" stroke="#f2c9b0" stroke-width="2"/>
    <g class="mascot__pupil">
      <circle cx="147" cy="114" r="10.5" fill="#2b1d17"/>
      <circle cx="150.5" cy="109.5" r="3.4" fill="#fff"/>
    </g>
  </g>

  <!-- Нос -->
  <path d="M111 138 Q120 132 129 138 Q127 147 120 148 Q113 147 111 138 Z" fill="#3a2620"/>
  <circle cx="116" cy="137" r="2" fill="#fff" opacity="0.6"/>
  <path d="M120 148 L120 154" stroke="#3a2620" stroke-width="3" stroke-linecap="round"/>

  <!-- Улыбка с язычком -->
  <path d="M99 153 Q120 160 141 153 Q139 177 120 179 Q101 177 99 153 Z" fill="#3a2620"/>
  <path d="M108 168 Q120 160 132 168 Q131 178 120 178.5 Q109 178 108 168 Z" fill="#ff8f8a"/>
  <path d="M120 165 L120 173" stroke="#e5675f" stroke-width="1.6" stroke-linecap="round"/>
  <path d="M95 151 Q99 150 101 154 M145 151 Q141 150 139 154" stroke="#3a2620" stroke-width="2.6" fill="none" stroke-linecap="round"/>
</svg>`;

export class Mascot {
  constructor({ button, bubbleText }) {
    this.button = button;
    this.bubbleText = bubbleText;
    this.status = '';
    this.phraseTimer = null;
    this.frame = null;

    // SVG — наша собственная статичная разметка, поэтому innerHTML здесь безопасен
    this.button.innerHTML = SVG;
    this.pupils = this.button.querySelectorAll('.mascot__pupil');

    this.button.addEventListener('click', () => this.poke());

    // Глаза следят за курсором (только там, где есть мышь)
    if (window.matchMedia('(hover: hover)').matches) {
      document.addEventListener('pointermove', (event) => this._lookAt(event.clientX, event.clientY));
    }
  }

  _lookAt(x, y) {
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = null;
      for (const pupil of this.pupils) {
        const eye = pupil.parentNode.getBoundingClientRect();
        const dx = x - (eye.left + eye.width / 2);
        const dy = y - (eye.top + eye.height / 2);
        const distance = Math.hypot(dx, dy) || 1;
        const shift = Math.min(distance / 25, 6);
        pupil.style.transform = `translate(${(dx / distance) * shift}px, ${(dy / distance) * shift}px)`;
      }
    });
  }

  /** Постоянный текст в облачке (сводка по смене). */
  setStatus(text) {
    this.status = text;
    if (!this.phraseTimer) this.bubbleText.textContent = text;
  }

  /** Клик: прыжок и случайная фраза на 4 секунды. */
  poke() {
    this.button.classList.remove('is-bouncing');
    void this.button.offsetWidth;
    this.button.classList.add('is-bouncing');

    const phrase = PHRASES[Math.floor(Math.random() * PHRASES.length)];
    this.bubbleText.textContent = phrase;
    clearTimeout(this.phraseTimer);
    this.phraseTimer = setTimeout(() => {
      this.phraseTimer = null;
      this.bubbleText.textContent = this.status;
    }, 4000);
  }
}
