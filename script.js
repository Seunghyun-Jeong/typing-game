'use strict';

/* ===== 설정 ===== */

// 헷갈리는 글자(대문자 I·O, 소문자 l·o, 숫자 0·1)는 일부러 뺐다.
// 화면에 뭐가 나온 건지 알 수 없으면 실력이 아니라 운으로 점수가 갈리기 때문.
const CHARS =
  'ABCDEFGHJKLMNPQRSTUVWXYZ' +
  'abcdefghijkmnpqrstuvwxyz' +
  '23456789';

const GAME_SECONDS = 20;
const POINT_HIT = 10;
const POINT_MISS = -5;
const BEST_KEY = 'typing-game-best';

/* ===== DOM ===== */

const el = {
  target:   document.getElementById('target'),
  catcher:  document.getElementById('catcher'),
  hint:     document.getElementById('hint'),
  score:    document.getElementById('score'),
  combo:    document.getElementById('combo'),
  time:     document.getElementById('time'),
  best:     document.getElementById('best'),
  bar:      document.getElementById('timerBar'),
  startBtn: document.getElementById('startBtn'),
  resetBtn: document.getElementById('resetBtn'),
  result:   document.getElementById('result'),
  game:     document.getElementById('game'),
};

/* ===== 상태 ===== */

let score = 0;
let combo = 0;
let bestCombo = 0;
let running = false;
let targetChar = '';
let endsAt = 0;      // 종료 시각(ms). 남은 시간을 실제 시계로 계산한다.
let tickId = null;

/* ===== 최고 기록 (localStorage) ===== */

// 시크릿 모드 등에서 접근 자체가 막힐 수 있어 try/catch로 감싼다.
function loadBest() {
  try {
    return Number(localStorage.getItem(BEST_KEY)) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    localStorage.setItem(BEST_KEY, String(value));
  } catch {
    /* 저장 실패해도 게임 진행에는 지장 없음 */
  }
}

/* ===== 화면 갱신 ===== */

function render() {
  el.score.textContent = score;
  el.combo.textContent = combo;
}

function setTarget() {
  let next;
  // 같은 글자가 연달아 나오면 눌렀는지 안 눌렀는지 헷갈린다.
  do {
    next = CHARS[Math.floor(Math.random() * CHARS.length)];
  } while (next === targetChar && CHARS.length > 1);

  targetChar = next;
  el.target.textContent = targetChar;
}

// 정답/오답을 색으로 알려준다
function flash(type) {
  el.target.classList.remove('is-ok', 'is-bad');
  void el.target.offsetWidth;          // 연속 입력에도 애니메이션이 다시 걸리도록
  el.target.classList.add(type);
  setTimeout(() => el.target.classList.remove(type), 220);
}

/* ===== 입력 처리 ===== */

const HANGUL = /[ㄱ-ㅎㅏ-ㅣ가-힣]/;

function handleChar(ch) {
  if (!running) return;

  // 한글 입력 상태면 점수를 깎는 대신 안내만 한다.
  // 원인이 실력이 아니라 입력기 설정이기 때문.
  if (HANGUL.test(ch)) {
    el.hint.textContent = '한영 키를 눌러 영문 입력으로 바꿔주세요';
    el.hint.hidden = false;
    return;
  }
  el.hint.hidden = true;

  // 대소문자는 구분하지 않는다. 'A'가 나와도 'a'로 입력하면 정답.
  if (ch.toLowerCase() === targetChar.toLowerCase()) {
    score += POINT_HIT;
    combo += 1;
    if (combo > bestCombo) bestCombo = combo;
    flash('is-ok');
  } else {
    score = Math.max(0, score + POINT_MISS);  // 점수가 끝없이 내려가지 않도록 0에서 멈춘다
    combo = 0;
    flash('is-bad');
  }

  render();
  setTarget();
}

// 숨은 input의 input 이벤트로 받는다.
// keydown만 쓰면 모바일 가상 키보드에서 글자가 안 들어오는 기기가 있다.
el.catcher.addEventListener('input', () => {
  const value = el.catcher.value;
  el.catcher.value = '';
  if (value) handleChar(value[value.length - 1]);
});

// 게임 중 포커스가 빠지면 입력을 못 받으므로 안내하고, 화면을 누르면 되돌린다.
el.catcher.addEventListener('blur', () => {
  if (!running) return;
  el.hint.textContent = '화면을 클릭한 뒤 입력하세요';
  el.hint.hidden = false;
});

el.game.addEventListener('click', (e) => {
  if (running && e.target !== el.resetBtn) {
    el.catcher.focus();
    el.hint.hidden = true;
  }
});

// 스페이스·엔터로 버튼이 다시 눌리는 것을 막는다.
[el.startBtn, el.resetBtn].forEach((btn) => {
  btn.addEventListener('keydown', (e) => {
    if (running && (e.key === ' ' || e.key === 'Enter')) e.preventDefault();
  });
});

/* ===== 타이머 ===== */

// setInterval 호출 횟수를 세지 않고 실제 시각으로 계산한다.
// 탭이 백그라운드로 가면 interval이 밀려서 남은 시간이 부정확해지기 때문.
function tick() {
  const left = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
  el.time.textContent = left;

  const ratio = Math.max(0, (endsAt - Date.now()) / (GAME_SECONDS * 1000));
  el.bar.style.width = (ratio * 100) + '%';
  el.bar.classList.toggle('is-low', ratio <= 0.25);

  if (left <= 0) end();
}

/* ===== 게임 흐름 ===== */

function start() {
  if (running) return;
  running = true;

  score = 0;
  combo = 0;
  bestCombo = 0;
  targetChar = '';
  endsAt = Date.now() + GAME_SECONDS * 1000;

  render();
  setTarget();
  el.result.hidden = true;
  el.hint.hidden = true;
  el.startBtn.disabled = true;
  el.bar.classList.remove('is-low');
  el.bar.style.width = '100%';
  el.time.textContent = GAME_SECONDS;

  el.catcher.focus();
  tickId = setInterval(tick, 100);   // 막대가 부드럽게 줄도록 0.1초마다
}

function end() {
  clearInterval(tickId);
  tickId = null;
  running = false;

  el.target.textContent = '';
  el.target.innerHTML = '<span class="target__idle">다시 도전해보세요</span>';
  el.startBtn.disabled = false;
  el.hint.hidden = true;
  el.bar.style.width = '0%';
  el.catcher.blur();

  const best = loadBest();
  const isNewBest = score > best;
  if (isNewBest) saveBest(score);

  el.best.textContent = isNewBest ? score : best;
  el.result.hidden = false;
  el.result.innerHTML =
    '<strong class="result__score">' + score + '점</strong>' +
    '최고 연속 ' + bestCombo + '회' +
    (isNewBest ? ' · <span class="result__new">최고 기록 경신!</span>' : '');
}

function reset() {
  clearInterval(tickId);
  tickId = null;
  running = false;

  score = 0;
  combo = 0;
  bestCombo = 0;
  targetChar = '';

  render();
  el.time.textContent = GAME_SECONDS;
  el.target.innerHTML = '<span class="target__idle">Start를 눌러 시작하세요</span>';
  el.result.hidden = true;
  el.hint.hidden = true;
  el.startBtn.disabled = false;
  el.bar.classList.remove('is-low');
  el.bar.style.width = '100%';
}

el.startBtn.addEventListener('click', start);
el.resetBtn.addEventListener('click', reset);

/* ===== 초기화 ===== */

el.best.textContent = loadBest();
reset();
