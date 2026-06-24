// ===== 单词数据管理模块 =====
// 使用 localStorage 持久化存储单词数据

const VOCAB_KEY = 'tibetan_vocab';
const STATS_KEY = 'tibetan_stats';

// 获取所有单词
function getVocabulary() {
    try {
        const data = localStorage.getItem(VOCAB_KEY);
        return data ? JSON.parse(data) : [];
    } catch (e) {
        console.error('读取单词数据失败:', e);
        return [];
    }
}

// 保存所有单词
function saveVocabulary(vocab) {
    try {
        localStorage.setItem(VOCAB_KEY, JSON.stringify(vocab));
        return true;
    } catch (e) {
        console.error('保存单词数据失败:', e);
        showToast('保存失败，存储空间可能已满', 'error');
        return false;
    }
}

// 获取统计数据
function getStats() {
    try {
        const data = localStorage.getItem(STATS_KEY);
        if (data) return JSON.parse(data);
    } catch (e) {}
    return { mastered: 0, streak: 0, lastStudyDate: null };
}

// 保存统计数据
function saveStats(stats) {
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
}

// 添加单词
function addWord(wordData) {
    const vocab = getVocabulary();
    const word = {
        id: Date.now().toString(),
        tibetan: wordData.tibetan.trim(),
        wylie: wordData.wylie?.trim() || '',
        pronunciation: wordData.pronunciation?.trim() || '',
        meaning: wordData.meaning.trim(),
        category: wordData.category || '其他',
        example: wordData.example?.trim() || '',
        exampleMeaning: wordData.exampleMeaning?.trim() || '',
        notes: wordData.notes?.trim() || '',
        createdAt: new Date().toISOString(),
        mastered: false,
        reviewCount: 0,
        lastReviewed: null
    };
    vocab.unshift(word);
    saveVocabulary(vocab);
    updateStatsDisplay();
    return word;
}

// 更新单词
function updateWord(id, updates) {
    const vocab = getVocabulary();
    const index = vocab.findIndex(w => w.id === id);
    if (index === -1) return false;
    vocab[index] = { ...vocab[index], ...updates };
    saveVocabulary(vocab);
    return true;
}

// 删除单词
function deleteWord(id) {
    const vocab = getVocabulary();
    const filtered = vocab.filter(w => w.id !== id);
    saveVocabulary(filtered);
    updateStatsDisplay();
    return filtered.length < vocab.length;
}

// 标记掌握/未掌握
function toggleMastered(id) {
    const vocab = getVocabulary();
    const word = vocab.find(w => w.id === id);
    if (!word) return false;
    word.mastered = !word.mastered;
    if (word.mastered) {
        word.reviewCount++;
        word.lastReviewed = new Date().toISOString();
    }
    saveVocabulary(vocab);
    updateStatsDisplay();
    return word.mastered;
}

// 按分类获取单词
function getWordsByCategory(category) {
    const vocab = getVocabulary();
    if (!category || category.trim() === '') return vocab;
    return vocab.filter(w => w.category === category);
}

// 搜索单词
function searchWords(query) {
    const vocab = getVocabulary();
    if (!query.trim()) return vocab;
    const q = query.toLowerCase();
    return vocab.filter(w =>
        w.tibetan.toLowerCase().includes(q) ||
        w.meaning.toLowerCase().includes(q) ||
        w.wylie.toLowerCase().includes(q) ||
        w.pronunciation.toLowerCase().includes(q)
    );
}

// 获取分类列表（从所有已录入的单词中收集）
function getCategories() {
    const vocab = getVocabulary();
    return [...new Set(vocab.map(w => w.category).filter(Boolean))];
}

// 动态更新 datalist 中的分类选项
function updateCategoryDatalist() {
    const categories = getCategories();
    const datalist = document.getElementById('category-list');
    if (!datalist) return;
    
    // 保留原有默认值选项
    const defaults = ['日常用语', '数字', '颜色', '家人', '食物', '动词', '形容词', '其他'];
    const all = [...new Set([...defaults, ...categories])];
    
    datalist.innerHTML = all.map(c => `<option value="${escapeHtml(c)}">`).join('');
}

// ===== UI 渲染 =====

