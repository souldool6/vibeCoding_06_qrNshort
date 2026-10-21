/* ===== app.js ===== */

// ------- DOM References -------
const urlInput     = document.getElementById('urlInput');
const generateBtn  = document.getElementById('generateBtn');
const inputSection = document.getElementById('inputSection');
const inputHint    = document.getElementById('inputHint');
const hero         = document.getElementById('hero');
const main         = document.getElementById('main');
const qrSection    = document.getElementById('qrSection');
const qrCard       = document.getElementById('qrCard');
const qrCanvas     = document.getElementById('qrCanvas');
const qrUrlLabel   = document.getElementById('qrUrlLabel');
const resetBtn     = document.getElementById('resetBtn');
const bgCanvas     = document.getElementById('bgCanvas');

// ------- QR 라이브러리 관련 -------
let qrInstance = null;     // QRCode 인스턴스 (내부 canvas/img 담을 div용)
let qrContainer = null;    // QRCode 가 렌더링되는 임시 div

// ------- 파티클 배경 (밝은 노랑-오렌지 계열) -------
(function initBackground() {
  const ctx = bgCanvas.getContext('2d');
  let W, H, particles = [];

  function resize() {
    W = bgCanvas.width  = window.innerWidth;
    H = bgCanvas.height = window.innerHeight;
  }

  class Particle {
    constructor() { this.reset(); }
    reset() {
      this.x  = Math.random() * W;
      this.y  = Math.random() * H;
      this.r  = Math.random() * 2.2 + 0.5;
      this.vx = (Math.random() - 0.5) * 0.3;
      this.vy = (Math.random() - 0.5) * 0.3;
      this.a  = Math.random() * 0.35 + 0.08;
      // 노랑(45°) / 오렌지(28°) / 코랄-핑크(350°) 계열
      const hues = [45, 38, 28, 20, 350, 15];
      this.hue = hues[Math.floor(Math.random() * hues.length)];
    }
    update() {
      this.x += this.vx;
      this.y += this.vy;
      if (this.x < 0 || this.x > W || this.y < 0 || this.y > H) this.reset();
    }
    draw() {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${this.hue}, 95%, 60%, ${this.a})`;
      ctx.fill();
    }
  }

  function initParticles() {
    particles = [];
    const count = Math.floor((W * H) / 7000);
    for (let i = 0; i < count; i++) particles.push(new Particle());
  }

  function loop() {
    ctx.clearRect(0, 0, W, H);
    particles.forEach(p => { p.update(); p.draw(); });
    requestAnimationFrame(loop);
  }

  resize();
  initParticles();
  loop();
  window.addEventListener('resize', () => { resize(); initParticles(); });
})();


// ------- 마우스 위치 → 그라디언트 배경 업데이트 -------
(function initMouseGradient() {
  const gradientBg = document.getElementById('gradientBg');
  // 현재 표시 좌표 (lerp 대상)
  let curX = 30, curY = 40;
  // 목표 좌표
  let targetX = 30, targetY = 40;

  // 색상 hue shift: 마우스 X→ 색조 변화 (±15°)
  let hueShift = 0;

  document.addEventListener('mousemove', (e) => {
    // 0~100% 비율
    targetX = (e.clientX / window.innerWidth)  * 100;
    targetY = (e.clientY / window.innerHeight) * 100;
    // X 위치에 따라 hue shift –15 ~ +15
    hueShift = ((e.clientX / window.innerWidth) - 0.5) * 30;
  });

  function lerpGradient() {
    // 부드러운 추적 (lerp factor)
    curX += (targetX - curX) * 0.07;
    curY += (targetY - curY) * 0.07;

    // 마우스 위치에 따라 CSS 변수 업데이트
    gradientBg.style.setProperty('--mx', `${curX.toFixed(2)}%`);
    gradientBg.style.setProperty('--my', `${curY.toFixed(2)}%`);

    // hue shift로 배경 색조 미세 변경
    const y1 = Math.max(0, Math.min(100, 45 + hueShift));    // 노랑 hue
    const o1 = Math.max(0, Math.min(100, 18 + hueShift * 0.5)); // 오렌지 hue

    gradientBg.style.background = [
      `radial-gradient(ellipse 60% 55% at ${curX.toFixed(1)}% ${curY.toFixed(1)}%,`,
      `  hsla(${y1.toFixed(0)}, 100%, 65%, 0.52) 0%,`,
      `  hsla(${y1.toFixed(0)}, 90%, 70%, 0.28) 35%,`,
      `  transparent 70%),`,
      `radial-gradient(ellipse 50% 50% at ${(100 - curX).toFixed(1)}% ${(100 - curY).toFixed(1)}%,`,
      `  hsla(${o1.toFixed(0)}, 100%, 60%, 0.38) 0%,`,
      `  hsla(350, 90%, 65%, 0.20) 40%,`,
      `  transparent 70%),`,
      `linear-gradient(145deg, #FFF9E6 0%, #FFF3CC 40%, #FFE0B2 75%, #FFCCBC 100%)`,
    ].join(' ');

    requestAnimationFrame(lerpGradient);
  }

  lerpGradient();
})();


// ------- 입력창 Enter 지원 -------
urlInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') generateQR();
});

generateBtn.addEventListener('click', generateQR);
resetBtn.addEventListener('click', resetState);
qrCard.addEventListener('click', downloadQR);


