// ===== 背单词模块（闪卡）=====

let flashcardSession = {
    words: [],
    currentIndex: 0,
    mode: 'tibetan-to-chinese',
    showFront: true
};

function startFlashcardSession() {
    const mode = document.getElementById('flashcard-mode').value;
    const filter = document.getElementById('flashcard-filter').value;
    
    let words = getWordsByCategory(filter);
    if (words.length === 0) {
        showToast('该分类下没有单词，请先录入', 'error');
        return;
    }
    
    // 打乱顺序
    words = [...words].sort(() => Math.random() - 0.5);
    
    flashcardSession = {
        words: words,
        currentIndex: 0,
        mode: mode,
        showFront: true
    };
    
    renderFlashcard();
    updateProgress();
    
    document.getElementById('flashcard-progress').style.display = 'flex';
    
    // 记录学习
    recordStudySession();
}

function renderFlashcard() {
    const area = document.getElementById('flashcard-area');
    const { words, currentIndex, mode, showFront } = flashcardSession;
    
    if (currentIndex >= words.length) {
        // 学习完成
        const mastered = words.filter((_, i) => i < currentIndex).length; // 简化统计
        area.innerHTML = `
            <div class="card" style="text-align:center;padding:48px">
                <div style="font-size:4rem;margin-bottom:20px">🎉</div>
                <h3 style="color:var(--secondary);margin-bottom:12px">本轮学习完成！</h3>
                <p style="color:var(--text-secondary);margin-bottom:8px">共学习了 ${words.length} 个单词</p>
                <p style="color:var(--text-muted);font-size:0.9rem;margin-bottom:24px">坚持就是胜利，日积月累必有收获</p>
                <button class="btn btn-primary" onclick="startFlashcardSession()">再来一轮</button>
            </div>
        `;
        document.getElementById('flashcard-progress').style.display = 'none';
        return;
    }
    
    const word = words[currentIndex];
    const isRandom = mode === 'random';
    const showTibetanFirst = isRandom ? Math.random() > 0.5 : mode === 'tibetan-to-chinese';
    
    // 正面内容
    let frontContent, backContent;
    if (showTibetanFirst) {
        frontContent = {
            main: word.tibetan,
            fontClass: 'tibetan-font',
            hint: word.wylie || word.pronunciation || '点击翻转查看翻译'
        };
        backContent = {
            main: word.meaning,
            fontClass: '',
            hint: word.wylie ? `威利: ${word.wylie}` : (word.pronunciation ? `发音: ${word.pronunciation}` : '')
        };
    } else {
        frontContent = {
            main: word.meaning,
            fontClass: '',
            hint: '点击翻转查看藏语'
        };
        backContent = {
            main: word.tibetan,
            fontClass: 'tibetan-font',
            hint: word.wylie ? `威利: ${word.wylie}` : (word.pronunciation ? `发音: ${word.pronunciation}` : '')
        };
    }
    
    area.innerHTML = `
        <div class="flashcard ${showFront ? '' : 'flipped'}" id="flashcard" onclick="flipCard()">
            <div class="flashcard-face flashcard-front">
                <div class="flashcard-word ${frontContent.fontClass}">${escapeHtml(frontContent.main)}</div>
                ${frontContent.hint ? `<div class="flashcard-hint">${escapeHtml(frontContent.hint)}</div>` : ''}
                <div class="flip-hint">点击翻转 ↻</div>
            </div>
            <div class="flashcard-face flashcard-back">
                <div class="flashcard-meaning ${backContent.fontClass}">${escapeHtml(backContent.main)}</div>
                ${backContent.hint ? `<div class="flashcard-hint">${escapeHtml(backContent.hint)}</div>` : ''}
                ${word.example ? `
                    <div class="flashcard-example">${escapeHtml(word.example)}</div>
                    <div class="flashcard-example-meaning">${escapeHtml(word.exampleMeaning || '')}</div>
                ` : ''}
                <div class="flip-hint">点击翻回 ↻</div>
            </div>
        </div>
        <div class="flashcard-nav">
            <button class="btn btn-ghost" onclick="prevCard(event)">⬅️ 上一个</button>
            <button class="btn btn-secondary" onclick="playAudioHint(event)">🔊 播放提示</button>
            <button class="btn btn-ghost" onclick="nextCard(event)">下一个 ➡️</button>
        </div>
        <div class="flashcard-result">
            <button class="btn btn-wrong" onclick="markWrong(event)">❌ 没记住</button>
            <button class="btn btn-correct" onclick="markCorrect(event)">✅ 记住了</button>
        </div>
    `;
}

