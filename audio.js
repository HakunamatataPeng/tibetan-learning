// ===== 音频文件管理模块 =====
// 使用 IndexedDB 存储音频文件，支持较大的音频数据

const DB_NAME = 'TibetanAudioDB';
const DB_VERSION = 1;
const STORE_NAME = 'audioFiles';

let db = null;

// 打开数据库
function openAudioDB() {
    return new Promise((resolve, reject) => {
        if (db) { resolve(db); return; }
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => { db = request.result; resolve(db); };
        request.onupgradeneeded = e => {
            const database = e.target.result;
            if (!database.objectStoreNames.contains(STORE_NAME)) {
                const store = database.createObjectStore(STORE_NAME, { keyPath: 'id' });
                store.createIndex('name', 'name', { unique: false });
                store.createIndex('createdAt', 'createdAt', { unique: false });
            }
        };
    });
}

// 添加音频文件
async function addAudioFile(file) {
    await openAudioDB();
    const arrayBuffer = await file.arrayBuffer();
    const record = {
        id: 'audio_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        name: file.name,
        type: file.type || 'audio/mpeg',
        size: file.size,
        data: arrayBuffer,
        createdAt: new Date().toISOString()
    };
    
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.add(record);
        req.onsuccess = () => resolve(record);
        req.onerror = () => reject(req.error);
    });
}

// 获取所有音频文件（不含二进制数据，用于列表展示）
async function getAudioList() {
    await openAudioDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.getAll();
        req.onsuccess = () => {
            const items = req.result.map(r => ({
                id: r.id,
                name: r.name,
                type: r.type,
                size: r.size,
                createdAt: r.createdAt
            }));
            resolve(items);
        };
        req.onerror = () => reject(req.error);
    });
}

// 获取单个音频文件（含二进制数据）
async function getAudioFile(id) {
    await openAudioDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(id);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
    });
}

// 删除音频文件
async function deleteAudioFile(id) {
    await openAudioDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.delete(id);
        req.onsuccess = () => resolve(true);
        req.onerror = () => reject(req.error);
    });
}

// 创建 Blob URL
function createAudioURL(record) {
    if (!record || !record.data) return null;
    const blob = new Blob([record.data], { type: record.type });
    return URL.createObjectURL(blob);
}

// 格式化文件大小
function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// ===== UI 渲染 =====

let currentAudioId = null;
let currentAudioURL = null;

async function renderAudioList() {
    const listEl = document.getElementById('audio-list');
    try {
        const files = await getAudioList();
        updateAudioStats(files.length);
        
        if (files.length === 0) {
            listEl.innerHTML = `
                <div class="empty-state small">
                    <span class="empty-icon">🎵</span>
                    <p>暂无录音素材</p>
                    <p class="empty-sub">上传老师的录音开始练习</p>
                </div>
            `;
            return;
        }
        
        listEl.innerHTML = files.map(file => `
            <div class="audio-item ${file.id === currentAudioId ? 'active' : ''}" data-id="${file.id}">
                <span class="audio-icon">🎵</span>
                <div class="audio-info">
                    <div class="audio-name">${escapeHtml(file.name)}</div>
                    <div class="audio-duration">${formatSize(file.size)}</div>
                </div>
                <button class="audio-delete" onclick="event.stopPropagation(); deleteAudio('${file.id}')" title="删除">🗑️</button>
            </div>
        `).join('');
        
        // 绑定点击事件
        listEl.querySelectorAll('.audio-item').forEach(item => {
            item.addEventListener('click', () => selectAudio(item.dataset.id));
        });
    } catch (e) {
        console.error('渲染音频列表失败:', e);
        listEl.innerHTML = `<div class="empty-state small"><p>加载失败</p></div>`;
    }
}

async function selectAudio(id) {
    currentAudioId = id;
    
    // 更新列表高亮
    document.querySelectorAll('.audio-item').forEach(item => {
        item.classList.toggle('active', item.dataset.id === id);
    });
    
    try {
        const record = await getAudioFile(id);
        if (!record) return;
        
        // 释放旧的 URL
        if (currentAudioURL) URL.revokeObjectURL(currentAudioURL);
        currentAudioURL = createAudioURL(record);
        
        const playerEl = document.getElementById('practice-player');
        playerEl.innerHTML = `
            <div class="audio-player-wrapper">
                <div class="now-playing">
                    <span class="now-playing-icon">🎵</span>
                    <div class="now-playing-info">
                        <div class="now-playing-name">${escapeHtml(record.name)}</div>
                        <div class="now-playing-status">准备就绪</div>
                    </div>
                </div>
                <audio id="teacher-audio" controls preload="auto">
                    <source src="${currentAudioURL}" type="${record.type}">
                    您的浏览器不支持音频播放
                </audio>
            </div>
        `;
        
        document.getElementById('practice-exercises').style.display = 'block';
        
        // 绑定音频事件
        const audio = document.getElementById('teacher-audio');
        const statusEl = playerEl.querySelector('.now-playing-status');
        if (audio && statusEl) {
            audio.addEventListener('play', () => { statusEl.textContent = '🔊 播放中'; });
            audio.addEventListener('pause', () => { statusEl.textContent = '⏸️ 已暂停'; });
            audio.addEventListener('ended', () => { statusEl.textContent = '✅ 播放完毕'; });
        }
    } catch (e) {
        console.error('选择音频失败:', e);
        showToast('加载音频失败', 'error');
    }
}

