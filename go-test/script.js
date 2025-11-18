// 8‑Bit Reaction Trainer - Script
(function () {
	'use strict';

	/** @type {HTMLInputElement} */
	const inputTargetCount = document.getElementById('target-count');
	/** @type {HTMLSelectElement} */
	const selectDifficulty = /** @type {HTMLSelectElement} */ (document.getElementById('difficulty'));
	/** @type {HTMLSelectElement} */
	const selectTheme = /** @type {HTMLSelectElement} */ (document.getElementById('theme'));
	/** @type {HTMLButtonElement} */
	const startBtn = document.getElementById('start-btn');
	/** @type {HTMLElement} */
	const uiPanel = document.getElementById('ui-panel');
	/** @type {HTMLElement} */
	const gameArea = document.getElementById('game-area');
	/** HUD elements */
	const hud = document.getElementById('hud');
	const timerEl = document.getElementById('timer');
	const hitsEl = document.getElementById('hits');
	const missesEl = document.getElementById('misses');
	const accuracyEl = document.getElementById('accuracy');
	const pauseBtn = document.getElementById('pause-btn');
	const resumeBtn = document.getElementById('resume-btn');
	const restartBtn = document.getElementById('restart-btn');
	const soundToggle = /** @type {HTMLInputElement} */ (document.getElementById('sound-toggle'));
	/** Modal elements */
	const resultBackdrop = document.getElementById('result-backdrop');
	const resultModal = document.getElementById('result-modal');
	const resultDuration = document.getElementById('result-duration');
	const resultHits = document.getElementById('result-hits');
	const resultMisses = document.getElementById('result-misses');
	const resultAccuracy = document.getElementById('result-accuracy');
	const resultScore = document.getElementById('result-score');
	const playerNameInput = /** @type {HTMLInputElement} */ (document.getElementById('player-name'));
	const saveScoreBtn = document.getElementById('save-score-btn');
	const playAgainBtn = document.getElementById('play-again-btn');
	const closeResultBtn = document.getElementById('close-result-btn');
	/** Pause modal */
	const pauseBackdrop = document.getElementById('pause-backdrop');
	const pauseModal = document.getElementById('pause-modal');
	const pauseContinueBtn = document.getElementById('pause-continue-btn');
	const pauseExitBtn = document.getElementById('pause-exit-btn');
	/** Leaderboard */
	const boardList = document.getElementById('board-list');
	/** SFX */
	const sfxHit = /** @type {HTMLAudioElement} */ (document.getElementById('sfx-hit'));
	const sfxPop = /** @type {HTMLAudioElement} */ (document.getElementById('sfx-pop'));

	const TARGET_SIZE = 48;
	let desiredTargetCount = 5;
	let isRunning = false;
	let isPaused = false;
	const ROUND_MS = 30000;
	let ttlMs = 5000;
	let hitCount = 0;
	let missCount = 0;
	let totalClicks = 0;
	let gameStartTs = 0;
	let gameEndTs = 0;
	let remainingMs = 0;
	let rafId = 0;
	let soundOn = true;
	const LS_KEY = 'eightbit_react_leaderboard_v1';
	const targetCreatedAt = new WeakMap();
	const targetTTL = new WeakMap();
	let pauseStartedAt = 0;

	function clamp(num, min, max) {
		return Math.max(min, Math.min(max, num));
	}

	function applyTheme(themeKey) {
		const body = document.body;
		body.classList.remove('theme-green', 'theme-red', 'theme-neon');
		switch (themeKey) {
			case 'red':
				body.classList.add('theme-red');
				break;
			case 'neon':
				body.classList.add('theme-neon');
				break;
			case 'green':
			default:
				body.classList.add('theme-green');
				break;
		}
	}

	function getSpawnBoundsPaddingTop() {
		if (!hud) return 0;
		const r = hud.getBoundingClientRect();
		// Provide small extra spacing
		return Math.ceil(r.height + 8);
	}

	function getRandomPositionWithinArea() {
		const rect = gameArea.getBoundingClientRect();
		const maxLeft = Math.max(0, rect.width - TARGET_SIZE);
		const topPadding = getSpawnBoundsPaddingTop();
		const maxTop = Math.max(0, rect.height - TARGET_SIZE);
		const left = Math.floor(Math.random() * (maxLeft + 1));
		const minTop = Math.min(topPadding, Math.max(0, rect.height - TARGET_SIZE));
		const topRange = Math.max(0, maxTop - minTop);
		const top = Math.floor(minTop + Math.random() * (topRange + 1));
		return { left, top };
	}

	function createTarget() {
		const div = document.createElement('div');
		div.className = 'target';
		const { left, top } = getRandomPositionWithinArea();
		div.style.left = left + 'px';
		div.style.top = top + 'px';
		// record TTL context
		targetCreatedAt.set(div, performance.now());
		targetTTL.set(div, ttlMs);
		playPopSfx();

		// Click interaction
		let clicked = false;
		div.addEventListener('click', () => {
			if (clicked || !isRunning || isPaused) return;
			clicked = true;
			// prevent future TTL expiry processing
			targetCreatedAt.delete(div);
			targetTTL.delete(div);
			hitCount++;
			totalClicks++;
			updateStatsUI();
			playHitSfx();
			div.classList.add('hit');
			// Replace after 0.2s
			setTimeout(() => {
				if (div.parentElement) {
					div.remove();
				}
				// Only spawn new if game is still running
				if (isRunning) {
					spawnTargetsToDesiredCount();
				}
			}, 200);
		}, { passive: true });
		return div;
	}

	function spawnTargetsToDesiredCount() {
		if (!isRunning) return;
		const current = gameArea.querySelectorAll('.target').length;
		for (let i = current; i < desiredTargetCount; i++) {
			const t = createTarget();
			gameArea.appendChild(t);
		}
	}

	function clearAllTargets() {
		gameArea.querySelectorAll('.target').forEach((el) => el.remove());
	}

	function mapDifficultyToTTL() {
		const v = selectDifficulty.value;
		if (v === '1') return 1000;
		if (v === '3') return 3000;
		return 5000;
	}

	function updateTimerUI(ms) {
		const sec = Math.max(0, Math.ceil(ms / 1000));
		const mm = String(Math.floor(sec / 60)).padStart(2, '0');
		const ss = String(sec % 60).padStart(2, '0');
		if (timerEl) timerEl.textContent = `${mm}:${ss}`;
	}

	function updateStatsUI() {
		if (hitsEl) hitsEl.textContent = String(hitCount);
		if (missesEl) missesEl.textContent = String(missCount);
		const acc = totalClicks === 0 ? 0 : Math.round((hitCount / totalClicks) * 100);
		if (accuracyEl) accuracyEl.textContent = `${acc}%`;
	}

	function tick(nowTs) {
		if (!isRunning || isPaused) return;
		const elapsed = nowTs - gameStartTs;
		remainingMs = Math.max(0, ROUND_MS - elapsed);
		updateTimerUI(remainingMs);
		// TTL expiry check
		const nodes = gameArea.querySelectorAll('.target');
		nodes.forEach((el) => {
			if (el.classList.contains('hit') || el.classList.contains('expired')) return;
			const createdAt = targetCreatedAt.get(el);
			const elTTL = targetTTL.get(el);
			if (createdAt == null || elTTL == null) return;
			if ((nowTs - createdAt) >= elTTL) {
				el.classList.add('expired');
				// once expired, clear tracking
				targetCreatedAt.delete(el);
				targetTTL.delete(el);
				missCount++;
				updateStatsUI();
				setTimeout(() => {
					if (el.parentElement) {
						el.remove();
					}
					if (isRunning) {
						spawnTargetsToDesiredCount();
					}
				}, 200);
			}
		});
		if (remainingMs <= 0) {
			endGame();
			return;
		}
		rafId = requestAnimationFrame(tick);
	}

	function startGameWithTimer() {
		isRunning = true;
		isPaused = false;
		ttlMs = mapDifficultyToTTL();
		hitCount = 0;
		missCount = 0;
		totalClicks = 0;
		updateStatsUI();
		uiPanel.classList.add('hidden');
		gameArea.classList.remove('hidden');
		remainingMs = ROUND_MS;
		updateTimerUI(remainingMs);
		desiredTargetCount = clamp(parseInt(inputTargetCount.value || '5', 10), 1, 10);
		clearAllTargets();
		spawnTargetsToDesiredCount();
		gameStartTs = performance.now();
		rafId = requestAnimationFrame(tick);
	}

	function difficultyMultiplier() {
		const v = selectDifficulty.value;
		if (v === '1') return 3;
		if (v === '3') return 2;
		return 1;
	}

	function endGame() {
		if (!isRunning) return;
		isRunning = false;
		isPaused = false;
		cancelAnimationFrame(rafId);
		gameEndTs = performance.now();
		clearAllTargets();
		const accuracy = totalClicks === 0 ? 0 : (hitCount / totalClicks);
		const score = Math.round(hitCount * accuracy * difficultyMultiplier());
		if (resultDuration) resultDuration.textContent = `${Math.round(ROUND_MS / 1000)}s`;
		if (resultHits) resultHits.textContent = String(hitCount);
		if (resultMisses) resultMisses.textContent = String(missCount);
		if (resultAccuracy) resultAccuracy.textContent = `${Math.round(accuracy * 100)}%`;
		if (resultScore) resultScore.textContent = String(score);
		openResultModal();
	}

	function pauseGame() {
		if (!isRunning || isPaused) return;
		isPaused = true;
		cancelAnimationFrame(rafId);
		pauseStartedAt = performance.now();
		// switch buttons
		pauseBtn.classList.add('hidden');
		resumeBtn.classList.remove('hidden');
		openPauseModal();
	}

	function resumeGame() {
		if (!isRunning || !isPaused) return;
		isPaused = false;
		// Re-anchor start time using remainingMs
		const now = performance.now();
		const pauseDelta = now - pauseStartedAt;
		gameStartTs = now - (ROUND_MS - remainingMs);
		// shift createdAt for all existing targets so TTL is not consumed during pause
		gameArea.querySelectorAll('.target').forEach((el) => {
			const createdAt = targetCreatedAt.get(el);
			if (createdAt != null) {
				targetCreatedAt.set(el, createdAt + pauseDelta);
			}
		});
		pauseBtn.classList.remove('hidden');
		resumeBtn.classList.add('hidden');
		rafId = requestAnimationFrame(tick);
	}

	function exitToHome() {
		// stop game without scoring
		isRunning = false;
		isPaused = false;
		cancelAnimationFrame(rafId);
		clearAllTargets();
		// close any modals
		closeResultModal();
		closePauseModal();
		// show settings, hide game area
		uiPanel.classList.remove('hidden');
		gameArea.classList.add('hidden');
		// reset HUD
		hitCount = 0;
		missCount = 0;
		totalClicks = 0;
		updateStatsUI();
		remainingMs = ROUND_MS;
		updateTimerUI(remainingMs);
		// reset buttons state
		pauseBtn.classList.remove('hidden');
		resumeBtn.classList.add('hidden');
	}

	function restartGame() {
		closeResultModal();
		// reset and start
		startGameWithTimer();
	}

	function openResultModal() {
		resultBackdrop.classList.remove('hidden');
		resultModal.classList.remove('hidden');
		resultBackdrop.setAttribute('aria-hidden', 'false');
	}

	function closeResultModal() {
		resultBackdrop.classList.add('hidden');
		resultModal.classList.add('hidden');
		resultBackdrop.setAttribute('aria-hidden', 'true');
	}

	function openPauseModal() {
		pauseBackdrop.classList.remove('hidden');
		pauseModal.classList.remove('hidden');
		pauseBackdrop.setAttribute('aria-hidden', 'false');
	}

	function closePauseModal() {
		pauseBackdrop.classList.add('hidden');
		pauseModal.classList.add('hidden');
		pauseBackdrop.setAttribute('aria-hidden', 'true');
	}

	function loadLeaderboard() {
		try {
			const raw = localStorage.getItem(LS_KEY);
			if (!raw) return [];
			return JSON.parse(raw);
		} catch {
			return [];
		}
	}

	function saveScoreEntry(entry) {
		try {
			const list = loadLeaderboard();
			list.push(entry);
			list.sort((a, b) => b.score - a.score);
			const top10 = list.slice(0, 10);
			localStorage.setItem(LS_KEY, JSON.stringify(top10));
		} catch {
			/* ignore */
		}
	}

	function renderLeaderboard() {
		const list = loadLeaderboard();
		if (!boardList) return;
		boardList.innerHTML = '';
		if (list.length === 0) {
			const li = document.createElement('li');
			li.className = 'placeholder';
			li.textContent = '暂无数据';
			boardList.appendChild(li);
			return;
		}
		list.forEach((e) => {
			const li = document.createElement('li');
			const acc = `${Math.round(e.accuracy * 100)}%`;
			li.textContent = `${e.name || '玩家'} - 分数 ${e.score}（命中 ${e.hits} / 失误 ${e.misses} / ${acc} / ${e.difficulty}s）`;
			boardList.appendChild(li);
		});
	}

	// Wire up UI
	selectTheme.addEventListener('change', (e) => {
		const val = /** @type {HTMLSelectElement} */ (e.target).value;
		applyTheme(val);
	});
	// Apply initial theme
	applyTheme(selectTheme.value);

	inputTargetCount.addEventListener('input', () => {
		const n = clamp(parseInt(inputTargetCount.value || '0', 10), 1, 10);
		if (String(n) !== inputTargetCount.value) {
			// normalize display
			inputTargetCount.value = String(n);
		}
		desiredTargetCount = n;
		// If game already running, adjust on the fly
		if (isRunning) {
			spawnTargetsToDesiredCount();
		}
	});
	desiredTargetCount = clamp(parseInt(inputTargetCount.value || '5', 10), 1, 10);

	// Difficulty now affects duration
	selectDifficulty.addEventListener('change', () => {
		ttlMs = mapDifficultyToTTL();
		if (!isRunning) updateTimerUI(ROUND_MS);
	});

	startBtn.addEventListener('click', () => {
		if (isRunning) return;
		startGameWithTimer();
	});

	// Handle resize: keep future spawns in-bounds
	window.addEventListener('resize', () => {
		// Existing targets can remain; new ones will use the new bounds
	});

	// Miss capture: click in game area but not on target or control
	gameArea.addEventListener('click', (e) => {
		if (!isRunning || isPaused) return;
		const t = /** @type {HTMLElement} */ (e.target);
		if (t.classList.contains('target')) return;
		if (t.closest && t.closest('.controls')) return;
		missCount++;
		totalClicks++;
		updateStatsUI();
	});

	// Controls
	if (pauseBtn) pauseBtn.addEventListener('click', pauseGame);
	if (resumeBtn) resumeBtn.addEventListener('click', resumeGame);
	if (restartBtn) restartBtn.addEventListener('click', restartGame);
	// Pause modal actions
	if (pauseContinueBtn) pauseContinueBtn.addEventListener('click', () => {
		closePauseModal();
		resumeGame();
	});
	if (pauseExitBtn) pauseExitBtn.addEventListener('click', exitToHome);

	// Modal actions
	if (saveScoreBtn) saveScoreBtn.addEventListener('click', () => {
		const accuracy = totalClicks === 0 ? 0 : (hitCount / totalClicks);
		const entry = {
			name: (playerNameInput && playerNameInput.value.trim()) || '玩家',
			score: Math.round(hitCount * accuracy * difficultyMultiplier()),
			hits: hitCount,
			misses: missCount,
			accuracy,
			durationMs: ROUND_MS,
			difficulty: selectDifficulty.value,
			dateISO: new Date().toISOString()
		};
		saveScoreEntry(entry);
		renderLeaderboard();
	});
	if (playAgainBtn) playAgainBtn.addEventListener('click', () => {
		closeResultModal();
		startGameWithTimer();
	});
	if (closeResultBtn) closeResultBtn.addEventListener('click', closeResultModal);
	if (resultBackdrop) resultBackdrop.addEventListener('click', closeResultModal);

	// SFX toggle
	if (soundToggle) {
		soundToggle.addEventListener('change', () => {
			soundOn = soundToggle.checked;
		});
		soundOn = soundToggle.checked;
	}

	function playHitSfx() {
		if (!soundOn || !sfxHit) return;
		try { sfxHit.currentTime = 0; sfxHit.play(); } catch {}
	}
	function playPopSfx() {
		if (!soundOn || !sfxPop) return;
		try { sfxPop.currentTime = 0; sfxPop.play(); } catch {}
	}

	// Auto-pause on blur
	window.addEventListener('blur', () => {
		if (isRunning && !isPaused) {
			pauseGame();
		}
	});

	// Initial UI
	updateTimerUI(ROUND_MS);
	renderLeaderboard();
})();