function flipCard() {
    const card = document.getElementById('flashcard');
    if (card) {
        card.classList.toggle('flipped');
        flashcardSession.showFront = !card.classList.contains('flipped');
    }
}

function nextCard(e) {
    e.stopPropagation();
    flashcardSession.currentIndex++;
    flashcardSession.showFront = true;
    renderFlashcard();
    updateProgress();
}

function prevCard(e) {
    e.stopPropagation();
    if (flashcardSession.currentIndex > 0) {
        flashcardSession.currentIndex--;
        flashcardSession.showFront = true;
        renderFlashcard();
        updateProgress();
    }
}

function markCorrect(e) {
    e.stopPropagation();
    const word = flashcardSession.words[flashcardSession.currentIndex];
    if (word) {
        toggleMastered(word.id);
        showToast('太棒了！已标记为掌握', 'success');
    }
    nextCard(e);
}

function markWrong(e) {
    e.stopPropagation();
    showToast('没关系，继续加油！', 'info');
    nextCard(e);
}

function updateProgress() {
    const { words, currentIndex } = flashcardSession;
    const progress = words.length > 0 ? ((currentIndex) / words.length) * 100 : 0;
    const fill = document.getElementById('progress-fill');
    const text = document.getElementById('progress-text');
    if (fill) fill.style.width = progress + '%';
    if (text) text.textContent = `${Math.min(currentIndex, words.length)} / ${words.length}`;
}

function playAudioHint(e) {
    e.stopPropagation();
    showToast('朗读功能: 请尝试大声朗读这个单词', 'info');
    // 浏览器语音合成朗读
    if ('speechSynthesis' in window) {
        const word = flashcardSession.words[flashcardSession.currentIndex];
        if (word) {
            const utter = new SpeechSynthesisUtterance(word.tibetan);
            // 藏语没有标准的 Speech Synthesis 语音，但可以尝试
            utter.lang = 'bo-CN';
            utter.rate = 0.8;
            speechSynthesis.speak(utter);
        }
    }
}

function recordStudySession() {
    const stats = getStats();
    const today = new Date().toDateString();
    if (stats.lastStudyDate !== today) {
        const last = stats.lastStudyDate ? new Date(stats.lastStudyDate) : null;
        const todayDate = new Date();
        const diff = last ? (todayDate - last) / (1000 * 60 * 60 * 24) : 999;
        if (diff === 1) {
            stats.streak = (stats.streak || 0) + 1;
        } else if (diff > 1) {
            stats.streak = 1;
        }
        stats.lastStudyDate = today;
        saveStats(stats);
        updateStatsDisplay();
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function initPractice() {
    document.getElementById('btn-start-session').addEventListener('click', startFlashcardSession);
}

// 兼容词汇模块的函数
function getWordsByCategory(category) {
    const vocab = getVocabulary ? getVocabulary() : [];
    if (category === 'all') return vocab;
    return vocab.filter(w => w.category === category);
}

function getVocabulary() {
    try {
        const data = localStorage.getItem('tibetan_vocab');
        return data ? JSON.parse(data) : [];
    } catch (e) {
        return [];
    }
}

function toggleMastered(id) {
    const vocab = getVocabulary();
    const word = vocab.find(w => w.id === id);
    if (!word) return false;
    word.mastered = !word.mastered;
    if (word.mastered) {
        word.reviewCount = (word.reviewCount || 0) + 1;
        word.lastReviewed = new Date().toISOString();
    }
    try {
        localStorage.setItem('tibetan_vocab', JSON.stringify(vocab));
    } catch (e) {}
    if (typeof updateStatsDisplay === 'function') updateStatsDisplay();
    return word.mastered;
}

function getStats() {
    try {
        const data = localStorage.getItem('tibetan_stats');
        if (data) return JSON.parse(data);
    } catch (e) {}
    return { mastered: 0, streak: 0, lastStudyDate: null };
}

function saveStats(stats) {
    localStorage.setItem('tibetan_stats', JSON.stringify(stats));
}

function updateStatsDisplay() {
    const vocab = getVocabulary();
    const stats = getStats();
    const mastered = vocab.filter(w => w.mastered).length;
    const elTotal = document.getElementById('stat-total-words');
    const elMastered = document.getElementById('stat-mastered');
    const elStreak = document.getElementById('stat-streak');
    if (elTotal) elTotal.textContent = vocab.length;
    if (elMastered) elMastered.textContent = mastered;
    if (elStreak) elStreak.textContent = stats.streak || 0;
}
