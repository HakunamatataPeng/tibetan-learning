// ===== 主应用入口 =====

// 页面导航
function navigateTo(page) {
    // 隐藏所有页面
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    // 显示目标页面
    const target = document.getElementById('page-' + page);
    if (target) target.classList.add('active');
    
    // 更新导航高亮
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.page === page);
    });
    
    // 页面特定初始化
    if (page === 'home') {
        updateStatsDisplay();
    } else if (page === 'vocabulary') {
        renderWordList();
    } else if (page === 'speaking') {
        renderAudioList();
    }
}

// 初始化应用
function initApp() {
    // 导航菜单点击
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => navigateTo(item.dataset.page));
    });
    
    // 初始化各模块
    if (typeof initVocabulary === 'function') initVocabulary();
    if (typeof initAudio === 'function') initAudio();
    if (typeof initPractice === 'function') initPractice();
    
    // 更新首页统计
    updateStatsDisplay();
    
    // 初始化分类下拉建议
    if (typeof updateCategoryDatalist === 'function') updateCategoryDatalist();
    
    // 检查并更新学习连续天数
    checkStreak();
}

function checkStreak() {
    const stats = getStats();
    const today = new Date().toDateString();
    const last = stats.lastStudyDate;
    
    if (last && last !== today) {
        const lastDate = new Date(last);
        const todayDate = new Date();
        const diffDays = (todayDate - lastDate) / (1000 * 60 * 60 * 24);
        
        if (diffDays >= 2) {
            // 断签
            stats.streak = 0;
            saveStats(stats);
            updateStatsDisplay();
        }
    }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', initApp);

// 兼容函数定义（在其他模块加载后覆盖）
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
    const vocab = typeof getVocabulary === 'function' ? getVocabulary() : [];
    const stats = getStats();
    const mastered = vocab.filter(w => w.mastered).length;
    
    const elTotal = document.getElementById('stat-total-words');
    const elMastered = document.getElementById('stat-mastered');
    const elStreak = document.getElementById('stat-streak');
    
    if (elTotal) elTotal.textContent = vocab.length;
    if (elMastered) elMastered.textContent = mastered;
    if (elStreak) elStreak.textContent = stats.streak || 0;
}

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