function renderWordList() {
    const listEl = document.getElementById('word-list');
    const filterCat = document.getElementById('filter-category').value.trim();
    const searchQuery = document.getElementById('search-words').value;
    
    let words = searchWords(searchQuery);
    if (filterCat) {
        words = words.filter(w => w.category === filterCat);
    }
    
    if (words.length === 0) {
        listEl.innerHTML = `
            <div class="empty-state">
                <span class="empty-icon">📝</span>
                <p>${searchQuery || filterCat ? '未找到匹配的单词' : '还没有录入单词'}</p>
                <p class="empty-sub">${searchQuery || filterCat ? '尝试其他关键词或分类' : '在左侧表单添加你的第一个藏语单词吧'}</p>
            </div>
        `;
        return;
    }
    
    listEl.innerHTML = words.map(word => `
        <div class="word-item" data-id="${word.id}">
            <div class="word-info">
                <div class="word-tibetan">${escapeHtml(word.tibetan)}</div>
                <div class="word-meta">
                    ${word.wylie ? `<span>威利: ${escapeHtml(word.wylie)}</span>` : ''}
                    ${word.pronunciation ? `<span>发音: ${escapeHtml(word.pronunciation)}</span>` : ''}
                    <span class="category-tag">${escapeHtml(word.category)}</span>
                    ${word.mastered ? '<span style="color:#27ae60">✅ 已掌握</span>' : ''}
                </div>
                <div class="word-meaning">${escapeHtml(word.meaning)}</div>
                ${word.example ? `<div class="word-example tibetan-font" style="font-size:0.9rem;color:var(--accent);margin-top:4px;line-height:1.6">${escapeHtml(word.example)}</div>` : ''}
                ${word.exampleMeaning ? `<div style="font-size:0.8rem;color:var(--text-muted);margin-top:2px">${escapeHtml(word.exampleMeaning)}</div>` : ''}
            </div>
            <div class="word-actions">
                <button onclick="editWord('${word.id}')" title="编辑">✏️</button>
                <button onclick="confirmDeleteWord('${word.id}')" title="删除">🗑️</button>
            </div>
        </div>
    `).join('');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 编辑单词
function editWord(id) {
    const vocab = getVocabulary();
    const word = vocab.find(w => w.id === id);
    if (!word) return;
    
    document.getElementById('edit-id').value = word.id;
    document.getElementById('edit-tibetan').value = word.tibetan;
    document.getElementById('edit-wylie').value = word.wylie;
    document.getElementById('edit-pronunciation').value = word.pronunciation;
    document.getElementById('edit-meaning').value = word.meaning;
    document.getElementById('edit-category').value = word.category;
    document.getElementById('edit-example').value = word.example;
    document.getElementById('edit-example-meaning').value = word.exampleMeaning;
    document.getElementById('edit-notes').value = word.notes;
    
    document.getElementById('edit-modal').classList.add('show');
}

function confirmDeleteWord(id) {
    if (!confirm('确定要删除这个单词吗？')) return;
    deleteWord(id);
    renderWordList();
    showToast('单词已删除', 'info');
}

// 初始化单词管理
function initVocabulary() {
    // 表单提交
    document.getElementById('word-form').addEventListener('submit', e => {
        e.preventDefault();
        const wordData = {
            tibetan: document.getElementById('word-tibetan').value,
            wylie: document.getElementById('word-wylie').value,
            pronunciation: document.getElementById('word-pronunciation').value,
            meaning: document.getElementById('word-meaning').value,
            category: document.getElementById('word-category').value,
            example: document.getElementById('word-example').value,
            exampleMeaning: document.getElementById('word-example-meaning').value,
            notes: document.getElementById('word-notes').value
        };
        
        if (!wordData.tibetan.trim() || !wordData.meaning.trim()) {
            showToast('请填写藏语单词和中文翻译', 'error');
            return;
        }
        
        addWord(wordData);
        e.target.reset();
        updateCategoryDatalist();
        renderWordList();
        showToast('单词添加成功！', 'success');
    });
    
    // 清空按钮
    document.getElementById('btn-clear-form').addEventListener('click', () => {
        document.getElementById('word-form').reset();
    });
    
    // 筛选和搜索
    document.getElementById('filter-category').addEventListener('input', renderWordList);
    document.getElementById('search-words').addEventListener('input', renderWordList);
    
    // 初始化 datalist
    updateCategoryDatalist();
    
    // 编辑表单
    document.getElementById('edit-form').addEventListener('submit', e => {
        e.preventDefault();
        const id = document.getElementById('edit-id').value;
        const updates = {
            tibetan: document.getElementById('edit-tibetan').value.trim(),
            wylie: document.getElementById('edit-wylie').value.trim(),
            pronunciation: document.getElementById('edit-pronunciation').value.trim(),
            meaning: document.getElementById('edit-meaning').value.trim(),
            category: document.getElementById('edit-category').value,
            example: document.getElementById('edit-example').value.trim(),
            exampleMeaning: document.getElementById('edit-example-meaning').value.trim(),
            notes: document.getElementById('edit-notes').value.trim()
        };
        
        if (!updates.tibetan || !updates.meaning) {
            showToast('藏语单词和中文翻译不能为空', 'error');
            return;
        }
        
        updateWord(id, updates);
        document.getElementById('edit-modal').classList.remove('show');
        updateCategoryDatalist();
        renderWordList();
        showToast('修改已保存', 'success');
    });
    
    // 关闭模态框
    document.getElementById('btn-close-modal').addEventListener('click', () => {
        document.getElementById('edit-modal').classList.remove('show');
    });
    document.getElementById('btn-cancel-edit').addEventListener('click', () => {
        document.getElementById('edit-modal').classList.remove('show');
    });
    
    // 点击模态框外部关闭
    document.getElementById('edit-modal').addEventListener('click', e => {
        if (e.target === e.currentTarget) {
            document.getElementById('edit-modal').classList.remove('show');
        }
    });
    
    renderWordList();
}

// 更新首页统计
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

// 显示提示消息
function showToast(message, type = 'info') {
    let toast = document.querySelector('.toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.className = 'toast';
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}