// ------- URL 유효성 검사 -------
function isValidURL(str) {
  try {
    const url = new URL(str);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

// ------- QR 생성 -------
function generateQR() {
  const rawVal = urlInput.value.trim();

  // 빈 값 처리
  if (!rawVal) {
    showHint('URL을 입력해 주세요.');
    shake(inputSection);
    return;
  }

  // http:// 없으면 자동 추가
  let url = rawVal;
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;

  if (!isValidURL(url)) {
    showHint('올바른 URL 형식이 아닙니다. (예: https://example.com)');
    shake(inputSection);
    return;
  }

  clearHint();

  // 기존 QR 인스턴스 제거
  if (qrContainer) {
    qrContainer.remove();
    qrContainer = null;
  }

  // qrcode.js 는 div에 canvas/img 를 붙이므로, 임시 div 생성
  qrContainer = document.createElement('div');
  qrContainer.style.display = 'none';
  document.body.appendChild(qrContainer);

  const qrSize = Math.min(260, window.innerWidth - 100);

  qrInstance = new QRCode(qrContainer, {
    text: url,
    width:  qrSize,
    height: qrSize,
    colorDark:  '#0f0f1a',
    colorLight: '#ffffff',
    correctLevel: QRCode.CorrectLevel.H,
  });

  // QRCode 내부 렌더링 완료 대기 (canvas or img)
  setTimeout(() => {
    const sourceEl = qrContainer.querySelector('canvas') || qrContainer.querySelector('img');
    if (!sourceEl) return;

    // 우리 qrCanvas 에 복사
    qrCanvas.width  = qrSize;
    qrCanvas.height = qrSize;
    const ctx = qrCanvas.getContext('2d');

    if (sourceEl.tagName === 'CANVAS') {
      ctx.drawImage(sourceEl, 0, 0);
    } else {
      // img 엘리먼트
      sourceEl.onload = () => ctx.drawImage(sourceEl, 0, 0);
      if (sourceEl.complete) ctx.drawImage(sourceEl, 0, 0);
    }

    qrUrlLabel.textContent = url.length > 50 ? url.slice(0, 47) + '...' : url;
    showQR();
  }, 150);
}

// ------- UI 상태 전환: QR 보여주기 -------
function showQR() {
  hero.classList.add('hidden');
  main.classList.add('qr-mode');

  setTimeout(() => {
    qrSection.classList.add('visible');
  }, 80);
}

// ------- UI 상태 전환: 초기화 -------
function resetState() {
  qrSection.classList.remove('visible');
  hero.classList.remove('hidden');
  main.classList.remove('qr-mode');
  urlInput.value = '';
  clearHint();

  // canvas 초기화
  const ctx = qrCanvas.getContext('2d');
  ctx.clearRect(0, 0, qrCanvas.width, qrCanvas.height);
  qrUrlLabel.textContent = '';

  if (qrContainer) {
    qrContainer.remove();
    qrContainer = null;
  }

  setTimeout(() => urlInput.focus(), 300);
}

// ------- QR 다운로드 (JPG) -------
function downloadQR() {
  // 흰 배경 위에 QR 합성해서 JPG로 저장 (JPG는 투명 배경 미지원)
  const offscreen = document.createElement('canvas');
  const padding = 24;
  offscreen.width  = qrCanvas.width  + padding * 2;
  offscreen.height = qrCanvas.height + padding * 2;

  const ctx = offscreen.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, offscreen.width, offscreen.height);
  ctx.drawImage(qrCanvas, padding, padding);

  const link = document.createElement('a');
  link.download = 'qrcode.jpg';
  link.href = offscreen.toDataURL('image/jpeg', 0.95);
  link.click();

  // 다운로드 피드백 애니메이션
  qrCard.style.transform = 'scale(0.96)';
  setTimeout(() => { qrCard.style.transform = ''; }, 200);
}

// ------- 힌트 표시/숨김 -------
function showHint(msg) {
  inputHint.textContent = msg;
}

function clearHint() {
  inputHint.textContent = '';
}

// ------- Shake 애니메이션 -------
function shake(el) {
  el.style.animation = 'none';
  el.offsetHeight; // reflow
  el.style.animation = 'shake 0.4s ease';
  el.addEventListener('animationend', () => { el.style.animation = ''; }, { once: true });
}

// Shake 키프레임을 동적으로 추가
const shakeStyle = document.createElement('style');
shakeStyle.textContent = `
  @keyframes shake {
    0%   { transform: translateX(0); }
    18%  { transform: translateX(-8px); }
    36%  { transform: translateX(8px); }
    54%  { transform: translateX(-6px); }
    72%  { transform: translateX(6px); }
    86%  { transform: translateX(-3px); }
    100% { transform: translateX(0); }
  }
`;
document.head.appendChild(shakeStyle);

// ------- Blob 배경 요소 동적 생성 (gradient-bg 다음에 삽입) -------
const gradBg = document.getElementById('gradientBg');
['blob-1', 'blob-2', 'blob-3'].forEach(cls => {
  const el = document.createElement('div');
  el.className = `blob ${cls}`;
  // gradient-bg 바로 뒤에 삽입
  gradBg.parentNode.insertBefore(el, gradBg.nextSibling);
});

// 페이지 로드시 입력창 포커스
window.addEventListener('load', () => {
  setTimeout(() => urlInput.focus(), 200);
});