async function deleteAudio(id) {
    if (!confirm('确定删除这个录音文件吗？')) return;
    try {
        await deleteAudioFile(id);
        if (currentAudioId === id) {
            currentAudioId = null;
            if (currentAudioURL) {
                URL.revokeObjectURL(currentAudioURL);
                currentAudioURL = null;
            }
            document.getElementById('practice-player').innerHTML = `
                <div class="player-empty">
                    <span class="empty-icon">🎧</span>
                    <p>请从左侧选择一个录音开始练习</p>
                </div>
            `;
            document.getElementById('practice-exercises').style.display = 'none';
        }
        renderAudioList();
        showToast('录音已删除', 'info');
    } catch (e) {
        console.error('删除音频失败:', e);
        showToast('删除失败', 'error');
    }
}

function updateAudioStats(count) {
    const el = document.getElementById('stat-audio-files');
    if (el) el.textContent = count;
}

// 初始化音频管理
function initAudio() {
    const uploadArea = document.getElementById('upload-area');
    const fileInput = document.getElementById('audio-file-input');
    
    // 点击上传
    uploadArea.addEventListener('click', () => fileInput.click());
    
    // 文件选择
    fileInput.addEventListener('change', async e => {
        const files = Array.from(e.target.files);
        if (!files.length) return;
        
        let success = 0;
        for (const file of files) {
            if (!file.type.startsWith('audio/')) {
                showToast(`跳过非音频文件: ${file.name}`, 'error');
                continue;
            }
            try {
                await addAudioFile(file);
                success++;
            } catch (err) {
                showToast(`上传失败: ${file.name}`, 'error');
            }
        }
        
        if (success > 0) {
            showToast(`成功上传 ${success} 个录音文件`, 'success');
            renderAudioList();
        }
        fileInput.value = '';
    });
    
    // 拖拽上传
    uploadArea.addEventListener('dragover', e => {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    });
    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('dragover');
    });
    uploadArea.addEventListener('drop', async e => {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
        
        const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('audio/'));
        if (!files.length) {
            showToast('请拖拽音频文件', 'error');
            return;
        }
        
        let success = 0;
        for (const file of files) {
            try {
                await addAudioFile(file);
                success++;
            } catch (err) {
                showToast(`上传失败: ${file.name}`, 'error');
            }
        }
        
        if (success > 0) {
            showToast(`成功上传 ${success} 个录音文件`, 'success');
            renderAudioList();
        }
    });
    
    // 练习标签切换
    document.querySelectorAll('.exercise-tabs .tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.exercise-tabs .tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
        });
    });
    
    // 循环播放按钮
    document.getElementById('btn-loop').addEventListener('click', () => {
        const audio = document.getElementById('teacher-audio');
        if (!audio) return;
        audio.loop = !audio.loop;
        showToast(audio.loop ? '已开启循环播放' : '已关闭循环播放', 'info');
    });
    
    // 慢速播放按钮
    document.getElementById('btn-slow').addEventListener('click', () => {
        const audio = document.getElementById('teacher-audio');
        if (!audio) return;
        audio.playbackRate = audio.playbackRate === 0.7 ? 1.0 : 0.7;
        showToast(audio.playbackRate === 0.7 ? '已切换至慢速播放 (0.7x)' : '已恢复正常速度', 'info');
    });
    
    // 设置暂停间隔（影子跟读辅助）
    let shadowInterval = null;
    document.getElementById('btn-pause-delay').addEventListener('click', () => {
        const audio = document.getElementById('teacher-audio');
        if (!audio) return;
        
        if (shadowInterval) {
            clearInterval(shadowInterval);
            shadowInterval = null;
            showToast('已关闭暂停间隔', 'info');
            return;
        }
        
        showToast('开启暂停间隔：每3秒自动暂停，给你跟读时间', 'info');
        let playTime = 3000;
        let pauseTime = 3000;
        
        function shadowLoop() {
            if (!audio) return;
            audio.play();
            setTimeout(() => {
                if (audio) audio.pause();
                setTimeout(() => shadowLoop(), pauseTime);
            }, playTime);
        }
        
        shadowLoop();
        shadowInterval = { clear: () => {} }; // 简化标记
    });
    
    // 录音功能
    let mediaRecorder = null;
    let recordedChunks = [];
    let userRecordingURL = null;
    
    document.getElementById('btn-start-record').addEventListener('click', async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            recordedChunks = [];
            
            mediaRecorder.ondataavailable = e => {
                if (e.data.size > 0) recordedChunks.push(e.data);
            };
            
            mediaRecorder.onstop = () => {
                const blob = new Blob(recordedChunks, { type: 'audio/webm' });
                if (userRecordingURL) URL.revokeObjectURL(userRecordingURL);
                userRecordingURL = URL.createObjectURL(blob);
                
                document.getElementById('user-recording').style.display = 'block';
                document.getElementById('user-audio').src = userRecordingURL;
                
                // 停止所有轨道
                stream.getTracks().forEach(track => track.stop());
            };
            
            mediaRecorder.start();
            document.getElementById('btn-start-record').disabled = true;
            document.getElementById('btn-stop-record').disabled = false;
            showToast('开始录音...', 'info');
        } catch (e) {
            showToast('无法访问麦克风，请检查权限', 'error');
        }
    });
    
    document.getElementById('btn-stop-record').addEventListener('click', () => {
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
            document.getElementById('btn-start-record').disabled = false;
            document.getElementById('btn-stop-record').disabled = true;
            showToast('录音已保存，请对比播放', 'success');
        }
    });
    
    renderAudioList();
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
