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
	const statsBox = document.querySelector('.stats');
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
	const homeBtn = document.getElementById('home-btn');
	/** Settings & Test controls */
	const settingsBtn = document.getElementById('settings-btn');
	const settingsBackdrop = document.getElementById('settings-backdrop');
	const settingsModal = document.getElementById('settings-modal');
	const settingsTheme = /** @type {HTMLSelectElement} */(document.getElementById('settings-theme'));
	const settingsDifficulty = /** @type {HTMLSelectElement} */(document.getElementById('settings-difficulty'));
	const settingsCloseBtn = document.getElementById('settings-close-btn');
	const testBtn = document.getElementById('test-btn');
	const openSettingsBtn = document.getElementById('open-settings-btn');
	const testOverlay = document.getElementById('test-overlay');
	const testCountdownEl = document.getElementById('test-countdown');
	const testTipEl = document.getElementById('test-tip');
	const testBackdrop = document.getElementById('test-backdrop');
	const testModal = document.getElementById('test-modal');
	const testList = document.getElementById('test-list');
	const testAvg = document.getElementById('test-avg');
	const testRetryBtn = document.getElementById('test-retry-btn');
	const testExitBtn = document.getElementById('test-exit-btn');

	// Testing state
	let isTesting = false;
	let testTrial = 0; // 1..5
	/** @type {{trial:number,status:'hit'|'miss'|'premature',reactionMs?:number}[]} */
	let testResults = [];
	/** @type {'idle'|'countdown'|'waiting'|'visible'} */
	let testPhase = 'idle';
	let testAppearTs = 0;
	let testDelayTimer = 0, testHideTimer = 0, testCountdownTimer = 0;
	let testDelayAt = 0, testHideAt = 0;
	let testRemainingDelay = 0, testRemainingHide = 0;
	let testCountdownRemaining = 0;
	/** Leaderboard */
	const leaderboardBtn = document.getElementById('leaderboard-btn');
	const leaderboardPage = document.getElementById('leaderboard-page');
	const lbBackBtn = document.getElementById('lb-back-btn');
	const boardList = document.getElementById('lb-list') || document.getElementById('board-list');
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

	function applyVisualStyle(styleKey) {
		const body = document.body;
		body.classList.remove('theme-classic','theme-neon','theme-retro','theme-gameboy','theme-green','theme-red','theme-neon');
		switch (styleKey) {
			case 'neon': body.classList.add('theme-neon'); break;
			case 'retro': body.classList.add('theme-retro'); break;
			case 'gameboy': body.classList.add('theme-gameboy'); break;
			case 'classic':
			default: body.classList.add('theme-classic'); break;
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
		const nodes = Array.from(gameArea.querySelectorAll('.target'));
		const current = nodes.length;
		if (current < desiredTargetCount) {
			for (let i = current; i < desiredTargetCount; i++) {
				const t = createTarget();
				gameArea.appendChild(t);
			}
		} else if (current > desiredTargetCount) {
			// remove extras from the end
			for (let i = 0; i < current - desiredTargetCount; i++) {
				const el = nodes[nodes.length - 1 - i];
				if (el && el.parentElement) el.parentElement.removeChild(el);
			}
		}
	}

	function clearAllTargets() {
		gameArea.querySelectorAll('.target').forEach((el) => el.remove());
	}

	function mapDifficultyToBlockCount() {
		const v = selectDifficulty ? selectDifficulty.value : 'medium';
		if (v === 'easy') return 3;
		if (v === 'hard') return 8;
		return 5; // medium
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
		ttlMs = 2000;
		hitCount = 0;
		missCount = 0;
		totalClicks = 0;
		updateStatsUI();
		uiPanel.classList.add('hidden');
		gameArea.classList.remove('hidden');
		remainingMs = ROUND_MS;
		updateTimerUI(ROUND_MS);
		desiredTargetCount = mapDifficultyToBlockCount();
		clearAllTargets();
		spawnTargetsToDesiredCount();
		gameStartTs = performance.now();
		rafId = requestAnimationFrame(tick);
		// ensure HUD stats & timer visible in training mode
		if (statsBox) statsBox.classList.remove('hidden');
		if (timerEl) timerEl.classList.remove('hidden');
		if (restartBtn) restartBtn.classList.remove('hidden');
	}

	function difficultyMultiplier() {
		const v = selectDifficulty ? selectDifficulty.value : 'medium';
		if (v === 'hard') return 3;
		if (v === 'medium') return 2;
		return 1; // easy
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
		if ((!isRunning && !isTesting) || isPaused) return;
		isPaused = true;
		cancelAnimationFrame(rafId);
		pauseStartedAt = performance.now();
		// training: switch buttons
		pauseBtn.classList.add('hidden');
		resumeBtn.classList.remove('hidden');
		// testing timers pause
		if (isTesting) {
			if (testPhase === 'waiting' && testDelayTimer) {
				const now = performance.now();
				testRemainingDelay = Math.max(0, testDelayAt - now);
				clearTimeout(testDelayTimer); testDelayTimer = 0;
			}
			if (testPhase === 'visible' && testHideTimer) {
				const now = performance.now();
				testRemainingHide = Math.max(0, testHideAt - now);
				clearTimeout(testHideTimer); testHideTimer = 0;
			}
			if (testPhase === 'countdown' && testCountdownTimer) {
				clearInterval(testCountdownTimer); testCountdownTimer = 0;
			}
		}
		openPauseModal();
	}

	function resumeGame() {
		if ((!isRunning && !isTesting) || !isPaused) return;
		isPaused = false;
		const now = performance.now();
		const pauseDelta = now - pauseStartedAt;
		if (isRunning) {
			// Re-anchor start time using remainingMs
			gameStartTs = now - (ROUND_MS - remainingMs);
			// shift createdAt for all existing targets so TTL is not consumed during pause
			gameArea.querySelectorAll('.target').forEach((el) => {
				const createdAt = targetCreatedAt.get(el);
				if (createdAt != null) {
					targetCreatedAt.set(el, createdAt + pauseDelta);
				}
			});
			rafId = requestAnimationFrame(tick);
		}
		// testing timers resume
		if (isTesting) {
			if (testPhase === 'waiting' && testRemainingDelay > 0) {
				testDelayAt = performance.now() + testRemainingDelay;
				testDelayTimer = setTimeout(showTestBlock, testRemainingDelay);
				testRemainingDelay = 0;
			}
			if (testPhase === 'visible' && testRemainingHide > 0) {
				testHideAt = performance.now() + testRemainingHide;
				testHideTimer = setTimeout(onTestMiss, testRemainingHide);
				testRemainingHide = 0;
			}
			if (testPhase === 'countdown' && testCountdownRemaining > 0 && !testCountdownTimer) {
				// resume numeric countdown
				if (testCountdownEl) testCountdownEl.textContent = String(testCountdownRemaining);
				testCountdownTimer = setInterval(() => {
					if (isPaused) return;
					testCountdownRemaining--;
					if (testCountdownRemaining <= 0) {
						clearInterval(testCountdownTimer); testCountdownTimer = 0;
						if (testCountdownEl) { testCountdownEl.textContent = ''; testCountdownEl.classList.add('hidden'); }
						testPhase = 'waiting';
						const delay = 100 + Math.floor(Math.random() * 2901);
						testDelayAt = performance.now() + delay;
						testDelayTimer = setTimeout(showTestBlock, delay);
						if (testOverlay) testOverlay.classList.remove('hidden');
					} else {
						if (testCountdownEl) testCountdownEl.textContent = String(testCountdownRemaining);
					}
				}, 1000);
			}
		}
		pauseBtn.classList.remove('hidden');
		resumeBtn.classList.add('hidden');
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
		if (timerEl) timerEl.classList.remove('hidden');
		if (statsBox) statsBox.classList.remove('hidden');
		if (restartBtn) restartBtn.classList.remove('hidden');
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

	// Reaction Test helpers
	function clearTestTimers() {
		if (testDelayTimer) { clearTimeout(testDelayTimer); testDelayTimer = 0; }
		if (testHideTimer) { clearTimeout(testHideTimer); testHideTimer = 0; }
		if (testCountdownTimer) { clearInterval(testCountdownTimer); testCountdownTimer = 0; }
	}
	function closeTestResultModal() {
		testBackdrop.classList.add('hidden');
		testModal.classList.add('hidden');
		testBackdrop.setAttribute('aria-hidden', 'true');
	}
	function openTestResultModal() {
		// render list
		if (testList) {
			testList.innerHTML = '';
			for (let i = 0; i < testResults.length; i++) {
				const r = testResults[i];
				const li = document.createElement('li');
				let text = `第 ${r.trial} 次：`;
				if (r.status === 'hit') text += `命中（${Math.round(r.reactionMs || 0)} ms）`;
				else if (r.status === 'premature') text += '提前点击';
				else text += '未命中';
				li.textContent = text;
				testList.appendChild(li);
			}
		}
		// average
		const hits = testResults.filter(r => r.status === 'hit' && typeof r.reactionMs === 'number');
		const avg = hits.length ? Math.round(hits.reduce((s, r) => s + (r.reactionMs || 0), 0) / hits.length) : null;
		if (testAvg) testAvg.textContent = hits.length ? `${avg} ms` : 'N/A';
		testBackdrop.classList.remove('hidden');
		testModal.classList.remove('hidden');
		testBackdrop.setAttribute('aria-hidden', 'false');
	}
	function resetTestState() {
		isTesting = false;
		testTrial = 0;
		testResults = [];
		testPhase = 'idle';
		testAppearTs = 0;
		clearTestTimers();
		if (testOverlay) testOverlay.classList.add('hidden');
		if (testCountdownEl) testCountdownEl.textContent = '3';
		if (testTipEl) testTipEl.classList.add('hidden');
		// remove any test block
		const tb = gameArea.querySelector('.target.test');
		if (tb) tb.remove();
	}
	function runNextTestTrial() {
		clearTestTimers();
		// remove leftover block
		const tb = gameArea.querySelector('.target.test');
		if (tb) tb.remove();
		if (testTrial >= 5) {
			openTestResultModal();
			return;
		}
		testTrial++;
		if (testTrial === 1) {
			// First trial: show numeric countdown 3->2->1
			testPhase = 'countdown';
			if (testOverlay) testOverlay.classList.remove('hidden');
			if (testTipEl) testTipEl.classList.add('hidden');
			if (testCountdownEl) {
				testCountdownEl.classList.remove('hidden');
				testCountdownRemaining = 3;
				testCountdownEl.textContent = String(testCountdownRemaining);
			}
			testCountdownTimer = setInterval(() => {
				if (isPaused) return; // paused, wait
				testCountdownRemaining--;
				if (testCountdownRemaining <= 0) {
					clearInterval(testCountdownTimer); testCountdownTimer = 0;
					if (testCountdownEl) { testCountdownEl.textContent = ''; testCountdownEl.classList.add('hidden'); }
					// switch to waiting and schedule block after random delay
					testPhase = 'waiting';
					const delay = 100 + Math.floor(Math.random() * 2901);
					testDelayAt = performance.now() + delay;
					testDelayTimer = setTimeout(showTestBlock, delay);
					if (testOverlay) testOverlay.classList.remove('hidden'); // keep overlay until block shows
				} else {
					if (testCountdownEl) testCountdownEl.textContent = String(testCountdownRemaining);
				}
			}, 1000);
		} else {
			// Subsequent trials: no countdown
			testPhase = 'waiting';
			if (testCountdownEl) { testCountdownEl.textContent = ''; testCountdownEl.classList.add('hidden'); }
			if (testTipEl) testTipEl.classList.add('hidden');
			const delay = 100 + Math.floor(Math.random() * 2901);
			testDelayAt = performance.now() + delay;
			testDelayTimer = setTimeout(showTestBlock, delay);
		}
	}
	function showTestBlock() {
		if (!isTesting) return;
		testPhase = 'visible';
		const div = document.createElement('div');
		div.className = 'target test';
		const { left, top } = getRandomPositionWithinArea();
		div.style.left = left + 'px';
		div.style.top = top + 'px';
		gameArea.appendChild(div);
		testAppearTs = performance.now();
		if (testTipEl) testTipEl.classList.add('hidden');
		if (testOverlay) testOverlay.classList.add('hidden');
		div.addEventListener('click', () => {
			if (!isTesting || testPhase !== 'visible') return;
			const reaction = performance.now() - testAppearTs;
			testResults.push({ trial: testTrial, status: 'hit', reactionMs: reaction });
			div.classList.add('hit');
			setTimeout(() => { if (div.parentElement) div.remove(); runNextTestTrial(); }, 180);
		});
		const life = 5000;
		testHideAt = performance.now() + life;
		testHideTimer = setTimeout(onTestMiss, life);
	}
	function onTestMiss() {
		if (!isTesting || testPhase !== 'visible') return;
		testResults.push({ trial: testTrial, status: 'miss' });
		const tb = gameArea.querySelector('.target.test');
		if (tb) tb.remove();
		runNextTestTrial();
	}
	function startReactionTest() {
		if (isRunning) exitToHome();
		isTesting = true;
		// keep HUD visible so Home button is available
		if (timerEl) timerEl.classList.add('hidden');
		if (statsBox) statsBox.classList.add('hidden');
		if (restartBtn) restartBtn.classList.add('hidden');
		uiPanel.classList.add('hidden');
		gameArea.classList.remove('hidden');
		testTrial = 0;
		testResults = [];
		runNextTestTrial();
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

	function openLeaderboardPage() {
		uiPanel.classList.add('hidden');
		gameArea.classList.add('hidden');
		leaderboardPage.classList.remove('hidden');
		renderLeaderboard();
	}

	function closeLeaderboardPage() {
		leaderboardPage.classList.add('hidden');
		if (!isRunning && !isTesting) {
			uiPanel.classList.remove('hidden');
		} else if (isRunning) {
			gameArea.classList.remove('hidden');
		}
	}

	// Settings modal helpers
	function openSettingsModal() {
		settingsBackdrop.classList.remove('hidden');
		settingsModal.classList.remove('hidden');
		settingsBackdrop.setAttribute('aria-hidden', 'false');
		// sync current values
		if (settingsDifficulty && selectDifficulty) settingsDifficulty.value = selectDifficulty.value;
		if (settingsTheme) {
			// no-op, theme already applied
		}
	}
	function closeSettingsModal() {
		settingsBackdrop.classList.add('hidden');
		settingsModal.classList.add('hidden');
		settingsBackdrop.setAttribute('aria-hidden', 'true');
	}

	// Wire up UI
	if (selectTheme) {
		selectTheme.addEventListener('change', (e) => {
			const val = /** @type {HTMLSelectElement} */ (e.target).value;
			applyVisualStyle(val);
		});
	}
	// Apply initial theme from any available selector
	{
		const initialTheme = (settingsTheme && settingsTheme.value) || 'classic';
		applyVisualStyle(initialTheme);
	}

	if (inputTargetCount) {
		inputTargetCount.addEventListener('input', () => {
			const n = clamp(parseInt(inputTargetCount.value || '0', 10), 1, 10);
			if (String(n) !== inputTargetCount.value) {
				inputTargetCount.value = String(n);
			}
			desiredTargetCount = n;
			if (isRunning) spawnTargetsToDesiredCount();
		});
		desiredTargetCount = clamp(parseInt(inputTargetCount.value || '5', 10), 1, 10);
	} else {
		desiredTargetCount = 5;
	}

	// Difficulty now affects concurrent blocks (3/5/8)
	if (selectDifficulty) selectDifficulty.addEventListener('change', () => {
		if (!isRunning) {
			updateTimerUI(ROUND_MS);
		} else {
			desiredTargetCount = mapDifficultyToBlockCount();
			spawnTargetsToDesiredCount();
		}
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
		const t = /** @type {HTMLElement} */ (e.target);
		// Testing branch
		if (isTesting) {
			if (testPhase === 'waiting') {
				// premature click
				if (testDelayTimer) { clearTimeout(testDelayTimer); testDelayTimer = 0; }
				testResults.push({ trial: testTrial, status: 'premature' });
				// advance to next trial immediately
				// ensure no stray test block exists
				const tb = gameArea.querySelector('.target.test');
				if (tb) tb.remove();
				runNextTestTrial();
			}
			// clicks elsewhere during visible/non-visible are ignored here (handled by block listener)
			return;
		}
		// Normal game branch
		if (!isRunning || isPaused) return;
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
	if (homeBtn) homeBtn.addEventListener('click', exitToHome);
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

	// Test entry & modal actions
	if (testBtn) testBtn.addEventListener('click', startReactionTest);
	if (testRetryBtn) testRetryBtn.addEventListener('click', () => {
		closeTestResultModal();
		resetTestState();
		startReactionTest();
	});
	if (testExitBtn) testExitBtn.addEventListener('click', () => {
		closeTestResultModal();
		resetTestState();
		// return home UI
		uiPanel.classList.remove('hidden');
		gameArea.classList.add('hidden');
		hud.classList.remove('hidden');
		if (timerEl) timerEl.classList.remove('hidden');
		if (statsBox) statsBox.classList.remove('hidden');
	});

	// Settings modal
	if (settingsBtn) settingsBtn.addEventListener('click', openSettingsModal);
	if (openSettingsBtn) openSettingsBtn.addEventListener('click', openSettingsModal);
	if (settingsCloseBtn) settingsCloseBtn.addEventListener('click', closeSettingsModal);
	if (settingsBackdrop) settingsBackdrop.addEventListener('click', closeSettingsModal);
	if (settingsTheme) settingsTheme.addEventListener('change', () => {
		applyVisualStyle(settingsTheme.value);
	});
	// Leaderboard page
	if (leaderboardBtn) leaderboardBtn.addEventListener('click', openLeaderboardPage);
	if (lbBackBtn) lbBackBtn.addEventListener('click', closeLeaderboardPage);
	if (settingsDifficulty) settingsDifficulty.addEventListener('change', () => {
		if (selectDifficulty) selectDifficulty.value = settingsDifficulty.value;
		if (!isRunning) updateTimerUI(ROUND_MS);
		else {
			desiredTargetCount = mapDifficultyToBlockCount();
			spawnTargetsToDesiredCount();
		}
	});

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


