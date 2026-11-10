/* ========================================
   梦角传讯 - 核心逻辑
   数据存储: IndexedDB (业务数据与图片统一存放, 不依赖 localStorage)
   架构: SPA 单页应用 + 状态管理
   ======================================== */

(function () {
    'use strict';

    // ================= 常量 =================
    const STATE_STORE = 'appdata';                     // IndexedDB 中业务数据的仓库名
    const APP_DATA_KEY = 'main';                       // 业务数据在仓库中的 key
    const DEFAULT_BGS = [
        { name: '樱粉', value: 'linear-gradient(135deg, rgba(255,215,213,0.65), rgba(255,238,182,0.4), rgba(175,220,241,0.35))' },
        { name: '暖黄', value: 'linear-gradient(135deg, rgba(255,238,182,0.6), rgba(255,215,213,0.5), rgba(255,245,220,0.5))' },
        { name: '淡蓝', value: 'linear-gradient(135deg, rgba(175,220,241,0.55), rgba(255,215,213,0.4), rgba(255,238,182,0.35))' },
        { name: '柔紫', value: 'linear-gradient(135deg, rgba(230,200,230,0.55), rgba(255,215,213,0.45), rgba(200,220,250,0.4))' }
    ];

    // 气泡样式预设
    const DEFAULT_BUBBLE_COLORS = [
        { name: '樱粉', value: '#ffb6bd' },
        { name: '淡蓝', value: '#a8d8f0' },
        { name: '嫩绿', value: '#b8e6c1' },
        { name: '柔紫', value: '#d9c2f0' },
        { name: '暖黄', value: '#ffe5a8' },
        { name: '纯白', value: '#ffffff' }
    ];
    const DEFAULT_BUBBLE_SHAPES = [
        { name: '大圆角', value: '20px' },
        { name: '中圆角', value: '12px' },
        { name: '小圆角', value: '6px' },
        { name: '直角', value: '0px' }
    ];
    const DEFAULT_BUBBLE_EFFECTS = [
        { name: '毛玻璃', value: 'glass' },
        { name: '纯色', value: 'solid' }
    ];
    const DEFAULT_BUBBLE_STYLE = {
        sent: { color: '#ffb6bd', shape: '20px', effect: 'solid' },
        received: { color: '#ffffff', shape: '20px', effect: 'glass' }
    };

    // 预设通用表情 (使用 emoji 作为默认表情集, 后续可支持图片自定义)
    const DEFAULT_EMOJIS = [
        '😀','😊','🥰','😍','😘','😗','😙','😚','😋','😛',
        '😜','🤪','😝','🤑','🤗','🤭','🤫','🤔','🤐','😐',
        '😑','😶','😏','😒','🙄','😬','🤥','😌','😔','😪',
        '🤤','😴','😷','🤒','🤕','🤢','🤮','🤧','🥵','🥶',
        '😵','🤯','🤠','🥳','😎','🤓','🧐','😕','😟','🙁',
        '☹️','😮','😯','😲','😳','🥺','😦','😧','😨','😰',
        '😥','😢','😭','😱','😖','😣','😞','😓','😩','😫',
        '🥱','😤','😡','😠','🤬','😈','👿','💀','☠️','💩',
        '🤡','👹','👺','👻','👽','👾','🤖','😺','😸','😹',
        '😻','😼','😽','🙀','😿','😾','❤️','🧡','💛','💚',
        '💙','💜','🖤','🤍','💔','❣️','💕','💞','💓','💗',
        '💖','💘','💝','💟','👍','👎','👊','✊','🤛','🤜',
        '🤞','✌️','🤟','🤘','👌','🤌','🤏','👈','👉','👆',
        '👇','☝️','✋','🤚','🖐️','🖖','👋','🤙','💪','🦾',
        '🙏','✨','⭐','🌟','💫','🔥','💧','🌈','☀️','🌙'
    ];

    // ================= 消息音效预设 (内置音频文件) =================
    const SOUND_PRESETS = [
        { id: 'jiangjiang', name: '将将~', src: 'sounds/将将~.MP3' },
        { id: 'binggo',     name: 'binggo', src: 'sounds/binggo.MP3' },
        { id: 'duang',      name: 'duang',  src: 'sounds/duang.MP3' },
        { id: 'kakao',      name: 'kakao',  src: 'sounds/kakao.MP3' }
    ];
    const __soundAudios = {};
    function playSound(soundId) {
        if (!soundId) return;
        const preset = SOUND_PRESETS.find(p => p.id === soundId);
        if (!preset) return;
        try {
            let audio = __soundAudios[preset.id];
            if (!audio) {
                audio = new Audio(encodeURI(preset.src));
                __soundAudios[preset.id] = audio;
            }
            audio.currentTime = 0;
            const p = audio.play();
            if (p && p.catch) p.catch(() => {});
        } catch (e) {}
    }

    // ================= 状态数据结构 =================
    /**
     * Data 结构:
     * {
     *   contacts: [{
     *     id: string,
     *     nickname: string,
     *     signature: string,
     *     avatar: string (base64/svg/默认渐变),
     *     createdAt: number,
     *     settings: {
     *       replyMin: number (秒),
     *       replyMax: number (秒),
     *       autoSend: boolean,
     *       autoInterval: number (分钟),
     *       chatBg: string (CSS背景值),
     *       wordcards: [{ keyword: string, reply: string }],
     *       emojis: string[] (专属表情库 - emoji 或 img base64),
     *       soundEnabled: boolean (消息音效总开关),
     *       userMsgSound: string (用户发送消息音效 id),
     *       otherMsgSound: string (梦角发送消息音效 id)
     *     },
     *     messages: [{
     *       id: string,
     *       from: 'me' | 'other',
     *       type: 'text' | 'image' | 'emoji' | 'wordcard',
     *       content: string,
     *       timestamp: number
     *     }],
     *     unread: number,
     *     lastAutoSend: number (时间戳, 用于主动消息)
     *   }],
     *   commonEmojis: string[] (通用表情库)
     * }
     */

    const state = {
        contacts: [],
        commonEmojis: [...DEFAULT_EMOJIS],
        surveys: [], // 问卷列表
        letters: [], // 寄出的信列表
        receivedLetters: [], // 收到的回信列表
        hisLetters: [], // 他的来信列表
        hisLetterSchedule: { date: '', entries: [] }, // 每日来信调度
        momentSchedules: [], // 朋友圈互动调度 (点赞/评论/回复)
        momentBadge: 0, // 发现页朋友圈卡片未读角标计数
        myReplyLetters: [], // 我的回信列表（回复他的来信）
        currentContactId: null,
        timers: {}, // { contactId: { replyTimer, autoTimer } }
        tempNewAvatar: null,
        tempNewGroupAvatar: null, // 新建群聊的临时头像
        tempEditAvatar: null,
        tempMeAvatar: null,
        me: null,
        editingWordcardIndex: -1,
        emojiTab: 'common',
        emojiCropTarget: 'stickers', // 裁剪弹窗保存目标: 'stickers'(字卡表情库) 或 'emojis'(专属表情)
        emojiPanelKeepOpenUntil: 0, // 表情面板保持展开的截止时间戳 (文件选择器关闭后防误关)
        wcBatchGroupId: '', // 批量添加/编辑字卡时选中的分组ID
        wcSearchKeyword: '', // 字卡搜索关键词
        wcBatchMode: false, // 批量管理模式
        wcSelectedCardIds: new Set(), // 批量选中的字卡ID
        groupMemberSelected: new Set(), // 新建群聊弹窗已选成员ID
        groupInviteSelected: new Set(), // 邀请新成员弹窗已选成员ID
        gsRemoveMode: false, // 群聊设置页移除模式
        gsRemoveSelected: new Set(), // 群聊设置页移除已选成员ID
        gmRemoveMode: false, // 群聊成员页移除模式
        gmRemoveSelected: new Set(), // 群聊成员页移除已选成员ID
        wcBatchGroupMode: false, // 批量分组模式标记
        wcStickerBatchMode: false, // 表情库批量管理模式
        wcSelectedStickerIds: new Set(), // 批量选中的表情ID
        wcMomentImageBatchMode: false, // 图片库批量管理模式
        wcSelectedMomentImageIds: new Set(), // 批量选中的图片ID
        // 互动: 拍一拍 / 对方状态
        wcInteractionTab: 'pat', // 当前互动子标签
        wcPatSearchKeyword: '',
        wcStatusSearchKeyword: '',
        wcVoiceSearchKeyword: '',
        wcConfessionSearchKeyword: '',
        wcPatFilterGroupId: '',
        wcStatusFilterGroupId: '',
        wcVoiceFilterGroupId: '',
        wcConfessionFilterGroupId: '',
        // 语音条批量管理
        wcVoiceBatchMode: false,
        wcVoiceSelectedIds: new Set(),
        momentsEditImages: [],
        momentsEditImageViewerIndex: 0,
        moments: [],
        remindSelectedIds: new Set(),
        remindSearchKeyword: '',
        visibleSelection: 'public',
        visiblePartialIds: new Set(),
        visibleExcludeIds: new Set()
    };

    // ================= 工具函数 =================
    function uuid() {
        return 'id_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 9);
    }
    function $(id) { return document.getElementById(id); }
    function $$(sel, root = document) { return Array.from(root.querySelectorAll(sel)); }
    function formatTime(ts) {
        const d = new Date(ts);
        const now = new Date();
        const isToday = d.toDateString() === now.toDateString();
        const hh = String(d.getHours()).padStart(2, '0');
        const mm = String(d.getMinutes()).padStart(2, '0');
        if (isToday) return `${hh}:${mm}`;
        const diffDays = Math.floor((now - d) / (1000 * 60 * 60 * 24));
        if (diffDays === 1) return '昨天';
        if (diffDays < 7) return ['周日','周一','周二','周三','周四','周五','周六'][d.getDay()];
        return `${d.getMonth() + 1}/${d.getDate()}`;
    }
    function formatChatTime(ts) {
        const d = new Date(ts);
        const now = new Date();
        const isToday = d.toDateString() === now.toDateString();
        const hh = String(d.getHours()).padStart(2, '0');
        const mm = String(d.getMinutes()).padStart(2, '0');
        if (isToday) return `${hh}:${mm}`;
        const M = d.getMonth() + 1;
        const D = d.getDate();
        const sameYear = d.getFullYear() === now.getFullYear();
        if (sameYear) return `${M}/${D} ${hh}:${mm}`;
        return `${d.getFullYear()}/${M}/${D} ${hh}:${mm}`;
    }
    function formatLetterTime(ts) {
        const d = new Date(ts);
        const now = new Date();
        const hh = String(d.getHours()).padStart(2, '0');
        const mm = String(d.getMinutes()).padStart(2, '0');
        const M = d.getMonth() + 1;
        const D = d.getDate();
        const sameYear = d.getFullYear() === now.getFullYear();
        if (sameYear) return `${M}/${D} ${hh}:${mm}`;
        return `${d.getFullYear()}/${M}/${D} ${hh}:${mm}`;
    }
    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
    function fileToBase64(file) {
        return new Promise((resolve, reject) => {
            if (!file) return resolve(null);
            const reader = new FileReader();
            reader.onload = e => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    // ================= 数据持久化 =================
    // ================= IndexedDB 存储 =================
    // 业务数据与图片统一存放在 IndexedDB: 业务数据中只保存 idb: 图片引用,
    // 避免重复存储并减轻主线程压力; 不再使用 localStorage 作为存储位置
    const IMG_DB_NAME = 'dream_corner_imgs'; // 保留原库名, 兼容已有的图片数据
    const DB_VERSION = 2;
    const IMG_STORE = 'images';
    let _imgDB = null;
    const _imgIdCache = new Map(); // base64 -> id (本 session 缓存, 避免重复 hash/写库)
    function imgDBOpen() {
        if (_imgDB) return Promise.resolve(_imgDB);
        return new Promise((resolve, reject) => {
            const req = indexedDB.open(IMG_DB_NAME, DB_VERSION);
            req.onupgradeneeded = e => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(IMG_STORE)) db.createObjectStore(IMG_STORE);
                if (!db.objectStoreNames.contains(STATE_STORE)) db.createObjectStore(STATE_STORE);
            };
            req.onsuccess = e => {
                _imgDB = e.target.result;
                // 结构升级时释放旧连接, 避免阻塞其他标签页的版本升级
                _imgDB.onversionchange = () => { _imgDB.close(); _imgDB = null; };
                resolve(_imgDB);
            };
            req.onerror = () => reject(req.error);
        });
    }
    // 追踪尚未完成的图片写入 (导出前等待完成, 避免备份里引用到还没落库的图片)
    const _imgPendingWrites = new Set();
    function imgDBPut(id, dataUrl) {
        const p = imgDBOpen().then(db => new Promise(resolve => {
            const tx = db.transaction(IMG_STORE, 'readwrite');
            tx.objectStore(IMG_STORE).put(dataUrl, id);
            tx.oncomplete = () => resolve();
            tx.onerror = () => { console.warn('图片写入IndexedDB失败:', tx.error); resolve(); };
        })).catch(e => console.warn('IndexedDB打开失败:', e));
        _imgPendingWrites.add(p);
        p.then(() => _imgPendingWrites.delete(p), () => _imgPendingWrites.delete(p));
        return p;
    }
    function imgDBGetMany(ids) {
        return imgDBOpen().then(db => new Promise(resolve => {
            const tx = db.transaction(IMG_STORE, 'readonly');
            const store = tx.objectStore(IMG_STORE);
            const result = {};
            ids.forEach(id => {
                const req = store.get(id);
                req.onsuccess = () => { if (req.result) result[id] = req.result; };
            });
            tx.oncomplete = () => resolve(result);
            tx.onerror = () => { console.warn('图片读取失败:', tx.error); resolve(result); };
        })).catch(e => { console.warn('IndexedDB打开失败:', e); return {}; });
    }
    function imgDBClear() {
        return imgDBOpen().then(db => new Promise(resolve => {
            const tx = db.transaction(IMG_STORE, 'readwrite');
            tx.objectStore(IMG_STORE).clear();
            tx.oncomplete = () => resolve();
            tx.onerror = () => resolve();
        })).catch(() => {});
    }
    // 业务数据读取 (IndexedDB)
    function appDBGet(key) {
        return imgDBOpen().then(db => new Promise(resolve => {
            const tx = db.transaction(STATE_STORE, 'readonly');
            const req = tx.objectStore(STATE_STORE).get(key);
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => resolve(null);
            tx.onerror = () => resolve(null);
        })).catch(() => null);
    }
    // 业务数据写入 (IndexedDB)
    function appDBPut(key, value) {
        return imgDBOpen().then(db => new Promise((resolve, reject) => {
            const tx = db.transaction(STATE_STORE, 'readwrite');
            tx.objectStore(STATE_STORE).put(value, key);
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => reject(tx.error || new Error('写入失败'));
            tx.onabort = () => reject(tx.error || new Error('写入被中断'));
        }));
    }
    // 由图片内容生成稳定 id (同内容同 id, 写库幂等, 避免产生重复记录)
    function _imgIdOf(dataUrl) {
        const s = dataUrl.length + '|' + dataUrl.slice(0, 2048) + '|' + dataUrl.slice(-2048);
        let h1 = 5381, h2 = 52711;
        for (let i = 0; i < s.length; i++) {
            const c = s.charCodeAt(i);
            h1 = ((h1 << 5) + h1 + c) | 0;
            h2 = ((h2 << 5) + h2 + c) | 0;
        }
        return 'img_' + (h1 >>> 0).toString(36) + (h2 >>> 0).toString(36) + '_' + dataUrl.length.toString(36);
    }
    // 将 base64 图片写入 IndexedDB 并返回 idb: 引用 (同内容同一 id, 写库幂等)
    function _idbRefOf(dataUrl) {
        let id = _imgIdCache.get(dataUrl);
        if (!id) {
            id = _imgIdOf(dataUrl);
            _imgIdCache.set(dataUrl, id);
            imgDBPut(id, dataUrl);
        }
        return 'idb:' + id;
    }
    // 匹配 CSS 值里内嵌的 base64 图片/语音 (如 url("data:image/png;base64,...")) 与 idb 引用
    const _DATA_IMG_RE = /data:(?:image|audio)\/[^"')\s]+/g;
    const _IDB_REF_RE = /idb:img_[A-Za-z0-9_]+/g;
    // 递归构建精简副本: base64 图片替换为 idb: 引用并异步写入 IndexedDB (不改动原 state)
    function _extractImages(node) {
        if (typeof node === 'string') {
            // 图片与语音统一抽离到 IndexedDB (语音 base64 同样体积巨大)
            if (node.startsWith('data:image/') || node.startsWith('data:audio/')) return _idbRefOf(node);
            // 聊天背景等 CSS 值里的图片也要抽离, 否则会整段原样存储/导出, 备份体积成倍膨胀
            if (node.indexOf('data:image/') > -1 || node.indexOf('data:audio/') > -1) {
                return node.replace(_DATA_IMG_RE, m => _idbRefOf(m));
            }
            return node;
        }
        if (Array.isArray(node)) return node.map(_extractImages);
        if (node && typeof node === 'object') {
            const o = {};
            for (const k in node) o[k] = _extractImages(node[k]);
            return o;
        }
        return node;
    }
    // 收集对象树中的 idb: 图片引用 (包含 CSS 值里内嵌的引用)
    function _collectIdbRefs(node, out) {
        if (typeof node === 'string') {
            if (node.indexOf('idb:img_') === -1) return;
            const m = node.match(_IDB_REF_RE);
            if (m) m.forEach(s => out.add(s.slice(4)));
            return;
        }
        if (Array.isArray(node)) { node.forEach(n => _collectIdbRefs(n, out)); return; }
        if (node && typeof node === 'object') { for (const k in node) _collectIdbRefs(node[k], out); }
    }
    // 水合: 将 idb: 引用替换回 base64 (就地回填, 渲染层无需改动)
    function _hydrateImages(node, imgMap) {
        if (typeof node === 'string') {
            if (node.indexOf('idb:img_') === -1) return node;
            return node.replace(_IDB_REF_RE, m => imgMap[m.slice(4)] || '');
        }
        if (Array.isArray(node)) { for (let i = 0; i < node.length; i++) node[i] = _hydrateImages(node[i], imgMap); return node; }
        if (node && typeof node === 'object') { for (const k in node) node[k] = _hydrateImages(node[k], imgMap); return node; }
        return node;
    }
    // 实际写入函数 (防抖调度的目标)
    async function _saveDataNow() {
        try {
            const data = {
                contacts: state.contacts,
                commonEmojis: state.commonEmojis,
                surveys: state.surveys,
                letters: state.letters,
                receivedLetters: state.receivedLetters,
                hisLetters: state.hisLetters,
                hisLetterSchedule: state.hisLetterSchedule,
                momentSchedules: state.momentSchedules,
                momentBadge: state.momentBadge,
                myReplyLetters: state.myReplyLetters,
                me: state.me
            };
            // 图片抽离到 IndexedDB, 业务数据中仅保留 idb: 引用, 一并写入 IndexedDB
            const slim = _extractImages(data);
            await appDBPut(APP_DATA_KEY, slim);
            return true;
        } catch (e) {
            console.error('保存失败:', e);
            showSimpleToast('数据保存失败, 请检查浏览器存储空间与权限', 'error');
            return false;
        }
    }
    // 防抖合并: 300ms 内的连续调用合并为一次实际写入, 避免频繁全量序列化造成卡顿
    let _saveTimer = null;
    function saveData() {
        if (_saveTimer) return true;
        _saveTimer = setTimeout(() => {
            _saveTimer = null;
            _saveDataNow();
        }, 300);
        return true;
    }
    // 页面关闭/隐藏前立即写入, 防止防抖窗口内的数据丢失
    window.addEventListener('pagehide', () => {
        if (_saveTimer) { clearTimeout(_saveTimer); _saveTimer = null; _saveDataNow(); }
    });
    // 移动端切后台/被系统冻结前也立即落库 (IndexedDB 写入是异步的, 提前触发更可靠)
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden' && _saveTimer) {
            clearTimeout(_saveTimer); _saveTimer = null; _saveDataNow();
        }
    });
    async function loadData() {
        try {
            // IndexedDB 是唯一存储位置
            const data = await appDBGet(APP_DATA_KEY);
            if (!data) return;
            // 从 IndexedDB 水合图片 (idb: 引用 -> base64)
            const refs = new Set();
            _collectIdbRefs(data, refs);
            if (refs.size > 0) {
                const imgMap = await imgDBGetMany([...refs]);
                _hydrateImages(data, imgMap);
            }
            state.contacts = data.contacts || [];
            state.commonEmojis = data.commonEmojis && data.commonEmojis.length > 0 ? data.commonEmojis : [...DEFAULT_EMOJIS];
            state.surveys = data.surveys || [];
            state.letters = data.letters || [];
            state.receivedLetters = data.receivedLetters || [];
            state.hisLetters = data.hisLetters || [];
            state.hisLetterSchedule = data.hisLetterSchedule || { date: '', entries: [] };
            state.momentSchedules = data.momentSchedules || [];
            state.momentBadge = data.momentBadge || 0;
            state.myReplyLetters = data.myReplyLetters || [];
            state.me = data.me || null;
            // 迁移旧版 state.moments 到 state.me.moments
            if (data.moments && data.moments.length > 0) {
                if (!state.me.moments) state.me.moments = [];
                state.me.moments = data.moments.concat(state.me.moments);
            }
            if (!state.me.moments) state.me.moments = [];
        } catch (e) {
            console.error('加载失败:', e);
        }
    }
    // 移动端下载兼容: 移动端浏览器下载文件是异步过程, 立即 revokeObjectURL 会导致
    // 文件为空或下载失败(桌面 Chrome 同步处理所以无感); 大文件下载耗时不可预估,
    // 固定倒计时释放仍可能把下载切断造成文件截断, 因此下载 URL 一直保留到页面关闭才释放
    const _pendingDownloadUrls = [];
    window.addEventListener('pagehide', () => {
        _pendingDownloadUrls.forEach(u => URL.revokeObjectURL(u));
        _pendingDownloadUrls.length = 0;
    });
    function triggerFileDownload(blob, filename) {
        const url = URL.createObjectURL(blob);
        _pendingDownloadUrls.push(url);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        if (a.parentNode) a.parentNode.removeChild(a);
    }
    // 微信/QQ/钉钉等内置浏览器禁止下载文件, 需引导用户到系统浏览器打开
    function isInAppBrowser() {
        const ua = (navigator.userAgent || '').toLowerCase();
        if (ua.indexOf('micromessenger') > -1) return true;
        if (ua.indexOf('dingtalk') > -1) return true;
        if (ua.indexOf('qq/') > -1 && ua.indexOf('mqqbrowser') === -1) return true;
        return false;
    }
    // ===== 大数据导出/导入辅助 =====
    // 让出主线程, 避免移动端在整理几十 MB 数据时界面长时间无响应
    function _yieldToUI() {
        return new Promise(resolve => setTimeout(resolve, 0));
    }
    // 分批从 IndexedDB 读取图片, 边读边交给调用方, 避免一次性把所有 base64 读进内存
    async function _forEachIdbImage(ids, onImage) {
        for (let i = 0; i < ids.length; i += 20) {
            const batch = ids.slice(i, i + 20);
            const map = await imgDBGetMany(batch);
            for (const id of batch) {
                if (map[id]) onImage(id, map[id]);
            }
            if (i + 20 < ids.length) await _yieldToUI();
        }
    }
    // ===== ZIP 读写 (STORE 无压缩, 纯 JS 实现; 图片/语音本身已是压缩格式, 再压缩无意义) =====
    // 备份结构: data.json (业务数据, 媒体仅为 idb: 引用, 体积很小) + images/<id>.<ext> (原始二进制)
    const _ZIP_ENCODER = new TextEncoder();
    const _ZIP_DECODER = new TextDecoder();
    function _strToBytes(s) { return _ZIP_ENCODER.encode(s); }
    // base64 dataURL -> 原始字节
    function _dataUrlToBytes(dataUrl) {
        const comma = dataUrl.indexOf(',');
        if (comma === -1) return _strToBytes(dataUrl);
        const payload = dataUrl.slice(comma + 1);
        if (dataUrl.slice(0, comma).indexOf(';base64') === -1) {
            try { return _strToBytes(decodeURIComponent(payload)); } catch (e) { return _strToBytes(payload); }
        }
        const bin = atob(payload);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        return bytes;
    }
    // 常见媒体 MIME <-> 扩展名 (ZIP 条目名带扩展名, 导入时据此还原 dataURL 的 MIME)
    const _MIME_EXT = {
        'image/jpeg': '.jpg', 'image/png': '.png', 'image/gif': '.gif', 'image/webp': '.webp',
        'image/svg+xml': '.svg', 'image/bmp': '.bmp', 'image/x-icon': '.ico',
        'audio/mpeg': '.mp3', 'audio/wav': '.wav', 'audio/ogg': '.ogg', 'audio/webm': '.weba',
        'audio/mp4': '.m4a', 'audio/aac': '.aac'
    };
    const _EXT_MIME = {};
    for (const _mime in _MIME_EXT) _EXT_MIME[_MIME_EXT[_mime]] = _mime;
    function _extOfDataUrl(dataUrl) {
        const m = /^data:([^;,]+)/.exec(dataUrl);
        return (m && _MIME_EXT[m[1]]) || '.bin';
    }
    // CRC32 校验 (ZIP 格式必需)
    const _CRC_TABLE = (() => {
        const t = new Uint32Array(256);
        for (let n = 0; n < 256; n++) {
            let c = n;
            for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
            t[n] = c >>> 0;
        }
        return t;
    })();
    function _crc32(bytes) {
        let crc = 0xFFFFFFFF;
        for (let i = 0; i < bytes.length; i++) crc = _CRC_TABLE[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
        return (crc ^ 0xFFFFFFFF) >>> 0;
    }
    // ZIP 写入器: add(name, bytes) 逐条追加, finish() 输出完整 Blob
    function _zipWriter() {
        const chunks = [];
        const central = [];
        let offset = 0;
        const now = new Date();
        const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
        const dosDate = (((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()) & 0xFFFF;
        return {
            add(name, bytes) {
                const nameBytes = _strToBytes(name);
                const crc = _crc32(bytes);
                const h = new DataView(new ArrayBuffer(30));
                h.setUint32(0, 0x04034b50, true);
                h.setUint16(4, 20, true);
                h.setUint16(6, 0x0800, true);  // 文件名按 UTF-8 编码
                h.setUint16(8, 0, true);       // STORE 无压缩
                h.setUint16(10, dosTime, true);
                h.setUint16(12, dosDate, true);
                h.setUint32(14, crc, true);
                h.setUint32(18, bytes.length, true);
                h.setUint32(22, bytes.length, true);
                h.setUint16(26, nameBytes.length, true);
                h.setUint16(28, 0, true);
                chunks.push(h.buffer, nameBytes, bytes);
                central.push({ nameBytes, crc, size: bytes.length, offset });
                offset += 30 + nameBytes.length + bytes.length;
            },
            finish() {
                const cdOffset = offset;
                const cdParts = [];
                let cdSize = 0;
                for (const e of central) {
                    const c = new DataView(new ArrayBuffer(46));
                    c.setUint32(0, 0x02014b50, true);
                    c.setUint16(4, 20, true);
                    c.setUint16(6, 20, true);
                    c.setUint16(8, 0x0800, true);
                    c.setUint16(10, 0, true);
                    c.setUint16(12, dosTime, true);
                    c.setUint16(14, dosDate, true);
                    c.setUint32(16, e.crc, true);
                    c.setUint32(20, e.size, true);
                    c.setUint32(24, e.size, true);
                    c.setUint16(28, e.nameBytes.length, true);
                    c.setUint32(42, e.offset, true);
                    cdParts.push(c.buffer, e.nameBytes);
                    cdSize += 46 + e.nameBytes.length;
                }
                if (cdOffset + cdSize + 22 > 0xFFFFFFFF) throw new Error('备份超出 ZIP 格式大小上限(4GB)');
                const eocd = new DataView(new ArrayBuffer(22));
                eocd.setUint32(0, 0x06054b50, true);
                eocd.setUint16(8, central.length, true);
                eocd.setUint16(10, central.length, true);
                eocd.setUint32(12, cdSize, true);
                eocd.setUint32(16, cdOffset, true);
                return new Blob(chunks.concat(cdParts, [eocd.buffer]), { type: 'application/zip' });
            }
        };
    }
    // 读取 ZIP 中央目录, 返回 [{name, method, size, offset}]; offset 为条目数据的起点
    async function _zipListEntries(file) {
        const tailSize = Math.min(file.size, 66000);
        const tail = new Uint8Array(await file.slice(file.size - tailSize, file.size).arrayBuffer());
        let eocdPos = -1;
        for (let i = tail.length - 22; i >= 0; i--) {
            if (tail[i] === 0x50 && tail[i + 1] === 0x4b && tail[i + 2] === 0x05 && tail[i + 3] === 0x06) { eocdPos = i; break; }
        }
        if (eocdPos < 0) throw new Error('不是有效的 ZIP 备份文件');
        const dv = new DataView(tail.buffer, tail.byteOffset, tail.length);
        const count = dv.getUint16(eocdPos + 10, true);
        const cdSize = dv.getUint32(eocdPos + 12, true);
        const cdOffset = dv.getUint32(eocdPos + 16, true);
        const cd = new Uint8Array(await file.slice(cdOffset, cdOffset + cdSize).arrayBuffer());
        const cdv = new DataView(cd.buffer);
        const entries = [];
        let p = 0;
        for (let i = 0; i < count; i++) {
            if (p + 46 > cd.length || cdv.getUint32(p, true) !== 0x02014b50) throw new Error('备份文件目录损坏');
            const method = cdv.getUint16(p + 10, true);
            const size = cdv.getUint32(p + 20, true);
            const nameLen = cdv.getUint16(p + 28, true);
            const extraLen = cdv.getUint16(p + 30, true);
            const commentLen = cdv.getUint16(p + 32, true);
            const localOffset = cdv.getUint32(p + 42, true);
            const name = _ZIP_DECODER.decode(cd.subarray(p + 46, p + 46 + nameLen));
            // 本网站生成的备份 local header 无 extra 字段, 数据偏移可直接计算
            entries.push({ name, method, size, offset: localOffset + 30 + nameLen });
            p += 46 + nameLen + extraLen + commentLen;
        }
        return entries;
    }
    function _blobToDataUrl(blob) {
        return new Promise((resolve, reject) => {
            const r = new FileReader();
            r.onload = () => resolve(r.result);
            r.onerror = () => reject(r.error || new Error('读取失败'));
            r.readAsDataURL(blob);
        });
    }
    let _isExporting = false;
    async function exportData() {
        if (isInAppBrowser()) {
            showSimpleToast('微信/QQ 内无法下载文件，请点右上角「···」选择「在浏览器打开」后重试', 'error');
            return;
        }
        if (_isExporting) return;
        _isExporting = true;
        try {
            showSimpleToast('正在整理导出数据...');
            await _yieldToUI();
            const otherKeys = ['commonEmojis', 'surveys', 'letters', 'receivedLetters', 'hisLetters', 'hisLetterSchedule', 'momentSchedules', 'momentBadge', 'myReplyLetters', 'me'];
            const src = {
                commonEmojis: state.commonEmojis,
                surveys: state.surveys,
                letters: state.letters,
                receivedLetters: state.receivedLetters,
                hisLetters: state.hisLetters,
                hisLetterSchedule: state.hisLetterSchedule,
                momentSchedules: state.momentSchedules,
                momentBadge: state.momentBadge,
                myReplyLetters: state.myReplyLetters,
                me: state.me
            };
            // 与本地存储使用同一套策略: base64 图片先替换为 idb: 引用, 不把原图重复塞进备份
            const slim = { contacts: [] };
            for (let i = 0; i < state.contacts.length; i++) {
                slim.contacts.push(_extractImages(state.contacts[i]));
                if (i + 1 < state.contacts.length) {
                    showSimpleToast(`正在整理数据 (${i + 1}/${state.contacts.length})...`);
                    await _yieldToUI();
                }
            }
            for (const key of otherKeys) {
                slim[key] = _extractImages(src[key]);
                await _yieldToUI();
            }
            // 等待刚产生的图片真正写入 IndexedDB, 保证备份里的引用都能取到内容
            if (_imgPendingWrites.size > 0) {
                showSimpleToast('正在准备图片数据...');
                await Promise.all([..._imgPendingWrites]);
            }
            const refs = new Set();
            _collectIdbRefs(slim, refs);
            const ids = [...refs];
            // 打包为 ZIP (STORE 无压缩): data.json 中的图片/语音只是 idb: 引用, 体积很小;
            // 媒体内容以原始二进制作为 ZIP 独立条目存储, 整体比 base64 JSON 小约 1/4,
            // 且导入时可逐条按需读取, 超大备份在手机浏览器也能正常导入
            slim.version = 3;
            slim.exportedAt = new Date().toISOString();
            showSimpleToast('正在生成备份数据...');
            await _yieldToUI();
            const zip = _zipWriter();
            zip.add('data.json', _strToBytes(JSON.stringify(slim)));
            let packed = 0;
            await _forEachIdbImage(ids, (id, val) => {
                zip.add('images/' + id + _extOfDataUrl(val), _dataUrlToBytes(val));
                packed++;
                if (packed % 100 === 0) showSimpleToast(`正在打包媒体文件 (${packed}/${ids.length})...`);
            });
            showSimpleToast('正在生成备份文件...');
            await _yieldToUI();
            const blob = zip.finish();
            triggerFileDownload(blob, `梦角传讯备份_${new Date().toLocaleDateString('zh-CN').replace(/\//g, '-')}.zip`);
            showSimpleToast('数据导出成功 ✓');
        } catch (e) {
            console.error('导出失败:', e);
            showSimpleToast('导出失败: ' + (e && e.message ? e.message : '请重试'), 'error');
        } finally {
            _isExporting = false;
        }
    }
    // 新版备份把图片集中放在 images 表中, 导入时先还原成 base64; 旧版备份没有该表, 行为不变
    async function _hydrateImportImages(data) {
        if (!data || !data.images || typeof data.images !== 'object') return;
        const fields = ['contacts', 'commonEmojis', 'surveys', 'letters', 'receivedLetters', 'hisLetters', 'hisLetterSchedule', 'momentSchedules', 'myReplyLetters', 'me'];
        for (const key of fields) {
            if (data[key] !== undefined) {
                _hydrateImages(data[key], data.images);
                await _yieldToUI();
            }
        }
        delete data.images;
    }
    function importData(file) {
        showSimpleToast('正在读取备份文件...');
        setTimeout(async () => {
            // 新版备份为 ZIP 格式 ("PK" 开头), 走逐条按需读取通道; 旧版 JSON 备份走原逻辑
            try {
                const head = new Uint8Array(await file.slice(0, 4).arrayBuffer());
                if (head[0] === 0x50 && head[1] === 0x4b) {
                    await _importZipBackup(file);
                    return;
                }
            } catch (err) {
                console.error(err);
                showSimpleToast('导入失败: ' + (err.message || '文件格式错误'), 'error');
                return;
            }
            const reader = new FileReader();
            reader.onload = e => {
                const text = e.target.result;
                // 完整性诊断: 备份内容几乎全是 ASCII(base64), 读到的字符数应与文件字节数接近;
                // 正常文件以 } 结尾。两者任一不满足即说明文件被截断, 不必再尝试解析
                const fileMB = (file.size / 1048576).toFixed(1);
                const readMB = (text.length / 1048576).toFixed(1);
                console.info('[导入诊断] 文件大小:', fileMB + 'MB, 读到:', readMB + 'MB, 结尾:', JSON.stringify(text.slice(-32)));
                if (!/\}\s*$/.test(text)) {
                    showSimpleToast(`导入失败: 文件不完整(文件 ${fileMB}MB, 实际读到 ${readMB}MB)`, 'error');
                    return;
                }
                showSimpleToast('正在解析备份文件...');
                // 解析是同步且耗时的, 先让提示渲染出来再开始
                setTimeout(() => {
                    try {
                        const data = JSON.parse(text);
                        if (!data.contacts || !Array.isArray(data.contacts)) {
                            throw new Error('数据格式不正确');
                        }
                        state._pendingImportData = data;
                        openModal('importDataConfirmModal');
                        showSimpleToast('文件解析完成，请确认导入');
                    } catch (err) {
                        console.error(err);
                        const msg = err && err.message === 'Unexpected end of JSON input'
                            ? '备份文件不完整(可能下载未完成), 请重新导出或等下载完成后再导入'
                            : (err.message || '文件格式错误');
                        showSimpleToast('导入失败: ' + msg, 'error');
                    }
                }, 30);
            };
            reader.onerror = () => showSimpleToast('读取备份文件失败', 'error');
            reader.readAsText(file);
        }, 30);
    }
    // ZIP 备份导入: 只把很小的 data.json 读入内存解析; images/ 条目逐张读为 base64
    // 并直接写入 IndexedDB, 数据中保留 idb: 引用, 整个备份无需一次性载入内存
    async function _importZipBackup(file) {
        const entries = await _zipListEntries(file);
        const dataEntry = entries.find(e => e.name === 'data.json');
        if (!dataEntry) throw new Error('备份文件格式不正确');
        showSimpleToast('正在解析备份数据...');
        await _yieldToUI();
        const data = JSON.parse(await file.slice(dataEntry.offset, dataEntry.offset + dataEntry.size).text());
        if (!data.contacts || !Array.isArray(data.contacts)) throw new Error('数据格式不正确');
        const mediaEntries = entries.filter(e => e.name.indexOf('images/') === 0);
        for (let i = 0; i < mediaEntries.length; i++) {
            const en = mediaEntries[i];
            if (en.method !== 0) throw new Error('备份被重新压缩过, 请使用本网站导出的原始 ZIP 文件');
            const dot = en.name.lastIndexOf('.');
            const id = en.name.slice(7, dot);
            const mime = _EXT_MIME[en.name.slice(dot)] || 'application/octet-stream';
            const dataUrl = await _blobToDataUrl(file.slice(en.offset, en.offset + en.size, mime));
            await imgDBPut(id, dataUrl);
            if ((i + 1) % 10 === 0 || i + 1 === mediaEntries.length) {
                showSimpleToast(`正在导入媒体文件 (${i + 1}/${mediaEntries.length})...`);
                await _yieldToUI();
            }
        }
        state._pendingImportData = data;
        openModal('importDataConfirmModal');
        showSimpleToast('文件解析完成，请确认导入');
    }
    let _isImporting = false;
    async function doImportData() {
        const data = state._pendingImportData;
        if (!data || _isImporting) return;
        _isImporting = true;
        try {
            showSimpleToast('正在导入数据...');
            await _yieldToUI();
            await _hydrateImportImages(data);
            state.contacts = data.contacts;
            state.commonEmojis = data.commonEmojis && data.commonEmojis.length > 0 ? data.commonEmojis : [...DEFAULT_EMOJIS];
            state.surveys = data.surveys || [];
            state.letters = data.letters || [];
            state.receivedLetters = data.receivedLetters || [];
            state.hisLetters = data.hisLetters || [];
            state.hisLetterSchedule = data.hisLetterSchedule || { date: '', entries: [] };
            state.momentSchedules = data.momentSchedules || [];
            state.momentBadge = data.momentBadge || 0;
            state.myReplyLetters = data.myReplyLetters || [];
            state.me = data.me || null;
            if (!state.me) {
                state.me = { nickname: '我', signature: '', avatar: '', status: '' };
            }
            if (state.me.status === undefined) state.me.status = '';
            state._pendingImportData = null;
            // 直接落库 (不经防抖), 确保刷新前数据写完
            await _saveDataNow();
            closeModal('importDataConfirmModal');
            showSimpleToast('数据导入成功 ✓ 正在刷新页面...');
            // ZIP 备份导入后 state 中的媒体是 idb: 引用, 刷新后由 loadData 统一水合渲染
            setTimeout(() => location.reload(), 800);
        } catch (e) {
            console.error('导入失败:', e);
            showSimpleToast('导入失败: ' + (e && e.message ? e.message : '请重试'), 'error');
        } finally {
            _isImporting = false;
        }
    }
    // ===== 字卡模块导出/导入 =====
    const WC_MODULES = [
        { key: 'wordcards', name: '主字卡', color: '#ff6a6a', bg: '#fff1f0',
          data: ['wordcards', 'wordcardGroups'],
          icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8M16 17H8M10 9H8"/></svg>' },
        { key: 'groupWordcards', name: '群聊字卡', color: '#eb2f96', bg: '#fff0f6',
          data: ['groupWordcards', 'groupWordcardGroups'],
          icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8M16 17H8M10 9H8"/></svg>' },
        { key: 'emojis', name: 'Emoji', color: '#fa8c16', bg: '#fff4e6',
          data: ['emojis', 'exclusiveEmojis'],
          icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>' },
        { key: 'stickers', name: '表情库', color: '#13c2c2', bg: '#e6fffb',
          data: ['stickers'],
          icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>' },
        { key: 'momentImages', name: '图片', color: '#2f54eb', bg: '#f0f5ff',
          data: ['momentImages'],
          icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>' },
        { key: 'pats', name: '拍一拍', color: '#722ed1', bg: '#f9f0ff',
          data: ['pats', 'patGroups'],
          icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 11V6a2 2 0 0 0-4 0v5"/><path d="M14 10V4a2 2 0 0 0-4 0v6"/><path d="M10 10.5V6a2 2 0 0 0-4 0v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/></svg>' },
        { key: 'statuses', name: '对方状态', color: '#eb2f96', bg: '#fff0f6',
          data: ['statuses', 'statusGroups'],
          icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>' },
        { key: 'voices', name: '语音条', color: '#52c41a', bg: '#f6ffed',
          data: ['voices', 'voiceGroups'],
          icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/></svg>' },
        { key: 'confessions', name: '告白', color: '#fa541c', bg: '#fff2e8',
          data: ['confessions', 'confessionGroups'],
          icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>' },
    ];

    function getWcModuleCount(contact, mod) {
        let count = 0;
        for (const key of mod.data) {
            const v = contact.settings[key];
            if (Array.isArray(v)) count += v.length;
        }
        return count;
    }

    function openWcExportMode() {
        if (!getContact(state.currentContactId)) { showSimpleToast('请先选择联系人'); return; }
        openModal('wcExportModeModal');
    }

    function openWcFullExport(preSelectedKeys) {
        closeModal('wcExportModeModal');
        const c = getContact(state.currentContactId);
        ensureWordcardStructs(c);
        const list = document.getElementById('wcFullExportList');
        list.innerHTML = WC_MODULES.map(mod => {
            const checked = preSelectedKeys ? preSelectedKeys.includes(mod.key) : true;
            return `
            <div class="wc-module-item">
                <div class="wc-module-icon" style="background:${mod.bg};color:${mod.color};">${mod.icon}</div>
                <div class="wc-module-info">
                    <div class="wc-module-name">${mod.name}</div>
                    <div class="wc-module-count">共 ${getWcModuleCount(c, mod)} 条</div>
                </div>
                <label class="wc-module-toggle">
                    <input type="checkbox" data-module="${mod.key}" ${checked ? 'checked' : ''}>
                    <span class="slider"></span>
                </label>
            </div>`;
        }).join('');
        openModal('wcFullExportModal');
    }

    function openWcGroupExport() {
        closeModal('wcExportModeModal');
        const c = getContact(state.currentContactId);
        ensureWordcardStructs(c);
        const groups = c.settings.wordcardGroups || [];
        const cards = c.settings.wordcards || [];
        const list = document.getElementById('wcGroupExportList');
        const groupIdSet = new Set(groups.map(g => g.id));
        const groupCounts = {};
        let ungroupedCount = 0;
        cards.forEach(w => {
            if (w.groupId && groupIdSet.has(w.groupId)) {
                groupCounts[w.groupId] = (groupCounts[w.groupId] || 0) + 1;
            } else {
                ungroupedCount++;
            }
        });

        let html = groups.map(g => `
            <div class="wc-group-export-item" data-module="wordcards" data-group-id="${g.id}">
                <div class="wc-group-export-checkbox"></div>
                <div class="wc-group-export-dot" style="background:${g.color || '#ccc'};"></div>
                <div class="wc-group-export-name">${g.name}</div>
                <div class="wc-group-export-count">${groupCounts[g.id] || 0} 条</div>
            </div>
        `).join('');
        if (ungroupedCount > 0) {
            html += `
            <div class="wc-group-export-item" data-module="wordcards" data-group-id="__ungrouped__">
                <div class="wc-group-export-checkbox"></div>
                <div class="wc-group-export-dot" style="background:#ccc;"></div>
                <div class="wc-group-export-name">未分组</div>
                <div class="wc-group-export-count">${ungroupedCount} 条</div>
            </div>`;
        }
        // 群聊字卡分组区域
        const gcGroups = c.settings.groupWordcardGroups || [];
        const gcCards = c.settings.groupWordcards || [];
        const gcGroupIdSet = new Set(gcGroups.map(g => g.id));
        const gcGroupCounts = {};
        let gcUngroupedCount = 0;
        gcCards.forEach(w => {
            if (w.groupId && gcGroupIdSet.has(w.groupId)) {
                gcGroupCounts[w.groupId] = (gcGroupCounts[w.groupId] || 0) + 1;
            } else {
                gcUngroupedCount++;
            }
        });
        if (gcGroups.length > 0 || gcUngroupedCount > 0) {
            html += `<div class="wc-group-export-section-title">群聊字卡</div>`;
            html += gcGroups.map(g => `
                <div class="wc-group-export-item" data-module="groupWordcards" data-group-id="${g.id}">
                    <div class="wc-group-export-checkbox"></div>
                    <div class="wc-group-export-dot" style="background:${g.color || '#ccc'};"></div>
                    <div class="wc-group-export-name">${g.name}</div>
                    <div class="wc-group-export-count">${gcGroupCounts[g.id] || 0} 条</div>
                </div>
            `).join('');
            if (gcUngroupedCount > 0) {
                html += `
                <div class="wc-group-export-item" data-module="groupWordcards" data-group-id="__ungrouped__">
                    <div class="wc-group-export-checkbox"></div>
                    <div class="wc-group-export-dot" style="background:#ccc;"></div>
                    <div class="wc-group-export-name">未分组</div>
                    <div class="wc-group-export-count">${gcUngroupedCount} 条</div>
                </div>`;
            }
        }
        // 语音条分组区域
        const voiceGroups = c.settings.voiceGroups || [];
        const voices = c.settings.voices || [];
        const voiceGroupIdSet = new Set(voiceGroups.map(g => g.id));
        const voiceGroupCounts = {};
        let voiceUngroupedCount = 0;
        voices.forEach(v => {
            if (v.groupId && voiceGroupIdSet.has(v.groupId)) {
                voiceGroupCounts[v.groupId] = (voiceGroupCounts[v.groupId] || 0) + 1;
            } else {
                voiceUngroupedCount++;
            }
        });
        const hasVoiceGroups = voiceGroups.length > 0 || voiceUngroupedCount > 0;
        if (hasVoiceGroups) {
            html += `<div class="wc-group-export-section-title">语音条</div>`;
            html += voiceGroups.map(g => `
                <div class="wc-group-export-item" data-module="voices" data-group-id="${g.id}">
                    <div class="wc-group-export-checkbox"></div>
                    <div class="wc-group-export-dot" style="background:${g.color || '#ccc'};"></div>
                    <div class="wc-group-export-name">${g.name}</div>
                    <div class="wc-group-export-count">${voiceGroupCounts[g.id] || 0} 条</div>
                </div>
            `).join('');
            if (voiceUngroupedCount > 0) {
                html += `
                <div class="wc-group-export-item" data-module="voices" data-group-id="__ungrouped__">
                    <div class="wc-group-export-checkbox"></div>
                    <div class="wc-group-export-dot" style="background:#ccc;"></div>
                    <div class="wc-group-export-name">未分组</div>
                    <div class="wc-group-export-count">${voiceUngroupedCount} 条</div>
                </div>`;
            }
        }
        if (!html) html = '<div style="text-align:center;color:var(--text-light);padding:20px;">暂无可导出的分组</div>';
        list.innerHTML = html;
        openModal('wcGroupExportModal');
    }

    function buildWcExportData(contact, selectedKeys, selectedGroupIds, selectedVoiceGroupIds, selectedGroupCardGroupIds) {
        const data = {
            type: 'wordcard-export',
            version: 1,
            exportedAt: new Date().toISOString(),
            contact: { id: contact.id, nickname: contact.nickname },
            modules: {}
        };
        for (const mod of WC_MODULES) {
            if (!selectedKeys.includes(mod.key)) continue;
            const modData = {};
            for (const key of mod.data) {
                if (key === 'wordcards' && selectedGroupIds) {
                    const groups = contact.settings.wordcardGroups || [];
                    const selectedGroups = groups.filter(g => selectedGroupIds.includes(g.id));
                    const selectedGroupIdSet = new Set(selectedGroups.map(g => g.id));
                    const allGroupIdSet = new Set(groups.map(g => g.id));
                    const includeUngrouped = selectedGroupIds.includes('__ungrouped__');
                    const cards = contact.settings.wordcards || [];
                    modData.wordcards = cards.filter(w => {
                        const inGroup = w.groupId && allGroupIdSet.has(w.groupId);
                        if (inGroup) return selectedGroupIdSet.has(w.groupId);
                        return includeUngrouped;
                    });
                    modData.wordcardGroups = JSON.parse(JSON.stringify(selectedGroups));
                } else if (key === 'groupWordcards' && selectedGroupCardGroupIds) {
                    const groups = contact.settings.groupWordcardGroups || [];
                    const selectedGroups = groups.filter(g => selectedGroupCardGroupIds.includes(g.id));
                    const selectedGroupIdSet = new Set(selectedGroups.map(g => g.id));
                    const allGroupIdSet = new Set(groups.map(g => g.id));
                    const includeUngrouped = selectedGroupCardGroupIds.includes('__ungrouped__');
                    const cards = contact.settings.groupWordcards || [];
                    modData.groupWordcards = cards.filter(w => {
                        const inGroup = w.groupId && allGroupIdSet.has(w.groupId);
                        if (inGroup) return selectedGroupIdSet.has(w.groupId);
                        return includeUngrouped;
                    });
                    modData.groupWordcardGroups = JSON.parse(JSON.stringify(selectedGroups));
                } else if (key === 'voices' && selectedVoiceGroupIds) {
                    const groups = contact.settings.voiceGroups || [];
                    const selectedGroups = groups.filter(g => selectedVoiceGroupIds.includes(g.id));
                    const selectedGroupIdSet = new Set(selectedGroups.map(g => g.id));
                    const allGroupIdSet = new Set(groups.map(g => g.id));
                    const includeUngrouped = selectedVoiceGroupIds.includes('__ungrouped__');
                    const cards = contact.settings.voices || [];
                    modData.voices = cards.filter(v => {
                        const inGroup = v.groupId && allGroupIdSet.has(v.groupId);
                        if (inGroup) return selectedGroupIdSet.has(v.groupId);
                        return includeUngrouped;
                    });
                    modData.voiceGroups = JSON.parse(JSON.stringify(selectedGroups));
                } else {
                    modData[key] = Array.isArray(contact.settings[key]) ? JSON.parse(JSON.stringify(contact.settings[key])) : contact.settings[key];
                }
            }
            data.modules[mod.key] = modData;
        }
        return data;
    }

    async function downloadWcExport(data) {
        if (isInAppBrowser()) {
            showSimpleToast('微信/QQ 内无法下载文件，请点右上角「···」选择「在浏览器打开」后重试', 'error');
            return false;
        }
        if (_isExporting) return false;
        _isExporting = true;
        try {
            showSimpleToast('正在整理导出数据...');
            await _yieldToUI();
            // 与本地存储一致: base64 图片抽离为 idb: 引用并按内容去重, 避免同一张图重复写入
            const slim = _extractImages(data);
            slim.version = 2;
            if (_imgPendingWrites.size > 0) {
                showSimpleToast('正在准备图片数据...');
                await Promise.all([..._imgPendingWrites]);
            }
            const refs = new Set();
            _collectIdbRefs(slim, refs);
            const parts = [JSON.stringify(slim).slice(0, -1), ',"images":{'];
            let firstImg = true;
            await _forEachIdbImage([...refs], (id, val) => {
                if (!firstImg) parts.push(',');
                firstImg = false;
                parts.push(JSON.stringify(id) + ':' + JSON.stringify(val));
            });
            parts.push('}}');
            const dateStr = new Date().toISOString().slice(0, 10);
            const modNames = Object.keys(data.modules).map(k => WC_MODULES.find(m => m.key === k)?.name || k).join('_');
            const blob = new Blob(parts, { type: 'application/json' });
            triggerFileDownload(blob, `字卡导出_${modNames}_${dateStr}.json`);
            return true;
        } catch (e) {
            console.error('导出失败:', e);
            showSimpleToast('导出失败: ' + (e && e.message ? e.message : '请重试'), 'error');
            return false;
        } finally {
            _isExporting = false;
        }
    }

    async function confirmWcFullExport() {
        const c = getContact(state.currentContactId);
        const checks = document.querySelectorAll('#wcFullExportList input[type=checkbox]:checked');
        const selectedKeys = Array.from(checks).map(cb => cb.dataset.module);
        if (selectedKeys.length === 0) { showSimpleToast('请至少选择一个模块'); return; }
        const data = buildWcExportData(c, selectedKeys, null);
        const ok = await downloadWcExport(data);
        closeModal('wcFullExportModal');
        if (ok) showSimpleToast('导出成功');
    }

    async function confirmWcGroupExport() {
        const c = getContact(state.currentContactId);
        const items = document.querySelectorAll('#wcGroupExportList .wc-group-export-item.checked');
        const wordcardGroupIds = Array.from(items).filter(el => el.dataset.module === 'wordcards').map(el => el.dataset.groupId);
        const voiceGroupIds = Array.from(items).filter(el => el.dataset.module === 'voices').map(el => el.dataset.groupId);
        const groupCardGroupIds = Array.from(items).filter(el => el.dataset.module === 'groupWordcards').map(el => el.dataset.groupId);
        if (wordcardGroupIds.length === 0 && voiceGroupIds.length === 0 && groupCardGroupIds.length === 0) { showSimpleToast('请至少选择一个分组'); return; }
        const selectedKeys = [];
        if (wordcardGroupIds.length > 0) selectedKeys.push('wordcards');
        if (voiceGroupIds.length > 0) selectedKeys.push('voices');
        if (groupCardGroupIds.length > 0) selectedKeys.push('groupWordcards');
        const data = buildWcExportData(c, selectedKeys, wordcardGroupIds.length > 0 ? wordcardGroupIds : null, voiceGroupIds.length > 0 ? voiceGroupIds : null, groupCardGroupIds.length > 0 ? groupCardGroupIds : null);
        const ok = await downloadWcExport(data);
        closeModal('wcGroupExportModal');
        if (ok) showSimpleToast('导出成功');
    }

    let wcImportData = null;

    function triggerWcImport() {
        if (!getContact(state.currentContactId)) { showSimpleToast('请先选择联系人'); return; }
        document.getElementById('wcImportFileInput').click();
    }

    function handleWcImportFile(e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function(ev) {
            try {
                const data = JSON.parse(ev.target.result);
                // 新版字卡备份的图片集中放在 images 表中, 先还原成 base64; 旧版备份没有该表, 行为不变
                if (data && data.images && typeof data.images === 'object' && data.modules) {
                    _hydrateImages(data.modules, data.images);
                    delete data.images;
                }
                if (!data || data.type !== 'wordcard-export' || !data.modules) {
                    showSimpleToast('文件格式不正确'); return;
                }
                wcImportData = data;
                openWcImportModal(data);
            } catch (err) {
                showSimpleToast('解析文件失败');
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    }

    function openWcImportModal(data) {
        const keys = Object.keys(data.modules);
        document.getElementById('wcImportSubtitle').textContent = `文件中包含 ${keys.length} 个模块`;
        const list = document.getElementById('wcImportList');
        list.innerHTML = keys.map(key => {
            const mod = WC_MODULES.find(m => m.key === key);
            if (!mod) return '';
            const modData = data.modules[key];
            let count = 0;
            for (const dk of mod.data) {
                if (Array.isArray(modData[dk])) count += modData[dk].length;
            }
            return `
            <div class="wc-module-item">
                <div class="wc-module-icon" style="background:${mod.bg};color:${mod.color};">${mod.icon}</div>
                <div class="wc-module-info">
                    <div class="wc-module-name">${mod.name}</div>
                    <div class="wc-module-count">共 ${count} 条</div>
                </div>
                <label class="wc-module-toggle">
                    <input type="checkbox" data-module="${key}" checked>
                    <span class="slider"></span>
                </label>
            </div>`;
        }).join('');
        openModal('wcImportModal');
    }

    function confirmWcImport() {
        const c = getContact(state.currentContactId);
        ensureWordcardStructs(c);
        const checks = document.querySelectorAll('#wcImportList input[type=checkbox]:checked');
        const selectedKeys = Array.from(checks).map(cb => cb.dataset.module);
        if (selectedKeys.length === 0) { showSimpleToast('请至少选择一个模块'); return; }
        const mode = document.querySelector('input[name=wcImportMode]:checked').value;

        for (const key of selectedKeys) {
            const mod = WC_MODULES.find(m => m.key === key);
            if (!mod) continue;
            const modData = wcImportData.modules[key] || {};
            for (const dk of mod.data) {
                const incoming = modData[dk];
                if (!Array.isArray(incoming)) continue;
                if (mode === 'overwrite') {
                    c.settings[dk] = JSON.parse(JSON.stringify(incoming));
                } else {
                    if (!Array.isArray(c.settings[dk])) c.settings[dk] = [];
                    c.settings[dk] = c.settings[dk].concat(JSON.parse(JSON.stringify(incoming)));
                }
            }
        }
        saveData();
        renderWordcardPage();
        renderInteractionPage();
        closeModal('wcImportModal');
        showSimpleToast('导入成功');
    }

    function resetData() {
        openModal('resetDataConfirmModal');
    }
    function doResetData() {
        stopAllTimers();
        imgDBClear(); // 同步清空 IndexedDB 图片库
        state.contacts = [];
        state.commonEmojis = [...DEFAULT_EMOJIS];
        state.surveys = [];
        state.letters = [];
        state.receivedLetters = [];
        state.hisLetters = [];
        state.hisLetterSchedule = { date: '', entries: [] };
        state.momentSchedules = [];
        state.momentBadge = 0;
        state.myReplyLetters = [];
        state.me = { nickname: '我', signature: '', avatar: '', status: '' };
        state.currentContactId = null;
        saveData();
        switchPage('chatListPage');
        renderChatList();
        closeModal('resetDataConfirmModal');
        closeModal('dataManageModal');
        showSimpleToast('数据已重置');
    }

    // ===== 清空聊天记录 =====
    let clearChatSelectedIds = [];

    function openClearChatModal() {
        const list = $('clearChatContactList');
        const contacts = state.contacts || [];
        if (contacts.length === 0) {
            list.innerHTML = '<div style="text-align:center;color:var(--text-light);padding:20px;">暂无联系人</div>';
        } else {
            list.innerHTML = contacts.map(c => `
                <div class="wc-group-export-item" data-contact-id="${c.id}">
                    <div class="wc-group-export-checkbox"></div>
                    <img src="${c.avatar || ''}" style="width:28px;height:28px;border-radius:50%;object-fit:cover;flex-shrink:0;" onerror="this.style.background='#eee';this.src='';">
                    <div class="wc-group-export-name">${escapeHtml(c.nickname || '未命名')}</div>
                    <div class="wc-group-export-count">${(c.messages || []).length} 条</div>
                </div>
            `).join('');
        }
        clearChatSelectedIds = [];
        openModal('clearChatModal');
    }

    function confirmClearChatSelection() {
        const items = document.querySelectorAll('#clearChatContactList .wc-group-export-item.checked');
        const ids = Array.from(items).map(el => el.dataset.contactId);
        if (ids.length === 0) { showSimpleToast('请至少选择一个联系人'); return; }
        clearChatSelectedIds = ids;
        const names = ids.map(id => {
            const c = state.contacts.find(x => x.id === id);
            return c ? (c.nickname || '未命名') : '';
        }).filter(Boolean);
        const nameText = names.join('、');
        $('clearChatConfirmText').innerHTML = `是否要清空 <b style="color:var(--primary);">${escapeHtml(nameText)}</b> 的聊天记录？<br><span style="font-size:13px;color:var(--text-light);font-weight:400;">清空后无法恢复</span>`;
        closeModal('clearChatModal');
        openModal('clearChatConfirmModal');
    }

    function doClearChat() {
        let count = 0;
        clearChatSelectedIds.forEach(id => {
            const c = state.contacts.find(x => x.id === id);
            if (c) {
                c.messages = [];
                count++;
            }
        });
        saveData();
        renderChatList();
        // 如果当前打开的聊天被清空，刷新消息
        if (clearChatSelectedIds.includes(state.currentContactId)) {
            renderMessages();
        }
        closeModal('clearChatConfirmModal');
        closeModal('dataManageModal');
        showSimpleToast(`已清空 ${count} 个联系人的聊天记录`);
    }

    // ================= 联系人管理 =================
    function createContact(nickname, signature, avatar) {
        const contact = {
            id: uuid(),
            nickname: nickname || '未命名梦角',
            signature: signature || '',
            avatar: avatar || makeDefaultAvatar(nickname),
            createdAt: Date.now(),
            settings: {
                replyMin: 3,
                replyMax: 10,
                autoSend: false,
                autoInterval: 60,
                mixedMode: false,
                chatBg: DEFAULT_BGS[0].value,
                customBgs: [],
                bubbleStyle: JSON.parse(JSON.stringify(DEFAULT_BUBBLE_STYLE)),
                wordcards: [],        // { id, keyword, reply, groupId }
                wordcardGroups: [],   // { id, name, type, color }
                emojis: [],
                soundEnabled: false,  // 消息音效总开关
                userMsgSound: 'kakao',  // 用户发送消息音效 id
                otherMsgSound: 'kakao' // 梦角发送消息音效 id
            },
            messages: [],
            unread: 0,
            lastAutoSend: Date.now()
        };
        state.contacts.unshift(contact);
        saveData();
        return contact;
    }
    function makeDefaultAvatar(name) {
        const ch = (name || '梦').trim().charAt(0) || '梦';
        // 用 SVG data URL 作为默认头像 (首字 + 渐变)
        const colors = [
            ['#ffb6bd', '#ffd7d5'], ['#ffd7d5', '#ffeeb6'],
            ['#ffeeb6', '#afdcf1'], ['#afdcf1', '#e0c8f0'],
            ['#f5b5c5', '#ffe6c8']
        ];
        const pick = colors[Math.floor(Math.random() * colors.length)];
        const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><defs><linearGradient id='g' x1='0%25' y1='0%25' x2='100%25' y2='100%25'><stop offset='0%25' stop-color='${pick[0]}'/><stop offset='100%25' stop-color='${pick[1]}'/></linearGradient></defs><rect width='100' height='100' rx='24' fill='url(%23g)'/><text x='50' y='65' text-anchor='middle' font-family='KaiTi, STKaiti, 楷体, serif' font-size='52' font-weight='700' fill='white' fill-opacity='0.96'>${escapeHtml(ch)}</text></svg>`;
        return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
    }
    function deleteContact(id) {
        const idx = state.contacts.findIndex(c => c.id === id);
        if (idx < 0) return;
        stopContactTimers(id);
        state.contacts.splice(idx, 1);
        if (state.currentContactId === id) {
            state.currentContactId = null;
            switchPage('chatListPage');
        }
        saveData();
        renderChatList();
    }
    function getContact(id) {
        return state.contacts.find(c => c.id === id);
    }

    // ================= 页面切换 =================
    function switchPage(pageId) {
        $$('.page').forEach(p => p.classList.toggle('active', p.id === pageId));
        // 聊天详情页、收藏页、收藏详情页及信箱页隐藏底栏，其他页面显示底栏
        const bar = $('bottomBar');
        if (bar) bar.classList.toggle('hidden',
            pageId === 'homePage'
            || pageId === 'chatDetailPage'
            || pageId === 'groupSettingPage'
            || pageId === 'groupMembersPage'
            || pageId === 'favoritesPage'
            || pageId === 'favoriteDetailPage'
            || pageId === 'mailboxPage'
            || pageId === 'mailboxSentPage'
            || pageId === 'mailboxWritePage'
            || pageId === 'mailboxReceivedPage'
            || pageId === 'mailboxHisPage'
            || pageId === 'mailboxMinePage'
            || pageId === 'mailboxReplyWritePage'
            || pageId === 'divinationPage'
            || pageId === 'userMomentsPage'
            || pageId === 'momentsInteractPage'
            || pageId === 'momentsFeedPage'
            || pageId === 'momentsEditPage'
            || pageId === 'remindPage'
            || pageId === 'visiblePage'
            || pageId === 'momentsDetailPage'
            || pageId === 'momentsCommentPage'
            || pageId === 'lenormandPage'
            || pageId === 'tarotPage');
    }
    function switchTab(pageId, btnId) {
        switchPage(pageId);
        $$('.tab-btn').forEach(b => b.classList.remove('active'));
        const btn = $(btnId);
        if (btn) btn.classList.add('active');
    }

    // ================= 首页 =================
    const HOME_POEM_TTL = 8 * 60 * 60 * 1000; // 诗句 8 小时刷新一次
    function updateHomeClock() {
        const now = new Date();
        const hh = String(now.getHours()).padStart(2, '0');
        const mm = String(now.getMinutes()).padStart(2, '0');
        const timeEl = $('homeTime');
        if (timeEl) timeEl.textContent = hh + ':' + mm;
        const dateEl = $('homeDate');
        if (dateEl) {
            const weeks = ['日', '一', '二', '三', '四', '五', '六'];
            dateEl.textContent = (now.getMonth() + 1) + '月' + now.getDate() + '日 星期' + weeks[now.getDay()];
        }
    }
    function collectAllConfessions() {
        const pool = [];
        (state.contacts || []).forEach(c => {
            const list = (c.settings && c.settings.confessions) || [];
            list.forEach(cf => {
                if (cf && !cf.blocked && cf.content && (cf.content + '').trim()) {
                    pool.push(cf.content);
                }
            });
        });
        return pool;
    }
    function renderHomeQuote(text) {
        const quoteEl = $('homeQuote');
        if (!quoteEl) return;
        if (!text) { quoteEl.innerHTML = ''; return; }
        const idx = text.indexOf('\n');
        if (idx === -1) {
            quoteEl.innerHTML = '<span class="home-poem-text">' + escapeHtml(text) + '</span>';
            return;
        }
        const poem = text.substring(0, idx);
        const author = text.substring(idx + 1);
        quoteEl.innerHTML =
            '<span class="home-poem-text">' + escapeHtml(poem) + '</span>' +
            '<span class="home-poem-author">' +
                '<span class="home-author-divider"></span>' +
                '<span class="home-author-heart">♥</span>' +
                '<span class="home-author-name">' + escapeHtml(author) + '</span>' +
                '<span class="home-author-heart">♥</span>' +
                '<span class="home-author-divider"></span>' +
            '</span>';
    }
    function refreshHomePoem(force) {
        const now = Date.now();
        const quoteEl = $('homeQuote');
        if (!quoteEl) return;
        // 未到刷新时间且已有诗句, 直接渲染已有内容
        if (!force && state.homePoem && state.homePoemAt && (now - state.homePoemAt) < HOME_POEM_TTL) {
            renderHomeQuote(state.homePoem);
            return;
        }
        const pool = collectAllConfessions();
        if (pool.length === 0) {
            // 无告白内容时诗句区域留空
            quoteEl.innerHTML = '';
            state.homePoem = '';
            state.homePoemAt = now;
            saveData();
            return;
        }
        const picked = pool[Math.floor(Math.random() * pool.length)];
        const formatted = picked.replace(/——?/g, '\n');
        state.homePoem = formatted;
        state.homePoemAt = now;
        renderHomeQuote(formatted);
        saveData();
    }
    function initHomePage() {
        updateHomeClock();
        setInterval(updateHomeClock, 1000);
        refreshHomePoem(false);
        // 每小时检查一次是否需要刷新诗句
        setInterval(() => refreshHomePoem(false), 60 * 60 * 1000);
    }
    function openChat(contactId) {
        const c = getContact(contactId);
        if (!c) return;
        state.currentContactId = contactId;
        c.unread = 0;
        saveData();
        // 更新顶栏信息 (昵称 + 对方状态)
        $('detailNickname').textContent = c.nickname;
        // 对方状态: 仅当切换到不同联系人(或首次)时初始化, 同一联系人重复进入不变化, 由定时器(1~8小时)更新
        const statusEl = $('detailStatus');
        if (statusEl.getAttribute('data-status-contact-id') !== contactId) {
            updateContactStatus(contactId);
        }
        // 启动对方状态定时更新 (群聊无对方状态)
        if (!c.isGroup) startStatusTimer(c);
        // 输入框上方正在输入胶囊的头像
        $('typingAvatar').style.backgroundImage = `url("${c.avatar}")`;
        $('typingAvatar').style.backgroundSize = 'cover';
        $('typingAvatar').style.backgroundPosition = 'center';
        // 背景
        applyChatBg(c);
        applyBubbleStyle(c);
        // 渲染消息
        renderMessages();
        // 重置输入区 & 表情面板
        $('messageInput').value = '';
        $('patInput').value = '';
        $('emojiPanel').classList.add('hidden');
        $('emojiPatWrap').classList.add('hidden');
        // 先清空旧的正在输入
        $('typingStatusBar').classList.add('hidden');
        switchPage('chatDetailPage');
        // 启动主动消息 & 刷新列表
        startContactAutoTimer(c);
        // 群聊: 潜水群禁用输入区; 启动自主聊天 / 自建群聊定时器
        const isLurkGroup = !!(c.isGroup && c.lurk);
        $('chatInputArea').classList.toggle('lurk-mode', isLurkGroup);
        $('lurkNotice').classList.toggle('hidden', !isLurkGroup);
        // 群聊隐藏视频通话按钮
        $('videoCallBtn').classList.toggle('hidden', !!c.isGroup);
        if (c.isGroup) {
            const tm = state.timers[c.id] || {};
            if (!tm.autoChatTimer && !tm.autoChatStepTimer) startGroupAutoChat(c);
            if (!tm.selfBuildTimer) startSelfBuildTimer(c);
            if (!tm.ownerTimer) startGroupOwnerTimer(c);
        }
        renderChatList();
    }
    function backToList() {
        state.currentContactId = null;
        stopContactReplyTimer(null); // 停止当前可能的回复
        switchTab('chatListPage', 'tabChatBtn');
        renderChatList();
    }

    // ================= 列表渲染 =================
    function renderChatList(filter = '') {
        const list = $('chatList');
        const empty = $('emptyTip');
        const keyword = filter.trim().toLowerCase();
        const data = state.contacts.filter(c => {
            if (!keyword) return true;
            return (c.nickname || '').toLowerCase().includes(keyword)
                || (c.signature || '').toLowerCase().includes(keyword);
        });
        list.innerHTML = '';
        if (data.length === 0) {
            empty.classList.toggle('hidden', state.contacts.length !== 0);
            return;
        }
        empty.classList.add('hidden');
        // 按最后消息时间排序 (置顶优先)
        data.sort((a, b) => {
            const at = a.messages.length ? a.messages[a.messages.length - 1].timestamp : a.createdAt;
            const bt = b.messages.length ? b.messages[b.messages.length - 1].timestamp : b.createdAt;
            if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
            return bt - at;
        });
        const frag = document.createDocumentFragment();
        data.forEach((c, i) => {
            const last = c.messages[c.messages.length - 1];
            const lastText = last ? summarizeContent(last) : (c.signature || '开始聊天吧~');
            const lastTime = last ? formatTime(last.timestamp) : formatTime(c.createdAt);
            const item = document.createElement('div');
            item.className = 'chat-item enter' + (c.pinned ? ' pinned' : '');
            item.style.animationDelay = `${Math.min(i * 0.03, 0.3)}s`;
            item.dataset.id = c.id;
            item.innerHTML = `
                <div class="avatar" style="background-image:url('${escapeHtml(c.avatar)}');background-size:cover;background-position:center;"></div>
                <div class="info">
                    <div class="row1">
                        <div class="name">${escapeHtml(c.nickname)}</div>
                        <div class="time">${lastTime}</div>
                    </div>
                    <div class="row2">
                        <div class="last-msg">${escapeHtml(lastText)}</div>
                        ${c.unread > 0 ? `<div class="badge">${c.unread > 99 ? '99+' : c.unread}</div>` : ''}
                    </div>
                </div>
            `;
            item.addEventListener('click', () => openChat(c.id));
            frag.appendChild(item);
        });
        list.appendChild(frag);
    }
    function summarizeContent(msg) {
        switch (msg.type) {
            case 'text': return msg.content.length > 24 ? msg.content.slice(0, 24) + '...' : msg.content;
            case 'image': return '[图片]';
            case 'audio': return '[语音]';
            case 'emoji': return '[表情]';
            case 'wordcard': return `[字卡] ${(msg.keyword || '')}`;
            case 'pat': return `拍了拍${msg.content ? '：' + msg.content : ''}`;
            case 'notice': return msg.content;
            default: return '';
        }
    }

    // ================= 消息渲染 =================
    // 移动端分页渲染: 只渲染最近 N 条消息, 避免数百条消息(含毛玻璃/图片)一次性建 DOM 造成卡顿
    let _msgRenderLimit = 80;
    let _msgRenderContactId = null;
    function renderMessages(keepScroll) {
        const c = getContact(state.currentContactId);
        if (!c) return;
        const container = $('messagesContainer');
        // 切换聊天时重置分页 (手机端 80 条, 桌面端保持全量)
        if (_msgRenderContactId !== state.currentContactId) {
            _msgRenderContactId = state.currentContactId;
            _msgRenderLimit = window.innerWidth <= 768 ? 80 : Infinity;
        }
        const _oldScrollHeight = keepScroll ? container.scrollHeight : 0;
        const _oldScrollTop = keepScroll ? container.scrollTop : 0;
        container.innerHTML = '';
        const frag = document.createDocumentFragment();
        // 潜水群: 顶部显示发现提示
        if (c.isGroup && c.lurk) {
            const tip = document.createElement('div');
            tip.className = 'msg pat-msg notice-msg lurk-discover';
            tip.innerHTML = `<div class="pat-tip"><span class="pat-line"></span><span class="pat-text">你偶然发现了[${escapeHtml(c.nickname || '群聊')}]，正在潜水围观</span><span class="pat-line"></span></div>`;
            frag.appendChild(tip);
        }
        const total = c.messages.length;
        const start = Number.isFinite(_msgRenderLimit) ? Math.max(0, total - _msgRenderLimit) : 0;
        if (start > 0) {
            const moreBtn = document.createElement('div');
            moreBtn.className = 'load-more-msg';
            moreBtn.textContent = '查看更早消息';
            moreBtn.addEventListener('click', () => {
                _msgRenderLimit += 80;
                renderMessages(true);
            });
            frag.appendChild(moreBtn);
        }
        for (let i = start; i < total; i++) {
            frag.appendChild(buildMessageEl(c.messages[i], c));
        }
        container.appendChild(frag);
        // 加载更早消息时保持当前视口位置, 否则滚动到底部
        requestAnimationFrame(() => {
            if (keepScroll) {
                container.scrollTop = container.scrollHeight - _oldScrollHeight + _oldScrollTop;
            } else {
                container.scrollTop = container.scrollHeight;
            }
        });
    }
    // 引用内容点击跳转到被引用消息, 并闪烁两下
    function bindQuoteJump(bubbleEl, quoteId) {
        if (!quoteId) return;
        const qContent = bubbleEl.querySelector('.quote-content');
        if (!qContent) return;
        qContent.style.cursor = 'pointer';
        qContent.addEventListener('click', () => {
            const target = document.querySelector('.msg[data-msg-id="' + quoteId + '"]');
            if (target) {
                target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                target.classList.remove('msg-blink');
                // 强制重排以重启动画
                void target.offsetWidth;
                target.classList.add('msg-blink');
                setTimeout(() => target.classList.remove('msg-blink'), 1100);
            }
        });
    }
    function buildMessageEl(msg, contact) {
        const wrap = document.createElement('div');
        wrap.className = `msg ${msg.from === 'me' ? 'sent' : 'received'}`;
        wrap.dataset.msgId = msg.id;

        // 群聊系统提示 (入群申请 / 群主拉人踢人 / 转让): 居中显示, 永久保存在消息列表
        if (msg.type === 'notice') {
            wrap.classList.add('pat-msg', 'notice-msg');
            const tip = document.createElement('div');
            tip.className = 'pat-tip';
            tip.innerHTML = `<span class="pat-line"></span><span class="pat-text">${escapeHtml(msg.content || '')}</span><span class="pat-line"></span>`;
            wrap.appendChild(tip);
            // 群主为"我"且申请待处理: 显示同意/拒绝按钮
            if (msg.request && msg.pending !== false && getGroupOwnerId(contact) === 'me') {
                const actions = document.createElement('div');
                actions.className = 'notice-actions';
                const okBtn = document.createElement('button');
                okBtn.className = 'notice-act approve';
                okBtn.dataset.msgId = msg.id;
                okBtn.dataset.act = 'approve';
                okBtn.textContent = '同意';
                const noBtn = document.createElement('button');
                noBtn.className = 'notice-act reject';
                noBtn.dataset.msgId = msg.id;
                noBtn.dataset.act = 'reject';
                noBtn.textContent = '拒绝';
                actions.appendChild(okBtn);
                actions.appendChild(noBtn);
                wrap.appendChild(actions);
            }
            return wrap;
        }

        // 拍一拍: 独立居中显示 - 样式: 两侧线 + 爱心包裹; 内容 = 用户自定义的纯文本 (不再自动拼接"我"和昵称)
        if (msg.type === 'pat') {
            wrap.classList.add('pat-msg');
            const tip = document.createElement('div');
            tip.className = 'pat-tip';
            const content = escapeHtml(msg.content || '');
            tip.innerHTML = `<span class="pat-line"></span><span class="pat-heart">♡</span><span class="pat-text">${content}</span><span class="pat-heart">♡</span><span class="pat-line"></span><span class="pat-time">${formatChatTime(msg.timestamp)}</span>`;
            wrap.appendChild(tip);
            return wrap;
        }

        // 视频通话记录: 居中显示 - 摄像机图标 + "视频通话已结束 · 时长"
        if (msg.type === 'call') {
            wrap.classList.add('pat-msg', 'call-msg');
            const tip = document.createElement('div');
            tip.className = 'call-tip';
            const dur = msg.duration ? formatVideoCallTime(msg.duration) : '00:00';
            tip.innerHTML = `<svg viewBox="0 0 24 24" class="call-icon"><rect x="2" y="6" width="14" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="m22 8-6 4 6 4V8z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg><span>视频通话已结束 · ${dur}</span>`;
            wrap.appendChild(tip);
            return wrap;
        }

        // 视频通话未接通 (梦角挂断): 居中显示 - 挂断图标 + 提示词
        if (msg.type === 'call_missed') {
            wrap.classList.add('pat-msg', 'call-missed');
            const tip = document.createElement('div');
            tip.className = 'call-missed-tip';
            const content = escapeHtml(msg.content || '');
            tip.innerHTML = `<svg viewBox="0 0 24 24" class="call-missed-icon"><path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 2.59 3.4z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><line x1="23" y1="1" x2="1" y2="23" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg><span>${content}</span>`;
            wrap.appendChild(tip);
            return wrap;
        }

        const avatar = document.createElement('div');
        avatar.className = 'msg-avatar';
        if (msg.from === 'me') {
            if (state.me && state.me.avatar) {
                avatar.style.backgroundImage = `url("${state.me.avatar}")`;
                avatar.style.backgroundSize = 'cover';
                avatar.style.backgroundPosition = 'center';
            } else {
                avatar.style.background = 'linear-gradient(135deg, #afdcf1, #c7eaf9)';
            }
            avatar.innerHTML = '';
        } else {
            avatar.style.backgroundImage = `url("${contact.avatar}")`;
            avatar.style.backgroundSize = 'cover';
            avatar.style.backgroundPosition = 'center';
        }

        const bw = document.createElement('div');
        bw.className = 'bubble-wrap';
        const time = document.createElement('div');
        time.className = 'time-tag';
        time.textContent = formatChatTime(msg.timestamp);

        const bubble = document.createElement('div');
        bubble.className = 'bubble';
        if (msg.type === 'wordcard') bubble.classList.add('wordcard-bubble');

        switch (msg.type) {
            case 'text':
                if (msg.quote) {
                    const qFrom = msg.quote.from === 'me' ? 'from-me' : 'from-other';
                    const isSticker = msg.quote.type === 'emoji' && msg.quote.content && msg.quote.content.startsWith('data:image');
                    const qContentHtml = isSticker
                        ? '<img src="' + escapeHtml(msg.quote.content) + '" class="quote-img" alt="表情">'
                        : escapeHtml(getMsgQuoteText({ type: msg.quote.type, content: msg.quote.content }));
                    bubble.innerHTML = '<div class="quote-block ' + qFrom + '"><div class="quote-name">' + escapeHtml(msg.quote.name) + '</div><div class="quote-content">' + qContentHtml + '</div></div><div class="msg-text">' + escapeHtml(msg.content) + '</div>';
                    bindQuoteJump(bubble, msg.quote.id);
                } else {
                    bubble.textContent = msg.content;
                }
                break;
            case 'emoji':
                if (msg.content.startsWith('data:image')) {
                    bubble.innerHTML = `<img src="${escapeHtml(msg.content)}" alt="emoji" style="width:80px;height:80px;object-fit:cover;border-radius:8px;">`;
                    bubble.style.background = 'transparent';
                    bubble.style.boxShadow = 'none';
                    bubble.style.border = 'none';
                    bubble.style.padding = '0';
                } else if (msg.quote) {
                    const qFrom = msg.quote.from === 'me' ? 'from-me' : 'from-other';
                    const isSticker = msg.quote.type === 'emoji' && msg.quote.content && msg.quote.content.startsWith('data:image');
                    const qContentHtml = isSticker
                        ? '<img src="' + escapeHtml(msg.quote.content) + '" class="quote-img" alt="表情">'
                        : escapeHtml(getMsgQuoteText({ type: msg.quote.type, content: msg.quote.content }));
                    bubble.innerHTML = '<div class="quote-block ' + qFrom + '"><div class="quote-name">' + escapeHtml(msg.quote.name) + '</div><div class="quote-content">' + qContentHtml + '</div></div><div class="msg-text">' + escapeHtml(msg.content) + '</div>';
                    bindQuoteJump(bubble, msg.quote.id);
                } else {
                    bubble.textContent = msg.content;
                }
                break;
            case 'image':
                bubble.style.padding = '4px';
                bubble.innerHTML = `<img src="${escapeHtml(msg.content)}" alt="image">`;
                if (msg.from === 'me') {
                    bubble.style.background = 'transparent';
                    bubble.style.boxShadow = 'none';
                    bubble.style.border = 'none';
                    bubble.style.padding = '0';
                }
                break;
            case 'audio': {
                bubble.classList.add('audio-bubble');
                const dur = Math.max(1, Math.round(msg.duration || 0));
                bubble.innerHTML = `
                    <span class="audio-icon">
                        <svg viewBox="0 0 24 24">
                            <rect class="wave-bar" x="3" y="9" width="2.6" height="11" rx="1.3" fill="currentColor"/>
                            <rect class="wave-bar" x="9" y="5" width="2.6" height="15" rx="1.3" fill="currentColor"/>
                            <rect class="wave-bar" x="15" y="9" width="2.6" height="11" rx="1.3" fill="currentColor"/>
                            <path d="M3 12a9 9 0 0 0 18 0" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
                        </svg>
                    </span>
                    <span class="audio-dur">${dur}"</span>`;
                bubble.title = '点击播放';
                bubble.addEventListener('click', () => playAudioBubble(bubble, msg.content));
                break;
            }
            case 'wordcard':
                bubble.textContent = msg.content;
                break;
            case 'pat':
                // 已在上方提前返回, 此处作为兜底
                bubble.textContent = msg.content;
                break;
        }

        // 所有消息(用户/梦角): 气泡上方显示 引用/收藏/删除 操作按键
        const actions = document.createElement('div');
        actions.className = 'msg-actions';
        // 引用
        const quoteBtn = document.createElement('button');
        quoteBtn.className = 'msg-action-btn quote-btn';
        quoteBtn.title = '引用';
        quoteBtn.innerHTML = '<svg viewBox="0 0 24 24" class="icon"><path d="M9 14l-5-5 5-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 9h9a5 5 0 0 1 5 5v1" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
        quoteBtn.addEventListener('click', () => quoteMessage(msg));
        // 收藏
        const favBtn = document.createElement('button');
        favBtn.className = 'msg-action-btn' + (msg.favorited ? ' favorited' : '');
        favBtn.title = msg.favorited ? '取消收藏' : '收藏';
        favBtn.innerHTML = msg.favorited
            ? '<svg viewBox="0 0 24 24" class="icon"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z" fill="currentColor" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/></svg>'
            : '<svg viewBox="0 0 24 24" class="icon"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>';
        favBtn.addEventListener('click', () => toggleFavorite(msg.id, favBtn));
        // 删除
        const delBtn = document.createElement('button');
        delBtn.className = 'msg-action-btn del-btn';
        delBtn.title = '删除';
        delBtn.innerHTML = '<svg viewBox="0 0 24 24" class="icon"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
        delBtn.addEventListener('click', () => deleteMessage(msg.id));
        actions.appendChild(quoteBtn);
        actions.appendChild(favBtn);
        actions.appendChild(delBtn);
        bw.appendChild(actions);

        bw.appendChild(bubble);
        // 用户消息: 时间 + 送达/已读状态; 梦角消息: 仅时间
        if (msg.from === 'me') {
            const meta = document.createElement('div');
            meta.className = 'msg-meta';
            meta.appendChild(time);
            const status = document.createElement('span');
            if (msg.status === 'read' && msg.readAt) {
                status.className = 'msg-status read';
                status.textContent = '已读';
            } else {
                status.className = 'msg-status sent';
                status.textContent = '送达';
            }
            meta.appendChild(status);
            bw.appendChild(meta);
        } else {
            bw.appendChild(time);
        }
        wrap.appendChild(avatar);
        wrap.appendChild(bw);
        return wrap;
    }
    function appendMessage(contactId, msg) {
        const c = getContact(contactId);
        if (!c) return;
        c.messages.push(msg);
        // 消息音效 (梦角消息: 后台也能听到; 用户消息: 仅当窗口可见时播放)
        try {
            const s = c.settings || {};
            if (s.soundEnabled) {
                const sid = msg.from === 'me' ? s.userMsgSound
                    : (msg.from === 'other' ? s.otherMsgSound : null);
                if (sid) playSound(sid);
            }
        } catch (e) {}
        // 梦角发消息时, 将该联系人所有未回信件标记为已回信
        if (msg.from === 'other' && state.letters) {
            state.letters.forEach(l => {
                if (l.contactId === contactId && !l.replied) {
                    l.replied = true;
                    l.repliedAt = Date.now();
                }
            });
        }
        saveData();
        if (state.currentContactId === contactId) {
            const container = $('messagesContainer');
            container.appendChild(buildMessageEl(msg, c));
            requestAnimationFrame(() => container.scrollTop = container.scrollHeight);
        } else if (msg.from === 'other') {
            // 不在当前聊天: 未读 +1, 弹出通知 (免打扰的群不弹提示)
            c.unread = (c.unread || 0) + 1;
            saveData();
            if (!c.muted) showNewMsgToast(c, msg);
        }
        renderChatList();
    }

    // ================= 发送消息 (我) =================
    function sendMessage({ type = 'text', content = '', duration = 0, quote = null } = {}) {
        const c = getContact(state.currentContactId);
        if (!c) return;
        // pat 类型允许空内容 (只显示"我 拍了拍 XX")
        if (type !== 'pat' && !content) return;
        const msg = {
            id: uuid(),
            from: 'me',
            type,
            content: content || '',
            timestamp: Date.now(),
            status: 'sent'
        };
        if (type === 'audio') msg.duration = duration;
        if (quote) msg.quote = quote;
        appendMessage(c.id, msg);
        // 触发回复: 拍一拍走独立的 schedulePatReply (1-2分钟延迟), 其他走 scheduleReply; 群聊走 scheduleGroupReply
        if (!c.isGroup) {
            if (type === 'pat') {
                schedulePatReply(c);
            } else {
                scheduleReply(c, msg);
            }
        } else if (type !== 'pat') {
            scheduleGroupReply(c, msg);
        }
    }

    // ================= 标记用户消息为已读 (梦角回复/主动发送时调用) =================
    function markUserMessagesRead(contactId) {
        const c = getContact(contactId);
        if (!c) return;
        const now = Date.now();
        let changed = false;
        c.messages.forEach(m => {
            if (m.from === 'me' && m.status !== 'read') {
                m.status = 'read';
                m.readAt = now;
                changed = true;
            }
        });
        if (!changed) return;
        saveData();
        // 正在查看该聊天: 局部更新 DOM 中的状态文字 (避免重渲染打断语音播放)
        if (state.currentContactId === contactId) {
            const container = $('messagesContainer');
            if (container) {
                container.querySelectorAll('.msg.sent').forEach(el => {
                    const statusEl = el.querySelector('.msg-status');
                    if (statusEl && !statusEl.classList.contains('read')) {
                        const msgId = el.dataset.msgId;
                        const msg = c.messages.find(mm => mm.id === msgId);
                        if (msg && msg.status === 'read') {
                            statusEl.classList.remove('sent');
                            statusEl.classList.add('read');
                            statusEl.textContent = '已读';
                        }
                    }
                });
            }
        }
    }

    // ================= 构建内容池 (仅字卡) =================
    function buildContentPool(s) {
        const pool = [];
        (s.wordcards || []).filter(w => !w.blocked).forEach(w => {
            if (w.reply && (w.reply + '').trim()) pool.push({ type: 'text', content: w.reply });
        });
        return pool;
    }
    // 随机取一个 Emoji
    function pickRandomEmoji(s) {
        const emojis = (s.emojis || []).map(e => typeof e === 'string' ? e : e.content).filter(c => c && (c + '').trim());
        if (emojis.length === 0) return null;
        return emojis[Math.floor(Math.random() * emojis.length)];
    }
    // 随机取一条拍一拍
    function pickRandomPat(s) {
        const pats = (s.pats || []).filter(p => !p.blocked && p.content && (p.content + '').trim());
        if (pats.length === 0) return null;
        return pats[Math.floor(Math.random() * pats.length)].content;
    }
    // 随机取一张表情库图片
    function pickRandomSticker(s) {
        const stickers = (s.stickers || []).filter(st => st.dataUrl);
        if (stickers.length === 0) return null;
        return stickers[Math.floor(Math.random() * stickers.length)].dataUrl;
    }
    // 随机取一条语音条
    function pickRandomVoice(s) {
        const voices = (s.voices || []).filter(v => !v.blocked && v.content);
        if (voices.length === 0) return null;
        return voices[Math.floor(Math.random() * voices.length)];
    }
    // 梦角引用: 从最近8条消息中随机选一条, 返回 quote 对象 (拍一拍消息不可被引用)
    function pickRandomQuote(contact) {
        const msgs = contact.messages;
        if (!msgs || msgs.length === 0) return null;
        const recent = msgs.filter(m => m.type !== 'pat').slice(-8);
        const picked = recent[Math.floor(Math.random() * recent.length)];
        if (!picked) return null;
        return {
            id: picked.id,
            from: picked.from,
            type: picked.type,
            name: picked.from === 'me' ? (state.me.nickname || '我') : (contact.nickname || ''),
            content: picked.content || ''
        };
    }
    // 发送自动消息: 拍一拍3%概率(每次回复独立判断一次) + 字卡后20%概率附带Emoji/表情库
    function sendAutoMessages(contact, count) {
        const s = contact.settings;
        const pool = buildContentPool(s);
        const picks = pickRandomWordcards(pool, count);
        let ts = Date.now();
        // 每条梦角消息前独立判断: 30%概率引用最近8条消息中的一条
        function rollQuote() {
            if (Math.random() < 0.3) return pickRandomQuote(contact);
            return null;
        }
        // 每次回复独立判断一次: 3%概率发送拍一拍 (与字卡平级)
        if (Math.random() < 0.03) {
            const patContent = pickRandomPat(s);
            if (patContent) {
                appendMessage(contact.id, { id: uuid(), from: 'other', type: 'pat', content: patContent, timestamp: ts++, quote: rollQuote() });
                return;
            }
        }
        picks.forEach(item => {
            // 每条消息独立判断类型: 5%语音条
            if (Math.random() < 0.05) {
                const voice = pickRandomVoice(s);
                if (voice) {
                    appendMessage(contact.id, { id: uuid(), from: 'other', type: 'audio', content: voice.content, timestamp: ts++, quote: rollQuote() });
                    return;
                }
            }
            // 每条消息独立判断类型: 20%表情库表情包, 80%字卡
            const isSticker = Math.random() < 0.2;
            if (isSticker) {
                const sticker = pickRandomSticker(s);
                if (sticker) {
                    appendMessage(contact.id, { id: uuid(), from: 'other', type: 'emoji', content: sticker, timestamp: ts++, quote: rollQuote() });
                    return;
                }
                // 无表情库内容时回退为字卡
            }
            // 字卡消息
            let textContent = item.content;
            // 字卡消息: 20%概率附带 Emoji
            if (Math.random() < 0.2) {
                const emoji = pickRandomEmoji(s);
                if (emoji) {
                    if (s.mixedMode) {
                        // 混合模式: Emoji拼入字卡文字, 50%在前, 50%在后
                        textContent = Math.random() < 0.5 ? emoji + textContent : textContent + emoji;
                    } else {
                        // 非混合模式: Emoji作为单独消息发出
                        appendMessage(contact.id, { id: uuid(), from: 'other', type: 'text', content: textContent, timestamp: ts++, quote: rollQuote() });
                        appendMessage(contact.id, { id: uuid(), from: 'other', type: 'emoji', content: emoji, timestamp: ts++, quote: rollQuote() });
                        return;
                    }
                }
            }
            appendMessage(contact.id, { id: uuid(), from: 'other', type: 'text', content: textContent, timestamp: ts++, quote: rollQuote() });
        });
    }
    // ================= 随机条数规则 75%/20%/5% =================
    function rollWcCount() {
        // 每次"梦角要发消息"独立判断一次发送几条字卡
        const r = Math.random();
        if (r < 0.75) return 1;
        if (r < 0.95) return 2;
        return 3;
    }
    function pickRandomWordcards(arr, n) {
        // 从 arr 中无放回随机挑 n 条; 当 arr.length < n 时, 取 min(arr.length, n) 条
        if (!arr || arr.length === 0) return [];
        const count = Math.min(arr.length, n);
        const idx = arr.map((_, i) => i);
        // Fisher-Yates shuffle
        for (let i = idx.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [idx[i], idx[j]] = [idx[j], idx[i]];
        }
        return idx.slice(0, count).map(k => arr[k]);
    }

    // ================= 回复逻辑 (随机抽取 1~3 条字卡) =================
    function scheduleReply(contact, userMsg) {
        stopContactReplyTimer(contact.id);
        const s = contact.settings;
        const min = Math.max(0, Number(s.replyMin) || 0);
        const max = Math.max(min, Number(s.replyMax) || min + 1);
        const delaySec = min + Math.random() * (max - min);
        // 显示正在输入 (输入框上方胶囊)
        if (state.currentContactId === contact.id) {
            $('typingStatusBar').classList.remove('hidden');
        }
        const t = setTimeout(() => {
            generateReply(contact, userMsg);
        }, delaySec * 1000);
        if (!state.timers[contact.id]) state.timers[contact.id] = {};
        state.timers[contact.id].replyTimer = t;
    }
    // 拍一拍回复: 1-2分钟随机延迟, 等待满1分钟后才显示正在输入
    function schedulePatReply(contact) {
        stopContactReplyTimer(contact.id);
        const delaySec = 60 + Math.random() * 60; // 60~120秒
        if (!state.timers[contact.id]) state.timers[contact.id] = {};
        // 正在输入: 延迟满60秒后才显示 (若总延迟<=60则不显示)
        if (delaySec > 60) {
            const typingT = setTimeout(() => {
                if (state.currentContactId === contact.id) {
                    $('typingStatusBar').classList.remove('hidden');
                }
            }, (delaySec - 60) * 1000);
            state.timers[contact.id].typingTimer = typingT;
        }
        const t = setTimeout(() => {
            generateReply(contact, null);
        }, delaySec * 1000);
        state.timers[contact.id].replyTimer = t;
    }
    function generateReply(contact, userMsg) {
        // 先清理 typing
        if (state.currentContactId === contact.id) {
            $('typingStatusBar').classList.add('hidden');
        }
        // 梦角决定回复 -> 标记该联系人所有未读用户消息为已读
        markUserMessagesRead(contact.id);
        const s = contact.settings;
        const pool = buildContentPool(s);
        if (pool.length === 0) {
            clearReplyTimer(contact.id);
            return;
        }
        const count = rollWcCount(); // 本次独立判断 1/2/3 条 (75%/20%/5%)
        sendAutoMessages(contact, count);
        clearReplyTimer(contact.id);
    }
    // ================= 群聊回复逻辑 (群内角色各自使用自己名下的"群聊字卡") =================
    function getGroupReplyPool(member) {
        return ((member.settings || {}).groupWordcards || [])
            .filter(w => !w.blocked && w.reply && (w.reply + '').trim())
            .map(w => String(w.reply).trim());
    }
    function scheduleGroupReply(group, userMsg) {
        const members = getGroupMembers(group);
        // 仅当群内存在配置了非空"群聊字卡"的角色时才回复
        const candidates = members
            .map(m => ({ member: m, pool: getGroupReplyPool(m) }))
            .filter(x => x.pool.length > 0);
        if (candidates.length === 0) return;
        stopContactReplyTimer(group.id);
        const s = group.settings;
        // 默认值与群聊设置页「回复时间」卡片一致 (最短 3 秒 / 最长 10 秒)
        const min = Math.max(0, Number(s.replyMin ?? 3) || 0);
        const max = Math.max(min, Number(s.replyMax ?? 10) || min + 1);
        // 随机挑选 1~N 位梦角回复 (N = 群内除我以外的梦角数量, 实际最多取可用角色数)
        const totalMembers = members.length;
        const wanted = 1 + Math.floor(Math.random() * Math.max(1, totalMembers));
        const replyCount = Math.min(wanted, candidates.length);
        // 随机抽取不重复的回复者
        const shuffled = candidates.slice();
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            const tmp = shuffled[i]; shuffled[i] = shuffled[j]; shuffled[j] = tmp;
        }
        const picked = shuffled.slice(0, replyCount);
        if (!state.timers[group.id]) state.timers[group.id] = {};
        // 仅 1 位回复: 沿用原规则, 延迟后连发 1~3 条
        if (replyCount === 1) {
            const delaySec = min + Math.random() * (max - min);
            if (state.currentContactId === group.id) {
                $('typingStatusBar').classList.remove('hidden');
            }
            const t = setTimeout(() => {
                if (state.currentContactId === group.id) {
                    $('typingStatusBar').classList.add('hidden');
                }
                markUserMessagesRead(group.id);
                const cand = picked[0];
                const count = rollWcCount();
                let ts = Date.now();
                pickRandomWordcards(cand.pool, count).forEach(text => {
                    appendMessage(group.id, {
                        id: uuid(),
                        from: 'other',
                        type: 'text',
                        content: text,
                        timestamp: ts++
                    });
                });
                clearReplyTimer(group.id);
            }, delaySec * 1000);
            state.timers[group.id].replyTimer = t;
            return;
        }
        // 多位回复: 每人只发 1 条, 首位在最短~最长秒内, 后续依次错开 1~3 秒
        if (state.currentContactId === group.id) {
            $('typingStatusBar').classList.remove('hidden');
        }
        let idx = 0;
        const scheduleNextReply = () => {
            if (idx >= picked.length) { clearReplyTimer(group.id); return; }
            const cand = picked[idx];
            const gapSec = idx === 0
                ? min + Math.random() * (max - min)
                : 1 + Math.random() * 2;
            idx++;
            const t = setTimeout(() => {
                markUserMessagesRead(group.id);
                if (state.currentContactId === group.id && idx >= picked.length) {
                    $('typingStatusBar').classList.add('hidden');
                }
                const text = pickRandomWordcards(cand.pool, 1)[0];
                if (text) {
                    appendMessage(group.id, {
                        id: uuid(),
                        from: 'other',
                        type: 'text',
                        content: text,
                        timestamp: Date.now()
                    });
                }
                scheduleNextReply();
            }, Math.round(gapSec * 1000));
            state.timers[group.id].replyTimer = t;
        };
        scheduleNextReply();
    }
    // ================= 群聊自主聊天 =================
    function stopGroupAutoChat(groupId) {
        const tm = state.timers[groupId];
        if (!tm) return;
        if (tm.autoChatTimer) { clearTimeout(tm.autoChatTimer); tm.autoChatTimer = null; }
        if (tm.autoChatStepTimer) { clearTimeout(tm.autoChatStepTimer); tm.autoChatStepTimer = null; }
    }
    function startGroupAutoChat(group) {
        if (!group || !group.isGroup) return;
        stopGroupAutoChat(group.id);
        const a = group.settings.autoChat || {};
        if (!a.enabled) return;
        const minM = Math.max(1, Number(a.minInterval) || 1);
        const maxM = Math.max(minM, Number(a.maxInterval) || 60);
        const delayMs = (minM + Math.random() * (maxM - minM)) * 60 * 1000;
        const t = setTimeout(() => runGroupAutoChatRound(group.id), delayMs);
        if (!state.timers[group.id]) state.timers[group.id] = {};
        state.timers[group.id].autoChatTimer = t;
    }
    function runGroupAutoChatRound(groupId) {
        const group = getContact(groupId);
        if (!group || !group.isGroup || !(group.settings.autoChat || {}).enabled) return;
        const a = group.settings.autoChat || {};
        const candidates = getGroupMembers(group)
            .map(m => ({ member: m, pool: getGroupReplyPool(m) }))
            .filter(x => x.pool.length > 0);
        // 群内无角色配置群聊字卡: 本轮不发言, 继续等待下一轮
        if (candidates.length === 0) {
            startGroupAutoChat(group);
            return;
        }
        const minC = Math.max(1, Number(a.minPerRound) || 3);
        const maxC = Math.max(minC, Number(a.maxPerRound) || 10);
        const total = minC + Math.floor(Math.random() * (maxC - minC + 1));
        let step = 0;
        let lastMemberId = null;
        const sendOne = () => {
            const g = getContact(groupId);
            if (!g || !g.isGroup || !(g.settings.autoChat || {}).enabled) return;
            const list = getGroupMembers(g)
                .map(m => ({ member: m, pool: getGroupReplyPool(m) }))
                .filter(x => x.pool.length > 0);
            if (list.length === 0) { startGroupAutoChat(g); return; }
            // 尽量让相邻两条来自不同角色
            let avail = list;
            if (list.length > 1 && lastMemberId) {
                const others = list.filter(x => x.member.id !== lastMemberId);
                if (others.length > 0) avail = others;
            }
            const pick = avail[Math.floor(Math.random() * avail.length)];
            lastMemberId = pick.member.id;
            const text = pickRandomWordcards(pick.pool, 1)[0];
            if (text) {
                appendMessage(groupId, {
                    id: uuid(),
                    from: 'other',
                    type: 'text',
                    content: text,
                    timestamp: Date.now()
                });
            }
            step++;
            if (step < total) {
                const tm = state.timers[groupId] = state.timers[groupId] || {};
                tm.autoChatStepTimer = setTimeout(sendOne, 1000 + Math.random() * 2000);
            } else {
                startGroupAutoChat(getContact(groupId));
            }
        };
        const tm = state.timers[groupId] = state.timers[groupId] || {};
        tm.autoChatStepTimer = setTimeout(sendOne, 1000 + Math.random() * 2000);
    }

    // ================= 角色自建群聊 =================
    const SELF_BUILD_CYCLE_MIN = { chill: 30, standard: 10, active: 3 };
    function getSelfBuiltGroupCount() {
        return (state.contacts || []).filter(c => c.isGroup && c.selfBuilt).length;
    }
    function createSelfBuiltGroup(sourceGroup) {
        const sb = sourceGroup.settings.selfBuild || {};
        const limit = Math.max(1, Number(sb.maxGroups) || 5);
        if (getSelfBuiltGroupCount() >= limit) return { ok: false, reason: 'limit' };
        const members = getGroupMembers(sourceGroup)
            .filter(m => getGroupReplyPool(m).length > 0);
        if (members.length === 0) return { ok: false, reason: 'noCards' };
        const creator = members[Math.floor(Math.random() * members.length)];
        const ratio = Math.min(100, Math.max(0, Number(sb.lurkRatio ?? 30)));
        const isLurk = Math.random() * 100 < ratio;
        // 梦角拉人群: 随机邀请部分角色 (也可能拉到全部人)
        const others = (state.contacts || []).filter(c => !c.isGroup && c.id !== creator.id);
        const pickCount = others.length === 0 ? 0 : 1 + Math.floor(Math.random() * others.length);
        const shuffledOthers = others.slice();
        for (let i = shuffledOthers.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            const tmp = shuffledOthers[i]; shuffledOthers[i] = shuffledOthers[j]; shuffledOthers[j] = tmp;
        }
        const picked = shuffledOthers.slice(0, pickCount);
        const name = `${creator.nickname || '角色'}拉的群`;
        const g = createContact(name, '', '');
        g.isGroup = true;
        g.memberIds = [creator.id].concat(picked.map(c => c.id));
        g.ownerId = creator.id; // 群主 = 建群的梦角
        g.selfBuilt = true;     // 标记为角色自建群
        g.lurk = isLurk;        // 潜水群: 我不在群内, 只能看不能发言
        saveData();
        renderChatList();
        startGroupOwnerTimer(g);
        return { ok: true, group: g, lurk: isLurk };
    }
    function stopSelfBuildTimer(groupId) {
        const tm = state.timers[groupId];
        if (tm && tm.selfBuildTimer) {
            clearTimeout(tm.selfBuildTimer);
            tm.selfBuildTimer = null;
        }
    }
    function startSelfBuildTimer(group) {
        if (!group || !group.isGroup) return;
        stopSelfBuildTimer(group.id);
        const sb = group.settings.selfBuild || {};
        if (!sb.enabled) return;
        const cycleMin = SELF_BUILD_CYCLE_MIN[sb.activity] || 10;
        const t = setTimeout(() => {
            const g = getContact(group.id);
            if (!g || !g.isGroup) return;
            const s2 = g.settings.selfBuild || {};
            if (!s2.enabled) return;
            const p = Math.min(100, Math.max(0, Number(s2.probability ?? 50)));
            if (Math.random() * 100 < p) createSelfBuiltGroup(g);
            startSelfBuildTimer(g);
        }, cycleMin * 60 * 1000);
        if (!state.timers[group.id]) state.timers[group.id] = {};
        state.timers[group.id].selfBuildTimer = t;
    }

    // ================= 自建群: 群主(梦角)随机管理 & 入群申请 =================
    function getGroupOwnerId(group) {
        return (group && group.ownerId) || 'me';
    }
    function getGroupOwnerName(group) {
        const id = getGroupOwnerId(group);
        if (id === 'me') return '我';
        const c = getContact(id);
        return c ? (c.nickname || '梦角') : '群主';
    }
    function getGroupNonMembers(group) {
        const inGroup = new Set((group && group.memberIds) || []);
        return (state.contacts || []).filter(c => !c.isGroup && !inGroup.has(c.id));
    }
    function addGroupNotice(groupId, content, extra) {
        appendMessage(groupId, Object.assign({
            id: uuid(),
            from: 'system',
            type: 'notice',
            content,
            timestamp: Date.now()
        }, extra || {}));
    }
    function stopGroupOwnerTimer(groupId) {
        const tm = state.timers[groupId];
        if (tm && tm.ownerTimer) {
            clearTimeout(tm.ownerTimer);
            tm.ownerTimer = null;
        }
    }
    function startGroupOwnerTimer(group) {
        if (!group || !group.isGroup || !group.selfBuilt) return;
        stopGroupOwnerTimer(group.id);
        // 完全随机: 每次事件间隔 1~5 分钟
        const delayMs = (1 + Math.random() * 4) * 60 * 1000;
        const t = setTimeout(() => runGroupOwnerEvent(group.id), delayMs);
        if (!state.timers[group.id]) state.timers[group.id] = {};
        state.timers[group.id].ownerTimer = t;
    }
    function runGroupOwnerEvent(groupId) {
        const g = getContact(groupId);
        if (!g || !g.isGroup || !g.selfBuilt) return;
        if (!g.memberIds) g.memberIds = [];
        const ownerIsMe = getGroupOwnerId(g) === 'me';
        const nonMembers = getGroupNonMembers(g);
        const actions = [];
        if (nonMembers.length > 0) actions.push('request');
        if (!ownerIsMe) {
            if (nonMembers.length > 0) actions.push('invite');
            if (g.memberIds.length > 1) actions.push('kick');
            if (!g.lurk) actions.push('transfer');
        }
        if (actions.length === 0) { startGroupOwnerTimer(g); return; }
        const act = actions[Math.floor(Math.random() * actions.length)];
        if (act === 'request') {
            const applicant = nonMembers[Math.floor(Math.random() * nonMembers.length)];
            const name = applicant.nickname || '梦角';
            if (ownerIsMe) {
                // 我是群主: 显示待审批提示, 由用户点击同意/拒绝
                addGroupNotice(groupId, `${name}申请入群`, {
                    request: { contactId: applicant.id, name },
                    pending: true
                });
            } else {
                // 梦角群主: 自动同意/拒绝
                const ok = Math.random() < 0.5;
                if (ok && !g.memberIds.includes(applicant.id)) g.memberIds.push(applicant.id);
                saveData();
                addGroupNotice(groupId, `${name}申请入群，群主${ok ? '同意' : '拒绝'}`);
            }
        } else if (act === 'invite') {
            const c = nonMembers[Math.floor(Math.random() * nonMembers.length)];
            if (c && !g.memberIds.includes(c.id)) {
                g.memberIds.push(c.id);
                saveData();
                addGroupNotice(groupId, `群主邀请${c.nickname}加入了群聊`);
            }
        } else if (act === 'kick') {
            const list = g.memberIds.filter(id => id !== g.ownerId);
            if (list.length > 0) {
                const id = list[Math.floor(Math.random() * list.length)];
                const c = getContact(id);
                g.memberIds = g.memberIds.filter(x => x !== id);
                saveData();
                addGroupNotice(groupId, `群主将${c ? c.nickname : '成员'}踢出群聊`);
            }
        } else if (act === 'transfer') {
            g.ownerId = 'me';
            saveData();
            addGroupNotice(groupId, '群主将群转让给了你');
        }
        const g2 = getContact(groupId);
        if (g2) startGroupOwnerTimer(g2);
    }
    // 我是群主时: 处理入群申请
    function respondJoinRequest(msgId, act) {
        const g = getContact(state.currentContactId);
        if (!g || !g.isGroup) return;
        if (getGroupOwnerId(g) !== 'me') return;
        const msg = (g.messages || []).find(m => m.id === msgId);
        if (!msg || !msg.request || msg.pending === false) return;
        const req = msg.request;
        if (act === 'approve') {
            if (!g.memberIds.includes(req.contactId)) g.memberIds.push(req.contactId);
            msg.content = `${req.name}申请入群，群主同意`;
        } else {
            msg.content = `${req.name}申请入群，群主拒绝`;
        }
        msg.pending = false;
        delete msg.request;
        saveData();
        renderMessages();
        showSimpleToast(act === 'approve' ? `已同意${req.name}入群` : `已拒绝${req.name}的入群申请`);
    }

    function clearReplyTimer(contactId) {
        const tm = state.timers[contactId];
        if (!tm) return;
        if (tm.replyTimer) { clearTimeout(tm.replyTimer); tm.replyTimer = null; }
        if (tm.typingTimer) { clearTimeout(tm.typingTimer); tm.typingTimer = null; }
    }
    function stopContactReplyTimer(contactId) {
        if (contactId) clearReplyTimer(contactId);
        else if (state.currentContactId) clearReplyTimer(state.currentContactId);
    }

    // ================= 主动发消息 =================
    function startContactAutoTimer(contact) {
        if (!contact) return;
        stopContactAutoTimer(contact.id);
        if (!contact.settings.autoSend) return;
        const interval = Math.max(1, Number(contact.settings.autoInterval) || 60);
        const ms = interval * 60 * 1000;
        // 方式1: 每次在 0~设置间隔 之间随机一个延迟, 刷新后重新随机
        const delay = Math.max(1000, Math.random() * ms);
        const t = setTimeout(() => {
            triggerAutoSend(contact.id);
        }, delay);
        if (!state.timers[contact.id]) state.timers[contact.id] = {};
        state.timers[contact.id].autoTimer = t;
    }
    function stopContactAutoTimer(contactId) {
        if (state.timers[contactId] && state.timers[contactId].autoTimer) {
            clearTimeout(state.timers[contactId].autoTimer);
            state.timers[contactId].autoTimer = null;
        }
    }
    function triggerAutoSend(contactId) {
        const c = getContact(contactId);
        if (!c) return;
        // 梦角主动发送 -> 标记该联系人所有未读用户消息为已读
        markUserMessagesRead(contactId);
        const pool = buildContentPool(c.settings);
        if (pool.length > 0) {
            // 主动推送也应用相同 75%/20%/5% 条数概率规则
            const count = rollWcCount();
            sendAutoMessages(c, count);
        }
        c.lastAutoSend = Date.now();
        saveData();
        // 重启下一次定时
        startContactAutoTimer(c);
    }
    function stopContactTimers(contactId) {
        clearReplyTimer(contactId);
        stopContactAutoTimer(contactId);
        stopStatusTimer(contactId);
        stopGroupAutoChat(contactId);
        stopSelfBuildTimer(contactId);
        stopGroupOwnerTimer(contactId);
        if (state.timers[contactId]) delete state.timers[contactId];
    }
    function stopAllTimers() {
        Object.keys(state.timers).forEach(id => stopContactTimers(id));
    }
    function startAllAutoTimers() {
        state.contacts.forEach(c => {
            startContactAutoTimer(c);
            if (c.isGroup) {
                startGroupAutoChat(c);
                startSelfBuildTimer(c);
                startGroupOwnerTimer(c);
            }
        });
    }

    // ================= 对方状态定时更新 =================
    function updateContactStatus(contactId) {
        const c = getContact(contactId);
        if (!c) return;
        if (state.currentContactId !== contactId) return;
        const statuses = (c.settings.statuses || []).filter(s => !s.blocked && s.content && (s.content + '').trim());
        const statusEl = $('detailStatus');
        if (statuses.length > 0) {
            statusEl.textContent = statuses[Math.floor(Math.random() * statuses.length)].content;
        } else {
            statusEl.textContent = '';
        }
        statusEl.setAttribute('data-status-contact-id', contactId);
    }
    function startStatusTimer(contact) {
        if (!contact) return;
        stopStatusTimer(contact.id);
        const delayMs = (1 + Math.random() * 7) * 60 * 60 * 1000; // 1~8小时
        const t = setTimeout(() => {
            updateContactStatus(contact.id);
            startStatusTimer(contact);
        }, delayMs);
        if (!state.timers[contact.id]) state.timers[contact.id] = {};
        state.timers[contact.id].statusTimer = t;
    }
    function stopStatusTimer(contactId) {
        if (state.timers[contactId] && state.timers[contactId].statusTimer) {
            clearTimeout(state.timers[contactId].statusTimer);
            state.timers[contactId].statusTimer = null;
        }
    }

    // ================= Toast 通知 =================
    let _newMsgToastTimer = null;
    function showNewMsgToast(contact, msg) {
        const container = $('toastContainer');
        // 新消息覆盖旧消息, 不堆叠
        container.innerHTML = '';
        if (_newMsgToastTimer) { clearTimeout(_newMsgToastTimer); _newMsgToastTimer = null; }
        const t = document.createElement('div');
        t.className = 'new-msg-toast';
        const text = summarizeContent(msg);
        t.innerHTML = `
            <div class="nmt-avatar" style="background-image:url('${escapeHtml(contact.avatar)}');background-size:cover;background-position:center;"></div>
            <div class="nmt-body">
                <div class="nmt-name">${escapeHtml(contact.nickname)}</div>
                <div class="nmt-msg">${escapeHtml(text)}</div>
            </div>
        `;
        let startX = 0, currentX = 0, dragging = false, removed = false;
        const onDown = (x) => { startX = x; currentX = x; dragging = true; t.style.transition = 'none'; };
        const onMove = (x) => {
            if (!dragging) return;
            currentX = x;
            const dx = currentX - startX;
            t.style.transform = `translateX(${dx}px)`;
            t.style.opacity = Math.max(0.4, 1 - Math.abs(dx) / 200);
        };
        const onUp = () => {
            if (!dragging) return;
            dragging = false;
            const dx = currentX - startX;
            t.style.transition = 'transform 0.25s var(--ease), opacity 0.25s var(--ease)';
            if (Math.abs(dx) > 80) {
                removeToast();
            } else {
                t.style.transform = 'translateX(0)';
                t.style.opacity = '1';
            }
        };
        const removeToast = () => {
            if (removed) return;
            removed = true;
            if (_newMsgToastTimer) { clearTimeout(_newMsgToastTimer); _newMsgToastTimer = null; }
            t.style.transition = 'transform 0.25s var(--ease), opacity 0.25s var(--ease)';
            t.style.transform = `translateX(${(currentX - startX) >= 0 ? '' : '-'}120%)`;
            t.style.opacity = '0';
            setTimeout(() => { if (t.parentNode) t.remove(); }, 250);
        };
        t.addEventListener('touchstart', e => onDown(e.touches[0].clientX), { passive: true });
        t.addEventListener('touchmove', e => onMove(e.touches[0].clientX), { passive: true });
        t.addEventListener('touchend', onUp);
        t.addEventListener('mousedown', e => { e.preventDefault(); onDown(e.clientX); });
        window.addEventListener('mousemove', e => onMove(e.clientX));
        window.addEventListener('mouseup', onUp);
        t.addEventListener('click', () => {
            if (Math.abs(currentX - startX) < 5) {
                removeToast();
                openChat(contact.id);
            }
        });
        container.appendChild(t);
        _newMsgToastTimer = setTimeout(removeToast, 4000);
    }
    // 单条 toast: 成功(绿色✓) / 失败(红色✕), 2秒消失, 同时只显示一条
    let _toastTimer = null;
    function showSimpleToast(text, type) {
        const isError = type === 'error';
        const container = $('toastContainer');
        // 清除已有 toast (只保留一条)
        container.innerHTML = '';
        if (_toastTimer) { clearTimeout(_toastTimer); _toastTimer = null; }
        const t = document.createElement('div');
        t.className = 'toast' + (isError ? ' toast-error' : ' toast-success');
        const iconSvg = isError
            ? '<path d="M18 6 6 18M6 6l12 12" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>'
            : '<path d="M20 6 9 17l-5-5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>';
        t.innerHTML = `
            <div class="t-icon">${iconSvg}</div>
            <div class="t-msg">${escapeHtml(text)}</div>
        `;
        container.appendChild(t);
        _toastTimer = setTimeout(() => {
            t.classList.add('hide');
            setTimeout(() => { if (t.parentNode) t.remove(); }, 300);
            _toastTimer = null;
        }, 2000);
    }

    // ================= Modal 控制 =================
    function openModal(id) {
        const m = $(id);
        if (m) {
            m.classList.add('show');
            // 聚焦第一个可输入
            const first = m.querySelector('input[type=text]:not([hidden]), textarea');
            setTimeout(() => first && first.focus(), 350);
        }
    }
    function closeModal(id) {
        const m = $(id);
        if (m) m.classList.remove('show');
    }
    function closeAllModals() {
        $$('.modal-mask.show').forEach(m => m.classList.remove('show'));
    }

    // ================= 视频通话 =================
    let vcTimer = null;
    let vcConnectTimer = null;
    let vcStartTime = 0;
    // 梦角来电
    let incomingCheckTimer = null;   // 来电检查定时器 (15~60分钟)
    let incomingTimeout = null;      // 来电30秒未操作超时
    let incomingContact = null;      // 当前来电联系人

    function openVideoCall(c) {
        // 设置联系人信息
        $('vcName').textContent = c.nickname;
        const avatar = $('vcAvatar');
        if (c.avatar) {
            avatar.style.backgroundImage = `url("${c.avatar}")`;
        } else {
            avatar.style.backgroundImage = '';
        }
        // 同步胶囊信息
        $('vcPillName').textContent = c.nickname;
        $('vcPillTime').textContent = '00:00';
        const pillAvatar = $('vcPillAvatar');
        if (c.avatar) {
            pillAvatar.style.backgroundImage = `url("${c.avatar}")`;
        } else {
            pillAvatar.style.backgroundImage = '';
        }
        // 重置状态
        $('vcStatusText').textContent = '连接中';
        $('vcSubText').textContent = '正在连接';
        $('vcSubText').classList.remove('hidden');
        $('vcPianoKeys').classList.add('hidden');
        const dots = document.querySelector('#videoCallModal .vc-dots');
        dots.classList.remove('hidden');
        // 重置沉浸模式
        const modal = $('videoCallModal');
        modal.classList.remove('immersive');
        $('vcImmersiveBtn').classList.remove('active');
        // 重置尺寸和尺寸菜单
        modal.classList.remove('vc-size-mini', 'vc-size-small', 'vc-size-large');
        modal.classList.add('vc-size-standard');
        $('vcSizeMenu').classList.add('hidden');
        $$('#vcSizeMenu .vc-size-item').forEach(i => i.classList.remove('active'));
        document.querySelector('#vcSizeMenu [data-size="standard"]').classList.add('active');
        // 重置背景
        modal.style.backgroundImage = '';
        // 重置位置和尺寸为居中
        modal.style.left = '0px';
        modal.style.top = '0px';
        modal.style.width = '';
        modal.style.height = '';
        modal.style.zoom = '';
        // 显示弹窗
        $('videoCallMask').classList.add('show');
        // 居中定位（用 offsetWidth 避免 transform 影响）
        requestAnimationFrame(() => {
            const mask = $('videoCallMask');
            modal.style.left = ((mask.clientWidth - modal.offsetWidth) / 2) + 'px';
            modal.style.top = ((mask.clientHeight - modal.offsetHeight) / 2) + 'px';
        });
        // 模拟接通: 1~30 秒随机等待后, 35% 概率梦角挂断, 65% 概率正常接通
        const delay = 1000 + Math.random() * 29000;
        vcConnectTimer = setTimeout(() => {
            if (Math.random() < 0.35) {
                // 梦角挂断
                rejectVideoCall();
            } else {
                // 正常接通
                $('vcStatusText').textContent = '00:00';
                $('vcSubText').classList.add('hidden');
                $('vcPianoKeys').classList.remove('hidden');
                dots.classList.add('hidden');
                vcStartTime = Date.now();
                startVideoCallTimer();
            }
        }, delay);
    }
    function rejectVideoCall() {
        if (vcConnectTimer) { clearTimeout(vcConnectTimer); vcConnectTimer = null; }
        // 随机抽取一条挂断提示词
        const tips = ['未接听', '拒绝了通话', '暂时无法接听', '正在忙，无法接听'];
        const tip = tips[Math.floor(Math.random() * tips.length)];
        const nickname = $('vcName').textContent;
        appendMessage(state.currentContactId, {
            id: 'call_missed_' + Date.now(),
            type: 'call_missed',
            from: 'other',
            content: `${nickname} ${tip}`,
            timestamp: Date.now()
        });
        $('videoCallMask').classList.remove('show');
        $('videoCallModal').classList.remove('immersive');
        $('vcImmersiveBtn').classList.remove('active');
        $('vcPill').classList.add('hidden');
    }
    function closeVideoCall() {
        if (vcConnectTimer) { clearTimeout(vcConnectTimer); vcConnectTimer = null; }
        stopVideoCallTimer();
        // 已接通时: 写入通话记录消息 (无论谁发起, 显示一致)
        if (vcStartTime > 0) {
            const duration = Math.floor((Date.now() - vcStartTime) / 1000);
            appendMessage(state.currentContactId, {
                id: 'call_' + Date.now(),
                type: 'call',
                from: 'me',
                duration: duration,
                timestamp: Date.now()
            });
            vcStartTime = 0;
        }
        $('videoCallMask').classList.remove('show');
        $('videoCallModal').classList.remove('immersive');
        $('vcImmersiveBtn').classList.remove('active');
        $('vcPill').classList.add('hidden');
    }

    // ================= 梦角来电 =================
    // 调度: 每 15~60 分钟随机检查一次, 25% 概率梦角主动来电
    function scheduleIncomingCallCheck() {
        if (incomingCheckTimer) { clearTimeout(incomingCheckTimer); incomingCheckTimer = null; }
        const delay = (15 + Math.random() * 45) * 60 * 1000; // 15~60 分钟
        incomingCheckTimer = setTimeout(() => {
            // 正在通话中或已有来电时不触发
            if (vcStartTime > 0 || incomingContact) {
                scheduleIncomingCallCheck();
                return;
            }
            if (Math.random() < 0.25) {
                // 随机选取一个联系人来电
                const validContacts = state.contacts.filter(c => !c.isGroup);
                if (validContacts.length > 0) {
                    const contact = validContacts[Math.floor(Math.random() * validContacts.length)];
                    showIncomingCall(contact);
                }
            }
            scheduleIncomingCallCheck();
        }, delay);
    }
    // 显示来电弹窗
    function showIncomingCall(contact) {
        incomingContact = contact;
        $('incomingName').textContent = contact.nickname;
        const avatar = $('incomingAvatar');
        if (contact.avatar) {
            avatar.style.backgroundImage = `url("${contact.avatar}")`;
        } else {
            avatar.style.backgroundImage = '';
        }
        $('incomingCallMask').classList.add('show');
        // 30 秒未操作视为未接听
        if (incomingTimeout) { clearTimeout(incomingTimeout); incomingTimeout = null; }
        incomingTimeout = setTimeout(handleIncomingTimeout, 30 * 1000);
    }
    // 关闭来电弹窗并清理超时
    function hideIncomingCall() {
        if (incomingTimeout) { clearTimeout(incomingTimeout); incomingTimeout = null; }
        incomingContact = null;
        $('incomingCallMask').classList.remove('show');
    }
    // 接听来电: 切换到现有通话弹窗并直接接通
    function answerIncomingCall() {
        if (!incomingContact) return;
        const contact = incomingContact;
        hideIncomingCall();
        openVideoCall(contact);
        // 清除接通等待定时器, 直接进入接通状态
        if (vcConnectTimer) { clearTimeout(vcConnectTimer); vcConnectTimer = null; }
        $('vcStatusText').textContent = '00:00';
        $('vcSubText').classList.add('hidden');
        $('vcPianoKeys').classList.remove('hidden');
        document.querySelector('#videoCallModal .vc-dots').classList.add('hidden');
        vcStartTime = Date.now();
        startVideoCallTimer();
    }
    // 拒绝来电
    function rejectIncomingCall() {
        if (!incomingContact) return;
        const callerName = incomingContact.nickname;
        const myName = state.me ? state.me.nickname : '我';
        appendMessage(incomingContact.id, {
            id: 'call_rejected_' + Date.now(),
            type: 'call_missed',
            from: 'other',
            content: `${myName}拒绝了${callerName}的视频通话`,
            timestamp: Date.now()
        });
        hideIncomingCall();
    }
    // 30 秒未操作: 视为未接听
    function handleIncomingTimeout() {
        if (!incomingContact) return;
        const callerName = incomingContact.nickname;
        const myName = state.me ? state.me.nickname : '我';
        appendMessage(incomingContact.id, {
            id: 'call_missed_timeout_' + Date.now(),
            type: 'call_missed',
            from: 'other',
            content: `${myName}未接听${callerName}的来电`,
            timestamp: Date.now()
        });
        hideIncomingCall();
    }

    function toggleVideoCallImmersive() {
        const modal = $('videoCallModal');
        const btn = $('vcImmersiveBtn');
        const immersive = modal.classList.toggle('immersive');
        btn.classList.toggle('active', immersive);
    }
    function startVideoCallTimer() {
        stopVideoCallTimer();
        vcTimer = setInterval(() => {
            const elapsed = Math.floor((Date.now() - vcStartTime) / 1000);
            const timeStr = formatVideoCallTime(elapsed);
            $('vcStatusText').textContent = timeStr;
            $('vcPillTime').textContent = timeStr;
        }, 1000);
    }
    function stopVideoCallTimer() {
        if (vcTimer) { clearInterval(vcTimer); vcTimer = null; }
    }
    function formatVideoCallTime(totalSeconds) {
        const h = Math.floor(totalSeconds / 3600);
        const m = Math.floor((totalSeconds % 3600) / 60);
        const s = totalSeconds % 60;
        const pad = n => String(n).padStart(2, '0');
        if (h > 0) {
            return `${pad(h)}:${pad(m)}:${pad(s)}`;
        }
        return `${pad(m)}:${pad(s)}`;
    }

    // ================= 头像裁剪 =================
    function openAvatarCrop(b64, target) {
        state.cropTarget = target;
        const modal = document.querySelector('#avatarCropModal .modal-title');
        if (modal) modal.textContent = target === 'cover' ? '裁剪封面' : (target === 'feedComment' ? '裁剪图片' : '裁剪头像');
        const img = $('avatarCropImg');
        img.src = b64;
        img.onload = () => {
            const area = $('avatarCropArea');
            const box = $('avatarCropBox');
            const aw = area.clientWidth;
            const ah = area.clientHeight;
            const iw = img.clientWidth;
            const ih = img.clientHeight;
            const ox = (aw - iw) / 2;
            const oy = (ah - ih) / 2;
            if (target === 'cover') {
                // 3:2 宽幅裁剪框
                let bw = iw * 0.8;
                let bh = bw * 2 / 3;
                if (bh > ih * 0.8) { bh = ih * 0.8; bw = bh * 3 / 2; }
                box.style.left = (ox + (iw - bw) / 2) + 'px';
                box.style.top = (oy + (ih - bh) / 2) + 'px';
                box.style.width = bw + 'px';
                box.style.height = bh + 'px';
            } else if (target === 'feedComment') {
                // 自由比例裁剪框（初始化为图片宽80%高60%）
                const bw = iw * 0.8;
                const bh = ih * 0.6;
                box.style.left = (ox + (iw - bw) / 2) + 'px';
                box.style.top = (oy + (ih - bh) / 2) + 'px';
                box.style.width = bw + 'px';
                box.style.height = bh + 'px';
            } else {
                const size = Math.min(iw, ih) * 0.6;
                box.style.left = (ox + (iw - size) / 2) + 'px';
                box.style.top = (oy + (ih - size) / 2) + 'px';
                box.style.width = size + 'px';
                box.style.height = size + 'px';
            }
            openModal('avatarCropModal');
        };
    }
    function bindAvatarCropEvents() {
        const box = $('avatarCropBox');
        const area = $('avatarCropArea');
        let mode = null, startX, startY, startL, startT, startW, startH;
        const onMove = e => {
            if (!mode) return;
            e.preventDefault();
            const cx = (e.touches ? e.touches[0].clientX : e.clientX);
            const cy = (e.touches ? e.touches[0].clientY : e.clientY);
            const dx = cx - startX;
            const dy = cy - startY;
            const img = $('avatarCropImg');
            const aw = area.clientWidth, ah = area.clientHeight;
            const iw = img.clientWidth, ih = img.clientHeight;
            const minX = (aw - iw) / 2, maxX = (aw + iw) / 2;
            const minY = (ah - ih) / 2, maxY = (ah + ih) / 2;
            let l = startL, t = startT, w = startW, h = startH;
            if (mode === 'move') {
                l = Math.max(minX, Math.min(maxX - w, startL + dx));
                t = Math.max(minY, Math.min(maxY - h, startT + dy));
            } else {
                if (mode.includes('e')) w = Math.max(20, startW + dx);
                if (mode.includes('s')) h = Math.max(20, startH + dy);
                if (mode.includes('w')) { const nw = Math.max(20, startW - dx); l = startL + (startW - nw); w = nw; }
                if (mode.includes('n')) { const nh = Math.max(20, startH - dy); t = startT + (startH - nh); h = nh; }
            }
            box.style.left = l + 'px';
            box.style.top = t + 'px';
            box.style.width = w + 'px';
            box.style.height = h + 'px';
        };
        const onUp = () => { mode = null; };
        box.addEventListener('mousedown', e => {
            if (e.target.classList.contains('wc-crop-handle')) {
                const h = e.target;
                if (h.classList.contains('wc-crop-handle-nw')) mode = 'nw';
                else if (h.classList.contains('wc-crop-handle-ne')) mode = 'ne';
                else if (h.classList.contains('wc-crop-handle-sw')) mode = 'sw';
                else if (h.classList.contains('wc-crop-handle-se')) mode = 'se';
            } else {
                mode = 'move';
            }
            startX = e.clientX; startY = e.clientY;
            startL = parseFloat(box.style.left); startT = parseFloat(box.style.top);
            startW = parseFloat(box.style.width); startH = parseFloat(box.style.height);
            e.preventDefault();
        });
        box.addEventListener('touchstart', e => {
            if (e.target.classList.contains('wc-crop-handle')) {
                const h = e.target;
                if (h.classList.contains('wc-crop-handle-nw')) mode = 'nw';
                else if (h.classList.contains('wc-crop-handle-ne')) mode = 'ne';
                else if (h.classList.contains('wc-crop-handle-sw')) mode = 'sw';
                else if (h.classList.contains('wc-crop-handle-se')) mode = 'se';
            } else {
                mode = 'move';
            }
            const t = e.touches[0];
            startX = t.clientX; startY = t.clientY;
            startL = parseFloat(box.style.left); startT = parseFloat(box.style.top);
            startW = parseFloat(box.style.width); startH = parseFloat(box.style.height);
        }, { passive: false });
        document.addEventListener('mousemove', onMove);
        document.addEventListener('touchmove', onMove, { passive: false });
        document.addEventListener('mouseup', onUp);
        document.addEventListener('touchend', onUp);
        $('avatarCropConfirmBtn').addEventListener('click', () => {
            const img = $('avatarCropImg');
            const box = $('avatarCropBox');
            const area = $('avatarCropArea');
            const aw = area.clientWidth, ah = area.clientHeight;
            const iw = img.clientWidth, ih = img.clientHeight;
            const ox = (aw - iw) / 2, oy = (ah - ih) / 2;
            const bl = parseFloat(box.style.left) - ox;
            const bt = parseFloat(box.style.top) - oy;
            const bw = parseFloat(box.style.width);
            const bh = parseFloat(box.style.height);
            const nw = img.naturalWidth;
            const nh = img.naturalHeight;
            const sx = bl / iw * nw;
            const sy = bt / ih * nh;
            const sw = bw / iw * nw;
            const sh = bh / ih * nh;
            const canvas = document.createElement('canvas');
            canvas.width = sw;
            canvas.height = sh;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
            const cropped = canvas.toDataURL('image/png');
            if (state.cropTarget === 'new') {
                state.tempNewAvatar = cropped;
                const pv = $('newAvatarPreview');
                pv.style.backgroundImage = `url("${cropped}")`;
                pv.style.backgroundSize = 'cover';
                pv.style.backgroundPosition = 'center';
                pv.textContent = '';
            } else if (state.cropTarget === 'newGroup') {
                state.tempNewGroupAvatar = cropped;
                const pv = $('newGroupAvatarPreview');
                pv.style.backgroundImage = `url("${cropped}")`;
                pv.style.backgroundSize = 'cover';
                pv.style.backgroundPosition = 'center';
                pv.textContent = '';
            } else if (state.cropTarget === 'groupEdit') {
                // 群聊设置页更换群头像
                const c = getContact(state.currentContactId);
                if (c && c.isGroup) {
                    c.avatar = cropped;
                    saveData();
                    renderGroupSettingPage();
                    renderChatList();
                    showSimpleToast('群头像已更换');
                }
            } else if (state.cropTarget === 'edit') {
                state.tempEditAvatar = cropped;
                const pv = $('editAvatarPreview');
                pv.style.backgroundImage = `url("${cropped}")`;
                pv.style.backgroundSize = 'cover';
                pv.style.backgroundPosition = 'center';
                pv.textContent = '';
            } else if (state.cropTarget === 'me') {
                state.tempMeAvatar = cropped;
                const pv = $('meAvatarPreview');
                pv.style.backgroundImage = `url("${cropped}")`;
                pv.style.backgroundSize = 'cover';
                pv.style.backgroundPosition = 'center';
                pv.textContent = '';
            } else if (state.cropTarget === 'bg') {
                const c = getContact(state.currentContactId);
                if (c) {
                    if (!c.settings.customBgs) c.settings.customBgs = [];
                    c.settings.customBgs.push(cropped);
                    c.settings.chatBg = cropped;
                    saveData();
                    renderBgOptions(c.settings.chatBg);
                    showSimpleToast('自定义背景已添加');
                }
            } else if (state.cropTarget === 'groupBg') {
                const c = getContact(state.currentContactId);
                if (c) {
                    if (!c.settings.customBgs) c.settings.customBgs = [];
                    c.settings.customBgs.push(cropped);
                    c.settings.chatBg = cropped;
                    saveData();
                    renderGroupBgOptions(c.settings.chatBg);
                    showSimpleToast('自定义背景已添加');
                }
            } else if (state.cropTarget === 'cover') {
                if (state.umContactId === null) {
                    state.me.coverImg = cropped;
                } else {
                    const c = getContact(state.umContactId);
                    if (c) c.coverImg = cropped;
                }
                saveData();
                const coverEl = $('userMomentsCover');
                coverEl.style.backgroundImage = `url('${cropped}')`;
                coverEl.classList.remove('expanded');
                const feedCoverEl = $('momentsFeedCover');
                if (feedCoverEl) {
                    feedCoverEl.style.backgroundImage = `url('${cropped}')`;
                    feedCoverEl.classList.remove('expanded');
                }
                showSimpleToast('封面已更换');
            } else if (state.cropTarget === 'feedComment') {
                feedCommentImage = cropped;
                renderFeedCommentPreview();
            } else if (state.cropTarget === 'videoBg') {
                const modal = $('videoCallModal');
                if (modal) {
                    modal.style.backgroundImage = `url("${cropped}")`;
                    modal.style.backgroundSize = 'cover';
                    modal.style.backgroundPosition = 'center';
                }
                showSimpleToast('通话背景已更换');
            }
            closeModal('avatarCropModal');
        });
    }

    // ================= 新建联系人 =================
    function initAddContactModal() {
        state.tempNewAvatar = null;
        $('newNickname').value = '';
        $('newSignature').value = '';
        const pv = $('newAvatarPreview');
        pv.style.backgroundImage = '';
        pv.textContent = '梦';
        $('newAvatarInput').value = '';
    }
    function handleAddContactSubmit() {
        const nickname = $('newNickname').value.trim();
        if (!nickname) {
            showSimpleToast('请输入昵称', 'error');
            $('newNickname').focus();
            return;
        }
        const signature = $('newSignature').value.trim();
        const avatar = state.tempNewAvatar || makeDefaultAvatar(nickname);
        const c = createContact(nickname, signature, avatar);
        closeModal('addContactModal');
        renderChatList();
        // 自动打开
        setTimeout(() => openChat(c.id), 220);
    }

    // ================= 新建群聊 =================
    function createGroup(name, avatar, memberIds) {
        const g = createContact(name, '', avatar);
        g.isGroup = true;
        g.memberIds = memberIds.slice();
        saveData();
        return g;
    }
    function initAddGroupModal() {
        state.tempNewGroupAvatar = null;
        $('newGroupName').value = '';
        const pv = $('newGroupAvatarPreview');
        pv.style.backgroundImage = '';
        pv.textContent = '群';
        $('newGroupAvatarInput').value = '';
        state.groupMemberSelected = new Set();
        renderGroupMemberList();
    }
    function renderGroupMemberList() {
        const list = $('groupMemberList');
        const contacts = (state.contacts || []).filter(c => !c.isGroup);
        if (contacts.length === 0) {
            list.innerHTML = '<div class="survey-empty">还没有添加梦角</div>';
            return;
        }
        list.innerHTML = '';
        contacts.forEach(c => {
            const item = document.createElement('div');
            item.className = 'remind-item';
            const checked = state.groupMemberSelected.has(c.id);
            item.innerHTML = `
                <div class="remind-check${checked ? ' checked' : ''}">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                </div>
                <div class="remind-avatar" style="background-image:url('${escapeHtml(c.avatar)}');background-size:cover;background-position:center;"></div>
                <span class="remind-name">${escapeHtml(c.nickname || '未命名')}</span>
            `;
            item.addEventListener('click', () => {
                if (state.groupMemberSelected.has(c.id)) state.groupMemberSelected.delete(c.id);
                else state.groupMemberSelected.add(c.id);
                renderGroupMemberList();
            });
            list.appendChild(item);
        });
    }
    function handleAddGroupSubmit() {
        const name = $('newGroupName').value.trim();
        if (!name) {
            showSimpleToast('请输入群聊名称', 'error');
            $('newGroupName').focus();
            return;
        }
        const memberIds = Array.from(state.groupMemberSelected || []);
        if (memberIds.length < 2) {
            showSimpleToast('请至少选择2位联系人', 'error');
            return;
        }
        const avatar = state.tempNewGroupAvatar || makeDefaultAvatar(name);
        const g = createGroup(name, avatar, memberIds);
        closeModal('addGroupModal');
        renderChatList();
        // 自动打开
        setTimeout(() => openChat(g.id), 220);
    }

    // ================= 群聊设置页 =================
    // 取当前群的梦角成员对象列表 (过滤掉已被删除的联系人)
    function getGroupMembers(g) {
        return (g.memberIds || []).map(id => getContact(id)).filter(Boolean);
    }
    function renderGroupSettingPage() {
        const g = getContact(state.currentContactId);
        const box = $('groupSettingContent');
        if (!g || !g.isGroup || !box) return;
        const me = state.me || {};
        const meAvatar = me.avatar || makeDefaultAvatar(me.nickname || '我');
        const members = getGroupMembers(g);
        const total = members.length + 1; // 含"我"
        const arrowSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>';
        const checkSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
        // 成员网格: "我"在最前 (不可被移除), 之后是梦角成员, 末尾是邀请/移除操作格
        const myGroupNickname = (g.groupNickname || '').trim() || (me.nickname || '我');
        // 回复时间 / 角色群自主聊天 参数默认值
        const replyMinVal = g.settings.replyMin ?? 3;
        const replyMaxVal = g.settings.replyMax ?? 10;
        const autoChat = g.settings.autoChat || {};
        const autoMinInterval = autoChat.minInterval ?? 1;
        const autoMaxInterval = autoChat.maxInterval ?? 60;
        const autoMinPerRound = autoChat.minPerRound ?? 3;
        const autoMaxPerRound = autoChat.maxPerRound ?? 10;
        // 角色自建群聊 参数默认值
        const selfBuild = g.settings.selfBuild || {};
        const selfBuildActivity = selfBuild.activity || 'standard';
        const selfBuildProbability = selfBuild.probability ?? 50;
        const selfBuildMaxGroups = selfBuild.maxGroups ?? 5;
        const selfBuildLurkRatio = selfBuild.lurkRatio ?? 30;
        const activityItems = [['chill', '佛系'], ['standard', '标准'], ['active', '活跃']].map(([val, label]) =>
            `<button type="button" class="gs-sb-seg-item${selfBuildActivity === val ? ' active' : ''}" data-val="${val}">${label}</button>`
        ).join('');
        let cells = `
            <div class="gs-member-cell" data-mid="__me">
                <div class="gs-member-avatar-wrap">
                    <div class="gs-member-avatar" style="background-image:url('${escapeHtml(meAvatar)}')"></div>
                </div>
                <div class="gs-member-name">${escapeHtml(myGroupNickname)}</div>
            </div>`;
        members.forEach(m => {
            const checked = state.gsRemoveSelected.has(m.id);
            cells += `
                <div class="gs-member-cell" data-mid="${m.id}">
                    <div class="gs-member-avatar-wrap">
                        <div class="gs-member-avatar" style="background-image:url('${escapeHtml(m.avatar)}')"></div>
                        ${state.gsRemoveMode ? `<div class="gs-member-check${checked ? ' checked' : ''}">${checkSvg}</div>` : ''}
                    </div>
                    <div class="gs-member-name">${escapeHtml(m.nickname || '未命名')}</div>
                </div>`;
        });
        cells += `
            <div class="gs-member-cell" id="gsInviteCell">
                <div class="gs-member-action"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg></div>
                <div class="gs-member-name">邀请</div>
            </div>
            <div class="gs-member-cell" id="gsRemoveCell">
                <div class="gs-member-action"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 12h14"/></svg></div>
                <div class="gs-member-name">移除</div>
            </div>`;
        box.innerHTML = `
            <div class="gs-top">
                <div class="gs-avatar" id="gsGroupAvatar" style="background-image:url('${escapeHtml(g.avatar)}')" title="更换群头像"></div>
                <div class="gs-name">${escapeHtml(g.nickname || '群聊')}</div>
            </div>
            <div class="gs-card">
                <div class="gs-card-head" id="gsMemberHead">
                    <span class="gs-card-title">群成员</span>
                    <span class="gs-card-more">${total}人 ${arrowSvg}</span>
                </div>
                <div class="gs-member-grid">${cells}</div>
                ${state.gsRemoveMode ? `
                <div class="gs-remove-bar">
                    <button class="btn btn-secondary" id="gsRemoveCancel">取消</button>
                    <button class="btn btn-primary" id="gsRemoveConfirm">确认移除</button>
                </div>` : ''}
            </div>
            <div class="gs-card">
                <div class="gs-name-row" id="gsNameRow">
                    <span class="gs-card-title">群名称</span>
                    <span class="gs-name-value">${escapeHtml(g.nickname || '群聊')} ${arrowSvg}</span>
                </div>
            </div>
            <div class="gs-card">
                <div class="gs-switch-row">
                    <span class="gs-switch-label">设为置顶</span>
                    <label class="switch">
                        <input type="checkbox" id="gsPinnedSwitch" ${g.pinned ? 'checked' : ''}>
                        <span class="slider"></span>
                    </label>
                </div>
                <div class="gs-switch-row">
                    <span class="gs-switch-label">消息免打扰</span>
                    <label class="switch">
                        <input type="checkbox" id="gsMutedSwitch" ${g.muted ? 'checked' : ''}>
                        <span class="slider"></span>
                    </label>
                </div>
            </div>
            <div class="gs-card">
                <div class="gs-info-row" id="gsNicknameRow">
                    <span class="gs-card-title">我在本群的昵称</span>
                    <span class="gs-info-value">${escapeHtml(myGroupNickname)} ${arrowSvg}</span>
                </div>
                <div class="gs-info-row" id="gsBgRow">
                    <span class="gs-card-title">个性设置</span>
                    <span class="gs-info-value">更换群聊背景 ${arrowSvg}</span>
                </div>
            </div>
            <div class="gs-card">
                <div class="gs-feature-head">
                    <span class="gs-feature-icon"><svg viewBox="0 0 24 24" class="icon" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></span>
                    <div class="gs-feature-head-text">
                        <span class="gs-feature-title">回复时间</span>
                        <span class="gs-feature-desc">梦角回复我消息的等待时间（自主聊天未开启时生效）</span>
                    </div>
                </div>
                <div class="gs-param-list">
                    <div class="gs-param-row">
                        <span class="gs-param-label">最短回复</span>
                        <input type="number" min="0" class="gs-param-input" id="gsReplyMin" value="${replyMinVal}">
                        <span class="gs-param-unit">秒</span>
                    </div>
                    <div class="gs-param-row">
                        <span class="gs-param-label">最长回复</span>
                        <input type="number" min="0" class="gs-param-input" id="gsReplyMax" value="${replyMaxVal}">
                        <span class="gs-param-unit">秒</span>
                    </div>
                </div>
            </div>
            <div class="gs-card">
                <div class="gs-feature-head">
                    <span class="gs-feature-icon"><svg viewBox="0 0 24 24" class="icon" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg></span>
                    <div class="gs-feature-head-text">
                        <span class="gs-feature-title">角色群自主聊天</span>
                        <span class="gs-feature-desc">角色自建群里，他们自己发起话题、接龙聊天（默认关闭）</span>
                    </div>
                    <label class="switch">
                        <input type="checkbox" id="gsAutoChatSwitch" ${autoChat.enabled ? 'checked' : ''}>
                        <span class="slider"></span>
                    </label>
                </div>
                <div class="gs-param-list" id="gsAutoParams" ${autoChat.enabled ? '' : 'style="display:none"'}>
                    <div class="gs-param-row">
                        <span class="gs-param-label">最短间隔</span>
                        <input type="number" min="1" class="gs-param-input" id="gsAutoMinInterval" value="${autoMinInterval}">
                        <span class="gs-param-unit">分钟</span>
                    </div>
                    <div class="gs-param-row">
                        <span class="gs-param-label">最长间隔</span>
                        <input type="number" min="1" class="gs-param-input" id="gsAutoMaxInterval" value="${autoMaxInterval}">
                        <span class="gs-param-unit">分钟</span>
                    </div>
                    <div class="gs-param-row">
                        <span class="gs-param-label">每轮最少</span>
                        <input type="number" min="1" class="gs-param-input" id="gsAutoMinPerRound" value="${autoMinPerRound}">
                        <span class="gs-param-unit">句</span>
                    </div>
                    <div class="gs-param-row">
                        <span class="gs-param-label">每轮最多</span>
                        <input type="number" min="1" class="gs-param-input" id="gsAutoMaxPerRound" value="${autoMaxPerRound}">
                        <span class="gs-param-unit">句</span>
                    </div>
                </div>
            </div>
            <div class="gs-card">
                <div class="gs-feature-head">
                    <span class="gs-feature-icon"><svg viewBox="0 0 24 24" class="icon" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></span>
                    <div class="gs-feature-head-text">
                        <span class="gs-feature-title">角色自建群聊</span>
                        <span class="gs-feature-desc">让角色们自己概率拉群、当群主</span>
                    </div>
                    <label class="switch">
                        <input type="checkbox" id="gsSelfBuildSwitch" ${selfBuild.enabled ? 'checked' : ''}>
                        <span class="slider"></span>
                    </label>
                </div>
                <div class="gs-param-list" id="gsSelfBuildParams" ${selfBuild.enabled ? '' : 'style="display:none"'}>
                    <div class="gs-sb-block">
                        <span class="gs-param-label">建群活跃度</span>
                        <div class="gs-sb-seg" id="gsActivitySeg">${activityItems}</div>
                    </div>
                    <div class="gs-param-row">
                        <span class="gs-param-label">建群概率</span>
                        <input type="number" min="0" max="100" class="gs-param-input" id="gsBuildProbability" value="${selfBuildProbability}">
                        <span class="gs-param-unit">%</span>
                    </div>
                    <div class="gs-sb-block">
                        <button type="button" class="gs-sb-build-btn" id="gsBuildTestBtn">立即试建一个群（测试用，不受概率/时间限制）</button>
                    </div>
                    <div class="gs-param-row">
                        <span class="gs-param-label">群数量上限</span>
                        <input type="number" min="1" class="gs-param-input" id="gsBuildMaxGroups" value="${selfBuildMaxGroups}">
                        <span class="gs-param-unit">个</span>
                    </div>
                    <div class="gs-param-row">
                        <span class="gs-param-label">潜水群比例</span>
                        <input type="number" min="0" max="100" class="gs-param-input" id="gsLurkRatio" value="${selfBuildLurkRatio}">
                        <span class="gs-param-unit">%</span>
                    </div>
                </div>
                <p class="gs-card-note">潜水群：角色建群时不拉你，你在群外潜水围观，只能看不能发言。其余的群会把你拉进去当普通成员。</p>
            </div>
            <div class="gs-card">
                <div class="gs-danger-row gs-danger-blue" id="gsClearChatRow">删除聊天记录</div>
            </div>
            <div class="gs-card">
                <div class="gs-danger-row gs-danger-red" id="gsQuitGroupRow">退出群聊</div>
            </div>
        `;
        // 绑定: 更换群头像
        $('gsGroupAvatar').addEventListener('click', () => $('groupAvatarInput').click());
        // 绑定: 进入群聊成员页
        $('gsMemberHead').addEventListener('click', () => {
            state.gmRemoveMode = false;
            state.gmRemoveSelected = new Set();
            renderGroupMembersPage();
            switchPage('groupMembersPage');
        });
        // 绑定: 修改群名称
        $('gsNameRow').addEventListener('click', () => {
            $('groupNameInput').value = g.nickname || '';
            openModal('groupNameModal');
        });
        // 绑定: 邀请新成员
        $('gsInviteCell').addEventListener('click', () => {
            initGroupInviteModal();
            openModal('groupInviteModal');
        });
        // 绑定: 进入移除模式
        $('gsRemoveCell').addEventListener('click', () => {
            state.gsRemoveMode = true;
            state.gsRemoveSelected = new Set();
            renderGroupSettingPage();
        });
        // 移除模式下的勾选与确认/取消
        if (state.gsRemoveMode) {
            $$('.gs-member-cell', box).forEach(cell => {
                const mid = cell.dataset.mid;
                if (!mid || mid === '__me') return; // "我"不可被移除
                cell.addEventListener('click', () => {
                    if (state.gsRemoveSelected.has(mid)) state.gsRemoveSelected.delete(mid);
                    else state.gsRemoveSelected.add(mid);
                    renderGroupSettingPage();
                });
            });
            $('gsRemoveCancel').addEventListener('click', () => {
                state.gsRemoveMode = false;
                state.gsRemoveSelected = new Set();
                renderGroupSettingPage();
            });
            $('gsRemoveConfirm').addEventListener('click', () => removeGroupMembers(state.gsRemoveSelected, 'setting'));
        }
        // 绑定: 设为置顶开关
        $('gsPinnedSwitch').addEventListener('change', e => {
            g.pinned = e.target.checked;
            saveData();
            renderChatList();
        });
        // 绑定: 消息免打扰开关
        $('gsMutedSwitch').addEventListener('change', e => {
            g.muted = e.target.checked;
            saveData();
        });
        // 绑定: 我在本群的昵称
        $('gsNicknameRow').addEventListener('click', () => {
            $('groupNicknameInput').value = g.groupNickname || '';
            openModal('groupNicknameModal');
        });
        // 绑定: 个性设置 -> 更换群聊背景
        $('gsBgRow').addEventListener('click', () => {
            renderGroupBgOptions(g.settings.chatBg);
            openModal('groupBgModal');
        });
        // 绑定: 删除聊天记录
        $('gsClearChatRow').addEventListener('click', () => {
            openModal('groupClearChatModal');
        });
        // 绑定: 退出群聊
        $('gsQuitGroupRow').addEventListener('click', () => {
            openModal('groupQuitModal');
        });
        // 绑定: 回复时间 (最短/最长回复, 校验与回复设置弹窗一致)
        const saveGroupReplyParams = () => {
            const min = Math.max(0, Number($('gsReplyMin').value) || 0);
            const max = Math.max(min, Number($('gsReplyMax').value) || min + 1);
            $('gsReplyMin').value = min;
            $('gsReplyMax').value = max;
            g.settings.replyMin = min;
            g.settings.replyMax = max;
            saveData();
            showSimpleToast('设置已保存');
        };
        $('gsReplyMin').addEventListener('change', saveGroupReplyParams);
        $('gsReplyMax').addEventListener('change', saveGroupReplyParams);
        // 绑定: 角色群自主聊天开关 (关闭时隐藏参数行)
        $('gsAutoChatSwitch').addEventListener('change', e => {
            if (!g.settings.autoChat) {
                g.settings.autoChat = { minInterval: 1, maxInterval: 60, minPerRound: 3, maxPerRound: 10 };
            }
            g.settings.autoChat.enabled = e.target.checked;
            $('gsAutoParams').style.display = e.target.checked ? '' : 'none';
            saveData();
            if (e.target.checked) startGroupAutoChat(g); else stopGroupAutoChat(g.id);
        });
        // 绑定: 自主聊天参数
        const saveGroupAutoParams = () => {
            const a = g.settings.autoChat = g.settings.autoChat || { minInterval: 1, maxInterval: 60, minPerRound: 3, maxPerRound: 10 };
            a.minInterval = Math.max(1, Number($('gsAutoMinInterval').value) || 1);
            a.maxInterval = Math.max(a.minInterval, Number($('gsAutoMaxInterval').value) || a.minInterval + 1);
            a.minPerRound = Math.max(1, Number($('gsAutoMinPerRound').value) || 1);
            a.maxPerRound = Math.max(a.minPerRound, Number($('gsAutoMaxPerRound').value) || a.minPerRound + 1);
            $('gsAutoMinInterval').value = a.minInterval;
            $('gsAutoMaxInterval').value = a.maxInterval;
            $('gsAutoMinPerRound').value = a.minPerRound;
            $('gsAutoMaxPerRound').value = a.maxPerRound;
            saveData();
            if (a.enabled) startGroupAutoChat(g);
            showSimpleToast('设置已保存');
        };
        ['gsAutoMinInterval', 'gsAutoMaxInterval', 'gsAutoMinPerRound', 'gsAutoMaxPerRound'].forEach(id => {
            $(id).addEventListener('change', saveGroupAutoParams);
        });
        // 绑定: 角色自建群聊开关 (关闭时隐藏参数区, 保留底部注释)
        $('gsSelfBuildSwitch').addEventListener('change', e => {
            if (!g.settings.selfBuild) {
                g.settings.selfBuild = { activity: 'standard', probability: 50, maxGroups: 5, lurkRatio: 30 };
            }
            g.settings.selfBuild.enabled = e.target.checked;
            $('gsSelfBuildParams').style.display = e.target.checked ? '' : 'none';
            saveData();
            if (e.target.checked) startSelfBuildTimer(g); else stopSelfBuildTimer(g.id);
        });
        // 绑定: 建群活跃度分段选择
        $$('#gsActivitySeg .gs-sb-seg-item').forEach(btn => {
            btn.addEventListener('click', () => {
                const sb = g.settings.selfBuild = g.settings.selfBuild || { activity: 'standard', probability: 50, maxGroups: 5, lurkRatio: 30 };
                sb.activity = btn.dataset.val;
                $$('#gsActivitySeg .gs-sb-seg-item').forEach(b => b.classList.toggle('active', b === btn));
                saveData();
                if (sb.enabled) startSelfBuildTimer(g);
                showSimpleToast('设置已保存');
            });
        });
        // 绑定: 角色自建群聊参数
        const saveSelfBuildParams = () => {
            const sb = g.settings.selfBuild = g.settings.selfBuild || { activity: 'standard', probability: 50, maxGroups: 5, lurkRatio: 30 };
            sb.probability = Math.min(100, Math.max(0, Number($('gsBuildProbability').value) || 0));
            sb.maxGroups = Math.max(1, Number($('gsBuildMaxGroups').value) || 1);
            sb.lurkRatio = Math.min(100, Math.max(0, Number($('gsLurkRatio').value) || 0));
            $('gsBuildProbability').value = sb.probability;
            $('gsBuildMaxGroups').value = sb.maxGroups;
            $('gsLurkRatio').value = sb.lurkRatio;
            saveData();
            if (sb.enabled) startSelfBuildTimer(g);
            showSimpleToast('设置已保存');
        };
        ['gsBuildProbability', 'gsBuildMaxGroups', 'gsLurkRatio'].forEach(id => {
            $(id).addEventListener('change', saveSelfBuildParams);
        });
        // 绑定: 立即试建一个群 (忽略概率与时间限制, 仍受群数量上限约束)
        $('gsBuildTestBtn').addEventListener('click', () => {
            const res = createSelfBuiltGroup(g);
            if (!res.ok) {
                showSimpleToast(res.reason === 'limit' ? '已达群数量上限' : '群内还没有角色配置群聊字卡', 'error');
                return;
            }
            showSimpleToast(res.lurk ? `已创建潜水群「${res.group.nickname}」` : `已创建群聊「${res.group.nickname}」`);
        });
    }

    // ================= 群聊成员页 =================
    function renderGroupMembersPage() {
        const g = getContact(state.currentContactId);
        const box = $('groupMembersContent');
        if (!g || !g.isGroup || !box) return;
        const me = state.me || {};
        const meAvatar = me.avatar || makeDefaultAvatar(me.nickname || '我');
        const members = getGroupMembers(g);
        const checkSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
        // "我"居首位并带群主标签 (不可被移除), 以下为梦角成员
        const myGmNickname = (g.groupNickname || '').trim() || (me.nickname || '我');
        let html = `
            <div class="gm-row" data-mid="__me">
                <div class="gm-avatar" style="background-image:url('${escapeHtml(meAvatar)}')"></div>
                <span class="gm-badge-owner">群主</span>
                <span class="gm-name">${escapeHtml(myGmNickname)}</span>
            </div>`;
        members.forEach(m => {
            const checked = state.gmRemoveSelected.has(m.id);
            html += `
                <div class="gm-row" data-mid="${m.id}">
                    ${state.gmRemoveMode ? `<div class="remind-check${checked ? ' checked' : ''}">${checkSvg}</div>` : ''}
                    <div class="gm-avatar" style="background-image:url('${escapeHtml(m.avatar)}')"></div>
                    <span class="gm-name">${escapeHtml(m.nickname || '未命名')}</span>
                </div>`;
        });
        box.innerHTML = html;
        // 移除模式: 底部确认栏 + 内容区留出底部空间
        box.style.paddingBottom = state.gmRemoveMode ? '76px' : '';
        $('gmRemoveBar').classList.toggle('hidden', !state.gmRemoveMode);
        if (state.gmRemoveMode) {
            $$('.gm-row', box).forEach(row => {
                const mid = row.dataset.mid;
                if (!mid || mid === '__me') return; // "我"不可被移除
                row.addEventListener('click', () => {
                    if (state.gmRemoveSelected.has(mid)) state.gmRemoveSelected.delete(mid);
                    else state.gmRemoveSelected.add(mid);
                    renderGroupMembersPage();
                });
            });
        }
    }

    // ================= 邀请新成员弹窗 =================
    function initGroupInviteModal() {
        state.groupInviteSelected = new Set();
        renderGroupInviteList();
    }
    function renderGroupInviteList() {
        const g = getContact(state.currentContactId);
        const list = $('groupInviteList');
        if (!g || !g.isGroup || !list) return;
        const inGroup = new Set(g.memberIds || []);
        // 仅列出未入群的非群聊联系人
        const candidates = (state.contacts || []).filter(c => !c.isGroup && !inGroup.has(c.id));
        if (candidates.length === 0) {
            list.innerHTML = '<div class="survey-empty">没有可邀请的梦角</div>';
            return;
        }
        list.innerHTML = '';
        candidates.forEach(c => {
            const item = document.createElement('div');
            item.className = 'remind-item';
            const checked = state.groupInviteSelected.has(c.id);
            item.innerHTML = `
                <div class="remind-check${checked ? ' checked' : ''}">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                </div>
                <div class="remind-avatar" style="background-image:url('${escapeHtml(c.avatar)}');background-size:cover;background-position:center;"></div>
                <span class="remind-name">${escapeHtml(c.nickname || '未命名')}</span>
            `;
            item.addEventListener('click', () => {
                if (state.groupInviteSelected.has(c.id)) state.groupInviteSelected.delete(c.id);
                else state.groupInviteSelected.add(c.id);
                renderGroupInviteList();
            });
            list.appendChild(item);
        });
    }
    function handleGroupInviteSubmit() {
        const g = getContact(state.currentContactId);
        if (!g || !g.isGroup) return;
        const ids = Array.from(state.groupInviteSelected || []);
        if (ids.length < 1) {
            showSimpleToast('请选择要邀请的梦角', 'error');
            return;
        }
        g.memberIds = (g.memberIds || []).concat(ids);
        saveData();
        closeModal('groupInviteModal');
        showSimpleToast('已邀请入群');
        renderGroupSettingPage();
        renderGroupMembersPage();
    }

    // ================= 移除群成员 =================
    function removeGroupMembers(selectedSet, fromPage) {
        const g = getContact(state.currentContactId);
        if (!g || !g.isGroup) return;
        if (!selectedSet || selectedSet.size === 0) {
            showSimpleToast('请选择要移除的成员', 'error');
            return;
        }
        // 仅移出群聊, 不删除联系人 (允许移除后少于2人)
        g.memberIds = (g.memberIds || []).filter(id => !selectedSet.has(id));
        saveData();
        showSimpleToast('已移除');
        state.gsRemoveMode = false;
        state.gsRemoveSelected = new Set();
        state.gmRemoveMode = false;
        state.gmRemoveSelected = new Set();
        if (fromPage === 'members') renderGroupMembersPage();
        else renderGroupSettingPage();
    }

    // ================= 设置 =================
    function loadSettingModal() {
        const c = getContact(state.currentContactId);
        if (!c) return;
        const s = c.settings;
        // 背景
        renderBgOptions(s.chatBg);
        // 气泡样式 (兼容旧数据)
        if (!s.bubbleStyle) s.bubbleStyle = JSON.parse(JSON.stringify(DEFAULT_BUBBLE_STYLE));
        renderBubbleStyleOptions(s.bubbleStyle);
        // 回复
        $('replyMin').value = s.replyMin ?? 3;
        $('replyMax').value = s.replyMax ?? 10;
        $('autoSendSwitch').checked = !!s.autoSend;
        $('autoInterval').value = s.autoInterval ?? 60;
        $('autoIntervalWrap').style.display = s.autoSend ? 'block' : 'none';
        $('mixedModeSwitch').checked = !!s.mixedMode;
        // 消息音效
        if (s.soundEnabled === undefined) s.soundEnabled = false;
        // 旧版内置音效已移除, 不在新预设中的旧 id 一律重置为默认音效
        if (!SOUND_PRESETS.some(p => p.id === s.userMsgSound)) s.userMsgSound = 'kakao';
        if (!SOUND_PRESETS.some(p => p.id === s.otherMsgSound)) s.otherMsgSound = 'kakao';
        const userSel = $('userMsgSoundSelect');
        const otherSel = $('otherMsgSoundSelect');
        if (userSel && !userSel.dataset.inited) {
            SOUND_PRESETS.forEach(p => {
                userSel.insertAdjacentHTML('beforeend', `<option value="${p.id}">${p.name}</option>`);
                otherSel.insertAdjacentHTML('beforeend', `<option value="${p.id}">${p.name}</option>`);
            });
            userSel.dataset.inited = '1';
            otherSel.dataset.inited = '1';
        }
        userSel.value = s.userMsgSound;
        otherSel.value = s.otherMsgSound;
        $('soundEnabledSwitch').checked = !!s.soundEnabled;
        $('soundOptionsWrap').style.display = s.soundEnabled ? 'block' : 'none';
        // 信息
        $('editNickname').value = c.nickname;
        $('editSignature').value = c.signature || '';
        state.tempEditAvatar = null;
        const pv = $('editAvatarPreview');
        pv.style.backgroundImage = `url("${c.avatar}")`;
        pv.style.backgroundSize = 'cover';
        pv.style.backgroundPosition = 'center';
        pv.textContent = '';
        $('editAvatarInput').value = '';
    }
    // 旧字卡预览芯片函数已废弃 (聊天设置内改为独立页面入口), 保留空壳兼容未清理的引用
    function renderWordcardsPreview() {}
    function openWordcardModal(cards, index, extra = {}) {
        state.editingWordcardIndex = index;
        state._editingCards = cards;
        state._editingGroupId = extra.groupId || '';
        state._editingCardId = extra.cardId || '';
        state._interactionTab = null;
        const rpEl = $('wordcardReply');
        if (index >= 0 && cards[index]) {
            $('wordcardModalTitle').textContent = '编辑字卡';
            rpEl.value = cards[index].reply || '';
            state.wcBatchGroupId = cards[index].groupId || '';
            state._editingCardId = cards[index].id || '';
            $('saveWordcardBtn').textContent = '保存';
        } else {
            $('wordcardModalTitle').textContent = '批量添加回复';
            rpEl.value = '';
            state.wcBatchGroupId = state._editingGroupId || '';
            $('saveWordcardBtn').textContent = '添加';
        }
        // 每次打开先重置面板展开态 + 刷新分组列表
        const panel = $('wcGroupPickerPanel');
        const btn = $('wcGroupPickerBtn');
        if (panel) panel.hidden = true;
        if (btn) btn.classList.remove('active');
        // 字卡弹窗始终显示"添加到分组"
        const wordcardGroupPicker = btn?.closest('.wc-group-picker');
        if (wordcardGroupPicker) wordcardGroupPicker.hidden = false;
        refreshWcGroupSelect();
        updateWcCounters();
        openModal('wordcardModal');
    }
    function saveWordcard() {
        // 按换行拆分 + 去空行 + trim (关键词功能已删除, 仅按回复逐行拆分)
        const splitLines = (txt) => (txt || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
        const replies = splitLines($('wordcardReply').value);
        if (replies.length === 0) { showSimpleToast('请输入至少一条回复内容', 'error'); return; }

        const groupId = state.wcBatchGroupId || '';
        const cards = state._editingCards || [];

        // === 编辑模式 (单条) ===
        if (state.editingWordcardIndex >= 0) {
            const rp = replies[0];
            const cur = cards[state.editingWordcardIndex] || {};
            const replaced = {
                id: cur.id || state._editingCardId || uuid(),
                reply: rp,
                groupId: groupId || cur.groupId || ''
            };
            cards[state.editingWordcardIndex] = replaced;
            dedupeWordcardsByIdentity(cards, state._editingCardId || replaced.id);
            saveData();
            closeModal('wordcardModal');
            if (isWordcardPageOpen()) renderWordcardPage();
            showSimpleToast('已保存');
            return;
        }

        // === 批量添加模式 ===
        // 每行 1 条回复 => 1 张独立字卡; 与现有库自动去重 (静默)
        const added = [];
        const keySet = new Set(cards.map(cardIdentity));
        for (const rp of replies) {
            const proto = { reply: rp, groupId };
            const key = cardIdentity(proto);
            if (keySet.has(key)) continue;
            keySet.add(key);
            added.push({ id: uuid(), ...proto });
        }
        if (added.length === 0) {
            saveData();
            closeModal('wordcardModal');
            if (isWordcardPageOpen()) renderWordcardPage();
            showSimpleToast('全部已存在，已自动去重');
            return;
        }
        cards.push(...added);
        saveData();
        closeModal('wordcardModal');
        if (isWordcardPageOpen()) renderWordcardPage();
        showSimpleToast(`已添加 ${added.length} 条${added.length < replies.length ? `（自动去重 ${replies.length - added.length} 条）` : ''}`);
    }

    // ================= 字卡管理独立页面 (升级版) =================
    // - 支持分组管理 / 多选 / 批量删除 / JSON导入 / 自动去重
    const WC_COLORS = ['#f2b73c','#e66868','#6ea8f2','#4cc9a7','#d87fd1','#e89cb9','#f5b346','#3ba98a'];
    function cardIdentity(w) {
        // 去重键: 仅按回复内容 (跨组去重)
        return `${w.reply || ''}`;
    }
    function dedupeWordcardsByIdentity(cards, keepId) {
        // 自动删除重复的字卡, 无需用户确认; 优先保留 keepId 对应记录
        if (!cards) return 0;
        const seen = new Map();
        let removed = 0;
        for (let i = cards.length - 1; i >= 0; i--) {
            const w = cards[i];
            if (!w || !(w.reply && (w.reply + '').trim())) {
                cards.splice(i, 1); removed++; continue;
            }
            // 迁移: 去掉 keyword 字段 (关键词功能已整体删除)
            if ('keyword' in w) { delete w.keyword; }
            if (!w.id) w.id = uuid();
            if (w.groupId === undefined) w.groupId = '';
            const idKey = cardIdentity(w);
            if (!seen.has(idKey)) {
                seen.set(idKey, w.id);
            } else {
                if (keepId && w.id === keepId) {
                    const oldKeepIdx = cards.findIndex(c => c.id === seen.get(idKey));
                    if (oldKeepIdx >= 0 && oldKeepIdx !== i) { cards.splice(oldKeepIdx, 1); removed++; }
                    seen.set(idKey, w.id);
                } else {
                    cards.splice(i, 1); removed++;
                }
            }
        }
        return removed;
    }
    // 字卡页面数据源: 主字卡 / 群聊字卡 (群聊字卡仅用于群聊中的梦角发言)
    function getWordcardSrc() {
        const isGroupCards = state.wcTopTab !== 'interaction' && state.wcSubTab === 'group';
        return isGroupCards
            ? { dataKey: 'groupWordcards', groupKey: 'groupWordcardGroups' }
            : { dataKey: 'wordcards', groupKey: 'wordcardGroups' };
    }
    function ensureWordcardStructs(c) {
        if (!c.settings.wordcards) c.settings.wordcards = [];
        if (!c.settings.wordcardGroups) c.settings.wordcardGroups = [];
        if (!c.settings.groupWordcards) c.settings.groupWordcards = [];
        if (!c.settings.groupWordcardGroups) c.settings.groupWordcardGroups = [];
        if (!c.settings.emojis) c.settings.emojis = [];
        if (!c.settings.exclusiveEmojis) c.settings.exclusiveEmojis = [];
        if (!c.settings.stickers) c.settings.stickers = [];
        if (!c.settings.momentImages) c.settings.momentImages = [];
        // 互动: 拍一拍 / 对方状态
        if (!c.settings.pats) c.settings.pats = [];
        if (!c.settings.patGroups) c.settings.patGroups = [];
        if (!c.settings.statuses) c.settings.statuses = [];
        if (!c.settings.statusGroups) c.settings.statusGroups = [];
        // 互动: 语音条
        if (!c.settings.voices) c.settings.voices = [];
        if (!c.settings.voiceGroups) c.settings.voiceGroups = [];
        // 互动: 告白
        if (!c.settings.confessions) c.settings.confessions = [];
        if (!c.settings.confessionGroups) c.settings.confessionGroups = [];
        // 迁移: 字卡补齐 id/groupId 并去重; 分组删除已废弃的 type 字段
        let changed = false;
        c.settings.wordcards.forEach(w => {
            if (!w.id) { w.id = uuid(); changed = true; }
            if (w.groupId === undefined) { w.groupId = ''; changed = true; }
            if (w.blocked === undefined) { w.blocked = false; changed = true; }
        });
        c.settings.groupWordcards.forEach(w => {
            if (!w.id) { w.id = uuid(); changed = true; }
            if (w.groupId === undefined) { w.groupId = ''; changed = true; }
            if (w.blocked === undefined) { w.blocked = false; changed = true; }
        });
        c.settings.pats.forEach(p => {
            if (!p.id) { p.id = uuid(); changed = true; }
            if (p.groupId === undefined) { p.groupId = ''; changed = true; }
            if (p.blocked === undefined) { p.blocked = false; changed = true; }
        });
        c.settings.statuses.forEach(s => {
            if (!s.id) { s.id = uuid(); changed = true; }
            if (s.groupId === undefined) { s.groupId = ''; changed = true; }
            if (s.blocked === undefined) { s.blocked = false; changed = true; }
        });
        c.settings.voices.forEach(v => {
            if (!v.id) { v.id = uuid(); changed = true; }
            if (v.groupId === undefined) { v.groupId = ''; changed = true; }
            if (v.blocked === undefined) { v.blocked = false; changed = true; }
        });
        c.settings.confessions.forEach(cf => {
            if (!cf.id) { cf.id = uuid(); changed = true; }
            if (cf.groupId === undefined) { cf.groupId = ''; changed = true; }
            if (cf.blocked === undefined) { cf.blocked = false; changed = true; }
        });
        c.settings.wordcardGroups.forEach(g => {
            if ('type' in g) { delete g.type; changed = true; }
        });
        c.settings.groupWordcardGroups.forEach(g => {
            if ('type' in g) { delete g.type; changed = true; }
        });
        const rm = dedupeWordcardsByIdentity(c.settings.wordcards);
        if (rm > 0) changed = true;
        const rmGroup = dedupeWordcardsByIdentity(c.settings.groupWordcards);
        if (rmGroup > 0) changed = true;
        return changed;
    }
    function isWordcardPageOpen() {
        return !!document.getElementById('wordcardPageMask')?.classList.contains('show');
    }
    function getGroupMap(c) {
        const map = new Map();
        (c.settings[getWordcardSrc().groupKey] || []).forEach(g => map.set(g.id, g));
        return map;
    }
    function openWordcardPage() {
        const c = getContact(state.currentContactId);
        if (!c) return;
        if (ensureWordcardStructs(c)) saveData();
        state.wcEditingGroupId = null;
        state.wcPickedColor = 1;
        state.wcTopTab = 'reply';
        state.wcSubTab = 'main';
        state.wcFilterGroupId = 'all';
        state.wcExpandedGroups = state.wcExpandedGroups || {};
        const mask = $('wordcardPageMask');
        mask.classList.add('show');
        renderWordcardPage();
    }
    function closeWordcardPage() {
        $('wordcardPageMask').classList.remove('show');
        // 关闭页面时退出批量模式
        state.wcBatchMode = false;
        state.wcSelectedCardIds.clear();
        state.wcStickerBatchMode = false;
        state.wcSelectedStickerIds.clear();
        // 关闭页面时退出图片库批量模式
        state.wcMomentImageBatchMode = false;
        state.wcSelectedMomentImageIds.clear();
        // 关闭页面时退出语音条批量模式
        state.wcVoiceBatchMode = false;
        state.wcVoiceSelectedIds.clear();
        const vb = $('wcViewBtn');
        if (vb) vb.classList.remove('active');
    }
    // 切换顶栏 Tab (回复库 / 互动)
    function switchWcTopTab(tab) {
        state.wcTopTab = tab;
        renderWordcardPage();
    }
    // 切换子 Tab (主字卡 / Emoji / 表情库)
    function switchWcSubTab(tab) {
        state.wcSubTab = tab;
        // 切到非主字卡页时退出字卡批量模式
        if (tab !== 'main') {
            state.wcBatchMode = false;
            state.wcSelectedCardIds.clear();
        }
        // 切到非表情库页时退出表情库批量模式
        if (tab !== 'sticker') {
            state.wcStickerBatchMode = false;
            state.wcSelectedStickerIds.clear();
        }
        // 切到非图片页时退出图片库批量模式
        if (tab !== 'momentImage') {
            state.wcMomentImageBatchMode = false;
            state.wcSelectedMomentImageIds.clear();
        }
        const vb = $('wcViewBtn');
        if (vb) vb.classList.remove('active');
        renderWordcardPage();
    }

    function renderWordcardPage() {
        const c = getContact(state.currentContactId);
        if (!c) return;
        const wcSrc = getWordcardSrc();
        const groups = c.settings[wcSrc.groupKey] || [];
        let cards = c.settings[wcSrc.dataKey] || [];
        // 搜索过滤: 只匹配回复内容
        const kw = (state.wcSearchKeyword || '').trim().toLowerCase();
        if (kw) cards = cards.filter(w => (w.reply || '').toLowerCase().includes(kw));
        const groupMap = getGroupMap(c);

        // ===== 顶栏 Tab 显隐 =====
        const replyContent = $('wcReplyContent');
        const interactionContent = $('wcInteractionContent');
        const topTabs = $('wcTopTabs');
        if (topTabs) {
            topTabs.querySelectorAll('.wc-top-tab').forEach(t => {
                t.classList.toggle('active', t.dataset.topTab === state.wcTopTab);
            });
        }
        if (state.wcTopTab === 'interaction') {
            replyContent.hidden = true;
            interactionContent.hidden = false;
            $('wcCloseBtn').parentElement.style.display = '';
            renderInteractionPage();
            return;
        } else {
            replyContent.hidden = false;
            interactionContent.hidden = true;
            $('wcCloseBtn').parentElement.style.display = '';
        }

        // ===== 子 Tab 显隐 (主字卡 / Emoji / 表情库) =====
        const subTabs = document.querySelectorAll('#wcReplyContent .wc-sub-tabs .wc-tab');
        subTabs.forEach(t => t.classList.toggle('active', t.dataset.subTab === state.wcSubTab));
        const mainContent = $('wcMainContent');
        const chipsRow = $('wcChipsRow');
        const emojiEmpty = $('wcEmojiEmpty');
        const stickerEmpty = $('wcStickerEmpty');
        const batchBar = $('wcBatchBar');
        const emojiSection = $('wcEmojiSection');
        emojiSection.hidden = state.wcSubTab !== 'emoji';
        const stickerSection = $('wcStickerSection');
        stickerSection.hidden = state.wcSubTab !== 'sticker';
        const momentImageSection = $('wcMomentImageSection');
        momentImageSection.hidden = state.wcSubTab !== 'momentImage';
        // 工具栏按钮显隐 (按子 Tab 控制)
        const groupManageBtn = $('wcGroupManageBtn');
        const batchManageBtn = $('wcViewBtn');
        if (state.wcSubTab === 'emoji') {
            // Emoji 页: 去掉分组管理 + 批量管理
            groupManageBtn.hidden = true;
            batchManageBtn.hidden = true;
        } else if (state.wcSubTab === 'sticker' || state.wcSubTab === 'momentImage') {
            // 表情库/图片页: 去掉分组管理, 保留批量管理
            groupManageBtn.hidden = true;
            batchManageBtn.hidden = false;
        } else {
            // 主字卡页: 全部显示
            groupManageBtn.hidden = false;
            batchManageBtn.hidden = false;
        }
        if (state.wcSubTab === 'main' || state.wcSubTab === 'group') {
            mainContent.hidden = false;
            chipsRow.hidden = false;
            emojiEmpty.hidden = true;
            stickerEmpty.hidden = true;
            // 批量管理操作栏
            if (state.wcBatchMode) {
                batchBar.hidden = false;
                const groupBtn = $('wcBatchGroup');
                if (groupBtn) groupBtn.hidden = false;
                // 主字卡: 还原删除按钮到独立第二行(表情库时移到了屏蔽按钮右边)
                const delBtn = $('wcBatchDelete');
                const batchRow = batchBar.querySelector('.wc-batch-row');
                if (batchRow && delBtn) batchRow.after(delBtn);
                // 按当前分组视图过滤字卡
                let viewCards = cards;
                if (state.wcFilterGroupId === '') {
                    viewCards = cards.filter(w => !w.groupId || !groupMap.has(w.groupId));
                } else if (state.wcFilterGroupId && state.wcFilterGroupId !== 'all') {
                    viewCards = cards.filter(w => w.groupId === state.wcFilterGroupId);
                }
                // 更新按钮启用/禁用 + 全选高亮状态
                const hasSel = state.wcSelectedCardIds.size > 0;
                const allSel = viewCards.length > 0 && viewCards.every(w => state.wcSelectedCardIds.has(w.id));
                const selAllBtn = $('wcBatchSelectAll');
                const svg = selAllBtn.querySelector('svg');
                const label = allSel ? '取消全选' : '全选';
                selAllBtn.innerHTML = '';
                if (svg) selAllBtn.appendChild(svg);
                if (allSel) {
                    selAllBtn.appendChild(document.createTextNode(' ' + label));
                } else {
                    selAllBtn.appendChild(document.createTextNode(' ' + label + ' ('));
                    const sp = document.createElement('span');
                    sp.id = 'wcBatchCount';
                    sp.textContent = viewCards.length;
                    selAllBtn.appendChild(sp);
                    selAllBtn.appendChild(document.createTextNode(')'));
                }
                selAllBtn.classList.toggle('all-selected', allSel);
                const hint = batchBar.querySelector('.wc-batch-hint');
                if (hint) hint.textContent = hasSel ? `已选 ${state.wcSelectedCardIds.size} 条` : '点击字卡以选择';
                ['wcBatchGroup', 'wcBatchBlock'].forEach(id => {
                    const b = $(id);
                    b.classList.toggle('disabled', !hasSel);
                    b.classList.toggle('active', hasSel);
                });
                delBtn.classList.toggle('disabled', !hasSel);
                delBtn.classList.toggle('active', hasSel);
            } else {
                batchBar.hidden = true;
            }
        } else if (state.wcSubTab === 'emoji') {
            mainContent.hidden = true;
            chipsRow.hidden = true;
            batchBar.hidden = true;
            stickerEmpty.hidden = true;
            // 渲染 Emoji 网格 (支持搜索过滤)
            const emojiSection = $('wcEmojiSection');
            const emojiGrid = $('wcEmojiGrid');
            emojiGrid.innerHTML = '';
            const emojiKw = (state.wcSearchKeyword || '').trim().toLowerCase();
            let emojis = c.settings.emojis || [];
            if (emojiKw) emojis = emojis.filter(e => (e.content || '').toLowerCase().includes(emojiKw));
            emojis.forEach(e => {
                const card = document.createElement('div');
                card.className = 'wc-emoji-card';
                card.dataset.emojiId = e.id;
                // 判断是否为纯 emoji (含 emoji 码点) 还是颜文字
                const isEmoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u{1F900}-\u{1F9FF}]/u.test(e.content);
                card.classList.add(isEmoji ? 'is-emoji' : 'is-text');
                card.innerHTML = `<span class="wc-emoji-content">${escapeHtml(e.content)}</span><button class="wc-emoji-del" data-action="del-emoji" data-emoji-id="${e.id}">×</button>`;
                emojiGrid.appendChild(card);
            });
            emojiEmpty.hidden = emojis.length > 0;
            emojiGrid.style.display = emojis.length > 0 ? '' : 'none';
            return;
        } else if (state.wcSubTab === 'sticker') {
            // 表情库
            mainContent.hidden = true;
            chipsRow.hidden = true;
            emojiEmpty.hidden = true;
            const stickerGrid = $('wcStickerGrid');
            stickerGrid.innerHTML = '';
            const stickers = c.settings.stickers || [];
            const keyword = (state.wcSearchKeyword || '').trim();
            const filteredStickers = keyword
                ? stickers.filter(s => (s.dataUrl || '').includes(keyword) || (s.name || '').includes(keyword))
                : stickers;
            const isBatch = state.wcStickerBatchMode;
            // 批量操作栏
            batchBar.hidden = !isBatch;
            const groupBtn = $('wcBatchGroup');
            const blockBtn = $('wcBatchBlock');
            const delBtn = $('wcBatchDelete');
            if (groupBtn) groupBtn.hidden = true; // 表情无分组
            // 表情库: 将删除按钮移到屏蔽按钮右边
            const batchActions = blockBtn ? blockBtn.parentElement : null;
            if (batchActions && delBtn) batchActions.appendChild(delBtn);
            const total = filteredStickers.length;
            const allSel = total > 0 && filteredStickers.every(s => state.wcSelectedStickerIds.has(s.id));
            const selAllBtn = $('wcBatchSelectAll');
            const svg = selAllBtn.querySelector('svg');
            const label = allSel ? '取消全选' : '全选';
            selAllBtn.innerHTML = '';
            if (svg) selAllBtn.appendChild(svg);
            if (allSel) {
                selAllBtn.appendChild(document.createTextNode(' ' + label));
            } else {
                selAllBtn.appendChild(document.createTextNode(' ' + label + ' ('));
                const sp = document.createElement('span');
                sp.id = 'wcBatchCount';
                sp.textContent = total;
                selAllBtn.appendChild(sp);
                selAllBtn.appendChild(document.createTextNode(')'));
            }
            selAllBtn.classList.toggle('all-selected', allSel);
            const hasSel = state.wcSelectedStickerIds.size > 0;
            const hint = batchBar.querySelector('.wc-batch-hint');
            if (hint) hint.textContent = hasSel ? `已选 ${state.wcSelectedStickerIds.size} 条` : '点击字卡以选择';
            if (blockBtn) {
                blockBtn.classList.toggle('active', hasSel);
                blockBtn.classList.toggle('disabled', !hasSel);
            }
            if (delBtn) {
                delBtn.classList.toggle('active', hasSel);
                delBtn.classList.toggle('disabled', !hasSel);
            }
            filteredStickers.forEach(s => {
                const isSelected = state.wcSelectedStickerIds.has(s.id);
                const card = document.createElement('div');
                card.className = 'wc-sticker-card' + (isSelected ? ' selected' : '');
                card.dataset.stickerId = s.id;
                card.innerHTML = (isBatch && isSelected
                        ? `<span class="wc-sticker-checkbox checked">✓</span>`
                        : '') +
                    `<img src="${s.dataUrl}" alt="">` +
                    (isBatch ? '' : `<button class="wc-sticker-del" data-action="del-sticker" data-sticker-id="${s.id}">×</button>`);
                stickerGrid.appendChild(card);
            });
            stickerEmpty.hidden = filteredStickers.length > 0;
            stickerGrid.style.display = filteredStickers.length > 0 ? '' : 'none';
            return;
        } else {
            // 图片库
            mainContent.hidden = true;
            chipsRow.hidden = true;
            emojiEmpty.hidden = true;
            stickerEmpty.hidden = true;
            const momentImageGrid = $('wcMomentImageGrid');
            const momentImageEmpty = $('wcMomentImageEmpty');
            momentImageGrid.innerHTML = '';
            const momentImages = c.settings.momentImages || [];
            const miKeyword = (state.wcSearchKeyword || '').trim();
            const filteredImages = miKeyword
                ? momentImages.filter(s => (s.dataUrl || '').includes(miKeyword) || (s.name || '').includes(miKeyword))
                : momentImages;
            const isMiBatch = state.wcMomentImageBatchMode;
            // 批量操作栏
            batchBar.hidden = !isMiBatch;
            const miGroupBtn = $('wcBatchGroup');
            const miBlockBtn = $('wcBatchBlock');
            const miDelBtn = $('wcBatchDelete');
            if (miGroupBtn) miGroupBtn.hidden = true; // 图片无分组
            // 图片库: 将删除按钮移到屏蔽按钮右边
            const miBatchActions = miBlockBtn ? miBlockBtn.parentElement : null;
            if (miBatchActions && miDelBtn) miBatchActions.appendChild(miDelBtn);
            const miTotal = filteredImages.length;
            const miAllSel = miTotal > 0 && filteredImages.every(s => state.wcSelectedMomentImageIds.has(s.id));
            const miSelAllBtn = $('wcBatchSelectAll');
            const miSvg = miSelAllBtn.querySelector('svg');
            const miLabel = miAllSel ? '取消全选' : '全选';
            miSelAllBtn.innerHTML = '';
            if (miSvg) miSelAllBtn.appendChild(miSvg);
            if (miAllSel) {
                miSelAllBtn.appendChild(document.createTextNode(' ' + miLabel));
            } else {
                miSelAllBtn.appendChild(document.createTextNode(' ' + miLabel + ' ('));
                const sp = document.createElement('span');
                sp.id = 'wcBatchCount';
                sp.textContent = miTotal;
                miSelAllBtn.appendChild(sp);
                miSelAllBtn.appendChild(document.createTextNode(')'));
            }
            miSelAllBtn.classList.toggle('all-selected', miAllSel);
            const miHasSel = state.wcSelectedMomentImageIds.size > 0;
            const miHint = batchBar.querySelector('.wc-batch-hint');
            if (miHint) miHint.textContent = miHasSel ? `已选 ${state.wcSelectedMomentImageIds.size} 条` : '点击字卡以选择';
            if (miBlockBtn) {
                miBlockBtn.classList.toggle('active', miHasSel);
                miBlockBtn.classList.toggle('disabled', !miHasSel);
            }
            if (miDelBtn) {
                miDelBtn.classList.toggle('active', miHasSel);
                miDelBtn.classList.toggle('disabled', !miHasSel);
            }
            filteredImages.forEach(s => {
                const isSelected = state.wcSelectedMomentImageIds.has(s.id);
                const card = document.createElement('div');
                card.className = 'wc-sticker-card' + (isSelected ? ' selected' : '');
                card.dataset.momentImageId = s.id;
                card.innerHTML = (isMiBatch && isSelected
                        ? `<span class="wc-sticker-checkbox checked">✓</span>`
                        : '') +
                    `<img src="${s.dataUrl}" alt="">` +
                    (isMiBatch ? '' : `<button class="wc-sticker-del" data-action="del-moment-image" data-moment-image-id="${s.id}">×</button>`);
                momentImageGrid.appendChild(card);
            });
            momentImageEmpty.hidden = filteredImages.length > 0;
            momentImageGrid.style.display = filteredImages.length > 0 ? '' : 'none';
            return;
        }

        // ===== 分组筛选 chips 行 (仅当存在分组时显示) =====
        chipsRow.innerHTML = '';
        if (groups.length === 0) {
            chipsRow.hidden = true;
        } else {
            chipsRow.hidden = false;
            const allCount = cards.length;
            const ungroupedCount = cards.filter(w => !w.groupId || !groupMap.has(w.groupId)).length;

            function makeChip(label, count, gid, color) {
                const chip = document.createElement('span');
                chip.className = 'wc-chip';
                if (state.wcFilterGroupId === gid) chip.classList.add('wc-chip-active');
                chip.dataset.gid = gid;
                let dot = '';
                if (color) dot = `<span class="wc-chip-dot" style="background:${color};"></span>`;
                chip.innerHTML = `${dot}${escapeHtml(label)} <b>${count}</b>`;
                chip.addEventListener('click', () => {
                    state.wcFilterGroupId = gid;
                    renderWordcardPage();
                });
                chipsRow.appendChild(chip);
            }
            makeChip('全部', allCount, 'all');
            makeChip('未分组', ungroupedCount, '');
            groups.forEach(g => {
                const cnt = cards.filter(w => w.groupId === g.id).length;
                makeChip(g.name, cnt, g.id, g.color);
            });
        }

        // ===== 按分组筛选字卡 =====
        const list = $('wcGroupList');
        list.innerHTML = '';

        const ungroupedCards = cards.filter(w => !w.groupId || !groupMap.has(w.groupId));

        // 渲染单张字卡 (用于展开内容 / 未分组 / 指定分组平铺)
        function renderCardItem(w, visibleIdx) {
            const item = document.createElement('div');
            const isBatch = state.wcBatchMode;
            const isSel = state.wcSelectedCardIds.has(w.id);
            item.className = 'wc-card-row' + (w.blocked ? ' blocked' : '') + (isBatch ? ' batch-mode' : '');
            item.style.animationDelay = `${Math.min(visibleIdx * 0.025, 0.25)}s`;
            item.dataset.cardId = w.id;
            // 屏蔽图标
            const eyeIcon = w.blocked
                ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`
                : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;
            const checkboxHtml = isBatch
                ? `<span class="wc-card-checkbox ${isSel ? 'checked' : ''}" data-action="toggle-card" data-card-id="${w.id}"></span>`
                : '';
            item.innerHTML = `
                ${checkboxHtml}
                <div class="wc-card-reply">${escapeHtml(w.reply || '')}</div>
                <div class="wc-card-actions">
                    <button class="wc-card-btn ${w.blocked ? 'active' : ''}" data-action="block-card" data-card-id="${w.id}" title="${w.blocked ? '取消屏蔽' : '屏蔽'}">${eyeIcon}</button>
                    <button class="wc-card-btn" data-action="group-card" data-card-id="${w.id}" title="分组">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                    </button>
                    <button class="wc-card-btn" data-action="edit-card" data-card-id="${w.id}" title="编辑">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                    </button>
                    <button class="wc-card-btn" data-action="del-card" data-card-id="${w.id}" title="删除">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14H7L5 6M10 11v6M14 11v6M9 6V4h6v2"/></svg>
                    </button>
                </div>
            `;
            return item;
        }

        // 渲染一个可折叠分组行
        function renderGroupRow(group, groupCards, key, visibleIdx) {
            const isExpanded = !!state.wcExpandedGroups[key];
            const row = document.createElement('div');
            row.className = 'wc-group-row' + (isExpanded ? ' expanded' : '');
            row.dataset.groupKey = key;
            row.style.animationDelay = `${Math.min(visibleIdx * 0.025, 0.25)}s`;
            const color = group ? group.color : '#ccc';
            const name = group ? group.name : '未分组';
            const groupAllSel = groupCards.length > 0 && groupCards.every(w => state.wcSelectedCardIds.has(w.id));
            const groupSelectAllBtn = state.wcBatchMode
                ? `<button class="wc-group-selectall ${groupAllSel ? 'all-selected' : ''}" data-action="select-group" data-group-key="${key}">全选</button>`
                : '';
            row.innerHTML = `
                <span class="wc-dot" style="background:${color};box-shadow:none;"></span>
                <div class="wc-group-name">${escapeHtml(name)}</div>
                <span class="wc-card-count">${groupCards.length} 条</span>
                <div class="wc-group-actions">
                    ${groupSelectAllBtn}
                    ${group ? `<button class="wc-edit-btn" data-action="edit-group" data-group-id="${group.id}" title="编辑分组">
                        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M12 20h9"/>
                            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                        </svg>
                    </button>` : ''}
                </div>
                <span class="wc-card-arrow">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>
                </span>
            `;
            list.appendChild(row);
            if (isExpanded) {
                const sub = document.createElement('div');
                sub.className = 'wc-group-cards';
                groupCards.forEach((w, i) => sub.appendChild(renderCardItem(w, i)));
                list.appendChild(sub);
            }
        }

        // ===== 分支: 全部 / 未分组 / 指定分组 =====
        if (state.wcFilterGroupId === 'all') {
            // 全部: 分组折叠行
            let hasAny = false;
            let idx = 0;
            groups.forEach(g => {
                const gc = cards.filter(w => w.groupId === g.id);
                if (gc.length > 0) {
                    renderGroupRow(g, gc, g.id, idx++);
                    hasAny = true;
                }
            });
            if (ungroupedCards.length > 0) {
                renderGroupRow(null, ungroupedCards, '__ungrouped__', idx++);
                hasAny = true;
            }
            if (!hasAny) {
                const empty = document.createElement('div');
                empty.className = 'wc-empty';
                if (kw) {
                    empty.innerHTML = `
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
                        </svg>
                        <div>未找到相关字卡</div>
                    `;
                } else {
                    empty.innerHTML = `
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                            <rect x="3" y="3" width="18" height="18" rx="4"/>
                            <path d="M7 7h10M7 12h10M7 17h6"/>
                        </svg>
                        <div>还没有字卡哦~</div>
                        <div style="font-size:12.5px;opacity:.85;">点击底部「新增」按钮添加第一张字卡</div>
                    `;
                }
                list.appendChild(empty);
            }
        } else {
            // 未分组 / 指定分组: 平铺字卡
            let filteredCards;
            if (state.wcFilterGroupId === '') {
                filteredCards = ungroupedCards;
            } else {
                filteredCards = cards.filter(w => w.groupId === state.wcFilterGroupId);
            }
            if (filteredCards.length === 0) {
                const empty = document.createElement('div');
                empty.className = 'wc-empty';
                if (kw) {
                    empty.innerHTML = `
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
                        </svg>
                        <div>未找到相关字卡</div>
                    `;
                } else {
                    empty.innerHTML = `
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                            <rect x="3" y="3" width="18" height="18" rx="4"/>
                            <path d="M7 7h10M7 12h10M7 17h6"/>
                        </svg>
                        <div>还没有字卡哦~</div>
                        <div style="font-size:12.5px;opacity:.85;">点击底部「新增」按钮添加第一张字卡</div>
                    `;
                }
                list.appendChild(empty);
            } else {
                filteredCards.forEach((w, i) => list.appendChild(renderCardItem(w, i)));
            }
        }
    }

    // ================= 互动: 拍一拍 / 对方状态 =================
    // 通用配置: 拍一拍和对方状态使用相同的渲染逻辑, 仅数据字段不同
    function getInteractionConfig(tab) {
        if (tab === 'pat') {
            return {
                dataKey: 'pats',
                groupKey: 'patGroups',
                listId: 'wcPatGroupList',
                chipsId: 'wcPatChipsRow',
                searchBarId: 'wcPatSearchBar',
                searchInputId: 'wcPatSearchInput',
                searchKeyword: 'wcPatSearchKeyword',
                filterGroupId: 'wcPatFilterGroupId'
            };
        }
        if (tab === 'voice') {
            return {
                dataKey: 'voices',
                groupKey: 'voiceGroups',
                listId: 'wcVoiceGroupList',
                chipsId: 'wcVoiceChipsRow',
                searchBarId: 'wcVoiceSearchBar',
                searchInputId: 'wcVoiceSearchInput',
                searchKeyword: 'wcVoiceSearchKeyword',
                filterGroupId: 'wcVoiceFilterGroupId'
            };
        }
        if (tab === 'confession') {
            return {
                dataKey: 'confessions',
                groupKey: 'confessionGroups',
                listId: 'wcConfessionGroupList',
                chipsId: 'wcConfessionChipsRow',
                searchBarId: 'wcConfessionSearchBar',
                searchInputId: 'wcConfessionSearchInput',
                searchKeyword: 'wcConfessionSearchKeyword',
                filterGroupId: 'wcConfessionFilterGroupId'
            };
        }
        return {
            dataKey: 'statuses',
            groupKey: 'statusGroups',
            listId: 'wcStatusGroupList',
            chipsId: 'wcStatusChipsRow',
            searchBarId: 'wcStatusSearchBar',
            searchInputId: 'wcStatusSearchInput',
            searchKeyword: 'wcStatusSearchKeyword',
            filterGroupId: 'wcStatusFilterGroupId'
        };
    }
    function renderInteractionPage() {
        const c = getContact(state.currentContactId);
        if (!c) return;
        ensureWordcardStructs(c);
        const cfg = getInteractionConfig(state.wcInteractionTab);
        const items = c.settings[cfg.dataKey] || [];
        const groups = c.settings[cfg.groupKey] || [];
        const keyword = state[cfg.searchKeyword] || '';
        const filterGid = state[cfg.filterGroupId] || '';
        const list = $(cfg.listId);
        list.innerHTML = '';

        // 过滤: 搜索关键词 + 分组 (不过滤被屏蔽项, 被屏蔽项保留显示)
        let filtered = items.slice();
        if (keyword) {
            const kw = keyword.toLowerCase();
            filtered = filtered.filter(it => (it.content || '').toLowerCase().includes(kw));
        }
        if (filterGid === '__ungrouped__') {
            filtered = filtered.filter(it => !it.groupId);
        } else if (filterGid) {
            filtered = filtered.filter(it => it.groupId === filterGid);
        }

        // 渲染单条互动内容卡片
        function renderInteractionCard(it) {
            const card = document.createElement('div');
            const isVoiceBatch = state.wcInteractionTab === 'voice' && state.wcVoiceBatchMode;
            const isSel = isVoiceBatch && state.wcVoiceSelectedIds.has(it.id);
            card.className = 'wc-card-row' + (it.blocked ? ' blocked' : '') + (isVoiceBatch ? ' batch-mode' : '');
            card.dataset.cardId = it.id;
            const eyeIcon = it.blocked
                ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`
                : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;
            const checkboxHtml = isVoiceBatch
                ? `<span class="wc-card-checkbox ${isSel ? 'checked' : ''}" data-action="voice-toggle-card" data-item-id="${it.id}"></span>`
                : '';
            const isConfession = state.wcInteractionTab === 'confession';
            const groupBtnHtml = isConfession ? '' : `<button class="wc-card-btn" data-action="group-interaction" data-item-id="${it.id}" title="分组"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg></button>`;
            const actionsHtml = isVoiceBatch ? '' : (`<div class="wc-card-actions">` +
                `<button class="wc-card-btn ${it.blocked ? 'active' : ''}" data-action="block-interaction" data-item-id="${it.id}" title="${it.blocked ? '取消屏蔽' : '屏蔽'}">${eyeIcon}</button>` +
                groupBtnHtml +
                `<button class="wc-card-btn" data-action="edit-interaction" data-item-id="${it.id}" title="编辑"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg></button>` +
                `<button class="wc-card-btn" data-action="del-interaction" data-item-id="${it.id}" title="删除"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14H7L5 6M10 11v6M14 11v6M9 6V4h6v2"/></svg></button>` +
                `</div>`);
            card.innerHTML = checkboxHtml + `<div class="wc-card-reply">${escapeHtml(it.content || '')}</div>` + actionsHtml;
            // 语音条卡片: 渲染为语音条样式, 点击播放
            if (cfg.dataKey === 'voices') {
                card.classList.add('wc-voice-card');
                const playIcon = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`;
                const voiceName = escapeHtml(it.name || '语音消息');
                // 批量模式: 点击卡片切换选中; 非批量模式: 点击播放
                const bodyAction = isVoiceBatch ? 'voice-toggle-card' : 'play-voice';
                card.innerHTML = checkboxHtml +
                    `<div class="wc-voice-body" data-action="${bodyAction}" data-item-id="${it.id}">` +
                    `<span class="wc-voice-play-icon">${playIcon}</span>` +
                    `<span class="wc-voice-name" title="${voiceName}">${voiceName}</span>` +
                    `</div>` + actionsHtml;
            }
            return card;
        }

        // 渲染分组 chips (仅当存在分组时显示; 告白无分组功能, 始终隐藏)
        const chipsRow = $(cfg.chipsId);
        chipsRow.innerHTML = '';
        const hideChips = state.wcInteractionTab === 'confession';
        if (groups.length === 0 || hideChips) {
            chipsRow.hidden = true;
        } else {
            chipsRow.hidden = false;
            const allCount = items.length;
            const ungroupedCount = items.filter(it => !it.groupId).length;

            function makeChip(label, count, gid, color) {
                const chip = document.createElement('span');
                chip.className = 'wc-chip' + (state[cfg.filterGroupId] === gid ? ' active' : '');
                let dot = '';
                if (color) dot = `<span class="wc-chip-dot" style="background:${color};"></span>`;
                chip.innerHTML = `${dot}${escapeHtml(label)} <b>${count}</b>`;
                chip.addEventListener('click', () => { state[cfg.filterGroupId] = gid; renderInteractionPage(); });
                chipsRow.appendChild(chip);
            }
            makeChip('全部', allCount, '');
            makeChip('未分组', ungroupedCount, '__ungrouped__');
            groups.forEach(g => {
                const cnt = items.filter(it => it.groupId === g.id).length;
                makeChip(g.name, cnt, g.id, g.color);
            });
        }

        // 无分组时: 内容直接平铺显示, 不渲染未分组折叠行
        if (groups.length === 0) {
            const cardsWrap = document.createElement('div');
            cardsWrap.className = 'wc-group-cards';
            filtered.forEach(it => {
                cardsWrap.appendChild(renderInteractionCard(it));
            });
            list.appendChild(cardsWrap);
        } else {
            // 按分组渲染
            const groupMap = new Map();
            groups.forEach(g => groupMap.set(g.id, g));
            const grouped = {};
            filtered.forEach(it => {
                const gid = it.groupId || '__ungrouped__';
                if (!grouped[gid]) grouped[gid] = [];
                grouped[gid].push(it);
            });
            const orderedKeys = ['__ungrouped__', ...groups.map(g => g.id)];
            orderedKeys.forEach(gid => {
                if (!grouped[gid] || grouped[gid].length === 0) return;
                const g = gid === '__ungrouped__' ? null : groupMap.get(gid);
                const isExpanded = !!state.wcExpandedGroups[gid];
                const row = document.createElement('div');
                row.className = 'wc-group-row' + (isExpanded ? ' expanded' : '');
                row.dataset.groupKey = gid;
                const editBtn = g
                    ? `<button class="wc-edit-btn" data-action="edit-inter-group" data-group-id="${g.id}" title="编辑分组">
                        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                        </svg>
                    </button>`
                    : '';
                // 语音条批量模式: 分组全选按钮
                const isVoiceBatch = state.wcInteractionTab === 'voice' && state.wcVoiceBatchMode;
                const groupAllSel = isVoiceBatch && grouped[gid].length > 0 && grouped[gid].every(it => state.wcVoiceSelectedIds.has(it.id));
                const groupSelectAllBtn = isVoiceBatch
                    ? `<button class="wc-group-selectall ${groupAllSel ? 'all-selected' : ''}" data-action="voice-select-group" data-group-key="${gid}">全选</button>`
                    : '';
                row.innerHTML = `<span class="wc-dot" style="background:${g ? g.color : '#ccc'};box-shadow:none;"></span>` +
                    `<div class="wc-group-name">${g ? escapeHtml(g.name) : '未分组'}</div>` +
                    `<span class="wc-card-count">${grouped[gid].length} 条</span>` +
                    `<div class="wc-group-actions">${groupSelectAllBtn}${editBtn}</div>` +
                    `<span class="wc-card-arrow"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg></span>`;
                list.appendChild(row);
                if (isExpanded) {
                    const cardsWrap = document.createElement('div');
                    cardsWrap.className = 'wc-group-cards';
                    grouped[gid].forEach(it => {
                        cardsWrap.appendChild(renderInteractionCard(it));
                    });
                    list.appendChild(cardsWrap);
                }
            });
        }

        // 空状态
        if (filtered.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'wc-empty';
            empty.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
                </svg>
                <div>列表空空如也</div>
            `;
            list.appendChild(empty);
        }

        // 语音条批量管理操作栏
        if (state.wcInteractionTab === 'voice') {
            const voiceBatchBar = $('wcVoiceBatchBar');
            if (state.wcVoiceBatchMode) {
                voiceBatchBar.hidden = false;
                const viewCards = filtered;
                const hasSel = state.wcVoiceSelectedIds.size > 0;
                const allSel = viewCards.length > 0 && viewCards.every(w => state.wcVoiceSelectedIds.has(w.id));
                const selAllBtn = $('wcVoiceBatchSelectAll');
                const svg = selAllBtn.querySelector('svg');
                const label = allSel ? '取消全选' : '全选';
                selAllBtn.innerHTML = '';
                if (svg) selAllBtn.appendChild(svg);
                if (allSel) {
                    selAllBtn.appendChild(document.createTextNode(' ' + label));
                } else {
                    selAllBtn.appendChild(document.createTextNode(' ' + label + ' ('));
                    const sp = document.createElement('span');
                    sp.id = 'wcVoiceBatchCount';
                    sp.textContent = viewCards.length;
                    selAllBtn.appendChild(sp);
                    selAllBtn.appendChild(document.createTextNode(')'));
                }
                selAllBtn.classList.toggle('all-selected', allSel);
                const hint = voiceBatchBar.querySelector('.wc-batch-hint');
                if (hint) hint.textContent = hasSel ? `已选 ${state.wcVoiceSelectedIds.size} 条` : '点击字卡以选择';
                ['wcVoiceBatchGroup', 'wcVoiceBatchBlock'].forEach(id => {
                    const b = $(id);
                    b.classList.toggle('disabled', !hasSel);
                    b.classList.toggle('active', hasSel);
                });
                const delBtn = $('wcVoiceBatchDelete');
                delBtn.classList.toggle('disabled', !hasSel);
                delBtn.classList.toggle('active', hasSel);
            } else {
                voiceBatchBar.hidden = true;
            }
        }
    }
    function openInteractionModal(tab, items, index) {
        const cfg = getInteractionConfig(tab);
        state.editingWordcardIndex = index;
        state._editingCards = items;
        state._interactionTab = tab;
        const rpEl = $('wordcardReply');
        const isVoice = tab === 'voice';
        const isConfession = tab === 'confession';
        // 切换 UI: 语音条显示文件选择区, 隐藏 textarea; 其他相反
        $('wcVoiceFileGroup').hidden = !isVoice;
        $('wcReplyGroup').hidden = isVoice;
        // 告白无分组功能, 隐藏"添加到分组"
        const groupPicker = $('wcGroupPickerBtn')?.closest('.wc-group-picker');
        if (groupPicker) groupPicker.hidden = isConfession;
        // 语音条临时文件数组
        if (isVoice) state._voiceSelectedFiles = [];
        if (index >= 0 && items[index]) {
            $('wordcardModalTitle').textContent = '编辑';
            rpEl.value = items[index].content || '';
            state.wcBatchGroupId = items[index].groupId || '';
            state._editingCardId = items[index].id || '';
            $('saveWordcardBtn').textContent = '保存';
            if (isVoice) {
                // 编辑模式: 显示原音频占位, 不重新读取 base64
                state._voiceSelectedFiles = [{ name: items[index].name || '当前音频.mp3', dataUrl: items[index].content || '', isOriginal: true, size: 0 }];
            }
        } else {
            $('wordcardModalTitle').textContent = tab === 'pat' ? '批量添加拍一拍' : (tab === 'voice' ? '批量添加语音条' : (tab === 'confession' ? '批量添加告白' : '批量添加状态'));
            rpEl.value = '';
            state.wcBatchGroupId = '';
            state._editingCardId = '';
            $('saveWordcardBtn').textContent = '添加';
        }
        // 副标题
        const subEl = document.querySelector('#wordcardModal .wc-add-subtitle');
        if (subEl) {
            if (isVoice) {
                subEl.textContent = index >= 0 ? '重新选择 MP3 文件替换原音频' : '支持一次选择多个 MP3 文件批量添加';
            } else {
                subEl.textContent = '每行一条，自动去重';
            }
        }
        if (isVoice) renderVoiceFileList();
        const panel = $('wcGroupPickerPanel');
        const btn = $('wcGroupPickerBtn');
        if (panel) panel.hidden = true;
        if (btn) btn.classList.remove('active');
        // 刷新分组列表为当前互动类型的分组
        refreshInteractionGroupSelect(tab);
        updateWcCounters();
        openModal('wordcardModal');
    }
    // 语音条文件选择: 点击按钮 → 触发 file input
    function handleVoiceFileInput(files) {
        if (!state._voiceSelectedFiles) state._voiceSelectedFiles = [];
        const arr = Array.from(files || []);
        if (arr.length === 0) return;
        // 先过滤出合法的 mp3 文件
        const valid = arr.filter(file => file && (file.type === 'audio/mpeg' || /\.mp3$/i.test(file.name || '')));
        const invalid = arr.filter(file => !file || (file.type !== 'audio/mpeg' && !/\.mp3$/i.test(file.name || '')));
        if (invalid.length > 0) {
            showSimpleToast(`仅支持 MP3 文件, 已跳过 ${invalid.length} 个非 MP3 文件`, 'error');
        }
        if (valid.length === 0) return;
        let processed = 0;
        valid.forEach(file => {
            const reader = new FileReader();
            reader.onload = e => {
                state._voiceSelectedFiles.push({
                    name: file.name,
                    dataUrl: e.target.result,
                    size: file.size,
                    isOriginal: false
                });
                processed++;
                if (processed >= valid.length) renderVoiceFileList();
            };
            reader.onerror = () => {
                processed++;
                if (processed >= valid.length) renderVoiceFileList();
            };
            reader.readAsDataURL(file);
        });
    }
    // 渲染语音条文件列表
    function renderVoiceFileList() {
        const list = $('wcVoiceFileList');
        if (!list) return;
        const files = state._voiceSelectedFiles || [];
        if (files.length === 0) {
            list.innerHTML = '';
            list.hidden = true;
            return;
        }
        list.hidden = false;
        list.innerHTML = files.map((f, i) => {
            const sizeStr = f.size > 0 ? ` (${(f.size / 1024).toFixed(1)} KB)` : '';
            const tag = f.isOriginal ? '<span class="wc-voice-file-tag">原</span>' : '';
            return `<div class="wc-voice-file-item">
                <span class="wc-voice-file-name">${tag}${escapeHtml(f.name)}${sizeStr}</span>
                <button type="button" class="wc-voice-file-del" data-voice-file-idx="${i}" title="移除">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
            </div>`;
        }).join('');
    }
    function refreshInteractionGroupSelect(tab) {
        const c = getContact(state.currentContactId);
        if (!c) return;
        const cfg = getInteractionConfig(tab);
        const groups = c.settings[cfg.groupKey] || [];
        const panel = $('wcGroupPickerPanel');
        if (!panel) return;
        const sel = state.wcBatchGroupId || '';
        const items = [
            `<span class="wc-group-tag ungrouped ${sel === '' ? 'selected' : ''}" data-gid="">不分组</span>`,
            ...groups.map(g =>
                `<span class="wc-group-tag group ${sel === g.id ? 'selected' : ''}" data-gid="${g.id}"><span class="wc-group-tag-dot" style="background:${g.color || '#999'}"></span>${escapeHtml(g.name)}</span>`
            )
        ];
        panel.innerHTML = items.join('');
        const label = $('wcGroupPickerLabel');
        if (label) {
            if (sel === '') {
                label.textContent = '添加到分组';
            } else {
                const g = groups.find(x => x.id === sel);
                label.textContent = g ? g.name : '添加到分组';
            }
        }
    }
    function saveInteractionItem() {
        const tab = state._interactionTab || state.wcInteractionTab;
        const isVoice = tab === 'voice';
        // 语音条分支: 从临时文件数组读取 base64
        if (isVoice) {
            const cfg = getInteractionConfig(tab);
            const c = getContact(state.currentContactId);
            if (!c) return;
            ensureWordcardStructs(c);
            const items = c.settings[cfg.dataKey];
            const groupId = state.wcBatchGroupId || '';
            const files = (state._voiceSelectedFiles || []).filter(f => f && f.dataUrl);
            if (state.editingWordcardIndex >= 0) {
                // 编辑模式: 仅当存在非"原"文件时才替换音频
                const newFile = files.find(f => !f.isOriginal);
                const cur = items[state.editingWordcardIndex] || {};
                if (newFile) {
                    items[state.editingWordcardIndex] = {
                        id: cur.id || state._editingCardId || uuid(),
                        content: newFile.dataUrl,
                        name: newFile.name,
                        groupId: groupId || cur.groupId || '',
                        blocked: cur.blocked || false
                    };
                } else if (!cur.content) {
                    showSimpleToast('请选择 MP3 文件', 'error');
                    return;
                } else {
                    // 仅更新分组
                    items[state.editingWordcardIndex] = {
                        id: cur.id,
                        content: cur.content,
                        name: cur.name,
                        groupId: groupId || cur.groupId || '',
                        blocked: cur.blocked || false
                    };
                }
            } else {
                // 新增模式: 批量添加, 排除原音频占位
                const newFiles = files.filter(f => !f.isOriginal);
                if (newFiles.length === 0) {
                    showSimpleToast('请选择至少一个 MP3 文件', 'error');
                    return;
                }
                newFiles.forEach(f => {
                    items.push({ id: uuid(), content: f.dataUrl, name: f.name, groupId, blocked: false });
                });
            }
            saveData();
            closeModal('wordcardModal');
            state._voiceSelectedFiles = [];
            if (isWordcardPageOpen()) renderInteractionPage();
            showSimpleToast(state.editingWordcardIndex >= 0 ? '已保存' : `已添加 ${files.filter(f => !f.isOriginal).length} 条`);
            return;
        }
        const splitLines = (txt) => (txt || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
        const lines = splitLines($('wordcardReply').value);
        if (lines.length === 0) { showSimpleToast('请输入至少一条内容', 'error'); return; }
        const cfg = getInteractionConfig(tab);
        const c = getContact(state.currentContactId);
        if (!c) return;
        ensureWordcardStructs(c);
        const items = c.settings[cfg.dataKey];
        const groupId = state.wcBatchGroupId || '';
        if (state.editingWordcardIndex >= 0) {
            const line = lines[0];
            const cur = items[state.editingWordcardIndex] || {};
            items[state.editingWordcardIndex] = {
                id: cur.id || state._editingCardId || uuid(),
                content: line,
                groupId: groupId || cur.groupId || '',
                blocked: cur.blocked || false
            };
        } else {
            lines.forEach(line => {
                items.push({ id: uuid(), content: line, groupId, blocked: false });
            });
        }
        saveData();
        closeModal('wordcardModal');
        if (isWordcardPageOpen()) renderInteractionPage();
        showSimpleToast(state.editingWordcardIndex >= 0 ? '已保存' : `已添加 ${lines.length} 条`);
    }
    function interactionDedupe(tab) {
        const c = getContact(state.currentContactId);
        if (!c) return;
        ensureWordcardStructs(c);
        const cfg = getInteractionConfig(tab);
        const items = c.settings[cfg.dataKey];
        const before = items.length;
        const seen = new Set();
        c.settings[cfg.dataKey] = items.filter(it => {
            const key = (it.content || '').trim();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
        const after = c.settings[cfg.dataKey].length;
        const removed = before - after;
        saveData();
        renderInteractionPage();
        showSimpleToast(removed > 0 ? `已去重，删除了 ${removed} 条` : '没有重复内容~');
    }
    function openInteractionGroupModal(tab) {
        const c = getContact(state.currentContactId);
        if (!c) return;
        state._interactionGroupTab = tab;
        renderInteractionGroupEditorList(tab);
        openModal('wcGroupModal');
    }
    function renderInteractionGroupEditorList(tab) {
        const c = getContact(state.currentContactId);
        if (!c) return;
        const cfg = getInteractionConfig(tab);
        const groups = c.settings[cfg.groupKey] || [];
        const cards = c.settings[cfg.dataKey] || [];
        const list = $('wcGroupListEditor');
        if (!list) return;
        list.innerHTML = '';
        if (groups.length === 0) {
            list.innerHTML = '<div class="wc-empty">暂无分组，点击上方「新建分组」添加</div>';
            return;
        }
        groups.forEach(g => {
            const cnt = cards.filter(it => it.groupId === g.id).length;
            const el = document.createElement('div');
            el.className = 'wc-group-editor-item';
            el.innerHTML = `
                <span class="wc-dot" style="background:${g.color || '#ccc'};box-shadow:none;"></span>
                <div class="wc-group-meta">
                    <div class="wc-group-meta-name">${escapeHtml(g.name)}</div>
                </div>
                <span class="wc-group-count-tag">${cnt} 条</span>
                <button class="wc-edit-btn wc-group-btn-edit" data-action="edit-inter-group" data-group-id="${g.id}" title="编辑此分组">
                    <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px;">
                        <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                    </svg>
                </button>
                <button class="wc-edit-btn wc-group-btn-del" data-action="del-inter-group" data-group-id="${g.id}" title="删除此分组 (同时删除组内所有内容)"
                    style="background:linear-gradient(135deg,#ffe0e2,#ffd7d5);color:#d06a75;border-color:rgba(255,182,189,0.35);">
                    <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px;">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6l-2 14H7L5 6M10 11v6M14 11v6M9 6V4h6v2"/>
                    </svg>
                </button>
            `;
            list.appendChild(el);
        });
    }

    function refreshWcGroupSelect() {
        const c = getContact(state.currentContactId);
        if (!c) return;
        const panel = $('wcGroupPickerPanel');
        if (!panel) return;
        const groups = c.settings[getWordcardSrc().groupKey] || [];
        const sel = state.wcBatchGroupId || '';
        const items = [
            `<span class="wc-group-tag ungrouped ${sel === '' ? 'selected' : ''}" data-gid="">不分组</span>`,
            ...groups.map(g =>
                `<span class="wc-group-tag group ${sel === g.id ? 'selected' : ''}" data-gid="${g.id}"><span class="wc-group-tag-dot" style="background:${g.color || '#999'}"></span>${escapeHtml(g.name)}</span>`
            )
        ];
        panel.innerHTML = items.join('');
        // 更新按钮文字
        const label = $('wcGroupPickerLabel');
        if (sel === '') {
            label.textContent = '添加到分组';
        } else {
            const g = groups.find(x => x.id === sel);
            label.textContent = g ? g.name : '添加到分组';
        }
    }
    function updateWcCounters() {
        const count = v => (v || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean).length;
        $('wcReplyCount').textContent = count($('wordcardReply').value);
    }

    // ================= 分组管理弹窗 =================
    function openWcGroupModal() {
        const c = getContact(state.currentContactId);
        if (!c) return;
        state._interactionGroupTab = null;
        renderWcGroupEditorList();
        openModal('wcGroupModal');
    }
    // 更新预览按钮: 文字 = 分组名(空则"预览"), 颜色 = 当前选中颜色
    function updatePreviewBtn() {
        const btn = $('wcPreviewColorBtn');
        if (!btn) return;
        const name = $('wcGroupNameInput').value.trim();
        btn.textContent = name || '预览';
        let color = '';
        const customVal = $('wcCustomColorInput').value.trim();
        if (/^#?[0-9a-fA-F]{6}$/.test(customVal)) {
            color = customVal.startsWith('#') ? customVal : '#' + customVal;
        } else {
            color = WC_COLORS[(state.wcPickedColor || 1) - 1] || WC_COLORS[0];
        }
        btn.style.color = color;
    }
    // ===== 自定义颜色选择器工具函数 =====
    function hexToHsv(hex) {
        let h = hex.replace('#', '');
        if (h.length !== 6) return { h: 0, s: 1, v: 1 };
        const r = parseInt(h.substring(0, 2), 16) / 255;
        const g = parseInt(h.substring(2, 4), 16) / 255;
        const b = parseInt(h.substring(4, 6), 16) / 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        const d = max - min;
        let hue = 0;
        if (d !== 0) {
            if (max === r) hue = ((g - b) / d) % 6;
            else if (max === g) hue = (b - r) / d + 2;
            else hue = (r - g) / d + 4;
            hue *= 60;
            if (hue < 0) hue += 360;
        }
        const sat = max === 0 ? 0 : d / max;
        return { h: Math.round(hue), s: sat, v: max };
    }
    function hsvToHex(h, s, v) {
        const c = v * s;
        const x = c * (1 - Math.abs((h / 60) % 2 - 1));
        const m = v - c;
        let r1, g1, b1;
        if (h < 60) { r1 = c; g1 = x; b1 = 0; }
        else if (h < 120) { r1 = x; g1 = c; b1 = 0; }
        else if (h < 180) { r1 = 0; g1 = c; b1 = x; }
        else if (h < 240) { r1 = 0; g1 = x; b1 = c; }
        else if (h < 300) { r1 = x; g1 = 0; b1 = c; }
        else { r1 = c; g1 = 0; b1 = x; }
        const r = Math.round((r1 + m) * 255);
        const g = Math.round((g1 + m) * 255);
        const b = Math.round((b1 + m) * 255);
        return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase();
    }
    // 同步颜色选择器 UI (SV 方块背景/游标 + 色相滑块)
    function syncColorPickerUI() {
        const h = state.wcColorHue || 0;
        const s = state.wcColorSat != null ? state.wcColorSat : 1;
        const v = state.wcColorVal != null ? state.wcColorVal : 1;
        const svSquare = $('wcSvSquare');
        if (svSquare) {
            svSquare.style.background = `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${h}, 100%, 50%))`;
            const cursor = $('wcSvCursor');
            if (cursor) {
                cursor.style.left = (s * 100) + '%';
                cursor.style.top = ((1 - v) * 100) + '%';
            }
        }
        const hueSlider = $('wcHueSlider');
        if (hueSlider) hueSlider.value = h;
    }
    // 从选择器更新颜色到色块/输入框/预览
    function updateColorFromPicker() {
        const h = state.wcColorHue || 0;
        const s = state.wcColorSat != null ? state.wcColorSat : 1;
        const v = state.wcColorVal != null ? state.wcColorVal : 1;
        const hex = hsvToHex(h, s, v);
        $('wcCustomSwatch').style.background = hex;
        $('wcCustomColorInput').value = hex;
        $('wcColorPicker').querySelectorAll('.wc-dot').forEach(d => d.classList.remove('active'));
        syncColorPickerUI();
        updatePreviewBtn();
    }
    // 渲染色点 (在新建/编辑分组弹窗中使用)
    function renderWcColorPicker() {
        const picker = $('wcColorPicker');
        if (!picker) return;
        picker.innerHTML = '';
        WC_COLORS.forEach((clr, i) => {
            const dot = document.createElement('span');
            dot.className = 'wc-dot c-' + (i + 1);
            dot.style.background = clr;
            dot.dataset.idx = i + 1;
            if (i + 1 === state.wcPickedColor) dot.classList.add('active');
            dot.addEventListener('click', () => {
                state.wcPickedColor = i + 1;
                picker.querySelectorAll('.wc-dot').forEach(d => d.classList.remove('active'));
                dot.classList.add('active');
                $('wcCustomColorInput').value = '';
                $('wcCustomSwatch').style.background = clr;
                $('wcColorPickerPanel').hidden = true;
                updatePreviewBtn();
            });
            picker.appendChild(dot);
        });
    }
    // 打开新建/编辑分组弹窗
    function openWcCreateGroupModal(editGroupId, groupKey) {
        const c = getContact(state.currentContactId);
        if (!c) return;
        state.wcEditingGroupId = editGroupId || null;
        const gKey = groupKey || (state._interactionGroupTab ? getInteractionConfig(state._interactionGroupTab).groupKey : 'wordcardGroups');
        let initColor = WC_COLORS[0];
        if (state.wcEditingGroupId) {
            const g = (c.settings[gKey] || []).find(x => x.id === state.wcEditingGroupId);
            if (!g) return;
            $('wcCreateGroupTitle').textContent = '编辑分组';
            $('wcGroupNameInput').value = g.name;
            initColor = g.color || WC_COLORS[0];
            const idx = WC_COLORS.indexOf(g.color);
            state.wcPickedColor = idx >= 0 ? idx + 1 : 1;
            if (idx < 0) {
                $('wcCustomColorInput').value = g.color || '';
            } else {
                $('wcCustomColorInput').value = '';
            }
        } else {
            $('wcCreateGroupTitle').textContent = '新建分组';
            $('wcGroupNameInput').value = '';
            state.wcPickedColor = 1;
            $('wcCustomColorInput').value = '';
        }
        $('wcCustomSwatch').style.background = initColor;
        $('wcColorPickerPanel').hidden = true;
        const initHsv = hexToHsv(initColor);
        state.wcColorHue = initHsv.h;
        state.wcColorSat = initHsv.s;
        state.wcColorVal = initHsv.v;
        renderWcColorPicker();
        updatePreviewBtn();
        openModal('wcCreateGroupModal');
    }
    // 打开字卡「选择分组」弹窗
    function openCardGroupModal() {
        const c = getContact(state.currentContactId);
        if (!c) return;
        const isBatch = state.wcBatchGroupMode === true;
        if (!isBatch && !state.wcOperatingCardId) return;
        const interTab = state._interactionTab;
        const cfg = interTab ? getInteractionConfig(interTab) : null;
        const groups = cfg ? (c.settings[cfg.groupKey] || []) : (c.settings[getWordcardSrc().groupKey] || []);
        const cards = cfg ? (c.settings[cfg.dataKey] || []) : (c.settings[getWordcardSrc().dataKey] || []);
        const list = $('wcCardGroupList');
        list.innerHTML = '';
        // 批量模式默认选中"移出所有分组"
        state.wcPickedCardGroup = isBatch ? '' : (cards.find(w => w.id === state.wcOperatingCardId)?.groupId || '');

        function makeOption(label, gid, color, count) {
            const opt = document.createElement('div');
            opt.className = 'wc-group-select-item' + (state.wcPickedCardGroup === gid ? ' selected' : '');
            opt.dataset.gid = gid;
            const dot = color ? `<span class="wc-dot" style="background:${color};box-shadow:none;width:10px;height:10px;"></span>` : '';
            opt.innerHTML = `
                <span class="wc-radio"><span class="wc-radio-dot"></span></span>
                ${dot}
                <span class="wc-group-select-name">${escapeHtml(label)}</span>
                <span class="wc-group-select-count">${count} 条</span>
            `;
            opt.addEventListener('click', () => {
                state.wcPickedCardGroup = gid;
                list.querySelectorAll('.wc-group-select-item').forEach(x => x.classList.remove('selected'));
                opt.classList.add('selected');
            });
            list.appendChild(opt);
        }
        const ungroupedCount = cards.filter(w => !w.groupId).length;
        makeOption(isBatch ? '移出所有分组' : '不分组', '', null, ungroupedCount);
        groups.forEach(g => {
            const cnt = cards.filter(w => w.groupId === g.id).length;
            makeOption(g.name, g.id, g.color, cnt);
        });
        // 标题 + 副标题
        $('wcCardGroupTitle').textContent = isBatch ? '批量分组' : '选择分组';
        const sub = $('wcCardGroupSubtitle');
        if (isBatch) {
            sub.style.display = '';
            sub.textContent = `将 ${state.wcSelectedCardIds.size} 条内容移入分组`;
        } else {
            sub.style.display = 'none';
        }
        openModal('wcCardGroupModal');
    }
    function renderWcGroupEditorList() {
        const c = getContact(state.currentContactId);
        if (!c) return;
        const box = $('wcGroupListEditor');
        const wcSrc = getWordcardSrc();
        const groups = c.settings[wcSrc.groupKey] || [];
        const cards = c.settings[wcSrc.dataKey] || [];
        box.innerHTML = '';
        if (groups.length === 0) {
            box.innerHTML = `<div class="wc-empty" style="padding:24px 8px 8px;"><div style="font-size:15px;color:var(--text);">还没有分组</div><div style="font-size:13px;opacity:.7;margin-top:4px;">点击下方按钮创建第一个分组</div></div>`;
            return;
        }
        groups.forEach(g => {
            const cnt = cards.filter(w => w.groupId === g.id).length;
            const el = document.createElement('div');
            el.className = 'wc-group-editor-item';
            el.innerHTML = `
                <span class="wc-dot" style="background:${g.color || '#ccc'};box-shadow:none;"></span>
                <div class="wc-group-meta">
                    <div class="wc-group-meta-name">${escapeHtml(g.name)}</div>
                </div>
                <span class="wc-group-count-tag">${cnt} 条字卡</span>
                <button class="wc-edit-btn wc-group-btn-edit" data-gid="${g.id}" title="编辑此分组">
                    <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px;">
                        <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                    </svg>
                </button>
                <button class="wc-edit-btn wc-group-btn-del" data-gid="${g.id}" title="删除此分组 (同时删除组内所有字卡)"
                    style="background:linear-gradient(135deg,#ffe0e2,#ffd7d5);color:#d06a75;border-color:rgba(255,182,189,0.35);">
                    <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px;">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6l-2 14H7L5 6M10 11v6M14 11v6M9 6V4h6v2"/>
                    </svg>
                </button>
            `;
            box.appendChild(el);
        });
    }
    function saveWcGroup() {
        const c = getContact(state.currentContactId);
        if (!c) return;
        const name = $('wcGroupNameInput').value.trim();
        if (!name) { showSimpleToast('请输入分组名', 'error'); return; }
        const customVal = $('wcCustomColorInput').value.trim();
        const color = customVal || WC_COLORS[(state.wcPickedColor || 1) - 1] || WC_COLORS[0];
        const gKey = state._interactionGroupTab ? getInteractionConfig(state._interactionGroupTab).groupKey : getWordcardSrc().groupKey;
        const groups = c.settings[gKey] || [];
        if (state.wcEditingGroupId) {
            const g = groups.find(x => x.id === state.wcEditingGroupId);
            if (g) { g.name = name; g.color = color; }
        } else {
            groups.push({ id: uuid(), name, color });
        }
        saveData();
        state.wcEditingGroupId = null;
        state.wcPickedColor = 1;
        $('wcGroupNameInput').value = '';
        $('wcCustomColorInput').value = '';
        closeModal('wcCreateGroupModal');
        closeModal('wcGroupModal');
        if (state._interactionGroupTab) {
            renderInteractionGroupEditorList(state._interactionGroupTab);
            renderInteractionPage();
        } else {
            refreshWcGroupSelect();
            renderWordcardPage();
        }
        showSimpleToast('分组已保存');
    }

    // ================= 字卡导入 =================
    function importWordcardsFromFile(file) {
        const c = getContact(state.currentContactId);
        if (!c) return;
        const reader = new FileReader();
        reader.onload = () => {
            try {
                const text = String(reader.result || '');
                let parsed;
                try { parsed = JSON.parse(text); }
                catch (e) {
                    // 非 JSON 时, 尝试按"每行 关键词=回复"或"关键词 回复"等简单文本导入
                    parsed = parseWordcardsPlainText(text);
                    if (parsed.length === 0) throw new Error('无法解析内容, 请使用 JSON 或每行一条「关键词=回复」');
                }
                // 接受数组形式: [{keyword,reply,groupId?}] 或 {wordcards:[...]} 或 {groups:[...], wordcards:[...]}
                const wcSrc = getWordcardSrc();
                let cardsToAdd = [];
                if (Array.isArray(parsed)) cardsToAdd = parsed;
                else if (parsed && typeof parsed === 'object') {
                    if (Array.isArray(parsed[wcSrc.dataKey])) cardsToAdd = parsed[wcSrc.dataKey];
                    else if (Array.isArray(parsed.wordcards)) cardsToAdd = parsed.wordcards;
                    if (Array.isArray(parsed.groups) && c.settings[wcSrc.groupKey]) {
                        // 兼容导入分组定义, 相同名字合并
                        const existingNames = new Map(c.settings[wcSrc.groupKey].map(g => [g.name, g]));
                        parsed.groups.forEach(ig => {
                            if (!ig || !ig.name) return;
                            if (existingNames.has(ig.name)) return; // 已存在同名分组就跳过
                            const newG = {
                                id: uuid(),
                                name: String(ig.name),
                                color: ig.color || WC_COLORS[Math.floor(Math.random() * WC_COLORS.length)]
                            };
                            c.settings[wcSrc.groupKey].push(newG);
                            existingNames.set(newG.name, newG);
                        });
                        // 导入的字卡如果 groupId 是原分组名 -> 映射为新 id
                        const nameToId = new Map(c.settings[wcSrc.groupKey].map(g => [g.name, g.id]));
                        cardsToAdd = cardsToAdd.map(w => {
                            if (w && (w.groupName || typeof w.groupId === 'string' && nameToId.has(w.groupId) === false)) {
                                const n = w.groupName || w.groupId;
                                if (nameToId.has(n)) return { ...w, groupId: nameToId.get(n) };
                            }
                            return w;
                        });
                    }
                }
                if (!cardsToAdd || cardsToAdd.length === 0) throw new Error('字卡列表为空');

                // 归一化 + 过滤合法字段 (关键词功能已删除, 仅保留 reply+groupId)
                const groups = c.settings[wcSrc.groupKey] || [];
                const idSet = new Set(groups.map(g => g.id));
                const normalized = cardsToAdd
                    .filter(w => w && typeof w.reply === 'string' && (w.reply + '').trim())
                    .map(w => ({
                        id: uuid(),
                        reply: String(w.reply).trim(),
                        groupId: (w.groupId && idSet.has(w.groupId)) ? w.groupId : ''
                    }));
                if (normalized.length === 0) throw new Error('没有可导入的合法字卡');
                // 合并入当前数组 + 自动去重 (静默)
                const before = c.settings[wcSrc.dataKey].length;
                const curKeys = new Set(c.settings[wcSrc.dataKey].map(cardIdentity));
                const added = [];
                normalized.forEach(nw => {
                    const k = cardIdentity(nw);
                    if (curKeys.has(k)) return;
                    curKeys.add(k);
                    added.push(nw);
                });
                c.settings[wcSrc.dataKey].push(...added);
                saveData();
                renderWordcardPage();
                const skip = normalized.length - added.length;
                showSimpleToast(`导入成功 ${added.length} 条${skip > 0 ? `，自动去重 ${skip} 条` : ''}`);
            } catch (err) {
                showSimpleToast('导入失败: ' + (err.message || '格式错误'), 'error');
            } finally {
                $('wcImportFile').value = '';
            }
        };
        reader.onerror = () => {
            showSimpleToast('读取文件失败', 'error');
            $('wcImportFile').value = '';
        };
        reader.readAsText(file, 'utf-8');
    }
    function parseWordcardsPlainText(text) {
        // 简单文本导入: 每行 1 条回复 (关键词功能已删除)
        const out = [];
        String(text || '').split(/\r?\n/).forEach(line => {
            line = line.trim();
            if (!line || line.startsWith('#')) return;
            out.push({ reply: line, groupId: '' });
        });
        return out;
    }
    function applyChatBg(c) {
        const bg = c.settings.chatBg || DEFAULT_BGS[0].value;
        const overlay = $('chatBgOverlay');
        if (bg.startsWith('data:')) {
            overlay.style.backgroundImage = `url("${bg}")`;
            overlay.style.backgroundSize = 'cover';
            overlay.style.backgroundPosition = 'center';
            overlay.style.backgroundRepeat = 'no-repeat';
        } else {
            overlay.style.background = bg;
        }
    }
    function hexToRgba(hex, alpha) {
        let h = (hex || '').replace('#', '');
        if (h.length === 3) h = h.split('').map(c => c + c).join('');
        const r = parseInt(h.substring(0, 2), 16) || 255;
        const g = parseInt(h.substring(2, 4), 16) || 255;
        const b = parseInt(h.substring(4, 6), 16) || 255;
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    function applyBubbleStyle(c) {
        const page = $('chatDetailPage');
        if (!page) return;
        const bs = (c && c.settings && c.settings.bubbleStyle) || DEFAULT_BUBBLE_STYLE;
        const sent = bs.sent || DEFAULT_BUBBLE_STYLE.sent;
        const received = bs.received || DEFAULT_BUBBLE_STYLE.received;
        // 我的气泡
        page.style.setProperty('--sent-bubble-radius', sent.shape || '20px');
        page.style.setProperty('--sent-quote-border', received.color || '#ffffff');
        if (sent.effect === 'glass') {
            page.style.setProperty('--sent-bubble-bg', hexToRgba(sent.color, 0.55));
            page.style.setProperty('--sent-bubble-blur', 'blur(12px)');
        } else {
            page.style.setProperty('--sent-bubble-bg', sent.color);
            page.style.setProperty('--sent-bubble-blur', 'none');
        }
        // 梦角气泡
        page.style.setProperty('--received-bubble-radius', received.shape || '20px');
        page.style.setProperty('--received-quote-border', sent.color || '#ffb6bd');
        if (received.effect === 'glass') {
            page.style.setProperty('--received-bubble-bg', hexToRgba(received.color, 0.55));
            page.style.setProperty('--received-bubble-blur', 'blur(12px)');
            page.style.setProperty('--received-bubble-border', `1px solid ${hexToRgba(received.color, 0.3)}`);
        } else {
            page.style.setProperty('--received-bubble-bg', received.color);
            page.style.setProperty('--received-bubble-blur', 'none');
            page.style.setProperty('--received-bubble-border', '1px solid rgba(0,0,0,0.06)');
        }
    }
    function renderBubbleStyleOptions(style) {
        const bs = style || DEFAULT_BUBBLE_STYLE;
        ['sent', 'received'].forEach(target => {
            const cfg = bs[target] || DEFAULT_BUBBLE_STYLE[target];
            // 颜色选项
            const colorBox = $(target + 'ColorOptions');
            if (colorBox) {
                colorBox.innerHTML = '';
                DEFAULT_BUBBLE_COLORS.forEach(b => {
                    const el = document.createElement('div');
                    el.className = 'bubble-color-option' + (b.value.toLowerCase() === String(cfg.color || '').toLowerCase() ? ' active' : '');
                    el.style.background = b.value;
                    el.title = b.name;
                    el.dataset.value = b.value;
                    el.addEventListener('click', () => {
                        $$('.bubble-color-option', colorBox).forEach(o => o.classList.remove('active'));
                        el.classList.add('active');
                        $(target + 'ColorPicker').value = b.value;
                    });
                    colorBox.appendChild(el);
                });
            }
            const picker = $(target + 'ColorPicker');
            if (picker) picker.value = cfg.color || '#ffffff';
            // 形状选项
            const shapeBox = $(target + 'ShapeOptions');
            if (shapeBox) {
                shapeBox.innerHTML = '';
                DEFAULT_BUBBLE_SHAPES.forEach(s => {
                    const el = document.createElement('div');
                    el.className = 'bubble-shape-option' + (s.value === cfg.shape ? ' active' : '');
                    el.textContent = s.name;
                    el.dataset.value = s.value;
                    el.addEventListener('click', () => {
                        $$('.bubble-shape-option', shapeBox).forEach(o => o.classList.remove('active'));
                        el.classList.add('active');
                    });
                    shapeBox.appendChild(el);
                });
            }
            // 效果选项
            const effectBox = $(target + 'EffectOptions');
            if (effectBox) {
                effectBox.innerHTML = '';
                DEFAULT_BUBBLE_EFFECTS.forEach(e => {
                    const el = document.createElement('div');
                    el.className = 'bubble-effect-option' + (e.value === cfg.effect ? ' active' : '');
                    el.textContent = e.name;
                    el.dataset.value = e.value;
                    el.addEventListener('click', () => {
                        $$('.bubble-effect-option', effectBox).forEach(o => o.classList.remove('active'));
                        el.classList.add('active');
                    });
                    effectBox.appendChild(el);
                });
            }
        });
    }
    function renderBgOptions(currentBg) {
        const c = getContact(state.currentContactId);
        const customBgs = (c && c.settings && c.settings.customBgs) || [];
        const box = $('bgOptions');
        box.innerHTML = '';
        DEFAULT_BGS.forEach(b => {
            const el = document.createElement('div');
            el.className = 'bg-option' + (b.value === currentBg ? ' active' : '');
            el.style.background = b.value;
            el.title = b.name;
            el.dataset.value = b.value;
            el.addEventListener('click', () => {
                $$('.bg-option', box).forEach(o => o.classList.remove('active'));
                el.classList.add('active');
            });
            box.appendChild(el);
        });
        // 渲染所有自定义背景
        customBgs.forEach((bg, idx) => {
            const el = document.createElement('div');
            el.className = 'bg-option custom-bg-option' + (bg === currentBg ? ' active' : '');
            el.style.backgroundImage = `url("${bg}")`;
            el.style.backgroundSize = 'cover';
            el.style.backgroundPosition = 'center';
            el.title = '自定义背景';
            el.dataset.value = bg;
            el.dataset.bgIndex = idx;
            const delBtn = document.createElement('button');
            delBtn.className = 'custom-bg-del';
            delBtn.innerHTML = '×';
            delBtn.addEventListener('click', e => {
                e.stopPropagation();
                if (!c) return;
                c.settings.customBgs = c.settings.customBgs.filter((_, i) => i !== idx);
                if (c.settings.chatBg === bg) {
                    c.settings.chatBg = DEFAULT_BGS[0].value;
                    applyChatBg(c);
                }
                saveData();
                renderBgOptions(c.settings.chatBg);
            });
            el.appendChild(delBtn);
            el.addEventListener('click', () => {
                $$('.bg-option', box).forEach(o => o.classList.remove('active'));
                el.classList.add('active');
            });
            box.appendChild(el);
        });
    }
    function renderGroupBgOptions(currentBg) {
        const c = getContact(state.currentContactId);
        const customBgs = (c && c.settings && c.settings.customBgs) || [];
        const box = $('groupBgOptions');
        if (!box) return;
        box.innerHTML = '';
        DEFAULT_BGS.forEach(b => {
            const el = document.createElement('div');
            el.className = 'bg-option' + (b.value === currentBg ? ' active' : '');
            el.style.background = b.value;
            el.title = b.name;
            el.dataset.value = b.value;
            el.addEventListener('click', () => {
                $$('.bg-option', box).forEach(o => o.classList.remove('active'));
                el.classList.add('active');
            });
            box.appendChild(el);
        });
        customBgs.forEach((bg, idx) => {
            const el = document.createElement('div');
            el.className = 'bg-option custom-bg-option' + (bg === currentBg ? ' active' : '');
            el.style.backgroundImage = `url("${bg}")`;
            el.style.backgroundSize = 'cover';
            el.style.backgroundPosition = 'center';
            el.title = '自定义背景';
            el.dataset.value = bg;
            el.dataset.bgIndex = idx;
            const delBtn = document.createElement('button');
            delBtn.className = 'custom-bg-del';
            delBtn.innerHTML = '×';
            delBtn.addEventListener('click', e => {
                e.stopPropagation();
                if (!c) return;
                c.settings.customBgs = c.settings.customBgs.filter((_, i) => i !== idx);
                if (c.settings.chatBg === bg) {
                    c.settings.chatBg = DEFAULT_BGS[0].value;
                    applyChatBg(c);
                }
                saveData();
                renderGroupBgOptions(c.settings.chatBg);
            });
            el.appendChild(delBtn);
            el.addEventListener('click', () => {
                $$('.bg-option', box).forEach(o => o.classList.remove('active'));
                el.classList.add('active');
            });
            box.appendChild(el);
        });
    }
    function saveBgSetting() {
        const c = getContact(state.currentContactId);
        if (!c) return;
        const activeBg = document.querySelector('#bgOptions .bg-option.active');
        if (activeBg) c.settings.chatBg = activeBg.dataset.value;
        // 保存气泡样式
        if (!c.settings.bubbleStyle) c.settings.bubbleStyle = JSON.parse(JSON.stringify(DEFAULT_BUBBLE_STYLE));
        ['sent', 'received'].forEach(target => {
            const color = $(target + 'ColorPicker').value;
            const shapeEl = document.querySelector('#' + target + 'ShapeOptions .bubble-shape-option.active');
            const effectEl = document.querySelector('#' + target + 'EffectOptions .bubble-effect-option.active');
            c.settings.bubbleStyle[target] = {
                color: color,
                shape: shapeEl ? shapeEl.dataset.value : DEFAULT_BUBBLE_STYLE[target].shape,
                effect: effectEl ? effectEl.dataset.value : DEFAULT_BUBBLE_STYLE[target].effect
            };
        });
        saveData();
        applyChatBg(c);
        applyBubbleStyle(c);
        closeModal('chatBgModal');
        showSimpleToast('设置已保存');
    }
    function saveReplySetting() {
        const c = getContact(state.currentContactId);
        if (!c) return;
        const min = Math.max(0, Number($('replyMin').value) || 0);
        const max = Math.max(min, Number($('replyMax').value) || min + 1);
        c.settings.replyMin = min;
        c.settings.replyMax = max;
        c.settings.autoSend = $('autoSendSwitch').checked;
        c.settings.autoInterval = Math.max(1, Number($('autoInterval').value) || 60);
        c.settings.mixedMode = $('mixedModeSwitch').checked;
        c.settings.soundEnabled = $('soundEnabledSwitch').checked;
        c.settings.userMsgSound = $('userMsgSoundSelect').value || 'kakao';
        c.settings.otherMsgSound = $('otherMsgSoundSelect').value || 'kakao';
        saveData();
        stopContactAutoTimer(c.id);
        startContactAutoTimer(c);
        closeModal('replySettingModal');
        showSimpleToast('回复设置已保存');
    }
    function saveContactInfo() {
        const c = getContact(state.currentContactId);
        if (!c) return;
        const nn = $('editNickname').value.trim();
        if (!nn) { showSimpleToast('昵称不能为空', 'error'); return; }
        c.nickname = nn;
        c.signature = $('editSignature').value.trim();
        if (state.tempEditAvatar) c.avatar = state.tempEditAvatar;
        saveData();
        if (state.currentContactId === c.id) {
            $('detailNickname').textContent = c.nickname;
            $('typingAvatar').style.backgroundImage = `url("${c.avatar}")`;
            $('typingAvatar').style.backgroundSize = 'cover';
            $('typingAvatar').style.backgroundPosition = 'center';
        }
        closeModal('contactInfoModal');
        renderChatList();
        showSimpleToast('联系人信息已保存');
    }

    // ================= 朋友圈 =================
    function renderMoments() {
        const body = document.querySelector('#momentsPage .moments-content');
        if (!body) return;
        const contacts = (state.contacts || []).filter(c => !c.isGroup); // 群聊不参与朋友圈
        const me = state.me || {};
        const meHtml = `
            <div class="moments-contact-item" data-me="1">
                <div class="moments-contact-avatar" style="${me.avatar ? `background-image:url('${escapeHtml(me.avatar)}');background-size:cover;background-position:center;` : 'background:linear-gradient(135deg,#afdcf1,#c7eaf9);'}"></div>
                <span class="moments-contact-name">${escapeHtml(me.nickname || '我')}</span>
                <span class="moments-contact-arrow">›</span>
            </div>
        `;
        const contactsHtml = contacts.length === 0
            ? ''
            : contacts.map(c => `
                <div class="moments-contact-item" data-contact-id="${escapeHtml(c.id)}">
                    <div class="moments-contact-avatar" style="${c.avatar ? `background-image:url('${escapeHtml(c.avatar)}');background-size:cover;background-position:center;` : 'background:linear-gradient(135deg,#afdcf1,#c7eaf9);'}"></div>
                    <span class="moments-contact-name">${escapeHtml(c.nickname || '未命名')}</span>
                    <span class="moments-contact-arrow">›</span>
                </div>
            `).join('');
        body.innerHTML = `
            <div class="moments-entry">
                <div class="moments-entry-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 3v18M3 12h18"/></svg>
                </div>
                <div class="moments-entry-text">
                    <div class="moments-entry-title">朋友圈</div>
                    <div class="moments-entry-sub">发布动态、分享心情</div>
                </div>
                ${(state.momentBadge || 0) > 0 ? `<span class="moments-entry-badge">${state.momentBadge > 99 ? '99+' : state.momentBadge}</span>` : ''}
                <span class="moments-entry-arrow">›</span>
            </div>
            <div class="moments-contact-list">
                ${meHtml}
                ${contactsHtml}
            </div>
        `;
        // 朋友圈入口：进入聚合页 (立即检查到期互动/发表, 随后清零未读角标)
        body.querySelector('.moments-entry').addEventListener('click', () => {
            checkMomentInteractions();
            checkContactMoments();
            if ((state.momentBadge || 0) > 0) {
                state.momentBadge = 0;
                saveData();
            }
            renderMomentsFeed();
            switchPage('momentsFeedPage');
        });
        // 点击用户卡片进入对应朋友圈页面
        body.querySelectorAll('.moments-contact-item').forEach(el => {
            el.addEventListener('click', () => {
                if (el.getAttribute('data-me') === '1') {
                    renderUserMoments(null);
                } else {
                    const cid = el.getAttribute('data-contact-id');
                    renderUserMoments(cid);
                }
            });
        });
    }

    // ================= 用户朋友圈页面 =================
    function renderUserMoments(contactId) {
        const page = $('userMomentsPage');
        if (!page) return;
        let user;
        if (contactId === null) {
            user = state.me || {};
        } else {
            user = (state.contacts || []).find(c => c.id === contactId);
            if (!user) return;
        }
        state.umContactId = contactId;
        // 封面
        const coverEl = $('userMomentsCover');
        coverEl.classList.remove('expanded');
        if (user.coverImg) {
            coverEl.style.backgroundImage = `url('${escapeHtml(user.coverImg)}')`;
        } else {
            coverEl.style.backgroundImage = '';
        }
        // 头像
        const avatarEl = $('userMomentsAvatar');
        const avatarBg = user.avatar
            ? `background-image:url('${escapeHtml(user.avatar)}');background-size:cover;background-position:center;`
            : 'background:linear-gradient(135deg,#afdcf1,#c7eaf9);';
        avatarEl.style.cssText = avatarBg;
        // 昵称
        $('userMomentsNickname').textContent = user.nickname || (contactId === null ? '我' : '未命名');
        // 个性签名
        $('userMomentsSignature').textContent = user.signature || '';
        // 渲染朋友圈列表
        renderMomentsList();
        switchPage('userMomentsPage');
    }

    // ================= 朋友圈聚合页 =================
    let feedCommentMomentId = null;
    let feedReplyToId = null;
    let feedDelTarget = null;
    let feedCommentImage = null;
    let feedEmojiTab = 'common';
    function renderMomentsFeed() {
        const page = $('momentsFeedPage');
        if (!page) return;
        const me = state.me || {};
        // 封面
        const coverEl = $('momentsFeedCover');
        if (me.coverImg) {
            coverEl.style.backgroundImage = `url('${escapeHtml(me.coverImg)}')`;
        } else {
            coverEl.style.backgroundImage = '';
        }
        // 头像
        const avatarEl = $('momentsFeedAvatar');
        const avatarBg = me.avatar
            ? `background-image:url('${escapeHtml(me.avatar)}');background-size:cover;background-position:center;`
            : 'background:linear-gradient(135deg,#afdcf1,#c7eaf9);';
        avatarEl.style.cssText = avatarBg;
        // 昵称
        $('momentsFeedNickname').textContent = me.nickname || '我';
        // 聚合所有朋友圈
        const container = $('momentsFeedList');
        if (!container) return;
        const all = [];
        if (me.moments) {
            me.moments.forEach(m => all.push({ m, author: me, contactId: null }));
        }
        (state.contacts || []).forEach(c => {
            if (c.moments) {
                c.moments.forEach(m => all.push({ m, author: c, contactId: c.id }));
            }
        });
        all.sort((a, b) => (b.m.timestamp || 0) - (a.m.timestamp || 0));
        if (all.length === 0) {
            container.innerHTML = '';
            return;
        }
        container.innerHTML = all.map(({ m, author, contactId }) => {
            const avatarStyle = author.avatar
                ? `background-image:url('${escapeHtml(author.avatar)}');background-size:cover;background-position:center;`
                : 'background:linear-gradient(135deg,#afdcf1,#c7eaf9);';
            const authorName = author.nickname || (contactId ? '未命名' : '我');
            const imgCount = (m.images || []).length;
            let thumbHtml = '';
            if (imgCount === 1) {
                thumbHtml = `<img class="moment-thumb single" src="${escapeHtml(m.images[0])}" alt="" onclick="openMomentsFeedViewer('${m.id}',0)">`;
            } else if (imgCount > 1) {
                const cols = (imgCount === 2 || imgCount === 4) ? 2 : 3;
                thumbHtml = `<div class="moment-grid cols-${cols}">${m.images.map((src, i) => `<img class="moment-thumb" src="${escapeHtml(src)}" alt="" onclick="openMomentsFeedViewer('${m.id}',${i})">`).join('')}</div>`;
            }
            const textHtml = m.text ? `<div class="moment-text">${escapeHtml(m.text)}</div>` : '';
            const timeStr = formatRelativeTime(m.timestamp);
            const likeClass = m.liked ? ' liked' : '';
            const likeText = m.liked ? '取消' : '赞';
            const likedByNames = (m.likedBy || []).map(id => {
                const u = id === 'me' ? (state.me || {}) : (state.contacts || []).find(x => x.id === id) || {};
                return u.nickname || (id === 'me' ? '我' : '未知');
            }).filter(n => n).join('、');
            const feedLikesHtml = likedByNames ? `<div class="moment-feed-likes"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg><span>${escapeHtml(likedByNames)}</span></div>` : '';
            const feedCommentsHtml = (m.comments || []).map((c, cIdx) => {
                const cu = c.contactId ? (state.contacts || []).find(x => x.id === c.contactId) : (state.me || {});
                const cName = cu.nickname || '我';
                const cImgHtml = c.image ? `<img class="moment-feed-comment-img" src="${escapeHtml(c.image)}" alt="">` : '';
                let nameHtml = `<span class="moment-feed-comment-name">${escapeHtml(cName)}:</span>`;
                if (c.replyToContactId) {
                    const ru = c.replyToContactId === 'me' ? (state.me || {}) : (state.contacts || []).find(x => x.id === c.replyToContactId) || {};
                    const rName = c.replyToContactId === 'me' ? (ru.nickname || '我') : (ru.nickname || '未知');
                    nameHtml = `<span class="moment-feed-comment-name">${escapeHtml(cName)}</span><span class="moment-feed-comment-reply">回复</span><span class="moment-feed-comment-name">${escapeHtml(rName)}:</span>`;
                }
                return `<div class="moment-feed-comment" data-moment-id="${m.id}" data-comment-idx="${cIdx}">${nameHtml}<span class="moment-feed-comment-text">${escapeHtml(c.text || '')}</span>${cImgHtml}</div>`;
            }).join('');
            const interactionHtml = (feedLikesHtml || feedCommentsHtml) ? `<div class="moment-feed-interaction">${feedLikesHtml}${feedCommentsHtml}</div>` : '';
            return `<div class="moment-feed-item">
                <div class="moment-feed-row">
                    <div class="moment-feed-avatar" style="${avatarStyle}"></div>
                    <div class="moment-feed-content">
                        <span class="moment-feed-name">${escapeHtml(authorName)}</span>
                        ${textHtml}
                        <div class="moment-item">
                            ${thumbHtml}
                        </div>
                        <div class="moment-feed-foot">
                            <span class="moment-feed-time">${escapeHtml(timeStr)}</span>
                            <div class="moment-feed-right-group">
                                <div class="moment-feed-action-bar" style="display:none;">
                                    <button class="moment-feed-action-btn moment-feed-like-btn${likeClass}" data-moment-id="${m.id}">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                                        <span>${likeText}</span>
                                    </button>
                                    <button class="moment-feed-action-btn moment-feed-comment-btn" data-moment-id="${m.id}">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                                        <span>评论</span>
                                    </button>
                                </div>
                                <button class="moment-feed-dots" data-moment-id="${m.id}">
                                    <svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>
                                </button>
                            </div>
                        </div>
                        ${interactionHtml}
                    </div>
                </div>
            </div>`;
        }).join('');
        // 绑定黑点按钮 + 点赞 + 评论
        container.querySelectorAll('.moment-feed-dots').forEach(btn => {
            btn.addEventListener('click', () => {
                const actionBar = btn.parentElement.querySelector('.moment-feed-action-bar');
                if (actionBar) actionBar.style.display = actionBar.style.display === 'none' ? 'flex' : 'none';
            });
        });
        container.querySelectorAll('.moment-feed-like-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const momentId = btn.getAttribute('data-moment-id');
                const m = findMomentAnywhere(momentId);
                if (!m) return;
                m.liked = !m.liked;
                if (m.liked) {
                    m.likeCount = (m.likeCount || 0) + 1;
                    if (!m.likedBy) m.likedBy = [];
                    if (!m.likedBy.includes('me')) m.likedBy.push('me');
                    btn.classList.add('liked');
                    btn.querySelector('span').textContent = '取消';
                } else {
                    m.likeCount = Math.max(0, (m.likeCount || 0) - 1);
                    if (m.likedBy) m.likedBy = m.likedBy.filter(id => id !== 'me');
                    btn.classList.remove('liked');
                    btn.querySelector('span').textContent = '赞';
                }
                setMyLikeRecord(m, m.liked);
                saveData();
                renderMomentsFeed();
            });
        });
        container.querySelectorAll('.moment-feed-comment-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const momentId = btn.getAttribute('data-moment-id');
                if (!findMomentAnywhere(momentId)) return;
                feedCommentMomentId = momentId;
                feedReplyToId = null;
                feedCommentImage = null;
                renderFeedCommentPreview();
                const input = $('momentsFeedCommentInput');
                if (input) {
                    input.value = '';
                    input.placeholder = '发表评论...';
                }
                $('momentsFeedCommentModal').classList.add('show');
                if (input) setTimeout(() => input.focus(), 100);
            });
        });
        // 评论点击：自己的评论弹删除卡片，梦角的评论弹回复弹窗
        container.querySelectorAll('.moment-feed-comment').forEach(el => {
            el.addEventListener('click', e => {
                e.stopPropagation();
                const momentId = el.getAttribute('data-moment-id');
                const cIdx = parseInt(el.getAttribute('data-comment-idx'), 10);
                const m = findMomentAnywhere(momentId);
                if (!m || !m.comments || !m.comments[cIdx]) return;
                const c = m.comments[cIdx];
                if (!c.contactId) {
                    showFeedCommentDelCard(el, momentId, cIdx);
                } else {
                    const cu = (state.contacts || []).find(x => x.id === c.contactId) || {};
                    feedCommentMomentId = momentId;
                    feedReplyToId = c.contactId;
                    feedCommentImage = null;
                    renderFeedCommentPreview();
                    const input = $('momentsFeedCommentInput');
                    if (input) {
                        input.value = '';
                        input.placeholder = `回复 ${cu.nickname || '对方'}`;
                    }
                    $('momentsFeedCommentModal').classList.add('show');
                    if (input) setTimeout(() => input.focus(), 100);
                }
            });
        });
    }
    // 显示评论删除小卡片（定位在被点击评论上方）
    function showFeedCommentDelCard(anchorEl, momentId, cIdx) {
        const card = $('feedCommentDelCard');
        if (!card) return;
        feedDelTarget = { momentId, cIdx };
        card.style.display = 'block';
        const rect = anchorEl.getBoundingClientRect();
        const cardRect = card.getBoundingClientRect();
        let left = rect.left;
        let top = rect.top - cardRect.height - 6;
        if (top < 0) top = rect.bottom + 6;
        if (left + cardRect.width > window.innerWidth) left = window.innerWidth - cardRect.width - 8;
        card.style.left = left + 'px';
        card.style.top = top + 'px';
    }
    // 渲染评论图片预览区
    function renderFeedCommentPreview() {
        const preview = $('feedCommentPreview');
        if (!preview) return;
        if (!feedCommentImage) {
            preview.innerHTML = '';
            preview.style.display = 'none';
            return;
        }
        preview.style.display = 'flex';
        preview.innerHTML = `<div class="feed-comment-preview-item"><img src="${feedCommentImage}" alt=""><button class="feed-comment-preview-del" id="feedCommentPreviewDel">×</button></div>`;
        $('feedCommentPreviewDel').addEventListener('click', e => {
            e.stopPropagation();
            feedCommentImage = null;
            renderFeedCommentPreview();
        });
    }
    // 渲染聚合页表情面板（无拍一拍）
    function renderFeedEmojiGrid() {
        const grid = $('feedEmojiGrid');
        if (!grid) return;
        grid.innerHTML = '';
        let items = [];
        if (feedEmojiTab === 'common') {
            items = state.commonEmojis.map(e => ({ type: 'emoji', value: e }));
        } else if (feedEmojiTab === 'exclusive') {
            const targetId = feedReplyToId || state.umContactId;
            const c = targetId ? getContact(targetId) : null;
            const list = c ? (c.settings.exclusiveEmojis || []) : [];
            items = list.map(e => ({ type: 'emoji', value: e }));
        }
        if (items.length === 0) {
            grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:var(--text-light);padding:20px;font-size:13px;">暂无表情</div>';
            return;
        }
        items.forEach(it => {
            const el = document.createElement('div');
            el.className = 'emoji-item';
            if (it.value.startsWith('data:image')) {
                el.innerHTML = `<img src="${escapeHtml(it.value)}" alt="emoji" draggable="false">`;
            } else {
                el.textContent = it.value;
            }
            el.addEventListener('click', () => {
                if (it.value.startsWith('data:image')) {
                    // 图片表情无法插入文字输入框, 作为评论图片进入预览区
                    feedCommentImage = it.value;
                    renderFeedCommentPreview();
                } else {
                    const input = $('momentsFeedCommentInput');
                    if (input) {
                        input.value += it.value;
                        input.focus();
                    }
                }
                $('momentsFeedEmojiModal').classList.remove('show');
            });
            grid.appendChild(el);
        });
    }
    // 跨用户/联系人查找朋友圈，并设置好上下文（state.umContactId）
    function findMomentAnywhere(momentId) {
        if (state.me && state.me.moments) {
            const m = state.me.moments.find(x => x.id === momentId);
            if (m) {
                state.umContactId = null;
                return m;
            }
        }
        for (const c of (state.contacts || [])) {
            if (c.moments) {
                const m = c.moments.find(x => x.id === momentId);
                if (m) {
                    state.umContactId = c.id;
                    return m;
                }
            }
        }
        return null;
    }
    function openMomentsFeedViewer(momentId, imgIdx) {
        if (!findMomentAnywhere(momentId)) return;
        openMomentsViewer(momentId, imgIdx, true);
    }
    function openMomentsFeedDetail(momentId) {
        if (!findMomentAnywhere(momentId)) return;
        openMomentsDetail(momentId);
    }
    window.openMomentsFeedViewer = openMomentsFeedViewer;
    window.openMomentsFeedDetail = openMomentsFeedDetail;

    function getMomentsArray() {
        if (state.umContactId) {
            const c = (state.contacts || []).find(x => x.id === state.umContactId);
            if (c) {
                if (!c.moments) c.moments = [];
                return c.moments;
            }
        }
        if (!state.me) state.me = {};
        if (!state.me.moments) state.me.moments = [];
        return state.me.moments;
    }

    // ================= 朋友圈搜索页 =================
    const momentsSearchHidden = new Set(); // 本次搜索中被隐藏的结果
    function formatSearchDate(ts) {
        const d = new Date(ts);
        return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
    }
    function highlightSearchKeyword(text, kw) {
        const safe = escapeHtml(text);
        if (!kw) return safe;
        const safeKw = escapeHtml(kw).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        try {
            return safe.replace(new RegExp(safeKw, 'gi'), m => `<span class="ms-hl">${m}</span>`);
        } catch (e) { return safe; }
    }
    function openMomentsSearch() {
        state.momentsSearchKeyword = '';
        momentsSearchHidden.clear();
        const input = $('momentsSearchInput');
        if (input) input.value = '';
        const clearBtn = $('momentsSearchClearBtn');
        if (clearBtn) clearBtn.style.display = 'none';
        renderMomentsSearchResults();
        const appEl = $('app');
        if (appEl) appEl.scrollLeft = 0;
        switchPage('momentsSearchPage');
        setTimeout(() => {
            if (appEl) appEl.scrollLeft = 0;
            if (input) input.focus({ preventScroll: true });
        }, 100);
    }
    function renderMomentsSearchResults() {
        const container = $('momentsSearchResults');
        if (!container) return;
        const endEl = $('momentsSearchEnd');
        const kw = (state.momentsSearchKeyword || '').trim();
        if (!kw) {
            container.innerHTML = '';
            if (endEl) endEl.style.display = 'none';
            return;
        }
        const lower = kw.toLowerCase();
        const list = getMomentsArray().filter(m => {
            if (momentsSearchHidden.has(m.id)) return false;
            const inText = (m.text || '').toLowerCase().includes(lower);
            const inComment = (m.comments || []).some(c => (c.text || '').toLowerCase().includes(lower));
            return inText || inComment;
        });
        if (list.length === 0) {
            container.innerHTML = '<div class="ms-empty">没有找到相关内容</div>';
            if (endEl) endEl.style.display = 'none';
            return;
        }
        const summaryHtml = `<div class="ms-summary">找到与「<span class="ms-hl">${escapeHtml(kw)}</span>」相关的朋友圈，共${list.length}条。</div>`;
        container.innerHTML = summaryHtml + list.map(m => {
            const imgs = m.images || [];
            const inText = (m.text || '').toLowerCase().includes(lower);
            const inComment = (m.comments || []).some(c => (c.text || '').toLowerCase().includes(lower));
            const types = [];
            if (inText) types.push('文字');
            if (imgs.length > 0) types.push('图片');
            if (inComment) types.push('评论');
            const textHtml = m.text ? `<div class="ms-item-text">${highlightSearchKeyword(m.text, kw)}</div>` : '';
            let imgHtml = '';
            if (imgs.length === 1) {
                imgHtml = `<img class="ms-thumb single" src="${escapeHtml(imgs[0])}" alt="" onclick="openMomentsViewer('${m.id}',0)">`;
            } else if (imgs.length > 1) {
                const cols = (imgs.length === 2 || imgs.length === 4) ? 2 : 3;
                imgHtml = `<div class="ms-grid cols-${cols}">${imgs.slice(0, 9).map((src, i) => `<img class="ms-thumb" src="${escapeHtml(src)}" alt="" onclick="openMomentsViewer('${m.id}',${i})">`).join('')}</div>`;
            }
            return `<div class="ms-item" data-mid="${m.id}">
                ${textHtml}
                ${imgHtml}
                <div class="ms-item-date">${formatSearchDate(m.timestamp)}</div>
                <div class="ms-item-footer"><span>${types.join('、')}与「${escapeHtml(kw)}」相关</span><button class="ms-hide-btn" data-mid="${m.id}" title="隐藏">×</button></div>
            </div>`;
        }).join('');
        if (endEl) endEl.style.display = 'block';
    }

    // ================= 朋友圈互动消息页 =================
    // 解析旧数据中 "M月D日 H:mm" 的评论时间
    function parseLegacyInteractTime(str) {
        const match = /^(\d{1,2})月(\d{1,2})日\s+(\d{1,2}):(\d{2})$/.exec(String(str || '').trim());
        if (!match) return null;
        const now = new Date();
        const build = year => new Date(year, parseInt(match[1], 10) - 1, parseInt(match[2], 10), parseInt(match[3], 10), parseInt(match[4], 10)).getTime();
        let t = build(now.getFullYear());
        if (t > Date.now() + 24 * 3600 * 1000) t = build(now.getFullYear() - 1);
        return t;
    }
    function formatInteractTime(at) {
        const d = new Date(at || Date.now());
        const now = new Date();
        const hh = String(d.getHours()).padStart(2, '0');
        const mm = String(d.getMinutes()).padStart(2, '0');
        const dayStart = t => new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime();
        const diffDays = Math.round((dayStart(now) - dayStart(d)) / 86400000);
        if (diffDays === 0) return `${hh}:${mm}`;
        if (diffDays === 1) return `昨天 ${hh}:${mm}`;
        if (d.getFullYear() === now.getFullYear()) return `${d.getMonth() + 1}月${d.getDate()}日 ${hh}:${mm}`;
        return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${hh}:${mm}`;
    }
    function setMyLikeRecord(m, liked) {
        if (!m) return;
        if (!m.likeRecords) m.likeRecords = [];
        m.likeRecords = m.likeRecords.filter(r => r && r.contactId !== 'me');
        if (liked) m.likeRecords.push({ contactId: 'me', at: Date.now() });
    }
    function getLikeInteractionTime(m, actorId) {
        const rec = (m.likeRecords || []).filter(r => r && r.contactId === actorId).pop();
        if (rec && rec.at) return rec.at;
        const c = (m.comments || []).filter(x => (x.contactId || 'me') === actorId).pop();
        if (c) {
            const t = c.createdAt || parseLegacyInteractTime(c.timeStr);
            if (t) return t;
        }
        return m.timestamp || Date.now();
    }
    function collectMomentInteractions() {
        const contacts = state.contacts || [];
        const items = [];
        const resolveActor = id => {
            if (id === 'me' || !id) {
                const me = state.me || {};
                return { avatar: me.avatar || '', name: me.nickname || '我' };
            }
            const c = contacts.find(x => x.id === id);
            if (!c) return null;
            return { avatar: c.avatar || '', name: c.nickname || '未知' };
        };
        const scan = (list, ownerIsMe) => {
            (list || []).forEach(m => {
                // 点赞: 我的点赞(任意朋友圈) + 梦角对我朋友圈的点赞
                (m.likedBy || []).forEach(actorId => {
                    if (actorId !== 'me' && !ownerIsMe) return;
                    const actor = resolveActor(actorId);
                    if (!actor) return;
                    items.push({ type: 'like', at: getLikeInteractionTime(m, actorId), actor, moment: m });
                });
                // 评论: 我的评论(任意朋友圈) + 梦角对我朋友圈的评论
                (m.comments || []).forEach(c => {
                    const isMine = !c.contactId;
                    if (!isMine && !ownerIsMe) return;
                    const actor = resolveActor(isMine ? 'me' : c.contactId);
                    if (!actor) return;
                    const at = c.createdAt || parseLegacyInteractTime(c.timeStr) || m.timestamp || Date.now();
                    items.push({ type: 'comment', at, actor, moment: m, text: c.text || (c.image ? '[图片]' : '') });
                });
            });
        };
        scan(state.me && state.me.moments, true);
        contacts.forEach(c => scan(c.moments, false));
        items.sort((a, b) => b.at - a.at);
        return items;
    }
    function renderMomentsInteractPage() {
        const container = $('momentsInteractList');
        if (!container) return;
        const endEl = $('momentsInteractEnd');
        const items = collectMomentInteractions();
        if (items.length === 0) {
            container.innerHTML = '<div class="mi-empty">暂无互动消息</div>';
            if (endEl) endEl.style.display = 'none';
            return;
        }
        container.innerHTML = items.map(it => {
            const avatarStyle = it.actor.avatar
                ? `background-image:url('${escapeHtml(it.actor.avatar)}')`
                : 'background:linear-gradient(135deg,#e8e8e8,#f4f4f4)';
            const contentHtml = it.type === 'like'
                ? '<span class="mi-like-icon">❤️</span>'
                : `<span>${escapeHtml(it.text)}</span>`;
            const thumbHtml = it.moment.images && it.moment.images.length > 0
                ? `<img class="mi-thumb" src="${escapeHtml(it.moment.images[0])}" alt="">`
                : '<div class="mi-thumb mi-thumb-empty"></div>';
            return `<div class="mi-item" data-mid="${escapeHtml(it.moment.id)}">
                <div class="mi-avatar" style="${avatarStyle}"></div>
                <div class="mi-main">
                    <div class="mi-top"><span class="mi-name">${escapeHtml(it.actor.name)}</span><span class="mi-time">${escapeHtml(formatInteractTime(it.at))}</span></div>
                    <div class="mi-content">${contentHtml}</div>
                </div>
                ${thumbHtml}
            </div>`;
        }).join('');
        if (endEl) endEl.style.display = 'block';
        const appEl = $('app');
        if (appEl) appEl.scrollLeft = 0;
    }
    function openMomentsInteractPage() {
        renderMomentsInteractPage();
        const appEl = $('app');
        if (appEl) appEl.scrollLeft = 0;
        switchPage('momentsInteractPage');
        setTimeout(() => { if (appEl) appEl.scrollLeft = 0; }, 100);
    }

    function renderMomentsList() {
        const container = $('userMomentsList');
        if (!container) return;
        const list = getMomentsArray();
        if (list.length === 0) {
            container.innerHTML = '';
            return;
        }
        container.innerHTML = list.map(m => {
            const dateStr = formatDateLabel(m.timestamp);
            const imgCount = (m.images || []).length;
            let thumbHtml = '';
            if (imgCount === 1) {
                thumbHtml = `<img class="moment-thumb single" src="${escapeHtml(m.images[0])}" alt="" onclick="openMomentsViewer('${m.id}',0)">`;
            } else if (imgCount > 1) {
                const cols = (imgCount === 2 || imgCount === 4) ? 2 : 3;
                thumbHtml = `<div class="moment-grid cols-${cols}">${m.images.map((src, i) => `<img class="moment-thumb" src="${escapeHtml(src)}" alt="" onclick="openMomentsViewer('${m.id}',${i})">`).join('')}</div>`;
            }
            const textHtml = m.text ? `<div class="moment-text${imgCount === 0 ? ' text-only' : ''}" onclick="openMomentsDetail('${m.id}')">${escapeHtml(m.text)}</div>` : '<div class="moment-text"></div>';
            return `<div class="moment-item">
                <span class="moment-date">${dateStr}</span>
                ${thumbHtml}
                ${textHtml}
            </div>`;
        }).join('');
    }
    function formatDateLabel(ts) {
        const d = new Date(ts);
        const month = d.getMonth() + 1;
        const day = d.getDate();
        return `<span class="moment-date-big">${month}</span><span class="moment-date-small">${day}月</span>`;
    }
    function formatDateTimeLabel(ts) {
        const d = new Date(ts);
        const y = d.getFullYear();
        const mo = d.getMonth() + 1;
        const da = d.getDate();
        const h = String(d.getHours()).padStart(2, '0');
        const mi = String(d.getMinutes()).padStart(2, '0');
        return `${y}年${mo}月${da}日 ${h}:${mi}`;
    }
    function formatRelativeTime(ts) {
        const now = new Date();
        const d = new Date(ts);
        const oneDayMs = 24 * 60 * 60 * 1000;
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const tsStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
        const diffDays = Math.round((todayStart - tsStart) / oneDayMs);
        const hh = String(d.getHours()).padStart(2, '0');
        const mm = String(d.getMinutes()).padStart(2, '0');
        if (diffDays <= 0) {
            return `${hh}:${mm}`;
        } else if (diffDays === 1) {
            return `昨天`;
        } else {
            return `${diffDays}天前`;
        }
    }
    // ===== 朋友圈图片浏览弹窗 =====
    let mvIndex = 0;
    let mvMoment = null;
    function openMomentsViewer(momentId, imgIdx, fromFeed) {
        const m = getMomentsArray().find(x => x.id === momentId);
        if (!m || !m.images || m.images.length === 0) return;
        mvMoment = m;
        mvIndex = imgIdx || 0;
        // 日期时间
        $('momentsViewerDate').textContent = formatDateTimeLabel(m.timestamp);
        // 文字
        $('momentsViewerText').textContent = m.text || '';
        // 图片
        const slider = $('momentsViewerSlider');
        slider.innerHTML = m.images.map(src => `<img src="${escapeHtml(src)}" alt="">`).join('');
        slider.style.width = (m.images.length * 100) + '%';
        slider.style.transform = `translateX(-${mvIndex * (100 / m.images.length)}%)`;
        // 点赞
        const likeBtn = $('momentsViewerLikeBtn');
        const likeCount = $('momentsViewerLikeCount');
        if (m.liked) {
            likeBtn.classList.add('liked');
        } else {
            likeBtn.classList.remove('liked');
        }
        likeCount.textContent = m.likeCount || 0;
        // 评论数
        $('momentsViewerCommentCount').textContent = (m.comments || []).length;
        // 显示弹窗
        const modal = $('momentsViewerModal');
        if (fromFeed) modal.classList.add('feed-mode');
        else modal.classList.remove('feed-mode');
        modal.classList.add('show');
    }
    function closeMomentsViewer() {
        $('momentsViewerModal').classList.remove('show');
    }
    function mvSlide(dir) {
        if (!mvMoment || !mvMoment.images) return;
        const total = mvMoment.images.length;
        mvIndex += dir;
        if (mvIndex < 0) mvIndex = 0;
        if (mvIndex >= total) mvIndex = total - 1;
        const slider = $('momentsViewerSlider');
        slider.style.transform = `translateX(-${mvIndex * (100 / total)}%)`;
    }
    function toggleMomentLike() {
        if (!mvMoment) return;
        mvMoment.liked = !mvMoment.liked;
        if (mvMoment.liked) {
            mvMoment.likeCount = (mvMoment.likeCount || 0) + 1;
            if (!mvMoment.likedBy) mvMoment.likedBy = [];
            if (!mvMoment.likedBy.includes('me')) mvMoment.likedBy.push('me');
            $('momentsViewerLikeBtn').classList.add('liked');
        } else {
            mvMoment.likeCount = Math.max(0, (mvMoment.likeCount || 0) - 1);
            if (mvMoment.likedBy) mvMoment.likedBy = mvMoment.likedBy.filter(id => id !== 'me');
            $('momentsViewerLikeBtn').classList.remove('liked');
        }
        setMyLikeRecord(mvMoment, mvMoment.liked);
        $('momentsViewerLikeCount').textContent = mvMoment.likeCount;
        renderMomentsList();
        saveData();
    }
    // ===== 朋友圈详情页面 =====
    function openMomentsDetail(momentId, fromInteract) {
        state.momentsInteractBack = !!fromInteract;
        const m = getMomentsArray().find(x => x.id === momentId);
        if (!m) return;
        mvMoment = m;
        const body = $('momentsDetailBody');
        const user = m.contactId ? (state.contacts || []).find(c => c.id === m.contactId) : (state.me || {});
        const avatarBg = user.avatar
            ? `background-image:url('${escapeHtml(user.avatar)}')`
            : 'background:linear-gradient(135deg,#afdcf1,#c7eaf9)';
        const name = user.nickname || '我';
        const imagesHtml = m.images && m.images.length > 0
            ? `<div class="mv-detail-images">${m.images.map(src => `<img src="${escapeHtml(src)}" alt="">`).join('')}</div>`
            : '';
        const mentionHtml = m.remindIds && m.remindIds.length > 0
            ? (() => {
                const names = m.remindIds.map(id => {
                    const c = (state.contacts || []).find(x => x.id === id);
                    return c ? c.nickname : '';
                }).filter(n => n);
                return names.length > 0 ? `<div class="mv-detail-mention">提到了: ${escapeHtml(names.join('、'))}</div>` : '';
            })()
            : '';
        const likeAvatarsHtml = m.likeCount > 0
            ? `<div class="mv-detail-like-avatars"></div>`
            : '';
        const likeListHtml = (m.likedBy || []).map(id => {
            const u = id === 'me' ? (state.me || {}) : (state.contacts || []).find(x => x.id === id) || {};
            const aBg = u.avatar ? `background-image:url('${escapeHtml(u.avatar)}')` : 'background:#ddd';
            return `<div class="mv-detail-like-avatar" style="${aBg}"></div>`;
        }).join('');
        const likesHtml = (m.likeCount || 0) > 0
            ? `<div class="mv-detail-section"><div class="mv-detail-likes"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>${likeListHtml}</div></div>`
            : '';
        const commentsHtml = (m.comments || []).length > 0
            ? `<div class="mv-detail-section"><div class="mv-detail-comments"><svg class="mv-detail-comment-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg><div class="mv-detail-comment-list">${(m.comments || []).map(c => {
                const cu = c.contactId ? (state.contacts || []).find(x => x.id === c.contactId) : (state.me || {});
                const cAvatar = cu.avatar ? `background-image:url('${escapeHtml(cu.avatar)}')` : 'background:#ddd';
                const cName = cu.nickname || '我';
                let replyPrefix = '';
                if (c.replyToContactId) {
                    const ru = c.replyToContactId === 'me' ? (state.me || {}) : (state.contacts || []).find(x => x.id === c.replyToContactId) || {};
                    const rName = c.replyToContactId === 'me' ? (ru.nickname || '我') : (ru.nickname || '未知');
                    replyPrefix = `<span class="mv-detail-comment-reply">回复</span><span class="mv-detail-comment-reply-name">${escapeHtml(rName)}</span>: `;
                }
                return `<div class="mv-detail-comment"><div class="mv-detail-comment-avatar" style="${cAvatar}"></div><div class="mv-detail-comment-body"><div class="mv-detail-comment-top"><span class="mv-detail-comment-name">${escapeHtml(cName)}</span><span class="mv-detail-comment-time">${escapeHtml(c.timeStr || '')}</span></div><div class="mv-detail-comment-text">${replyPrefix}${escapeHtml(c.text)}</div></div></div>`;
            }).join('')}</div></div></div>`
            : '';
        const likeText = m.liked ? '取消' : '赞';
        body.innerHTML = `<div class="mv-detail-author"><div class="mv-detail-avatar" style="${avatarBg}"></div><div class="mv-detail-name">${escapeHtml(name)}</div></div><div class="mv-detail-text">${escapeHtml(m.text || '')}</div>${imagesHtml}${mentionHtml}<div class="mv-detail-time"><span class="mv-detail-time-text">${escapeHtml(formatDateTimeLabel(m.timestamp))}</span><button class="mv-detail-delete" id="momentsDetailDeleteBtn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button><div class="mv-detail-right-group"><div class="mv-detail-action-bar" id="momentsDetailActionBar" style="display:none;"><button class="mv-detail-action-btn${m.liked ? ' liked' : ''}" id="momentsDetailLikeBtn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg><span>${likeText}</span></button><button class="mv-detail-action-btn" id="mvDetailCommentBtn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg><span>评论</span></button></div><button class="mv-detail-dots" id="momentsDetailDotsBtn"><svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg></button></div></div>${likesHtml}${commentsHtml}`;
        switchPage('momentsDetailPage');
        const dotsBtn = $('momentsDetailDotsBtn');
        if (dotsBtn) dotsBtn.addEventListener('click', () => {
            const bar = $('momentsDetailActionBar');
            if (bar) bar.style.display = bar.style.display === 'none' ? 'flex' : 'none';
        });
        const likeBtn = $('momentsDetailLikeBtn');
        if (likeBtn) likeBtn.addEventListener('click', () => {
            if (!mvMoment) return;
            mvMoment.liked = !mvMoment.liked;
            if (mvMoment.liked) {
                mvMoment.likeCount = (mvMoment.likeCount || 0) + 1;
                if (!mvMoment.likedBy) mvMoment.likedBy = [];
                if (!mvMoment.likedBy.includes('me')) mvMoment.likedBy.push('me');
                likeBtn.classList.add('liked');
                likeBtn.querySelector('span').textContent = '取消';
            } else {
                mvMoment.likeCount = Math.max(0, (mvMoment.likeCount || 0) - 1);
                if (mvMoment.likedBy) mvMoment.likedBy = mvMoment.likedBy.filter(id => id !== 'me');
                likeBtn.classList.remove('liked');
                likeBtn.querySelector('span').textContent = '赞';
            }
            setMyLikeRecord(mvMoment, mvMoment.liked);
            saveData();
            openMomentsDetail(mvMoment.id, state.momentsInteractBack);
            const newBar = $('momentsDetailActionBar');
            if (newBar) newBar.style.display = 'flex';
        });
        const cmtBtn = $('mvDetailCommentBtn');
        if (cmtBtn) cmtBtn.addEventListener('click', () => {
            const input = $('momentsDetailCommentInput');
            if (input) input.focus();
        });
        const delBtn = $('momentsDetailDeleteBtn');
        if (delBtn) delBtn.addEventListener('click', () => {
            openModal('momentDelModal');
        });
    }
    function addMomentComment(text) {
        if (!mvMoment || !text.trim()) return;
        if (!mvMoment.comments) mvMoment.comments = [];
        const now = new Date();
        const timeStr = `${now.getMonth() + 1}月${now.getDate()}日 ${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;
        mvMoment.comments.push({ text: text.trim(), contactId: null, timeStr, createdAt: now.getTime() });
        // 用户评论后: 50% 概率相关梦角在 0~10 分钟内随机时间回复 (梦角的朋友圈→该梦角; 用户的朋友圈→最近评论的梦角)
        let replyTargetCid = null;
        if (mvMoment.contactId) {
            replyTargetCid = mvMoment.contactId;
        } else {
            const contactComments = (mvMoment.comments || []).filter(x => x.contactId);
            if (contactComments.length) replyTargetCid = contactComments[contactComments.length - 1].contactId;
        }
        if (replyTargetCid && Math.random() < 0.5) {
            state.momentSchedules.push({
                id: uuid(),
                type: 'reply',
                momentId: mvMoment.id,
                contactId: replyTargetCid,
                at: Date.now() + Math.floor(Math.random() * 10 * 60 * 1000),
                done: false
            });
        }
        $('momentsViewerCommentCount').textContent = mvMoment.comments.length;
        renderMomentsList();
        saveData();
    }
    function renderMomentsCommentList() {
        const container = $('momentsCommentList');
        if (!container || !mvMoment) return;
        const comments = mvMoment.comments || [];
        container.innerHTML = comments.map(c => {
            const cu = c.contactId ? (state.contacts || []).find(x => x.id === c.contactId) : (state.me || {});
            const cAvatar = cu.avatar ? `background-image:url('${escapeHtml(cu.avatar)}')` : 'background:#ddd';
            const cName = cu.nickname || '我';
            return `<div class="mv-comment-item"><div class="mv-comment-avatar" style="${cAvatar}"></div><div class="mv-comment-body"><div class="mv-comment-name">${escapeHtml(cName)}</div><div class="mv-comment-text">${escapeHtml(c.text)}</div><div class="mv-comment-time">${escapeHtml(c.timeStr || '')}</div></div></div>`;
        }).join('');
    }
    window.openMomentsViewer = openMomentsViewer;
    window.openMomentsDetail = openMomentsDetail;
    function publishMoment() {
        const text = ($('momentsEditTextarea') || {}).value || '';
        const images = (state.momentsEditImages || []).slice();
        const moment = {
            id: 'm' + Date.now(),
            text: text.trim(),
            images: images,
            timestamp: Date.now(),
            visible: state.visibleSelection,
            remindIds: Array.from(state.remindSelectedIds || []),
            partialIds: Array.from(state.visiblePartialIds || []),
            excludeIds: Array.from(state.visibleExcludeIds || []),
            contactId: state.umContactId
        };
        if (!moment.text && images.length === 0) {
            showToast('请输入内容');
            return;
        }
        getMomentsArray().unshift(moment);
        // 用户发表朋友圈后: 所有梦角各自在 0~4 小时内随机时间点点赞+评论
        if (!moment.contactId) {
            (state.contacts || []).forEach(c => {
                if (c.isGroup) return; // 群聊不参与点赞评论
                state.momentSchedules.push({
                    id: uuid(),
                    type: 'like-comment',
                    momentId: moment.id,
                    contactId: c.id,
                    at: Date.now() + Math.floor(Math.random() * 4 * 3600 * 1000),
                    done: false
                });
            });
        }
        // 清空编辑页面
        const ta = $('momentsEditTextarea');
        if (ta) ta.value = '';
        state.momentsEditImages = [];
        state.remindSelectedIds = new Set();
        state.visibleSelection = 'public';
        state.visiblePartialIds = new Set();
        state.visibleExcludeIds = new Set();
        // 重置提醒谁看卡片
        const remindBtn = $('momentsEditRemindBtn');
        if (remindBtn) {
            remindBtn.classList.remove('selected');
            remindBtn.querySelector('.um-edit-option-label').textContent = '提醒谁看';
            const subEl = remindBtn.querySelector('.um-edit-option-sub');
            if (subEl) subEl.textContent = '';
            const valEl = remindBtn.querySelector('.um-edit-option-value');
            if (valEl) valEl.textContent = '';
        }
        // 重置谁可以看卡片
        const visibleBtn = $('momentsEditVisibleBtn');
        if (visibleBtn) {
            visibleBtn.classList.remove('selected', 'selected-pink');
            visibleBtn.querySelector('.um-edit-option-label').textContent = '谁可以看';
            const subEl = visibleBtn.querySelector('.um-edit-option-sub');
            if (subEl) subEl.textContent = '';
            const valEl = visibleBtn.querySelector('.um-edit-option-value');
            if (valEl) valEl.textContent = '';
        }
        renderMomentsEditImages();
        const returnTo = state.momentsEditFrom || 'userMomentsPage';
        state.momentsEditFrom = null;
        switchPage(returnTo);
        if (returnTo === 'momentsFeedPage') {
            renderMomentsFeed();
        } else {
            renderMomentsList();
        }
        saveData();
        showToast('发表成功');
    }

    function renderMomentsEditImages() {
        const container = $('momentsEditImages');
        if (!container) return;
        container.innerHTML = '';
        state.momentsEditImages.forEach((src, i) => {
            const img = document.createElement('img');
            img.className = 'um-edit-thumb';
            img.src = src;
            img.alt = '图片' + (i + 1);
            img.addEventListener('click', () => openMomentsEditImageViewer(i));
            container.appendChild(img);
        });
        const addBtn = $('momentsEditAddBtn');
        if (addBtn) addBtn.style.display = state.momentsEditImages.length >= 9 ? 'none' : '';
    }

    function renderMomentsEditImageViewer() {
        const slider = $('imageViewerSlider');
        const images = state.momentsEditImages;
        slider.innerHTML = '';
        images.forEach(src => {
            const img = document.createElement('img');
            img.src = src;
            slider.appendChild(img);
        });
        const idx = state.momentsEditImageViewerIndex;
        $('imageViewerCounter').textContent = (idx + 1) + ' / ' + images.length;
        slider.style.transition = 'none';
        slider.style.transform = 'translateX(-' + idx * 100 + '%)';
        requestAnimationFrame(() => { slider.style.transition = ''; });
    }

    function openMomentsEditImageViewer(index) {
        state.momentsEditImageViewerIndex = index;
        renderMomentsEditImageViewer();
        $('imageViewerModal').classList.add('show');
    }

    function closeMomentsEditImageViewer() {
        $('imageViewerModal').classList.remove('show');
    }

    function deleteMomentsEditImage() {
        const idx = state.momentsEditImageViewerIndex;
        state.momentsEditImages.splice(idx, 1);
        if (state.momentsEditImages.length === 0) {
            closeMomentsEditImageViewer();
            renderMomentsEditImages();
            return;
        }
        if (idx >= state.momentsEditImages.length) {
            state.momentsEditImageViewerIndex = state.momentsEditImages.length - 1;
        }
        renderMomentsEditImageViewer();
        renderMomentsEditImages();
    }

    function renderRemindPage() {
        const list = $('remindContactList');
        if (!list) return;
        let contacts = (state.contacts || []).filter(c => !c.isGroup); // 群聊不参与提醒
        const kw = state.remindSearchKeyword;
        if (kw) {
            contacts = contacts.filter(c => (c.nickname || '').indexOf(kw) >= 0);
        }
        list.innerHTML = '';
        contacts.forEach(c => {
            const item = document.createElement('div');
            item.className = 'remind-item';
            const checked = state.remindSelectedIds.has(c.id);
            const avatarBg = c.avatar
                ? `background-image:url('${escapeHtml(c.avatar)}');`
                : 'background:linear-gradient(135deg,#afdcf1,#c7eaf9);';
            item.innerHTML = `
                <div class="remind-check${checked ? ' checked' : ''}">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                </div>
                <div class="remind-avatar" style="${avatarBg}"></div>
                <span class="remind-name">${escapeHtml(c.nickname || '未命名')}</span>
            `;
            item.addEventListener('click', () => toggleRemindSelect(c.id));
            list.appendChild(item);
        });
        renderRemindSelectedList();
        updateRemindConfirmBtn();
    }

    function renderRemindSelectedList() {
        const container = $('remindSelectedList');
        if (!container) return;
        container.innerHTML = '';
        state.remindSelectedIds.forEach(id => {
            const c = (state.contacts || []).find(x => x.id === id);
            if (!c) return;
            const div = document.createElement('div');
            div.className = 'remind-selected-avatar';
            div.style.cssText = c.avatar
                ? `background-image:url('${escapeHtml(c.avatar)}');`
                : 'background:linear-gradient(135deg,#afdcf1,#c7eaf9);';
            container.appendChild(div);
        });
    }

    function updateRemindConfirmBtn() {
        const btn = $('remindConfirmBtn');
        if (!btn) return;
        const count = state.remindSelectedIds.size;
        if (count > 0) {
            btn.textContent = '确定(' + count + '/5)';
        } else {
            btn.textContent = '确定';
        }
    }

    function toggleRemindSelect(contactId) {
        if (state.remindSelectedIds.has(contactId)) {
            state.remindSelectedIds.delete(contactId);
        } else {
            if (state.remindSelectedIds.size >= 5) {
                showSimpleToast('最多选择5位梦角');
                return;
            }
            state.remindSelectedIds.add(contactId);
        }
        renderRemindPage();
    }

    function openRemindPage() {
        switchPage('remindPage');
        renderRemindPage();
    }

    function confirmRemindSelect() {
        const ids = Array.from(state.remindSelectedIds);
        const remindOption = $('momentsEditRemindBtn');
        if (!remindOption) return;
        if (ids.length > 0) {
            const names = ids.map(id => {
                const c = (state.contacts || []).find(x => x.id === id);
                return c ? (c.nickname || '未命名') : '';
            }).filter(n => n);
            remindOption.querySelector('.um-edit-option-label').textContent = '提到了' + names.join('、');
            remindOption.classList.add('selected');
        } else {
            remindOption.querySelector('.um-edit-option-label').textContent = '提醒谁看';
            remindOption.classList.remove('selected');
        }
        switchPage('momentsEditPage');
    }

    function renderVisiblePage() {
        const list = $('visibleList');
        if (!list) return;
        const sel = state.visibleSelection;
        const options = [
            { value: 'public', label: '公开', desc: '所有朋友可见' },
            { value: 'private', label: '私密', desc: '仅自己可见' },
            { value: 'partial', label: '部分可见', desc: '' },
            { value: 'exclude', label: '不给谁看', desc: '' }
        ];
        list.innerHTML = '';
        options.forEach(opt => {
            const item = document.createElement('div');
            item.className = 'visible-item';
            const checked = sel === opt.value;
            item.innerHTML = `
                <div class="remind-check${checked ? ' checked' : ''}">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                </div>
                <div class="visible-item-info">
                    <div class="visible-label">${opt.label}</div>
                    ${opt.desc ? '<div class="visible-desc">' + opt.desc + '</div>' : ''}
                </div>
            `;
            item.addEventListener('click', () => {
                state.visibleSelection = opt.value;
                renderVisiblePage();
            });
            list.appendChild(item);
            if (opt.value === 'partial' && sel === 'partial') {
                list.appendChild(renderVisibleContactList('partial'));
            }
            if (opt.value === 'exclude' && sel === 'exclude') {
                list.appendChild(renderVisibleContactList('exclude'));
            }
        });
        updateVisibleConfirmBtn();
    }

    function renderVisibleContactList(type) {
        const container = document.createElement('div');
        container.className = 'visible-sub-list';
        const title = document.createElement('div');
        title.className = 'visible-sub-title';
        title.textContent = type === 'partial' ? '选择朋友（选中的朋友可见）' : '选择朋友（选中的朋友不可见）';
        container.appendChild(title);
        const idSet = type === 'partial' ? state.visiblePartialIds : state.visibleExcludeIds;
        (state.contacts || []).forEach(c => {
            if (c.isGroup) return; // 群聊不参与可见范围选择
            const item = document.createElement('div');
            item.className = 'visible-sub-item';
            const checked = idSet.has(c.id);
            const avatarBg = c.avatar
                ? `background-image:url('${escapeHtml(c.avatar)}');`
                : 'background:linear-gradient(135deg,#afdcf1,#c7eaf9);';
            item.innerHTML = `
                <div class="remind-check${checked ? ' checked' : ''}">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                </div>
                <div class="remind-avatar" style="${avatarBg}"></div>
                <span class="remind-name">${escapeHtml(c.nickname || '未命名')}</span>
            `;
            item.addEventListener('click', () => {
                if (idSet.has(c.id)) {
                    idSet.delete(c.id);
                } else {
                    idSet.add(c.id);
                }
                renderVisiblePage();
            });
            container.appendChild(item);
        });
        return container;
    }

    function updateVisibleConfirmBtn() {
        const btn = $('visibleConfirmBtn');
        if (!btn) return;
        const sel = state.visibleSelection;
        if (sel === 'partial' && state.visiblePartialIds.size === 0) {
            btn.classList.add('disabled');
        } else if (sel === 'exclude' && state.visibleExcludeIds.size === 0) {
            btn.classList.add('disabled');
        } else {
            btn.classList.remove('disabled');
        }
    }

    function confirmVisibleSelect() {
        const sel = state.visibleSelection;
        const visibleOption = $('momentsEditVisibleBtn');
        if (!visibleOption) return;
        const labelEl = visibleOption.querySelector('.um-edit-option-label');
        const subEl = visibleOption.querySelector('.um-edit-option-sub');
        const valueEl = visibleOption.querySelector('.um-edit-option-value');
        visibleOption.classList.remove('selected', 'selected-pink');
        if (sel === 'public') {
            labelEl.textContent = '谁可以看';
            subEl.textContent = '';
            valueEl.textContent = '公开';
        } else if (sel === 'private') {
            labelEl.textContent = '谁可以看';
            subEl.textContent = '';
            valueEl.textContent = '私密';
        } else if (sel === 'partial') {
            labelEl.textContent = '谁可以看';
            const names = Array.from(state.visiblePartialIds).map(id => {
                const c = (state.contacts || []).find(x => x.id === id);
                return c ? (c.nickname || '未命名') : '';
            }).filter(n => n);
            subEl.textContent = '梦角：' + names.join('、');
            valueEl.textContent = '';
            visibleOption.classList.add('selected');
        } else if (sel === 'exclude') {
            labelEl.textContent = '谁不可看';
            const names = Array.from(state.visibleExcludeIds).map(id => {
                const c = (state.contacts || []).find(x => x.id === id);
                return c ? (c.nickname || '未命名') : '';
            }).filter(n => n);
            subEl.textContent = '梦角：' + names.join('、');
            valueEl.textContent = '';
            visibleOption.classList.add('selected-pink');
        }
        switchPage('momentsEditPage');
    }

    // ================= 个人资料（我） =================
    function renderProfile() {
        const me = state.me;
        const header = document.querySelector('#profilePage .app-header');
        const statusHtml = me.status
            ? `<div class="me-status-text" id="meStatusText">${escapeHtml(me.status)}</div>`
            : `<button class="me-status-pill" id="meStatusAdd">+状态</button>`;
        const avatarBg = me.avatar ? `background-image:url('${escapeHtml(me.avatar)}');` : '';
        header.innerHTML = `
            <div style="display:flex;align-items:center;gap:12px;min-width:0;">
                <div class="me-avatar" id="meAvatar" style="${avatarBg}cursor:pointer;"></div>
                <div style="min-width:0;">
                    <div style="font-size:15px;font-weight:500;color:var(--text);word-break:break-all;line-height:1.2;">${escapeHtml(me.nickname || '我')}</div>
                    <div style="margin-top:6px;">${statusHtml}</div>
                </div>
            </div>
        `;
        $('profileContent').innerHTML = `
            <div class="me-list">
                <div class="me-list-item" data-me-entry="mailbox">
                    <div class="me-list-item-left">
                        <div class="me-list-item-icon">✉️</div>
                        <span class="me-list-item-title">信箱</span>
                    </div>
                    <span class="me-list-item-arrow">›</span>
                </div>
                <div class="me-list-item" data-me-entry="survey">
                    <div class="me-list-item-left">
                        <div class="me-list-item-icon"><svg viewBox="0 0 24 24" style="width:18px;height:18px;" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></svg></div>
                        <span class="me-list-item-title">问卷</span>
                    </div>
                    <span class="me-list-item-arrow">›</span>
                </div>
                <div class="me-list-item" data-me-entry="favorites">
                    <div class="me-list-item-left">
                        <div class="me-list-item-icon"><svg viewBox="0 0 24 24" style="width:18px;height:18px;" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg></div>
                        <span class="me-list-item-title">收藏</span>
                    </div>
                    <span class="me-list-item-arrow">›</span>
                </div>
            </div>
        `;
        $('profileContent').querySelectorAll('.me-list-item').forEach(el => {
            const entry = el.dataset.meEntry;
            el.addEventListener('click', () => {
                if (entry === 'mailbox') openMailboxPage();
                else if (entry === 'survey') openSurveyPage();
                else if (entry === 'favorites') openFavoritesPage();
                else showSimpleToast('功能开发中');
            });
        });
        const avatarEl = $('meAvatar');
        if (avatarEl) {
            avatarEl.addEventListener('click', openMeProfileModal);
        }
        const addBtn = $('meStatusAdd');
        if (addBtn) {
            addBtn.addEventListener('click', e => {
                e.stopPropagation();
                openStatusEditor();
            });
        }
        const statusText = $('meStatusText');
        if (statusText) {
            statusText.addEventListener('click', e => {
                e.stopPropagation();
                openStatusEditor();
            });
        }
    }
    function openStatusEditor() {
        const me = state.me;
        const wrapper = document.createElement('div');
        wrapper.style.marginTop = '8px';
        wrapper.innerHTML = `<input type="text" class="me-status-input" id="meStatusInput" value="${escapeHtml(me.status || '')}" placeholder="输入状态">`;
        const addBtn = $('meStatusAdd');
        const statusText = $('meStatusText');
        const anchor = addBtn || statusText;
        if (!anchor) return;
        anchor.replaceWith(wrapper);
        const input = $('meStatusInput');
        input.focus();
        const commit = () => {
            const v = input.value.trim();
            me.status = v;
            saveData();
            renderProfile();
        };
        input.addEventListener('blur', commit);
        input.addEventListener('keydown', e => {
            if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
        });
        document.addEventListener('click', function onClickDoc(ev) {
            if (ev.target === input) return;
            document.removeEventListener('click', onClickDoc);
            input.blur();
        });
    }
    function openMeProfileModal() {
        const me = state.me;
        state.tempMeAvatar = null;
        $('meNickname').value = me.nickname || '';
        $('meSignature').value = me.signature || '';
        const pv = $('meAvatarPreview');
        pv.style.backgroundImage = `url("${me.avatar || ''}")`;
        pv.style.backgroundSize = 'cover';
        pv.style.backgroundPosition = 'center';
        pv.textContent = '';
        $('meAvatarInput').value = '';
        openModal('meProfileModal');
    }
    function saveMeProfile() {
        const nn = $('meNickname').value.trim();
        if (!nn) { showSimpleToast('昵称不能为空', 'error'); return; }
        state.me.nickname = nn;
        state.me.signature = $('meSignature').value.trim();
        if (state.tempMeAvatar) state.me.avatar = state.tempMeAvatar;
        saveData();
        renderProfile();
        closeModal('meProfileModal');
        showSimpleToast('个人资料已保存');
    }

    // ================= 收藏页 =================
    function openFavoritesPage() {
        switchPage('favoritesPage');
        renderFavoritesPage();
    }
    function closeFavoritesPage() {
        switchPage('profilePage');
    }
    // ================= 信箱页 =================
    function openMailboxPage() {
        switchPage('mailboxPage');
        renderMailboxPage();
    }
    function closeMailboxPage() {
        switchPage('profilePage');
    }
    function renderMailboxPage() {
        const body = $('mailboxContent');
        if (!body) return;
        body.innerHTML = `
            <div class="mailbox-grid">
                <div class="mailbox-card mailbox-card--sent" data-mailbox-entry="sent">
                    <div class="mailbox-card-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
                    </div>
                    <div class="mailbox-card-label">寄出的信</div>
                </div>
                <div class="mailbox-card mailbox-card--received" data-mailbox-entry="received">
                    <div class="mailbox-card-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>
                    </div>
                    <div class="mailbox-card-label">收到的回信</div>
                </div>
                <div class="mailbox-card mailbox-card--his" data-mailbox-entry="his">
                    <div class="mailbox-card-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                    </div>
                    <div class="mailbox-card-label">他的来信</div>
                </div>
                <div class="mailbox-card mailbox-card--mine" data-mailbox-entry="mine">
                    <div class="mailbox-card-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/></svg>
                    </div>
                    <div class="mailbox-card-label">我的回信</div>
                </div>
            </div>
        `;
        body.querySelectorAll('.mailbox-card').forEach(el => {
            const entry = el.dataset.mailboxEntry;
            el.addEventListener('click', () => {
                if (entry === 'sent') openMailboxSentPage();
                else if (entry === 'received') openMailboxReceivedPage();
                else if (entry === 'his') openMailboxHisPage();
                else if (entry === 'mine') openMailboxMinePage();
            });
        });
        // 他的来信未读标识
        const unreadCount = (state.hisLetters || []).filter(l => !l.read).length;
        if (unreadCount > 0) {
            const hisCard = body.querySelector('[data-mailbox-entry="his"]');
            if (hisCard) {
                const badge = document.createElement('div');
                badge.className = 'mailbox-unread-badge';
                badge.textContent = unreadCount > 99 ? '99+' : String(unreadCount);
                hisCard.appendChild(badge);
            }
        }
        // 收到的回信未读标识
        const unreadReceivedCount = (state.receivedLetters || []).filter(l => !l.read).length;
        if (unreadReceivedCount > 0) {
            const receivedCard = body.querySelector('[data-mailbox-entry="received"]');
            if (receivedCard) {
                const badge = document.createElement('div');
                badge.className = 'mailbox-unread-badge';
                badge.textContent = unreadReceivedCount > 99 ? '99+' : String(unreadReceivedCount);
                receivedCard.appendChild(badge);
            }
        }
    }
    // ================= 寄出的信页 =================
    function openMailboxSentPage() {
        switchPage('mailboxSentPage');
        renderMailboxSentPage();
    }
    function closeMailboxSentPage() {
        switchPage('mailboxPage');
    }
    // ================= 收到的回信页 =================
    function openMailboxReceivedPage() {
        switchPage('mailboxReceivedPage');
        renderMailboxReceivedPage();
    }
    function closeMailboxReceivedPage() {
        switchPage('mailboxPage');
        renderMailboxPage();
    }
    function renderMailboxReceivedPage() {
        const body = $('mailboxReceivedContent');
        if (!body) return;
        checkDueLetterReplies();
        const letters = state.receivedLetters || [];
        let listHtml = '';
        if (letters.length === 0) {
            listHtml = '<div class="survey-empty">还没有收到回信</div>';
        } else {
            listHtml = letters.map(l => {
                const preview = (l.content || '').slice(0, 40);
                const ellipsis = (l.content || '').length > 40 ? '...' : '';
                return `
                        <div class="sent-letter-card received-letter-card" data-received-id="${escapeHtml(l.id)}">
                            <div class="sent-letter-header received-letter-header">
                                <div class="sent-letter-header-left">
                                    <svg class="sent-letter-send-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>
                                    <span class="sent-letter-send-text">收到</span>
                                    <span class="sent-letter-time">· ${formatLetterTime(l.sentAt)}</span>
                                </div>
                                <button class="sent-letter-edit-btn received-letter-edit-btn" type="button" data-received-edit="${escapeHtml(l.id)}" title="编辑">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                                </button>
                            </div>
                            <div class="sent-letter-body">
                                <div class="sent-letter-preview">${escapeHtml(preview)}${ellipsis}</div>
                            </div>
                        </div>
                    `;
            }).join('');
        }
        body.innerHTML = listHtml;
        // 卡片点击 (浏览模式)
        body.querySelectorAll('[data-received-id]').forEach(card => {
            card.addEventListener('click', () => openLetterReceivedDetail(card.dataset.receivedId, false));
        });
        // 房子(编辑)按钮
        body.querySelectorAll('[data-received-edit]').forEach(btn => {
            btn.addEventListener('click', (e) => { e.stopPropagation(); openLetterReceivedDetail(btn.dataset.receivedEdit, true); });
        });
    }
    // ================= 他的来信页 =================
    function openMailboxHisPage() {
        switchPage('mailboxHisPage');
        renderMailboxHisPage();
    }
    function closeMailboxHisPage() {
        switchPage('mailboxPage');
        renderMailboxPage();
    }
    function renderMailboxHisPage() {
        const body = $('mailboxHisContent');
        if (!body) return;
        checkDailyHisLetters();
        const letters = state.hisLetters || [];
        let listHtml = '';
        if (letters.length === 0) {
            listHtml = '<div class="survey-empty">还没有来信</div>';
        } else {
            listHtml = letters.map(l => {
                const preview = (l.content || '').slice(0, 40);
                const ellipsis = (l.content || '').length > 40 ? '...' : '';
                const read = !!l.read;
                const statusText = read ? '已读来信' : '收到来信';
                const statusIcon = read
                    ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'
                    : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>';
                return `
                        <div class="sent-letter-card his-letter-card" data-his-id="${escapeHtml(l.id)}">
                            <div class="sent-letter-header his-letter-header">
                                <div class="sent-letter-header-left">
                                    <svg class="sent-letter-send-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                                    <span class="sent-letter-send-text">来信</span>
                                    <span class="sent-letter-time">· ${formatLetterTime(l.sentAt)}</span>
                                </div>
                                <button class="sent-letter-edit-btn his-letter-edit-btn" type="button" data-his-edit="${escapeHtml(l.id)}" title="编辑">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                                </button>
                            </div>
                            <div class="sent-letter-body">
                                <div class="sent-letter-preview">${escapeHtml(preview)}${ellipsis}</div>
                                <div class="sent-letter-status-row">
                                    <div class="sent-letter-status ${read ? 'is-replied' : 'is-pending'}">
                                        ${statusIcon}
                                        <span>${statusText}</span>
                                    </div>
                                    <button class="sent-letter-close-btn" type="button" data-his-del="${escapeHtml(l.id)}" title="删除">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
                                    </button>
                                </div>
                            </div>
                        </div>
                    `;
            }).join('');
        }
        body.innerHTML = listHtml;
        // 卡片点击 (浏览模式, 不显示编辑按钮)
        body.querySelectorAll('[data-his-id]').forEach(card => {
            card.addEventListener('click', () => openLetterHisDetail(card.dataset.hisId, false));
        });
        // 删除按钮
        body.querySelectorAll('[data-his-del]').forEach(btn => {
            btn.addEventListener('click', (e) => { e.stopPropagation(); openLetterHisDelModal(btn.dataset.hisDel); });
        });
        // 编辑(铅笔)按钮 (浏览模式, 显示编辑按钮)
        body.querySelectorAll('[data-his-edit]').forEach(btn => {
            btn.addEventListener('click', (e) => { e.stopPropagation(); openLetterHisDetail(btn.dataset.hisEdit, true); });
        });
    }
    // ================= 我的回信页 =================
    function openMailboxMinePage() {
        switchPage('mailboxMinePage');
        renderMailboxMinePage();
    }
    function closeMailboxMinePage() {
        switchPage('mailboxPage');
        renderMailboxPage();
    }
    function renderMailboxMinePage() {
        const body = $('mailboxMineContent');
        if (!body) return;
        const letters = state.myReplyLetters || [];
        let listHtml = '';
        if (letters.length === 0) {
            listHtml = '<div class="survey-empty">还没有回信</div>';
        } else {
            listHtml = letters.map(l => {
                const preview = (l.content || '').slice(0, 40);
                const ellipsis = (l.content || '').length > 40 ? '...' : '';
                return `
                        <div class="sent-letter-card mine-letter-card" data-mine-id="${escapeHtml(l.id)}">
                            <div class="sent-letter-header mine-letter-header">
                                <div class="sent-letter-header-left">
                                    <svg class="sent-letter-send-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
                                    <span class="sent-letter-send-text">回信</span>
                                    <span class="sent-letter-time">· ${formatLetterTime(l.sentAt)}</span>
                                </div>
                                <button class="sent-letter-edit-btn mine-letter-edit-btn" type="button" data-mine-edit="${escapeHtml(l.id)}" title="编辑">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                                </button>
                            </div>
                            <div class="sent-letter-body">
                                <div class="sent-letter-preview">${escapeHtml(preview)}${ellipsis}</div>
                                <div class="sent-letter-status-row">
                                    <div></div>
                                    <button class="sent-letter-close-btn" type="button" data-mine-del="${escapeHtml(l.id)}" title="删除">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
                                    </button>
                                </div>
                            </div>
                        </div>
                    `;
            }).join('');
        }
        body.innerHTML = listHtml;
        // 卡片点击 (浏览模式, 隐藏编辑按钮)
        body.querySelectorAll('[data-mine-id]').forEach(card => {
            card.addEventListener('click', () => openLetterMineDetail(card.dataset.mineId, false));
        });
        // 删除按钮
        body.querySelectorAll('[data-mine-del]').forEach(btn => {
            btn.addEventListener('click', (e) => { e.stopPropagation(); openLetterMineDelModal(btn.dataset.mineDel); });
        });
        // 编辑(铅笔)按钮 (浏览模式, 显示编辑按钮)
        body.querySelectorAll('[data-mine-edit]').forEach(btn => {
            btn.addEventListener('click', (e) => { e.stopPropagation(); openLetterMineDetail(btn.dataset.mineEdit, true); });
        });
        // 底部栏: 回信按钮 (样式参考写信按钮)
        const bar = $('mailboxMineBar');
        if (bar) {
            bar.innerHTML = `
                <button class="btn btn-primary" data-action="reply-letter">
                    <svg viewBox="0 0 24 24" style="width:18px;height:18px;" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                    回信
                </button>
            `;
            const btn = bar.querySelector('[data-action="reply-letter"]');
            if (btn) btn.addEventListener('click', openMailboxReplySelectModal);
        }
    }
    function renderMailboxSentPage() {
        const body = $('mailboxSentContent');
        if (body) {
            const letters = state.letters || [];
            let listHtml = '';
            if (letters.length === 0) {
                listHtml = '<div class="survey-empty">还没有寄出的信</div>';
            } else {
                listHtml = letters.map(l => {
                    const preview = (l.content || '').slice(0, 40);
                    const ellipsis = (l.content || '').length > 40 ? '...' : '';
                    const replied = !!l.replied;
                    const statusText = replied ? '已收到回信' : '未收到回信';
                    const statusIcon = replied
                        ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'
                        : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>';
                    return `
                        <div class="sent-letter-card" data-letter-id="${escapeHtml(l.id)}">
                            <div class="sent-letter-header">
                                <div class="sent-letter-header-left">
                                    <svg class="sent-letter-send-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
                                    <span class="sent-letter-send-text">寄出</span>
                                    <span class="sent-letter-time">· ${formatLetterTime(l.sentAt)}</span>
                                </div>
                                <button class="sent-letter-edit-btn" type="button" data-letter-edit="${escapeHtml(l.id)}" title="编辑">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                                </button>
                            </div>
                            <div class="sent-letter-body">
                                <div class="sent-letter-preview">${escapeHtml(preview)}${ellipsis}</div>
                                <div class="sent-letter-status-row">
                                    <div class="sent-letter-status ${replied ? 'is-replied' : 'is-pending'}">
                                        ${statusIcon}
                                        <span>${statusText}</span>
                                    </div>
                                    <button class="sent-letter-close-btn" type="button" data-letter-del="${escapeHtml(l.id)}" title="删除">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
                                    </button>
                                </div>
                            </div>
                        </div>
                    `;
                }).join('');
            }
            body.innerHTML = listHtml;
            // 绑定卡片点击事件 (浏览模式, 隐藏编辑按钮)
            body.querySelectorAll('.sent-letter-card').forEach(card => {
                card.addEventListener('click', () => openLetterDetail(card.dataset.letterId, false));
            });
            // 绑定删除按钮事件
            body.querySelectorAll('[data-letter-del]').forEach(btn => {
                btn.addEventListener('click', (e) => { e.stopPropagation(); openLetterDelModal(btn.dataset.letterDel); });
            });
            // 绑定编辑(铅笔)按钮事件
            body.querySelectorAll('[data-letter-edit]').forEach(btn => {
                btn.addEventListener('click', (e) => { e.stopPropagation(); openLetterDetail(btn.dataset.letterEdit, true); });
            });
        }
        const bar = $('mailboxSentBar');
        if (bar) {
            bar.innerHTML = `
                <button class="btn btn-primary" data-action="write-letter">
                    <svg viewBox="0 0 24 24" style="width:18px;height:18px;" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                    写信
                </button>
            `;
            const btn = bar.querySelector('[data-action="write-letter"]');
            if (btn) btn.addEventListener('click', openMailboxRecipientModal);
        }
    }
    // ================= 信件删除 =================
    let pendingDelLetterId = null;
    function openLetterDelModal(letterId) {
        pendingDelLetterId = letterId;
        openModal('letterDelModal');
    }
    function confirmDeleteLetter() {
        const letterId = pendingDelLetterId;
        pendingDelLetterId = null;
        if (!letterId) return;
        const idx = state.letters.findIndex(l => l.id === letterId);
        if (idx !== -1) {
            state.letters.splice(idx, 1);
            saveData();
        }
        closeModal('letterDelModal');
        renderMailboxSentPage();
    }
    // ================= 信件详情 =================
    let currentViewLetterId = null;
    function openLetterDetail(letterId, editable = true) {
        const letter = state.letters.find(l => l.id === letterId);
        if (!letter) return;
        currentViewLetterId = letterId;
        const editBtn = $('letterDetailEditBtn');
        if (editBtn) editBtn.style.display = editable ? '' : 'none';
        const d = new Date(letter.sentAt);
        const y = d.getFullYear();
        const M = String(d.getMonth() + 1).padStart(2, '0');
        const D = String(d.getDate()).padStart(2, '0');
        const weekday = ['周日','周一','周二','周三','周四','周五','周六'][d.getDay()];
        const dateEl = $('letterDetailDate');
        if (dateEl) dateEl.textContent = `${y}/${M}/${D} ${weekday}`;
        const stampEl = $('letterDetailStampDate');
        if (stampEl) stampEl.textContent = `${M}/${D}`;
        // 信件正文 (保留换行)
        const contentEl = $('letterDetailContent');
        if (contentEl) {
            contentEl.textContent = letter.content || '';
        }
        const recipientEl = $('letterDetailRecipient');
        if (recipientEl) {
            recipientEl.textContent = letter.recipient ? `致${letter.recipient}：` : '';
        }
        const writerEl = $('letterDetailWriter');
        if (writerEl) {
            writerEl.textContent = letter.writer ? `——${letter.writer}` : '';
        }
        const dateLetterEl = $('letterDetailDateLetter');
        if (dateLetterEl) {
            dateLetterEl.textContent = letter.letterDate || '';
        }
        // 应用信纸样式
        const paper = $('letterDetailPaper');
        if (paper) {
            paper.classList.remove('paper-lined', 'paper-grid', 'paper-blank', 'paper-love', 'tex-kraft', 'tex-parchment', 'tex-gridtex');
            const styleId = letter.style || 'lined';
            if (styleId === 'lined') paper.classList.add('paper-lined');
            else if (styleId === 'grid') paper.classList.add('paper-grid');
            else if (styleId === 'blank') paper.classList.add('paper-blank');
            else if (styleId === 'love') paper.classList.add('paper-love');
            const texId = letter.texture || 'none';
            if (texId === 'kraft') paper.classList.add('tex-kraft');
            else if (texId === 'parchment') paper.classList.add('tex-parchment');
            else if (texId === 'gridtex') paper.classList.add('tex-gridtex');
            const colorObj = MAILBOX_COLORS.find(x => x.id === letter.color) || MAILBOX_COLORS[0];
            paper.style.backgroundColor = colorObj ? colorObj.value : '#fff5f3';
        }
        openModal('letterDetailModal');
    }
    // ================= 信件编辑 =================
    function openLetterEdit(letterId) {
        const letter = state.letters.find(l => l.id === letterId);
        if (!letter) return;
        currentViewLetterId = letterId;
        const d = new Date(letter.sentAt);
        const y = d.getFullYear();
        const M = String(d.getMonth() + 1).padStart(2, '0');
        const D = String(d.getDate()).padStart(2, '0');
        const weekday = ['周日','周一','周二','周三','周四','周五','周六'][d.getDay()];
        const dateEl = $('letterEditDate');
        if (dateEl) dateEl.textContent = `${y}/${M}/${D} ${weekday}`;
        const stampEl = $('letterEditStampDate');
        if (stampEl) stampEl.textContent = `${M}/${D}`;
        $('letterEditRecipient').value = letter.recipient || '';
        $('letterEditContent').value = letter.content || '';
        $('letterEditWriter').value = letter.writer || '';
        $('letterEditDateInput').value = letter.letterDate || '';
        // 应用信纸样式 (只读展示)
        const paper = $('letterEditPaper');
        if (paper) {
            paper.classList.remove('paper-lined', 'paper-grid', 'paper-blank', 'paper-love', 'tex-kraft', 'tex-parchment', 'tex-gridtex');
            const styleId = letter.style || 'lined';
            if (styleId === 'lined') paper.classList.add('paper-lined');
            else if (styleId === 'grid') paper.classList.add('paper-grid');
            else if (styleId === 'blank') paper.classList.add('paper-blank');
            else if (styleId === 'love') paper.classList.add('paper-love');
            const texId = letter.texture || 'none';
            if (texId === 'kraft') paper.classList.add('tex-kraft');
            else if (texId === 'parchment') paper.classList.add('tex-parchment');
            else if (texId === 'gridtex') paper.classList.add('tex-gridtex');
            const colorObj = MAILBOX_COLORS.find(x => x.id === letter.color) || MAILBOX_COLORS[0];
            paper.style.backgroundColor = colorObj ? colorObj.value : '#fff5f3';
        }
        closeModal('letterDetailModal');
        openModal('letterEditModal');
    }
    function cancelLetterEdit() {
        closeModal('letterEditModal');
        if (currentViewLetterId) openLetterDetail(currentViewLetterId);
    }
    function saveLetterEdit() {
        const letter = state.letters.find(l => l.id === currentViewLetterId);
        if (!letter) return;
        let content = ($('letterEditContent').value || '').replace(/^[ \t\n\r]+|[ \t\n\r]+$/g, '');
        if (!content) { showSimpleToast('信件内容不能为空'); return; }
        content = content.split('\n').map(line => {
            if (!line) return line;
            return line.startsWith('　　') ? line : '　　' + line;
        }).join('\n');
        letter.recipient = ($('letterEditRecipient').value || '').trim();
        letter.content = content;
        letter.writer = ($('letterEditWriter').value || '').trim();
        letter.letterDate = ($('letterEditDateInput').value || '').trim();
        saveData();
        showSimpleToast('已保存');
        closeModal('letterEditModal');
        openLetterDetail(currentViewLetterId);
    }
    function closeLetterEditAll() {
        closeModal('letterEditModal');
        switchPage('mailboxSentPage');
        renderMailboxSentPage();
    }
    // ================= 梦角回信生成 =================
    function generateLetterReply(letter) {
        const c = getContact(letter.contactId);
        if (!c) return null;
        const pool = buildContentPool(c.settings || {});
        if (pool.length === 0) return null;
        const count = Math.min(pool.length, 8 + Math.floor(Math.random() * 5)); // 8~12
        const shuffled = pool.slice().sort(() => Math.random() - 0.5).slice(0, count);
        const puncts = ['。', '，', '！', '？', '；', '~'];
        const content = shuffled.map(w => w.content).reduce((acc, cur, i) => {
            if (i === 0) return cur;
            return acc + puncts[Math.floor(Math.random() * puncts.length)] + cur;
        }, '');
        const userNickname = (state.me && state.me.nickname) || '我';
        const now = new Date();
        return {
            id: 'R' + Date.now() + Math.random().toString(36).slice(2, 6),
            contactId: letter.contactId,
            contactName: c.nickname || '未命名',
            content: content,
            recipient: userNickname,
            writer: c.nickname || '未命名',
            letterDate: `${now.getFullYear()}年${String(now.getMonth() + 1).padStart(2, '0')}月${String(now.getDate()).padStart(2, '0')}日`,
            style: letter.style,
            color: letter.color,
            texture: letter.texture,
            sentAt: Date.now(),
            replied: true,
            replyToLetterId: letter.id,
            read: false
        };
    }
    function checkDueLetterReplies() {
        const letters = state.letters || [];
        const now = Date.now();
        let changed = false;
        for (const letter of letters) {
            if (letter.replied || !letter.replyDueAt || letter.replyDueAt > now) continue;
            const reply = generateLetterReply(letter);
            if (!reply) continue;
            letter.replied = true;
            state.receivedLetters.unshift(reply);
            changed = true;
        }
        if (changed) saveData();
    }
    // ================= 他的来信 每日生成 =================
    function buildHisLetterContentPool(s) {
        const pool = [];
        (s.wordcards || []).filter(w => !w.blocked).forEach(w => {
            if (w.reply && (w.reply + '').trim()) pool.push({ type: 'text', content: w.reply });
        });
        (s.emojis || []).forEach(e => {
            const c = typeof e === 'string' ? e : (e.content || '');
            if (c && (c + '').trim()) pool.push({ type: 'text', content: c });
        });
        return pool;
    }
    function generateHisLetter(contact) {
        const pool = buildHisLetterContentPool(contact.settings || {});
        if (pool.length === 0) return null;
        const count = Math.min(pool.length, 10 + Math.floor(Math.random() * 16)); // 10~25
        const shuffled = pool.slice().sort(() => Math.random() - 0.5).slice(0, count);
        const puncts = ['。', '，', '！', '？', '；', '~'];
        const content = shuffled.map(w => w.content).reduce((acc, cur, i) => {
            if (i === 0) return cur;
            return acc + puncts[Math.floor(Math.random() * puncts.length)] + cur;
        }, '');
        const userNickname = (state.me && state.me.nickname) || '我';
        const now = new Date();
        const styles = ['lined', 'grid', 'blank', 'love'];
        const colors = ['pink', 'blue', 'cream', 'white'];
        const textures = ['none', 'kraft', 'parchment', 'gridtex'];
        return {
            id: 'H' + Date.now() + Math.random().toString(36).slice(2, 6),
            contactId: contact.id,
            contactName: contact.nickname || '未命名',
            content: content,
            recipient: userNickname,
            writer: contact.nickname || '未命名',
            letterDate: `${now.getFullYear()}年${String(now.getMonth() + 1).padStart(2, '0')}月${String(now.getDate()).padStart(2, '0')}日`,
            style: styles[Math.floor(Math.random() * styles.length)],
            color: colors[Math.floor(Math.random() * colors.length)],
            texture: textures[Math.floor(Math.random() * textures.length)],
            sentAt: Date.now(),
            read: false
        };
    }
    function checkDailyHisLetters() {
        const now = new Date();
        const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        if (state.hisLetterSchedule.date !== today) {
            // 新的一天，重新生成调度
            const entries = [];
            const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
            const endOfDay = startOfDay + 24 * 60 * 60 * 1000 - 1;
            (state.contacts || []).forEach(c => {
                if (c.isGroup) return; // 群聊不参与来信调度
                if (Math.random() < 0.4) { // 40% 概率写信
                    const scheduledAt = startOfDay + Math.floor(Math.random() * (endOfDay - startOfDay));
                    entries.push({ contactId: c.id, scheduledAt: scheduledAt, delivered: false });
                }
            });
            state.hisLetterSchedule = { date: today, entries: entries };
            saveData();
        }
        // 检查已到时间的信件
        let changed = false;
        for (const entry of state.hisLetterSchedule.entries) {
            if (entry.delivered) continue;
            if (entry.scheduledAt > Date.now()) continue;
            const contact = (state.contacts || []).find(c => c.id === entry.contactId);
            if (!contact) { entry.delivered = true; continue; }
            const letter = generateHisLetter(contact);
            if (letter) {
                state.hisLetters.unshift(letter);
                entry.delivered = true;
                changed = true;
            } else {
                entry.delivered = true;
            }
        }
        if (changed) saveData();
    }
    // ================= 朋友圈互动调度 (梦角点赞/评论/回复 + 梦角发表) =================
    // 纯查找朋友圈 (不改变 state.umContactId)
    function findMomentByIdPure(momentId) {
        if (state.me && state.me.moments) {
            const m = state.me.moments.find(x => x.id === momentId);
            if (m) return m;
        }
        for (const c of (state.contacts || [])) {
            if (c.moments) {
                const m = c.moments.find(x => x.id === momentId);
                if (m) return m;
            }
        }
        return null;
    }
    // 文本 emoji 池 (排除 base64 图片表情)
    function getTextEmojiPool(s) {
        return (s.emojis || [])
            .map(e => typeof e === 'string' ? e : (e.content || ''))
            .filter(x => x && String(x).trim() && !String(x).startsWith('data:'));
    }
    // 构造梦角评论内容: 主字卡1条 + 20%附加emoji + 20%附加表情库图片
    function buildMomentCommentContent(contact) {
        const s = contact.settings || {};
        const cards = (s.wordcards || []).filter(w => !w.blocked && w.reply && String(w.reply).trim());
        let text = '';
        if (cards.length) text = cards[Math.floor(Math.random() * cards.length)].reply;
        const emojis = getTextEmojiPool(s);
        if (emojis.length && Math.random() < 0.2) {
            text += emojis[Math.floor(Math.random() * emojis.length)];
        }
        if (!text && emojis.length) {
            text = emojis[Math.floor(Math.random() * emojis.length)];
        }
        const stickers = (s.stickers || []).filter(x => !x.blocked && x.dataUrl);
        let image = '';
        if (stickers.length && Math.random() < 0.2) {
            image = stickers[Math.floor(Math.random() * stickers.length)].dataUrl;
        }
        if (!text && !image) return null;
        const nowD = new Date();
        const timeStr = `${nowD.getMonth() + 1}月${nowD.getDate()}日 ${nowD.getHours()}:${String(nowD.getMinutes()).padStart(2, '0')}`;
        const cmt = { text, contactId: contact.id, timeStr, createdAt: nowD.getTime() };
        if (image) cmt.image = image;
        return cmt;
    }
    // 互动发生后刷新相关视图
    function refreshMomentsViews() {
        if ($('momentsFeedPage') && $('momentsFeedPage').classList.contains('active')) renderMomentsFeed();
        if ($('userMomentsPage') && $('userMomentsPage').classList.contains('active')) renderMomentsList();
        if ($('momentsPage') && $('momentsPage').classList.contains('active')) renderMoments();
        if ($('momentsInteractPage') && $('momentsInteractPage').classList.contains('active')) renderMomentsInteractPage();
    }
    // 检查并执行到期的朋友圈互动调度
    function checkMomentInteractions() {
        const schedules = state.momentSchedules || [];
        const now = Date.now();
        let changed = false;
        for (const s of schedules) {
            if (s.done || !s.at || s.at > now) continue;
            s.done = true;
            changed = true;
            const contact = (state.contacts || []).find(c => c.id === s.contactId);
            if (!contact) continue;
            const m = findMomentByIdPure(s.momentId);
            if (!m) continue;
            if (s.type === 'like-comment') {
                // 点赞 (必须)
                if (!m.likedBy) m.likedBy = [];
                if (!m.likedBy.includes(contact.id)) {
                    m.likedBy.push(contact.id);
                    m.likeCount = (m.likeCount || 0) + 1;
                }
                // 记录点赞动作发生时间
                if (!m.likeRecords) m.likeRecords = [];
                m.likeRecords = m.likeRecords.filter(r => r && r.contactId !== contact.id);
                m.likeRecords.push({ contactId: contact.id, at: Date.now() });
                // 评论 1 条
                const cmt = buildMomentCommentContent(contact);
                if (cmt) {
                    if (!m.comments) m.comments = [];
                    m.comments.push(cmt);
                }
                state.momentBadge = (state.momentBadge || 0) + 1;
            } else if (s.type === 'reply') {
                // 回复用户评论
                const cmt = buildMomentCommentContent(contact);
                if (cmt) {
                    cmt.replyToContactId = 'me';
                    if (!m.comments) m.comments = [];
                    m.comments.push(cmt);
                    state.momentBadge = (state.momentBadge || 0) + 1;
                }
            }
        }
        if (changed) {
            // 清理已执行的调度项, 避免无限堆积
            state.momentSchedules = schedules.filter(s => !s.done);
            saveData();
            refreshMomentsViews();
        }
    }
    // 生成梦角朋友圈内容: 主字卡1~5条拼接; 50%纯文字(30%带emoji) / 50%文字+图片(1~3张)
    function generateContactMoment(contact) {
        const s = contact.settings || {};
        const cards = (s.wordcards || []).filter(w => !w.blocked && w.reply && String(w.reply).trim());
        if (!cards.length) return null;
        const count = Math.min(cards.length, 1 + Math.floor(Math.random() * 5));
        const shuffled = cards.slice().sort(() => Math.random() - 0.5).slice(0, count);
        const puncts = ['。', '，', '！', '？', '；', '~'];
        let text = shuffled.map(w => w.reply).reduce((acc, cur, i) => {
            if (i === 0) return cur;
            return acc + puncts[Math.floor(Math.random() * puncts.length)] + cur;
        }, '');
        let images = [];
        const appendEmojiIfHit = prob => {
            const emojis = getTextEmojiPool(s);
            if (emojis.length && Math.random() < prob) {
                text += emojis[Math.floor(Math.random() * emojis.length)];
            }
        };
        if (Math.random() < 0.5) {
            // 纯文字: 30% 携带 emoji
            appendEmojiIfHit(0.3);
        } else {
            // 文字 + 图片: 图片库随机 1~3 张, 为空回退纯文字
            const imgs = (s.momentImages || []).filter(x => !x.blocked && x.dataUrl);
            if (imgs.length) {
                const n = Math.min(imgs.length, 1 + Math.floor(Math.random() * 3));
                images = imgs.slice().sort(() => Math.random() - 0.5).slice(0, n).map(x => x.dataUrl);
            } else {
                appendEmojiIfHit(0.3);
            }
        }
        return {
            id: 'm' + Date.now() + Math.random().toString(36).slice(2, 6),
            text: text,
            images: images,
            timestamp: Date.now(),
            visible: 'public',
            remindIds: [],
            partialIds: [],
            excludeIds: [],
            contactId: contact.id
        };
    }
    // 检查梦角朋友圈发表调度 (每梦角独立 0~48 小时随机时间点, 到点 50% 发表一条)
    function checkContactMoments() {
        const now = Date.now();
        let changed = false;
        (state.contacts || []).forEach(c => {
            if (c.isGroup) return; // 群聊不发表朋友圈
            if (!c.nextMomentAt) {
                c.nextMomentAt = now + Math.floor(Math.random() * 48 * 3600 * 1000);
                changed = true;
                return;
            }
            if (c.nextMomentAt > now) return;
            if (Math.random() < 0.5) {
                const m = generateContactMoment(c);
                if (m) {
                    if (!c.moments) c.moments = [];
                    c.moments.unshift(m);
                    state.momentBadge = (state.momentBadge || 0) + 1;
                }
            }
            c.nextMomentAt = now + Math.floor(Math.random() * 48 * 3600 * 1000);
            changed = true;
        });
        if (changed) {
            saveData();
            refreshMomentsViews();
        }
    }
    // ================= 收到的回信 弹窗 =================
    let currentViewReceivedId = null;
    function openLetterReceivedDetail(letterId, editable) {
        const letter = state.receivedLetters.find(l => l.id === letterId);
        if (!letter) return;
        currentViewReceivedId = letterId;
        // 标记为已读
        if (!letter.read) {
            letter.read = true;
            saveData();
        }
        const d = new Date(letter.sentAt);
        const y = d.getFullYear();
        const M = String(d.getMonth() + 1).padStart(2, '0');
        const D = String(d.getDate()).padStart(2, '0');
        const weekday = ['周日','周一','周二','周三','周四','周五','周六'][d.getDay()];
        const dateEl = $('letterReceivedDate');
        if (dateEl) dateEl.textContent = `${y}/${M}/${D} ${weekday}`;
        const stampEl = $('letterReceivedStampDate');
        if (stampEl) stampEl.textContent = `${M}/${D}`;
        // 编辑按钮显隐 (卡片点击=仅浏览, 房子图标=可编辑)
        const editBtn = $('letterReceivedDetailEditBtn');
        if (editBtn) editBtn.style.display = editable ? '' : 'none';
        // 你的原信
        const origLetter = state.letters.find(l => l.id === letter.replyToLetterId);
        const origEl = $('letterReceivedOriginal');
        const origBlock = $('letterReceivedOriginalBlock');
        const toggleEl = $('letterReceivedOriginalToggle');
        if (origLetter && origEl) {
            origBlock.style.display = '';
            const origText = `致${origLetter.recipient || ''}：\n${origLetter.content || ''}`;
            origEl.textContent = origText;
            origEl.dataset.full = origText;
            origEl.classList.remove('expanded');
            if (origText.length > 60) {
                origEl.textContent = origText.slice(0, 60) + '...';
                toggleEl.style.display = '';
                toggleEl.textContent = '展开查看全文';
            } else {
                toggleEl.style.display = 'none';
            }
        } else if (origBlock) {
            origBlock.style.display = 'none';
        }
        const recipientEl = $('letterReceivedRecipient');
        if (recipientEl) recipientEl.textContent = letter.recipient ? `致${letter.recipient}：` : '';
        const contentEl = $('letterReceivedContent');
        if (contentEl) contentEl.textContent = letter.content || '';
        const writerEl = $('letterReceivedWriter');
        if (writerEl) writerEl.textContent = letter.writer ? `——${letter.writer}` : '';
        const dateLetterEl = $('letterReceivedDateLetter');
        if (dateLetterEl) dateLetterEl.textContent = letter.letterDate || '';
        const paper = $('letterReceivedPaper');
        applyLetterPaperStyleTo(paper, letter);
        openModal('letterReceivedDetailModal');
    }
    function openLetterReceivedEdit() {
        const letter = state.receivedLetters.find(l => l.id === currentViewReceivedId);
        if (!letter) return;
        const d = new Date(letter.sentAt);
        const M = String(d.getMonth() + 1).padStart(2, '0');
        const D = String(d.getDate()).padStart(2, '0');
        const weekday = ['周日','周一','周二','周三','周四','周五','周六'][d.getDay()];
        const dateEl = $('letterReceivedEditDate');
        if (dateEl) dateEl.textContent = `${d.getFullYear()}/${M}/${D} ${weekday}`;
        const stampEl = $('letterReceivedEditStampDate');
        if (stampEl) stampEl.textContent = `${M}/${D}`;
        $('letterReceivedEditRecipient').value = letter.recipient || '';
        $('letterReceivedEditContent').value = letter.content || '';
        $('letterReceivedEditWriter').value = letter.writer || '';
        $('letterReceivedEditDateInput').value = letter.letterDate || '';
        const paper = $('letterReceivedEditPaper');
        applyLetterPaperStyleTo(paper, letter);
        closeModal('letterReceivedDetailModal');
        openModal('letterReceivedEditModal');
    }
    function applyLetterPaperStyleTo(paper, letter) {
        if (!paper) return;
        paper.classList.remove('paper-lined', 'paper-grid', 'paper-blank', 'paper-love', 'tex-kraft', 'tex-parchment', 'tex-gridtex');
        const styleId = letter.style || 'lined';
        if (styleId === 'lined') paper.classList.add('paper-lined');
        else if (styleId === 'grid') paper.classList.add('paper-grid');
        else if (styleId === 'blank') paper.classList.add('paper-blank');
        else if (styleId === 'love') paper.classList.add('paper-love');
        const texId = letter.texture || 'none';
        if (texId === 'kraft') paper.classList.add('tex-kraft');
        else if (texId === 'parchment') paper.classList.add('tex-parchment');
        else if (texId === 'gridtex') paper.classList.add('tex-gridtex');
        const colorObj = MAILBOX_COLORS.find(x => x.id === letter.color) || MAILBOX_COLORS[0];
        paper.style.backgroundColor = colorObj ? colorObj.value : '#fff5f3';
    }
    function cancelLetterReceivedEdit() {
        closeModal('letterReceivedEditModal');
        if (currentViewReceivedId) openLetterReceivedDetail(currentViewReceivedId, true);
    }
    function saveLetterReceivedEdit() {
        const letter = state.receivedLetters.find(l => l.id === currentViewReceivedId);
        if (!letter) return;
        let content = ($('letterReceivedEditContent').value || '').replace(/^[ \t\n\r]+|[ \t\n\r]+$/g, '');
        if (!content) { showSimpleToast('信件内容不能为空'); return; }
        content = content.split('\n').map(line => {
            if (!line) return line;
            return line.startsWith('　　') ? line : '　　' + line;
        }).join('\n');
        letter.recipient = ($('letterReceivedEditRecipient').value || '').trim();
        letter.content = content;
        letter.writer = ($('letterReceivedEditWriter').value || '').trim();
        letter.letterDate = ($('letterReceivedEditDateInput').value || '').trim();
        saveData();
        showSimpleToast('已保存');
        closeModal('letterReceivedEditModal');
        openLetterReceivedDetail(currentViewReceivedId, true);
    }
    function closeLetterReceivedEditAll() {
        closeModal('letterReceivedEditModal');
        switchPage('mailboxReceivedPage');
        renderMailboxReceivedPage();
    }
    // ================= 他的来信 弹窗 =================
    let currentViewHisId = null;
    let pendingDelHisId = null;
    function openLetterHisDetail(letterId, editable) {
        const letter = state.hisLetters.find(l => l.id === letterId);
        if (!letter) return;
        currentViewHisId = letterId;
        // 标记为已读
        if (!letter.read) {
            letter.read = true;
            saveData();
        }
        const d = new Date(letter.sentAt);
        const y = d.getFullYear();
        const M = String(d.getMonth() + 1).padStart(2, '0');
        const D = String(d.getDate()).padStart(2, '0');
        const weekday = ['周日','周一','周二','周三','周四','周五','周六'][d.getDay()];
        const dateEl = $('letterHisDate');
        if (dateEl) dateEl.textContent = `${y}/${M}/${D} ${weekday}`;
        const stampEl = $('letterHisStampDate');
        if (stampEl) stampEl.textContent = `${M}/${D}`;
        const editBtn = $('letterHisDetailEditBtn');
        if (editBtn) editBtn.style.display = editable ? '' : 'none';
        const recipientEl = $('letterHisRecipient');
        if (recipientEl) recipientEl.textContent = letter.recipient ? `致${letter.recipient}：` : '';
        const contentEl = $('letterHisContent');
        if (contentEl) contentEl.textContent = letter.content || '';
        const writerEl = $('letterHisWriter');
        if (writerEl) writerEl.textContent = letter.writer ? `——${letter.writer}` : '';
        const dateLetterEl = $('letterHisDateLetter');
        if (dateLetterEl) dateLetterEl.textContent = letter.letterDate || '';
        const paper = $('letterHisPaper');
        applyLetterHisPaperStyle(paper, letter);
        openModal('letterHisDetailModal');
    }
    function openLetterHisEdit() {
        const letter = state.hisLetters.find(l => l.id === currentViewHisId);
        if (!letter) return;
        const d = new Date(letter.sentAt);
        const M = String(d.getMonth() + 1).padStart(2, '0');
        const D = String(d.getDate()).padStart(2, '0');
        const weekday = ['周日','周一','周二','周三','周四','周五','周六'][d.getDay()];
        const dateEl = $('letterHisEditDate');
        if (dateEl) dateEl.textContent = `${d.getFullYear()}/${M}/${D} ${weekday}`;
        const stampEl = $('letterHisEditStampDate');
        if (stampEl) stampEl.textContent = `${M}/${D}`;
        $('letterHisEditRecipient').value = letter.recipient || '';
        $('letterHisEditContent').value = letter.content || '';
        $('letterHisEditWriter').value = letter.writer || '';
        $('letterHisEditDateInput').value = letter.letterDate || '';
        const paper = $('letterHisEditPaper');
        applyLetterHisPaperStyle(paper, letter);
        closeModal('letterHisDetailModal');
        openModal('letterHisEditModal');
    }
    function applyLetterHisPaperStyle(paper, letter) {
        if (!paper) return;
        paper.classList.remove('paper-lined', 'paper-grid', 'paper-blank', 'paper-love', 'tex-kraft', 'tex-parchment', 'tex-gridtex');
        const styleId = letter.style || 'lined';
        if (styleId === 'lined') paper.classList.add('paper-lined');
        else if (styleId === 'grid') paper.classList.add('paper-grid');
        else if (styleId === 'blank') paper.classList.add('paper-blank');
        else if (styleId === 'love') paper.classList.add('paper-love');
        const texId = letter.texture || 'none';
        if (texId === 'kraft') paper.classList.add('tex-kraft');
        else if (texId === 'parchment') paper.classList.add('tex-parchment');
        else if (texId === 'gridtex') paper.classList.add('tex-gridtex');
        const colorObj = MAILBOX_COLORS.find(x => x.id === letter.color) || MAILBOX_COLORS[0];
        paper.style.backgroundColor = colorObj ? colorObj.value : '#fff8e8';
    }
    function cancelLetterHisEdit() {
        closeModal('letterHisEditModal');
        if (currentViewHisId) openLetterHisDetail(currentViewHisId, true);
    }
    function saveLetterHisEdit() {
        const letter = state.hisLetters.find(l => l.id === currentViewHisId);
        if (!letter) return;
        let content = ($('letterHisEditContent').value || '').replace(/^[ \t\n\r]+|[ \t\n\r]+$/g, '');
        if (!content) { showSimpleToast('信件内容不能为空'); return; }
        content = content.split('\n').map(line => {
            if (!line) return line;
            return line.startsWith('　　') ? line : '　　' + line;
        }).join('\n');
        letter.recipient = ($('letterHisEditRecipient').value || '').trim();
        letter.content = content;
        letter.writer = ($('letterHisEditWriter').value || '').trim();
        letter.letterDate = ($('letterHisEditDateInput').value || '').trim();
        saveData();
        showSimpleToast('已保存');
        closeModal('letterHisEditModal');
        openLetterHisDetail(currentViewHisId, true);
    }
    function closeLetterHisEditAll() {
        closeModal('letterHisEditModal');
        switchPage('mailboxHisPage');
        renderMailboxHisPage();
    }
    function openLetterHisDelModal(letterId) {
        pendingDelHisId = letterId;
        openModal('letterHisDelModal');
    }
    function confirmDeleteHisLetter() {
        const letterId = pendingDelHisId;
        pendingDelHisId = null;
        if (!letterId) return;
        const idx = state.hisLetters.findIndex(l => l.id === letterId);
        if (idx !== -1) {
            state.hisLetters.splice(idx, 1);
            saveData();
        }
        closeModal('letterHisDelModal');
        renderMailboxHisPage();
    }
    // ================= 我的回信 弹窗 =================
    let currentViewMineId = null;
    let pendingDelMineId = null;
    function openLetterMineDetail(letterId, editable) {
        const letter = state.myReplyLetters.find(l => l.id === letterId);
        if (!letter) return;
        currentViewMineId = letterId;
        const d = new Date(letter.sentAt);
        const y = d.getFullYear();
        const M = String(d.getMonth() + 1).padStart(2, '0');
        const D = String(d.getDate()).padStart(2, '0');
        const weekday = ['周日','周一','周二','周三','周四','周五','周六'][d.getDay()];
        const dateEl = $('letterMineDate');
        if (dateEl) dateEl.textContent = `${y}/${M}/${D} ${weekday}`;
        const stampEl = $('letterMineStampDate');
        if (stampEl) stampEl.textContent = `${M}/${D}`;
        const editBtn = $('letterMineDetailEditBtn');
        if (editBtn) editBtn.style.display = editable ? '' : 'none';
        // 梦角的来信
        const origLetter = state.hisLetters.find(l => l.id === letter.replyToHisLetterId);
        const origEl = $('letterMineOriginal');
        const origBlock = $('letterMineOriginalBlock');
        const toggleEl = $('letterMineOriginalToggle');
        if (origLetter && origEl) {
            origBlock.style.display = '';
            const origText = `致${origLetter.recipient || ''}：\n${origLetter.content || ''}`;
            origEl.dataset.full = origText;
            origEl.classList.remove('expanded');
            if (origText.length > 60) {
                origEl.textContent = origText.slice(0, 60) + '...';
                toggleEl.style.display = '';
                toggleEl.textContent = '展开查看全文';
            } else {
                origEl.textContent = origText;
                toggleEl.style.display = 'none';
            }
        } else if (origBlock) {
            origBlock.style.display = 'none';
        }
        const recipientEl = $('letterMineRecipient');
        if (recipientEl) recipientEl.textContent = letter.recipient ? `致${letter.recipient}：` : '';
        const contentEl = $('letterMineContent');
        if (contentEl) contentEl.textContent = letter.content || '';
        const writerEl = $('letterMineWriter');
        if (writerEl) writerEl.textContent = letter.writer ? `——${letter.writer}` : '';
        const dateLetterEl = $('letterMineDateLetter');
        if (dateLetterEl) dateLetterEl.textContent = letter.letterDate || '';
        const paper = $('letterMinePaper');
        applyLetterMinePaperStyle(paper, letter);
        openModal('letterMineDetailModal');
    }
    function openLetterMineEdit() {
        const letter = state.myReplyLetters.find(l => l.id === currentViewMineId);
        if (!letter) return;
        const d = new Date(letter.sentAt);
        const M = String(d.getMonth() + 1).padStart(2, '0');
        const D = String(d.getDate()).padStart(2, '0');
        const weekday = ['周日','周一','周二','周三','周四','周五','周六'][d.getDay()];
        const dateEl = $('letterMineEditDate');
        if (dateEl) dateEl.textContent = `${d.getFullYear()}/${M}/${D} ${weekday}`;
        const stampEl = $('letterMineEditStampDate');
        if (stampEl) stampEl.textContent = `${M}/${D}`;
        // 梦角的来信
        const origLetter = state.hisLetters.find(l => l.id === letter.replyToHisLetterId);
        const origEl = $('letterMineEditOriginal');
        const origBlock = $('letterMineEditOriginalBlock');
        const toggleEl = $('letterMineEditOriginalToggle');
        if (origLetter && origEl) {
            origBlock.style.display = '';
            const origText = `致${origLetter.recipient || ''}：\n${origLetter.content || ''}`;
            origEl.dataset.full = origText;
            origEl.classList.remove('expanded');
            if (origText.length > 60) {
                origEl.textContent = origText.slice(0, 60) + '...';
                toggleEl.style.display = '';
                toggleEl.textContent = '展开查看全文';
            } else {
                origEl.textContent = origText;
                toggleEl.style.display = 'none';
            }
        } else if (origBlock) {
            origBlock.style.display = 'none';
        }
        $('letterMineEditRecipient').value = letter.recipient || '';
        $('letterMineEditContent').value = letter.content || '';
        $('letterMineEditWriter').value = letter.writer || '';
        $('letterMineEditDateInput').value = letter.letterDate || '';
        const paper = $('letterMineEditPaper');
        applyLetterMinePaperStyle(paper, letter);
        closeModal('letterMineDetailModal');
        openModal('letterMineEditModal');
    }
    function applyLetterMinePaperStyle(paper, letter) {
        if (!paper) return;
        paper.classList.remove('paper-lined', 'paper-grid', 'paper-blank', 'paper-love', 'tex-kraft', 'tex-parchment', 'tex-gridtex');
        const styleId = letter.style || 'lined';
        if (styleId === 'lined') paper.classList.add('paper-lined');
        else if (styleId === 'grid') paper.classList.add('paper-grid');
        else if (styleId === 'blank') paper.classList.add('paper-blank');
        else if (styleId === 'love') paper.classList.add('paper-love');
        const texId = letter.texture || 'none';
        if (texId === 'kraft') paper.classList.add('tex-kraft');
        else if (texId === 'parchment') paper.classList.add('tex-parchment');
        else if (texId === 'gridtex') paper.classList.add('tex-gridtex');
        const colorObj = MAILBOX_COLORS.find(x => x.id === letter.color) || MAILBOX_COLORS[0];
        paper.style.backgroundColor = colorObj ? colorObj.value : '#fff5f3';
    }
    function cancelLetterMineEdit() {
        closeModal('letterMineEditModal');
        if (currentViewMineId) openLetterMineDetail(currentViewMineId, true);
    }
    function saveLetterMineEdit() {
        const letter = state.myReplyLetters.find(l => l.id === currentViewMineId);
        if (!letter) return;
        let content = ($('letterMineEditContent').value || '').replace(/^[ \t\n\r]+|[ \t\n\r]+$/g, '');
        if (!content) { showSimpleToast('信件内容不能为空'); return; }
        content = content.split('\n').map(line => {
            if (!line) return line;
            return line.startsWith('　　') ? line : '　　' + line;
        }).join('\n');
        letter.recipient = ($('letterMineEditRecipient').value || '').trim();
        letter.content = content;
        letter.writer = ($('letterMineEditWriter').value || '').trim();
        letter.letterDate = ($('letterMineEditDateInput').value || '').trim();
        saveData();
        showSimpleToast('已保存');
        closeModal('letterMineEditModal');
        openLetterMineDetail(currentViewMineId, true);
    }
    function closeLetterMineEditAll() {
        closeModal('letterMineEditModal');
        switchPage('mailboxMinePage');
        renderMailboxMinePage();
    }
    function openLetterMineDelModal(letterId) {
        pendingDelMineId = letterId;
        openModal('letterMineDelModal');
    }
    function confirmDeleteMineLetter() {
        const letterId = pendingDelMineId;
        pendingDelMineId = null;
        if (!letterId) return;
        const idx = state.myReplyLetters.findIndex(l => l.id === letterId);
        if (idx !== -1) {
            state.myReplyLetters.splice(idx, 1);
            saveData();
        }
        closeModal('letterMineDelModal');
        renderMailboxMinePage();
    }
    // ================= 收信人选择弹窗 =================
    function openMailboxRecipientModal() {
        const list = $('mailboxRecipientList');
        if (!list) return;
        const contacts = (state.contacts || []).filter(c => !c.isGroup); // 群聊不能作为收信人
        if (contacts.length === 0) {
            list.innerHTML = '<div class="survey-empty">还没有添加梦角</div>';
        } else {
            list.innerHTML = `<div class="chat-list">${contacts.map(c => `
                <div class="chat-item" data-contact-id="${escapeHtml(c.id)}">
                    <div class="avatar" style="background-image:url('${escapeHtml(c.avatar)}');background-size:cover;background-position:center;"></div>
                    <div class="info">
                        <div class="row1">
                            <div class="name">${escapeHtml(c.nickname || '未命名')}</div>
                        </div>
                        <div class="row2">
                            <div class="last-msg">${escapeHtml(c.signature || '')}</div>
                        </div>
                    </div>
                </div>
            `).join('')}</div>`;
            list.querySelectorAll('.chat-item').forEach(el => {
                el.addEventListener('click', () => selectMailboxRecipient(el.dataset.contactId));
            });
        }
        openModal('mailboxRecipientModal');
    }
    function selectMailboxRecipient(contactId) {
        closeModal('mailboxRecipientModal');
        openMailboxWritePage(contactId);
    }
    // ================= 写信页 =================
    let mailboxWriteContactId = null;
    let mailboxWriteStyle = 'lined';
    let mailboxWriteColor = 'pink';
    let mailboxWriteTexture = 'none';
    // 回信编辑页 state
    let mailboxReplySourceId = null;
    let mailboxReplyStyle = 'lined';
    let mailboxReplyColor = 'pink';
    let mailboxReplyTexture = 'none';
    const MAILBOX_STYLES = [
        { id: 'lined', name: '横线' },
        { id: 'grid', name: '方格' },
        { id: 'blank', name: '空白' },
        { id: 'love', name: '情书' }
    ];
    const MAILBOX_COLORS = [
        { id: 'pink', name: '粉色', value: '#fff5f3' },
        { id: 'blue', name: '蓝色', value: '#f0faff' },
        { id: 'cream', name: '奶黄', value: '#fff8e8' },
        { id: 'white', name: '白色', value: '#ffffff' }
    ];
    const MAILBOX_TEXTURES = [
        { id: 'none', name: '无纹' },
        { id: 'kraft', name: '牛皮纸' },
        { id: 'parchment', name: '羊皮纸' },
        { id: 'gridtex', name: '网格纹' }
    ];
    function openMailboxWritePage(contactId) {
        const c = getContact(contactId);
        if (!c) return;
        mailboxWriteContactId = contactId;
        mailboxWriteStyle = 'lined';
        mailboxWriteColor = 'pink';
        mailboxWriteTexture = 'none';
        $('mailboxWriteTitle').textContent = `写给 ${c.nickname || '未命名'} 的信`;
        switchPage('mailboxWritePage');
        renderMailboxWritePage();
    }
    function closeMailboxWritePage() {
        switchPage('mailboxSentPage');
        renderMailboxSentPage();
    }
    function renderMailboxWritePage() {
        const body = $('mailboxWriteContent');
        if (!body) return;
        const colorObj = MAILBOX_COLORS.find(x => x.id === mailboxWriteColor) || MAILBOX_COLORS[0];
        body.innerHTML = `
            <div class="mailbox-write-section">
                <h4 class="mailbox-write-label">信纸样式</h4>
                <div class="mailbox-opt-grid">
                    ${MAILBOX_STYLES.map(s => `
                        <div class="mailbox-opt${s.id === mailboxWriteStyle ? ' active' : ''}" data-style="${s.id}">${s.name}</div>
                    `).join('')}
                </div>
            </div>
            <div class="mailbox-write-section">
                <h4 class="mailbox-write-label">颜色</h4>
                <div class="mailbox-opt-grid">
                    ${MAILBOX_COLORS.map(c => `
                        <div class="mailbox-opt mailbox-opt-color${c.id === mailboxWriteColor ? ' active' : ''}" data-color="${c.id}" style="background:${c.value};">${c.name}</div>
                    `).join('')}
                </div>
            </div>
            <div class="mailbox-write-section">
                <h4 class="mailbox-write-label">纸纹</h4>
                <div class="mailbox-opt-grid">
                    ${MAILBOX_TEXTURES.map(t => `
                        <div class="mailbox-opt${t.id === mailboxWriteTexture ? ' active' : ''}" data-texture="${t.id}">${t.name}</div>
                    `).join('')}
                </div>
            </div>
            <div class="mailbox-write-section">
                <h4 class="mailbox-write-label">信件内容</h4>
                <div class="mailbox-letter-form">
                    <div class="letter-recipient-row">
                        <span class="letter-recipient-prefix">致</span>
                        <input type="text" class="letter-recipient-input" id="letterRecipientInput" placeholder="收信人" />
                        <span class="letter-recipient-suffix">：</span>
                    </div>
                    <textarea class="mailbox-write-textarea" id="mailboxWriteTextarea" placeholder="写下你想说的话..."></textarea>
                    <div class="letter-signoff">
                        <div class="letter-signoff-row">
                            <span class="letter-signoff-prefix">——</span>
                            <input type="text" class="letter-writer-input" id="letterWriterInput" placeholder="写信人" />
                        </div>
                        <div class="letter-signoff-row">
                            <input type="text" class="letter-date-input" id="letterDateInput" />
                        </div>
                    </div>
                </div>
            </div>
        `;
        const bar = $('mailboxWriteBar');
        if (bar) {
            bar.innerHTML = `
                <button class="btn btn-primary" data-action="send-letter">
                    <svg viewBox="0 0 24 24" style="width:18px;height:18px;" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
                    发送
                </button>
            `;
            const sendBtn = bar.querySelector('[data-action="send-letter"]');
            if (sendBtn) sendBtn.addEventListener('click', sendMailboxLetter);
        }
        applyMailboxPaperStyle();
        const dateInput = $('letterDateInput');
        if (dateInput && !dateInput.value) {
            const now = new Date();
            dateInput.value = `${now.getFullYear()}年${String(now.getMonth() + 1).padStart(2, '0')}月${String(now.getDate()).padStart(2, '0')}日`;
        }
        const ta = $('mailboxWriteTextarea');
        if (ta) {
            ta.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    const start = ta.selectionStart;
                    const end = ta.selectionEnd;
                    const before = ta.value.slice(0, start);
                    const after = ta.value.slice(end);
                    ta.value = before + '\n　　' + after;
                    ta.selectionStart = ta.selectionEnd = start + 3;
                }
            });
        }
        body.querySelectorAll('[data-style]').forEach(el => {
            el.addEventListener('click', () => { mailboxWriteStyle = el.dataset.style; renderMailboxWritePage(); });
        });
        body.querySelectorAll('[data-color]').forEach(el => {
            el.addEventListener('click', () => { mailboxWriteColor = el.dataset.color; renderMailboxWritePage(); });
        });
        body.querySelectorAll('[data-texture]').forEach(el => {
            el.addEventListener('click', () => { mailboxWriteTexture = el.dataset.texture; renderMailboxWritePage(); });
        });
    }
    function applyMailboxPaperStyle() {
        const ta = $('mailboxWriteTextarea');
        if (!ta) return;
        const colorObj = MAILBOX_COLORS.find(x => x.id === mailboxWriteColor) || MAILBOX_COLORS[0];
        ta.style.backgroundColor = colorObj.value;
        ta.classList.remove('paper-lined', 'paper-grid', 'paper-blank', 'paper-love', 'tex-kraft', 'tex-parchment', 'tex-gridtex');
        if (mailboxWriteStyle === 'lined') ta.classList.add('paper-lined');
        else if (mailboxWriteStyle === 'grid') ta.classList.add('paper-grid');
        else if (mailboxWriteStyle === 'blank') ta.classList.add('paper-blank');
        else if (mailboxWriteStyle === 'love') ta.classList.add('paper-love');
        if (mailboxWriteTexture === 'kraft') ta.classList.add('tex-kraft');
        else if (mailboxWriteTexture === 'parchment') ta.classList.add('tex-parchment');
        else if (mailboxWriteTexture === 'gridtex') ta.classList.add('tex-gridtex');
    }
    function sendMailboxLetter() {
        const ta = $('mailboxWriteTextarea');
        if (!ta) return;
        let content = (ta.value || '').replace(/^[ \t\n\r]+|[ \t\n\r]+$/g, '');
        if (!content) { showSimpleToast('请先写下信件内容'); return; }
        content = content.split('\n').map(line => {
            if (!line) return line;
            return line.startsWith('　　') ? line : '　　' + line;
        }).join('\n');
        const recipient = ($('letterRecipientInput')?.value || '').trim();
        const writer = ($('letterWriterInput')?.value || '').trim();
        const letterDate = ($('letterDateInput')?.value || '').trim();
        const c = getContact(mailboxWriteContactId);
        if (!c) return;
        const letter = {
            id: 'L' + Date.now() + Math.random().toString(36).slice(2, 6),
            contactId: mailboxWriteContactId,
            contactName: c.nickname || '未命名',
            content: content,
            recipient: recipient,
            writer: writer,
            letterDate: letterDate,
            style: mailboxWriteStyle,
            color: mailboxWriteColor,
            texture: mailboxWriteTexture,
            sentAt: Date.now(),
            replied: false,
            replyDueAt: Date.now() + (10 + Math.random() * 14) * 60 * 60 * 1000
        };
        state.letters.unshift(letter);
        saveData();
        showSimpleToast('信件已寄出');
        closeMailboxWritePage();
    }
    // ================= 回信编辑页 =================
    function openMailboxReplySelectModal() {
        const list = $('mailboxReplySelectList');
        if (!list) return;
        const letters = (state.hisLetters || []).filter(l =>
            !(state.myReplyLetters || []).some(r => r.replyToHisLetterId === l.id)
        );
        if (letters.length === 0) {
            list.innerHTML = '<div class="survey-empty">还没有可回复的来信</div>';
        } else {
            list.innerHTML = `<div class="chat-list">${letters.map(l => {
                const preview = (l.content || '').slice(0, 40);
                const ellipsis = (l.content || '').length > 40 ? '...' : '';
                return `
                <div class="chat-item" data-reply-source="${escapeHtml(l.id)}">
                    <div class="avatar" style="background-image:url('${escapeHtml(getContact(l.contactId)?.avatar || '')}');background-size:cover;background-position:center;"></div>
                    <div class="info">
                        <div class="row1">
                            <div class="name">${escapeHtml(l.writer || '未命名')}</div>
                            <div class="time">${formatLetterTime(l.sentAt)}</div>
                        </div>
                        <div class="row2">
                            <div class="last-msg">${escapeHtml(preview)}${ellipsis}</div>
                        </div>
                    </div>
                </div>`;
            }).join('')}</div>`;
            list.querySelectorAll('[data-reply-source]').forEach(el => {
                el.addEventListener('click', () => selectMailboxReplySource(el.dataset.replySource));
            });
        }
        openModal('mailboxReplySelectModal');
    }
    function selectMailboxReplySource(hisLetterId) {
        closeModal('mailboxReplySelectModal');
        openMailboxReplyWritePage(hisLetterId);
    }
    function openMailboxReplyWritePage(hisLetterId) {
        const src = state.hisLetters.find(l => l.id === hisLetterId);
        if (!src) { showSimpleToast('来信不存在'); return; }
        mailboxReplySourceId = hisLetterId;
        mailboxReplyStyle = 'lined';
        mailboxReplyColor = 'pink';
        mailboxReplyTexture = 'none';
        const contact = getContact(src.contactId);
        $('mailboxReplyWriteTitle').textContent = `回复 ${src.writer || '未命名'} 的来信`;
        switchPage('mailboxReplyWritePage');
        renderMailboxReplyWritePage();
    }
    function closeMailboxReplyWritePage() {
        switchPage('mailboxMinePage');
        renderMailboxMinePage();
    }
    function renderMailboxReplyWritePage() {
        const body = $('mailboxReplyWriteContent');
        if (!body) return;
        const src = state.hisLetters.find(l => l.id === mailboxReplySourceId);
        if (!src) { closeMailboxReplyWritePage(); return; }
        const origText = `致${src.recipient || ''}：\n${src.content || ''}`;
        body.innerHTML = `
            <div class="mailbox-write-section">
                <div class="letter-original-block" style="display:block;">
                    <div class="letter-original-title">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                        <span>梦角的来信</span>
                    </div>
                    <div class="letter-original-content" id="mailboxReplyOriginal">${escapeHtml(origText)}</div>
                </div>
            </div>
            <div class="mailbox-write-section">
                <h4 class="mailbox-write-label">信纸样式</h4>
                <div class="mailbox-opt-grid">
                    ${MAILBOX_STYLES.map(s => `
                        <div class="mailbox-opt${s.id === mailboxReplyStyle ? ' active' : ''}" data-rstyle="${s.id}">${s.name}</div>
                    `).join('')}
                </div>
            </div>
            <div class="mailbox-write-section">
                <h4 class="mailbox-write-label">颜色</h4>
                <div class="mailbox-opt-grid">
                    ${MAILBOX_COLORS.map(c => `
                        <div class="mailbox-opt mailbox-opt-color${c.id === mailboxReplyColor ? ' active' : ''}" data-rcolor="${c.id}" style="background:${c.value};">${c.name}</div>
                    `).join('')}
                </div>
            </div>
            <div class="mailbox-write-section">
                <h4 class="mailbox-write-label">纸纹</h4>
                <div class="mailbox-opt-grid">
                    ${MAILBOX_TEXTURES.map(t => `
                        <div class="mailbox-opt${t.id === mailboxReplyTexture ? ' active' : ''}" data-rtexture="${t.id}">${t.name}</div>
                    `).join('')}
                </div>
            </div>
            <div class="mailbox-write-section">
                <h4 class="mailbox-write-label">信件内容</h4>
                <div class="mailbox-letter-form">
                    <div class="letter-recipient-row">
                        <span class="letter-recipient-prefix">致</span>
                        <input type="text" class="letter-recipient-input" id="letterReplyRecipientInput" value="${escapeHtml(src.writer || '')}" />
                        <span class="letter-recipient-suffix">：</span>
                    </div>
                    <textarea class="mailbox-write-textarea" id="mailboxReplyTextarea" placeholder="写下你想说的话..."></textarea>
                    <div class="letter-signoff">
                        <div class="letter-signoff-row">
                            <span class="letter-signoff-prefix">——</span>
                            <input type="text" class="letter-writer-input" id="letterReplyWriterInput" placeholder="写信人" />
                        </div>
                        <div class="letter-signoff-row">
                            <input type="text" class="letter-date-input" id="letterReplyDateInput" />
                        </div>
                    </div>
                </div>
            </div>
        `;
        const bar = $('mailboxReplyWriteBar');
        if (bar) {
            bar.innerHTML = `
                <button class="btn btn-primary" data-action="send-reply-letter">
                    <svg viewBox="0 0 24 24" style="width:18px;height:18px;" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
                    发送
                </button>
            `;
            const sendBtn = bar.querySelector('[data-action="send-reply-letter"]');
            if (sendBtn) sendBtn.addEventListener('click', sendMailboxReplyLetter);
        }
        applyMailboxReplyPaperStyle();
        const dateInput = $('letterReplyDateInput');
        if (dateInput && !dateInput.value) {
            const now = new Date();
            dateInput.value = `${now.getFullYear()}年${String(now.getMonth() + 1).padStart(2, '0')}月${String(now.getDate()).padStart(2, '0')}日`;
        }
        const ta = $('mailboxReplyTextarea');
        if (ta) {
            ta.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    const start = ta.selectionStart;
                    const end = ta.selectionEnd;
                    const before = ta.value.slice(0, start);
                    const after = ta.value.slice(end);
                    ta.value = before + '\n　　' + after;
                    ta.selectionStart = ta.selectionEnd = start + 3;
                }
            });
        }
        body.querySelectorAll('[data-rstyle]').forEach(el => {
            el.addEventListener('click', () => { mailboxReplyStyle = el.dataset.rstyle; renderMailboxReplyWritePage(); });
        });
        body.querySelectorAll('[data-rcolor]').forEach(el => {
            el.addEventListener('click', () => { mailboxReplyColor = el.dataset.rcolor; renderMailboxReplyWritePage(); });
        });
        body.querySelectorAll('[data-rtexture]').forEach(el => {
            el.addEventListener('click', () => { mailboxReplyTexture = el.dataset.rtexture; renderMailboxReplyWritePage(); });
        });
    }
    function applyMailboxReplyPaperStyle() {
        const ta = $('mailboxReplyTextarea');
        if (!ta) return;
        const colorObj = MAILBOX_COLORS.find(x => x.id === mailboxReplyColor) || MAILBOX_COLORS[0];
        ta.style.backgroundColor = colorObj.value;
        ta.classList.remove('paper-lined', 'paper-grid', 'paper-blank', 'paper-love', 'tex-kraft', 'tex-parchment', 'tex-gridtex');
        if (mailboxReplyStyle === 'lined') ta.classList.add('paper-lined');
        else if (mailboxReplyStyle === 'grid') ta.classList.add('paper-grid');
        else if (mailboxReplyStyle === 'blank') ta.classList.add('paper-blank');
        else if (mailboxReplyStyle === 'love') ta.classList.add('paper-love');
        if (mailboxReplyTexture === 'kraft') ta.classList.add('tex-kraft');
        else if (mailboxReplyTexture === 'parchment') ta.classList.add('tex-parchment');
        else if (mailboxReplyTexture === 'gridtex') ta.classList.add('tex-gridtex');
    }
    function sendMailboxReplyLetter() {
        const ta = $('mailboxReplyTextarea');
        if (!ta) return;
        let content = (ta.value || '').replace(/^[ \t\n\r]+|[ \t\n\r]+$/g, '');
        if (!content) { showSimpleToast('请先写下信件内容'); return; }
        content = content.split('\n').map(line => {
            if (!line) return line;
            return line.startsWith('　　') ? line : '　　' + line;
        }).join('\n');
        const recipient = ($('letterReplyRecipientInput')?.value || '').trim();
        const writer = ($('letterReplyWriterInput')?.value || '').trim();
        const letterDate = ($('letterReplyDateInput')?.value || '').trim();
        const src = state.hisLetters.find(l => l.id === mailboxReplySourceId);
        if (!src) { showSimpleToast('来信不存在'); return; }
        const letter = {
            id: 'MR' + Date.now() + Math.random().toString(36).slice(2, 6),
            replyToHisLetterId: src.id,
            contactId: src.contactId,
            recipient: recipient,
            content: content,
            writer: writer,
            letterDate: letterDate,
            style: mailboxReplyStyle,
            color: mailboxReplyColor,
            texture: mailboxReplyTexture,
            sentAt: Date.now()
        };
        state.myReplyLetters.unshift(letter);
        saveData();
        showSimpleToast('回信已寄出');
        mailboxReplySourceId = null;
        closeMailboxReplyWritePage();
    }
    function renderFavoritesPage() {
        const body = $('favoritesContent');
        if (!body) return;
        const contacts = state.contacts || [];
        let listHtml = '';
        if (contacts.length === 0) {
            listHtml = '<div class="survey-empty">还没有添加梦角</div>';
        } else {
            listHtml = `<div class="chat-list">${contacts.map(c => `
                <div class="chat-item" data-contact-id="${escapeHtml(c.id)}">
                    <div class="avatar" style="background-image:url('${escapeHtml(c.avatar)}');background-size:cover;background-position:center;"></div>
                    <div class="info">
                        <div class="row1">
                            <div class="name">${escapeHtml(c.nickname || '未命名')}</div>
                        </div>
                        <div class="row2">
                            <div class="last-msg">${escapeHtml(c.signature || '')}</div>
                        </div>
                    </div>
                </div>
            `).join('')}</div>`;
        }
        body.innerHTML = listHtml;
        body.querySelectorAll('.chat-item').forEach(el => {
            el.addEventListener('click', () => openFavoriteDetailPage(el.dataset.contactId));
        });
    }
    // ================= 占卜 =================
    // 雷诺曼 36 张牌
    const LENORMAND_CARDS = [
        { no: 1, name: '骑士', keyword: '消息·行动', meaning: '消息、访客、快速行动', rev: '延迟、误会、迟迟不到的消息',
          icon: '<path d="M18 44c0-7 5-12 12-12h5l5-7 7 2-2 7 9 2v9h-5v7h-7v-7H24v7h-6z" fill="#c9aad9"/><circle cx="32" cy="16" r="5" fill="#f0c9a0"/><path d="M25 23v12h14V23" fill="none" stroke="#c9aad9" stroke-width="3" stroke-linejoin="round"/>' },
        { no: 2, name: '三叶草', keyword: '好运·机遇', meaning: '好运、机遇、小确幸', rev: '错过机会、短暂的好运',
          icon: '<path d="M32 10c-3 0-5 2-5 5s2 5 5 5 5-2 5-5-2-5-5-5z" fill="#7ec96b"/><path d="M32 20c-4 0-8 3-8 8 0 4 3 7 8 7s8-3 8-7c0-5-4-8-8-8z" fill="#7ec96b"/><path d="M22 22c-4 0-7 3-7 7s3 7 7 7 7-3 7-7-3-7-7-7z" fill="#7ec96b"/><path d="M42 22c-4 0-7 3-7 7s3 7 7 7 7-3 7-7-3-7-7-7z" fill="#7ec96b"/><path d="M32 35v18" stroke="#5a9e4a" stroke-width="3" stroke-linecap="round"/>' },
        { no: 3, name: '船', keyword: '旅行·远方', meaning: '旅行、远方、进展', rev: '停滞、思乡、行程受阻',
          icon: '<path d="M14 30l18-12 18 12z" fill="#e8c07a"/><path d="M32 18v12" stroke="#b89050" stroke-width="2"/><path d="M10 34h44l-5 10H15z" fill="#a87d5a"/><path d="M32 44v10" stroke="#a87d5a" stroke-width="3" stroke-linecap="round"/>' },
        { no: 4, name: '房屋', keyword: '家庭·安稳', meaning: '家庭、稳定、归属感', rev: '家庭矛盾、不安定、封闭',
          icon: '<path d="M14 30l18-14 18 14v20H14z" fill="#e8a0a0"/><path d="M26 50V38h12v12z" fill="#b87070"/><path d="M32 16l-8 6v8h16v-8z" fill="#d98a8a"/>' },
        { no: 5, name: '树', keyword: '健康·成长', meaning: '健康、成长、生命力', rev: '健康小恙、成长停滞',
          icon: '<path d="M32 8c-6 4-10 10-10 16 0 5 4 9 10 9s10-4 10-9c0-6-4-12-10-16z" fill="#7ec96b"/><path d="M28 33v20h8V33z" fill="#a87d5a"/>' },
        { no: 6, name: '云', keyword: '困惑·迷雾', meaning: '困惑、不确定、阴霾', rev: '迷雾散去、逐渐明朗',
          icon: '<path d="M20 40c-6 0-10-4-10-10s4-9 9-9c1-7 7-12 14-11 7 1 11 6 12 13 5 1 8 5 8 10 0 5-4 9-10 9H20z" fill="#b8c0d0"/>' },
        { no: 7, name: '蛇', keyword: '智慧·诱惑', meaning: '智慧、诱惑、复杂', rev: '化解矛盾、识破心机',
          icon: '<path d="M16 14c4-4 8 0 8 4s-4 8-8 8-8 4-8 8 4 8 8 8" fill="none" stroke="#8a6bb0" stroke-width="4" stroke-linecap="round"/><circle cx="16" cy="14" r="3" fill="#8a6bb0"/>' },
        { no: 8, name: '棺材', keyword: '结束·转变', meaning: '结束、转变、放下', rev: '迟迟无法结束、僵局松动',
          icon: '<rect x="18" y="22" width="28" height="22" rx="3" fill="#8a7a8a"/><path d="M18 30h28" stroke="#6a5a6a" stroke-width="2"/>' },
        { no: 9, name: '花束', keyword: '礼物·美好', meaning: '礼物、美好、邀请', rev: '失约、被忽视的善意',
          icon: '<circle cx="32" cy="20" r="6" fill="#f5a0b0"/><circle cx="24" cy="26" r="5" fill="#f5c070"/><circle cx="40" cy="26" r="5" fill="#a0c8f0"/><path d="M32 26v22" stroke="#7ec96b" stroke-width="3" stroke-linecap="round"/><path d="M32 36l-8-6M32 40l8-6" stroke="#7ec96b" stroke-width="3" stroke-linecap="round"/>' },
        { no: 10, name: '镰刀', keyword: '决断·收割', meaning: '突然的决定，危险，收割，结束，手术。', rev: '犹豫不决、藕断丝连',
          icon: '<path d="M20 44l24-24" stroke="#c9a050" stroke-width="4" stroke-linecap="round"/><path d="M44 20c-2 8-8 14-16 16 0-8 6-14 16-16z" fill="#e8c07a"/>' },
        { no: 11, name: '鞭子', keyword: '冲突·争执', meaning: '冲突、重复、争执', rev: '和解、停止争吵',
          icon: '<path d="M20 14c8 4 16 4 24 0" fill="none" stroke="#c08060" stroke-width="4" stroke-linecap="round"/><path d="M20 22c8 4 16 4 24 0" fill="none" stroke="#c08060" stroke-width="4" stroke-linecap="round"/><path d="M20 30c8 4 16 4 24 0" fill="none" stroke="#c08060" stroke-width="4" stroke-linecap="round"/>' },
        { no: 12, name: '鸟', keyword: '沟通·对话', meaning: '沟通、对话、焦虑', rev: '沟通顺畅、焦虑缓解',
          icon: '<path d="M16 30c0-6 4-10 10-10s10 4 10 10-4 10-10 10-10-4-10-10z" fill="#a0c8f0"/><circle cx="22" cy="28" r="2" fill="#3d5a7a"/><path d="M26 30l4 4M26 32l6 2" stroke="#a0c8f0" stroke-width="2" stroke-linecap="round"/><path d="M40 36c0-5 3-8 8-8s8 3 8 8-3 8-8 8-8-3-8-8z" fill="#b8a0d4"/><circle cx="45" cy="34" r="1.5" fill="#3d5a7a"/>' },
        { no: 13, name: '小孩', keyword: '纯真·新始', meaning: '纯真、新开始、弱小', rev: '不成熟、依赖、停滞',
          icon: '<circle cx="32" cy="18" r="7" fill="#f0c9a0"/><path d="M22 44c0-8 5-13 10-13s10 5 10 13" fill="none" stroke="#f0c9a0" stroke-width="6" stroke-linecap="round"/>' },
        { no: 14, name: '狐狸', keyword: '谨慎·计谋', meaning: '谨慎、计谋、工作', rev: '坦诚、被识破的计谋',
          icon: '<path d="M20 28l12-12 12 12-6 8h-12z" fill="#e89060"/><circle cx="27" cy="26" r="1.5" fill="#3d2a2a"/><circle cx="37" cy="26" r="1.5" fill="#3d2a2a"/><path d="M29 32l3 3 3-3" stroke="#3d2a2a" stroke-width="1.5" fill="none"/><path d="M32 36v10" stroke="#e89060" stroke-width="4" stroke-linecap="round"/>' },
        { no: 15, name: '熊', keyword: '力量·权威', meaning: '力量、权威、资源', rev: '失去支持、权力斗争',
          icon: '<circle cx="22" cy="18" r="5" fill="#9a7a60"/><circle cx="42" cy="18" r="5" fill="#9a7a60"/><circle cx="32" cy="30" r="14" fill="#b09070"/><circle cx="27" cy="28" r="2" fill="#3d2a2a"/><circle cx="37" cy="28" r="2" fill="#3d2a2a"/><ellipse cx="32" cy="34" rx="4" ry="3" fill="#e8c8a0"/>' },
        { no: 16, name: '星星', keyword: '希望·指引', meaning: '希望、指引、梦想', rev: '希望渺茫、迷失方向',
          icon: '<path d="M32 10l5 14 14 2-11 10 4 14-12-8-12 8 4-14-11-10 14-2z" fill="#f5d060"/>' },
        { no: 17, name: '鹳', keyword: '变化·更新', meaning: '变化、迁移、更新', rev: '抗拒改变、延迟的变动',
          icon: '<path d="M14 30l10-10 8 8 10-16 8 16-14 10-8-8z" fill="#e8e0d0"/><path d="M14 30l8-4M50 22l6 2" stroke="#e8a060" stroke-width="2" stroke-linecap="round"/><path d="M32 38v14" stroke="#e8a060" stroke-width="3" stroke-linecap="round"/>' },
        { no: 18, name: '狗', keyword: '忠诚·友谊', meaning: '忠诚、友谊、信任', rev: '不忠、友情破裂',
          icon: '<path d="M18 24c0-8 6-14 14-14s14 6 14 14v14l-6-4h-16l-6 4z" fill="#c8a070"/><circle cx="26" cy="24" r="2" fill="#3d2a2a"/><circle cx="38" cy="24" r="2" fill="#3d2a2a"/><ellipse cx="32" cy="30" rx="3" ry="2" fill="#3d2a2a"/>' },
        { no: 19, name: '塔', keyword: '孤独·机构', meaning: '机构、孤独、结构', rev: '脱离体制、打破孤立',
          icon: '<path d="M24 14h16v36H24z" fill="#c8b090"/><path d="M22 14h20l-2-6H24z" fill="#a89070"/><rect x="28" y="22" width="8" height="8" fill="#8a7050"/><rect x="28" y="36" width="8" height="8" fill="#8a7050"/>' },
        { no: 20, name: '花园', keyword: '社交·公开', meaning: '社交、公开、聚会', rev: '社交回避、隐私暴露',
          icon: '<rect x="14" y="38" width="36" height="12" rx="2" fill="#a87d5a"/><circle cx="22" cy="28" r="5" fill="#f5a0b0"/><circle cx="32" cy="24" r="5" fill="#f5d060"/><circle cx="42" cy="28" r="5" fill="#a0c8f0"/><path d="M22 33v5M32 29v9M42 33v5" stroke="#7ec96b" stroke-width="2" stroke-linecap="round"/>' },
        { no: 21, name: '山', keyword: '阻碍·挑战', meaning: '阻碍、挑战、延迟', rev: '克服障碍、问题解决',
          icon: '<path d="M10 46L26 22l10 14 6-8 12 18z" fill="#9a8a7a"/><path d="M22 28l4-6 4 6z" fill="#ffffff"/>' },
        { no: 22, name: '十字路口', keyword: '选择·分歧', meaning: '选择、决定、分歧', rev: '犹豫不定、做出选择',
          icon: '<path d="M28 10h8v18h10v8H36v18h-8V36H18v-8h10z" fill="#c8b090"/>' },
        { no: 23, name: '老鼠', keyword: '损耗·压力', meaning: '损耗、压力、侵蚀', rev: '止损、压力减轻',
          icon: '<path d="M16 38c0-8 6-14 14-14s14 6 14 14-6 10-14 10-14-2-14-10z" fill="#a8a0a0"/><circle cx="24" cy="34" r="2" fill="#3d2a2a"/><path d="M44 32l8-2M44 38l8 2" stroke="#a8a0a0" stroke-width="2" stroke-linecap="round"/>' },
        { no: 24, name: '心', keyword: '爱情·感情', meaning: '爱、感情、热情', rev: '感情降温、伤心',
          icon: '<path d="M32 50s-16-10-16-22c0-6 4-10 10-10 4 0 6 2 6 2s2-2 6-2c6 0 10 4 10 10 0 12-16 22-16 22z" fill="#f58a9a"/>' },
        { no: 25, name: '戒指', keyword: '承诺·关系', meaning: '承诺、关系、契约', rev: '关系破裂、解除承诺',
          icon: '<circle cx="32" cy="36" r="12" fill="none" stroke="#e8c070" stroke-width="5"/><path d="M26 24l6-8 6 8z" fill="#f5d060"/>' },
        { no: 26, name: '书', keyword: '秘密·知识', meaning: '秘密、知识、隐藏', rev: '秘密揭露、求知若渴',
          icon: '<rect x="16" y="14" width="32" height="36" rx="2" fill="#7a90b0"/><rect x="20" y="18" width="24" height="28" fill="#e8e0d0"/><path d="M32 18v28" stroke="#b0a090" stroke-width="1.5"/>' },
        { no: 27, name: '信件', keyword: '消息·文书', meaning: '消息、文书、沟通', rev: '坏消息、通信中断',
          icon: '<rect x="14" y="18" width="36" height="26" rx="2" fill="#e8e0d0"/><path d="M14 20l18 12 18-12" fill="none" stroke="#b0a090" stroke-width="2"/>' },
        { no: 28, name: '男人', keyword: '男性·阳刚', meaning: '男性、阳刚、提问者', rev: '优柔寡断、失去力量',
          icon: '<circle cx="32" cy="16" r="7" fill="#f0c9a0"/><path d="M20 44c0-9 6-14 12-14s12 5 12 14" fill="none" stroke="#7a90b0" stroke-width="7" stroke-linecap="round"/>' },
        { no: 29, name: '女人', keyword: '女性·阴柔', meaning: '女性、阴柔、对方', rev: '情绪化、不够坚定',
          icon: '<circle cx="32" cy="16" r="7" fill="#f0c9a0"/><path d="M20 44c0-9 6-14 12-14s12 5 12 14" fill="none" stroke="#e890a0" stroke-width="7" stroke-linecap="round"/>' },
        { no: 30, name: '百合', keyword: '纯洁·和谐', meaning: '纯洁、和谐、年长', rev: '不和、幼稚冲动',
          icon: '<path d="M32 12c-4 4-4 10 0 14 4-4 4-10 0-14z" fill="#f0f0f8"/><path d="M24 18c-4 2-4 8 0 12M40 18c4 2 4 8 0 12" fill="none" stroke="#f0f0f8" stroke-width="4" stroke-linecap="round"/><path d="M32 26v24" stroke="#7ec96b" stroke-width="3" stroke-linecap="round"/>' },
        { no: 31, name: '太阳', keyword: '成功·喜悦', meaning: '成功、喜悦、活力', rev: '暂时阴霾、热情减退',
          icon: '<circle cx="32" cy="32" r="10" fill="#f5d060"/><g stroke="#f5d060" stroke-width="3" stroke-linecap="round"><path d="M32 12v6M32 46v6M12 32h6M46 32h6M18 18l4 4M42 42l4 4M46 18l-4 4M18 46l4-4"/></g>' },
        { no: 32, name: '月亮', keyword: '情绪·直觉', meaning: '情绪、直觉、名声', rev: '情绪平复、名声受损',
          icon: '<path d="M40 16a14 14 0 1 0 8 24 11 11 0 0 1-8-24z" fill="#f0e8c8"/>' },
        { no: 33, name: '钥匙', keyword: '答案·开启', meaning: '答案、开启、确定', rev: '找不到答案、错失良机',
          icon: '<circle cx="22" cy="32" r="8" fill="none" stroke="#e8c070" stroke-width="4"/><path d="M30 32h20M42 32v6M48 32v4" stroke="#e8c070" stroke-width="4" stroke-linecap="round"/>' },
        { no: 34, name: '鱼', keyword: '财富·流动', meaning: '财富、流动、独立', rev: '财务紧张、流动受阻',
          icon: '<path d="M14 32c8-8 16-8 24 0-8 8-16 8-24 0z" fill="#7ac0d8"/><path d="M38 32l10-6v12z" fill="#7ac0d8"/><circle cx="22" cy="30" r="2" fill="#3d2a2a"/>' },
        { no: 35, name: '锚', keyword: '稳定·坚持', meaning: '稳定、坚持、长久', rev: '动摇、缺乏根基',
          icon: '<circle cx="32" cy="14" r="4" fill="none" stroke="#8a9ab0" stroke-width="3"/><path d="M32 18v30M22 40a12 12 0 0 0 20 0M20 26h24" stroke="#8a9ab0" stroke-width="3" stroke-linecap="round" fill="none"/>' },
        { no: 36, name: '十字架', keyword: '考验·宿命', meaning: '考验、宿命、沉重', rev: '走出低谷、卸下重担',
          icon: '<path d="M28 10h8v14h14v8H36v22h-8V32H14v-8h14z" fill="#b07070"/>' }
    ];

    // 塔罗 22 张大阿卡纳
    const TAROT_CARDS = [
        { name: '愚者', keyword: '自由·冒险', meaning: '新的开始、冒险、纯真自由', rev: '鲁莽、犹豫不决、停滞不前' },
        { name: '魔术师', keyword: '创造·意志', meaning: '创造力、意志力、行动力', rev: '能力浪费、操纵、缺乏方向' },
        { name: '女祭司', keyword: '直觉·神秘', meaning: '直觉、神秘、内在智慧', rev: '忽视直觉、秘密暴露、困惑' },
        { name: '皇后', keyword: '丰饶·母性', meaning: '丰饶、母性、感官享受', rev: '依赖、创造力受阻、忽视自我' },
        { name: '皇帝', keyword: '权威·秩序', meaning: '权威、结构、秩序', rev: '专制、僵化、失去控制' },
        { name: '教皇', keyword: '传统·信仰', meaning: '传统、信仰、精神教导', rev: '反叛传统、信仰动摇、标新立异' },
        { name: '恋人', keyword: '结合·选择', meaning: '结合、选择、价值观', rev: '不和谐、错误选择、关系失衡' },
        { name: '战车', keyword: '胜利·意志', meaning: '胜利、决心、意志力', rev: '失控、方向迷失、被情绪驱使' },
        { name: '力量', keyword: '勇气·内在力量', meaning: '勇气、耐心、内在力量', rev: '自我怀疑、软弱、被恐惧支配' },
        { name: '隐士', keyword: '内省·指引', meaning: '内省、独处、灵魂指引', rev: '孤立、逃避、拒绝建议' },
        { name: '命运之轮', keyword: '转变·循环', meaning: '转变、循环、命运', rev: '坏运气、抗拒变化、陷入低谷' },
        { name: '正义', keyword: '公平·因果', meaning: '公平、真相、因果', rev: '不公、逃避责任、偏见' },
        { name: '倒吊人', keyword: '牺牲·新视角', meaning: '牺牲、新视角、耐心等待', rev: '无谓牺牲、固执己见、停滞' },
        { name: '死神', keyword: '结束·重生', meaning: '结束、转变、重生', rev: '抗拒改变、停滞不前、无法放下' },
        { name: '节制', keyword: '平衡·调和', meaning: '平衡、调和、耐心', rev: '失衡、过度、缺乏节制' },
        { name: '恶魔', keyword: '束缚·欲望', meaning: '束缚、欲望、执念', rev: '挣脱束缚、觉醒、摆脱控制' },
        { name: '塔', keyword: '突变·觉醒', meaning: '突变、崩塌、觉醒', rev: '避免灾难、内在动摇、抗拒改变' },
        { name: '星星', keyword: '希望·灵感', meaning: '希望、灵感、宁静', rev: '失去希望、信心不足、灵感枯竭' },
        { name: '月亮', keyword: '幻象·潜意识', meaning: '幻象、潜意识、不安', rev: '迷雾散去、真相显现、不安消退' },
        { name: '太阳', keyword: '成功·快乐', meaning: '成功、快乐、活力', rev: '暂时阴霾、热情减退、过度乐观' },
        { name: '审判', keyword: '觉醒·重生', meaning: '觉醒、重生、召唤', rev: '自我怀疑、拒绝改变、错过机会' },
        { name: '世界', keyword: '完成·圆满', meaning: '完成、圆满、成就', rev: '未完成、缺乏闭环、停滞' }
    ];

    // 韦特塔罗牌面图片（jsdelivr CDN · @cometpisces/tarot-kit-images）
    const TAROT_IMAGE_NAMES = [
        'TheFool', 'TheMagician', 'TheHighPriestess', 'TheEmpress', 'TheEmperor', 'TheHierophant',
        'TheLovers', 'TheChariot', 'Strength', 'TheHermit', 'WheelOfFortune', 'Justice',
        'TheHangedMan', 'Death', 'Temperance', 'TheDevil', 'TheTower', 'TheStar', 'TheMoon',
        'TheSun', 'Judgement', 'TheWorld'
    ];
    function getTarotImageUrl(index) {
        const name = TAROT_IMAGE_NAMES[index];
        if (!name) return '';
        const num = String(index).padStart(2, '0');
        return `https://cdn.jsdelivr.net/npm/@cometpisces/tarot-kit-images@0.2.0/images/${num}-${name}.png`;
    }

    const LENORMAND_POSITIONS = ['第一张', '第二张', '第三张'];
    const TAROT_POSITIONS = ['过去', '现在', '未来'];

    function drawDivineCards(pool, count) {
        const arr = pool.slice();
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr.slice(0, count).map(c => ({ ...c, reversed: Math.random() < 0.5 }));
    }

    function openDivinationPage() {
        switchPage('divinationPage');
    }
    function closeDivinationPage() {
        switchPage('homePage');
    }
    let lenormandSelectedCount = 1;
    function openLenormandPage() {
        switchPage('lenormandPage');
        lenormandSelectedCount = 1;
        const form = $('lenormandForm');
        if (form) form.classList.remove('hidden');
        $('lenormandResult').innerHTML = '';
        $('lenormandResultModal').classList.remove('show');
        $$('.len-count-btn').forEach(b => b.classList.toggle('active', b.dataset.count === '1'));
        $('lenormandCountHint').textContent = '单张牌 · 直达答案';
    }
    function closeLenormandPage() {
        $('lenormandResultModal').classList.remove('show');
        switchPage('divinationPage');
    }
    let tarotSelectedCount = 1;
    function openTarotPage() {
        switchPage('tarotPage');
        tarotSelectedCount = 1;
        $('tarotResult').innerHTML = '';
        $('tarotResultModal').classList.remove('show');
        $$('.tarot-count-btn').forEach(b => b.classList.toggle('active', b.dataset.count === '1'));
        $('tarotCountHint').textContent = '单张牌 · 直指当下';
    }
    function closeTarotPage() {
        $('tarotResultModal').classList.remove('show');
        switchPage('divinationPage');
    }

    // 生成三张牌的综合解读（通顺连贯的一段文字）
    function generateLenormandSummary(cards) {
        const names = cards.map(c => c.name);
        // 取每张牌关键词的第一段作为核心意象
        const kws = cards.map(c => {
            const seg = (c.keyword || '').split(/[·、]/);
            return seg[0] || c.name;
        });
        // 取每张牌牌义的第一个词作为能量点
        const energies = cards.map(c => {
            const seg = (c.meaning || '').split(/[、，,]/);
            return seg[0] || c.name;
        });
        const templates = [
            `「${names[0]}」与「${names[1]}」、「${names[2]}」共同呈现：${kws[0]}的气息与${kws[1]}、${kws[2]}在此交织，${energies[0]}与${energies[1]}汇聚成${energies[2]}的方向。愿三张牌的能量，成为你此刻的指引。`,
            `「${names[0]}」引出「${names[1]}」与「${names[2]}」的回响：${kws[0]}开启了序幕，${kws[1]}带来转折，${kws[2]}则指向最终的落点——${energies[0]}、${energies[1]}与${energies[2]}彼此呼应，静待你的回应。愿三张牌的能量，成为你此刻的指引。`,
            `当「${names[0]}」遇见「${names[1]}」与「${names[2]}」：${kws[0]}是起点，${kws[1]}是过程，${kws[2]}是答案。${energies[0]}的力量推动着${energies[1]}，最终抵达${energies[2]}的彼岸。愿三张牌的能量，成为你此刻的指引。`,
            `「${names[0]}」、「${names[1]}」、「${names[2]}」三牌同现：${kws[0]}与${kws[1]}相互映照，催生出${kws[2]}的契机。让${energies[0]}的勇气、${energies[1]}的智慧，带你走向${energies[2]}的圆满。愿三张牌的能量，成为你此刻的指引。`
        ];
        return templates[Math.floor(Math.random() * templates.length)];
    }

    function renderLenormandResult(cards) {
        const container = $('lenormandResult');
        if (!container) return;
        const quote = '雷诺曼轻声说 · 爱能克服距离';
        let html = `<div class="len-quote"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg><span>${quote}</span></div>`;
        html += '<div class="len-cards-row">';
        cards.forEach(c => {
            html += `
                <div class="len-card">
                    <div class="len-card-icon"><svg viewBox="0 0 64 64" width="56" height="56">${c.icon}</svg></div>
                    <div class="len-card-name">${escapeHtml(c.name)}</div>
                    <div class="len-card-no">No.${c.no}</div>
                    <div class="len-card-keyword">「${escapeHtml(c.keyword)}」</div>
                    <div class="len-card-meaning">${escapeHtml(c.reversed ? c.rev : c.meaning)}</div>
                </div>
            `;
        });
        html += '</div>';
        // 三张牌时追加综合解读
        if (cards.length === 3) {
            const summary = generateLenormandSummary(cards);
            html += `
                <div class="len-summary">
                    <div class="len-summary-title">
                        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-2.9z"/></svg>
                        <span>综合解读</span>
                    </div>
                    <div class="len-summary-text">${escapeHtml(summary)}</div>
                </div>
            `;
        }
        html += `
            <div class="len-result-actions">
                <button class="len-action-btn" id="lenormandRedrawBtn">重新占卜</button>
                <button class="len-action-btn" id="lenormandCloseBtn">关闭</button>
            </div>
        `;
        container.innerHTML = html;
        $('lenormandRedrawBtn').addEventListener('click', redrawLenormand);
        $('lenormandCloseBtn').addEventListener('click', closeLenormandPage);
        $('lenormandResultModal').classList.add('show');
    }

    function redrawLenormand() {
        $('lenormandResultModal').classList.remove('show');
        $('lenormandResult').innerHTML = '';
    }

    function renderDivineResult(containerId, cards, positions, typeLabel) {
        const container = $(containerId);
        if (!container) return;
        const questionEl = typeLabel === '雷诺曼' ? $('lenormandQuestion') : $('tarotQuestion');
        const question = (questionEl ? questionEl.value : '').trim();
        let cardsHtml = '<div class="divine-cards-row">';
        cards.forEach((c, i) => {
            const pos = positions[i] || '';
            cardsHtml += `
                <div class="divine-card ${c.reversed ? 'reversed' : ''}">
                    ${c.reversed ? '<span class="divine-card-rev-mark">逆位</span>' : '<span class="divine-card-rev-mark" style="color:#6bbf6b;background:rgba(107,191,107,0.15);">正位</span>'}
                    <div class="divine-card-name">${escapeHtml(c.name)}</div>
                    ${pos ? `<div class="divine-card-pos">${escapeHtml(pos)}</div>` : ''}
                    <div class="divine-card-meaning">${escapeHtml(c.reversed ? c.rev : c.meaning)}</div>
                </div>
            `;
        });
        cardsHtml += '</div>';
        const summaryText = question
            ? `关于「${escapeHtml(question)}」，${typeLabel}牌面显示：` + cards.map((c, i) => {
                const pos = positions[i] ? `${positions[i]}：` : '';
                return `${pos}${c.name}${c.reversed ? '（逆位）' : ''}——${c.reversed ? c.rev : c.meaning}`;
            }).join('；') + '。'
            : cards.map((c, i) => {
                const pos = positions[i] ? `${positions[i]}：` : '';
                return `${pos}${c.name}${c.reversed ? '（逆位）' : ''}——${c.reversed ? c.rev : c.meaning}`;
            }).join('；') + '。';
        container.innerHTML = cardsHtml + `
            <div class="divine-summary">
                <div class="divine-summary-title">牌面解读</div>
                ${summaryText}
            </div>
        `;
    }

    function handleLenormandDraw() {
        const count = lenormandSelectedCount;
        const cards = drawDivineCards(LENORMAND_CARDS, count);
        renderLenormandResult(cards);
    }
    function handleTarotDraw() {
        const count = tarotSelectedCount;
        const cards = drawDivineCards(TAROT_CARDS, count);
        renderTarotResult(cards, count === 1 ? [] : TAROT_POSITIONS);
    }

    // 生成塔罗三张牌的综合解读
    function generateTarotSummary(cards) {
        const names = cards.map(c => c.name);
        const kws = cards.map(c => {
            const seg = (c.keyword || '').split(/[·、]/);
            return seg[0] || c.name;
        });
        const energies = cards.map(c => {
            const seg = (c.meaning || '').split(/[、，,]/);
            return seg[0] || c.name;
        });
        const templates = [
            `「${names[0]}」与「${names[1]}」、「${names[2]}」共同揭示：${kws[0]}的能量流经${kws[1]}，最终在${kws[2]}处显化。${energies[0]}与${energies[1]}的交织，指引你走向${energies[2]}的方向。愿塔罗的启示，照亮你前行的路。`,
            `过去的「${names[0]}」、现在的「${names[1]}」与未来的「${names[2]}」一脉相承：${kws[0]}播下的种子，在${kws[1]}中萌芽，终将以${kws[2]}的姿态绽放。让${energies[0]}的余韵、${energies[1]}的当下，带你抵达${energies[2]}的彼岸。愿塔罗的启示，照亮你前行的路。`,
            `当「${names[0]}」、「${names[1]}」、「${names[2]}」依次展开：${kws[0]}是起因，${kws[1]}是过程，${kws[2]}是结果。${energies[0]}的力量催动${energies[1]}的转化，一切皆指向${energies[2]}的答案。愿塔罗的启示，照亮你前行的路。`,
            `「${names[0]}」引出「${names[1]}」与「${names[2]}」的脉络：${kws[0]}开启了能量的流动，${kws[1]}承接并转化，${kws[2]}给出最终的昭示。${energies[0]}、${energies[1]}与${energies[2]}环环相扣，答案已在牌中。愿塔罗的启示，照亮你前行的路。`
        ];
        return templates[Math.floor(Math.random() * templates.length)];
    }

    function renderTarotResult(cards, positions) {
        const container = $('tarotResult');
        if (!container) return;
        const isThree = cards.length === 3;
        // 引言：单张 / 三张 不同文案
        const quote = isThree ? '三张牌为你揭示 · 洞见能量流动' : '塔罗为你揭示 · 一切皆有答案';
        const sunIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>';
        let html = `<div class="len-quote">${sunIcon}<span>${quote}</span></div>`;
        html += '<div class="tarot-cards-row">';
        cards.forEach((c, i) => {
            const pos = positions[i] || '';
            // 通过牌名查找原始索引，用于图片映射
            const cardIndex = TAROT_CARDS.findIndex(x => x.name === c.name);
            const imgUrl = getTarotImageUrl(cardIndex);
            const isRev = c.reversed;
            html += `
                <div class="tarot-card ${isRev ? 'reversed' : ''}" data-idx="${i}">
                    <div class="tarot-card-inner">
                        <div class="tarot-card-face tarot-card-front">
                            <img src="${imgUrl}" alt="${escapeHtml(c.name)}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
                            <div class="tarot-card-fallback">${escapeHtml(c.name)}</div>
                        </div>
                        <div class="tarot-card-face tarot-card-back">
                            ${pos ? `<div class="tarot-card-pos">${escapeHtml(pos)}</div>` : ''}
                            <div class="tarot-card-name">${escapeHtml(c.name)}</div>
                            <div class="tarot-card-rev-badge ${isRev ? '' : 'upright'}">${isRev ? '逆位' : '正位'}</div>
                            <div class="tarot-card-keyword">「${escapeHtml(c.keyword)}」</div>
                            <div class="tarot-card-meaning">${escapeHtml(isRev ? c.rev : c.meaning)}</div>
                        </div>
                    </div>
                </div>
            `;
        });
        html += '</div>';
        // 三张牌追加综合解读
        if (isThree) {
            const comp = generateTarotSummary(cards);
            html += `
                <div class="len-summary">
                    <div class="len-summary-title">
                        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-2.9z"/></svg>
                        <span>综合解读</span>
                    </div>
                    <div class="len-summary-text">${escapeHtml(comp)}</div>
                </div>
            `;
        }
        html += `
            <div class="len-result-actions">
                <button class="len-action-btn" id="tarotRedrawBtn">重新占卜</button>
                <button class="len-action-btn" id="tarotCloseBtn">关闭</button>
            </div>
        `;
        container.innerHTML = html;
        // 绑定翻牌点击
        container.querySelectorAll('.tarot-card').forEach(card => {
            card.addEventListener('click', () => card.classList.toggle('flipped'));
        });
        $('tarotRedrawBtn').addEventListener('click', redrawTarot);
        $('tarotCloseBtn').addEventListener('click', closeTarotPage);
        $('tarotResultModal').classList.add('show');
    }

    function redrawTarot() {
        $('tarotResultModal').classList.remove('show');
        $('tarotResult').innerHTML = '';
    }

    // ================= 收藏详情页 =================
    let favoriteDetailContactId = null;
    let favoriteDetailDate = null;
    let favoriteDetailContactName = '';
    let pendingFavDelDate = null;
    function getDateKey(ts) {
        const d = new Date(ts);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
    function formatDateDisplay(ts) {
        const d = new Date(ts);
        return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
    }
    function openFavoriteDetailPage(contactId) {
        const c = getContact(contactId);
        if (!c) return;
        favoriteDetailContactId = contactId;
        favoriteDetailDate = null;
        favoriteDetailContactName = c.nickname || '收藏';
        $('favoriteDetailTitle').textContent = favoriteDetailContactName;
        switchPage('favoriteDetailPage');
        renderFavoriteDetail();
    }
    function closeFavoriteDetailPage() {
        if (favoriteDetailDate) {
            favoriteDetailDate = null;
            renderFavoriteDetail();
        } else {
            switchPage('favoritesPage');
        }
    }
    function renderFavoriteDetail() {
        const body = $('favoriteDetailContent');
        if (!body) return;
        const c = getContact(favoriteDetailContactId);
        if (!c) return;
        const favMsgs = c.messages.filter(m => m.favorited);
        if (favMsgs.length === 0) {
            body.innerHTML = '<div class="survey-empty">暂无收藏的聊天记录</div>';
            return;
        }
        if (favoriteDetailDate) {
            // 消息列表视图: 显示该日期内收藏的聊天记录
            const dateMsgs = favMsgs.filter(m => getDateKey(m.timestamp) === favoriteDetailDate);
            $('favoriteDetailTitle').textContent = formatDateDisplay(dateMsgs[0].timestamp);
            body.innerHTML = '<div class="messages-container" id="favMsgList"></div>';
            const list = $('favMsgList');
            dateMsgs.forEach(msg => {
                const el = buildMessageEl(msg, c);
                const actions = el.querySelector('.msg-actions');
                if (actions) actions.remove();
                list.appendChild(el);
            });
        } else {
            // 日期列表视图: 按日期分组展示
            $('favoriteDetailTitle').textContent = favoriteDetailContactName;
            const dateGroups = {};
            favMsgs.forEach(msg => {
                const key = getDateKey(msg.timestamp);
                if (!dateGroups[key]) dateGroups[key] = [];
                dateGroups[key].push(msg);
            });
            const dates = Object.keys(dateGroups).sort((a, b) => b.localeCompare(a));
            let html = '<div class="me-list">';
            dates.forEach(key => {
                const count = dateGroups[key].length;
                const displayDate = formatDateDisplay(dateGroups[key][0].timestamp);
                html += `
                    <div class="me-list-item" data-date-key="${key}">
                        <div class="me-list-item-left">
                            <div class="me-list-item-icon"><svg viewBox="0 0 24 24" style="width:18px;height:18px;" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg></div>
                            <div>
                                <div class="me-list-item-title">${displayDate}</div>
                                <div style="font-size:12px;color:var(--text-light);margin-top:2px;">${count} 条收藏</div>
                            </div>
                        </div>
                        <span class="me-list-item-arrow">›</span>
                    </div>
                `;
            });
            html += '</div>';
            body.innerHTML = html;
            body.querySelectorAll('.me-list-item').forEach(el => {
                const dateKey = el.dataset.dateKey;
                let pressTimer = null;
                let longPressed = false;
                el.addEventListener('click', () => {
                    if (longPressed) { longPressed = false; return; }
                    favoriteDetailDate = dateKey;
                    renderFavoriteDetail();
                });
                el.addEventListener('contextmenu', e => {
                    e.preventDefault();
                    deleteFavDate(dateKey);
                });
                el.addEventListener('touchstart', () => {
                    longPressed = false;
                    pressTimer = setTimeout(() => {
                        longPressed = true;
                        deleteFavDate(dateKey);
                    }, 500);
                }, { passive: true });
                el.addEventListener('touchend', () => {
                    if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
                });
                el.addEventListener('touchmove', () => {
                    if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
                });
            });
        }
    }
    function deleteFavDate(dateKey) {
        pendingFavDelDate = dateKey;
        openModal('favDateDelModal');
    }
    function confirmDeleteFavDate() {
        const dateKey = pendingFavDelDate;
        pendingFavDelDate = null;
        if (!dateKey) return;
        const c = getContact(favoriteDetailContactId);
        if (c) {
            c.messages.forEach(msg => {
                if (msg.favorited && getDateKey(msg.timestamp) === dateKey) {
                    msg.favorited = false;
                }
            });
            saveData();
        }
        closeModal('favDateDelModal');
        renderFavoriteDetail();
    }

    // ================= 表情面板 =================
    function toggleEmojiPanel() {
        const panel = $('emojiPanel');
        panel.classList.toggle('hidden');
        if (!panel.classList.contains('hidden')) {
            renderEmojiGrid();
        }
    }
    function setEmojiTab(tab) {
        state.emojiTab = tab;
        $$('.emoji-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
        renderEmojiGrid();
    }
    function renderEmojiGrid() {
        const grid = $('emojiGrid');
        const patWrap = $('emojiPatWrap');
        const addWrap = $('emojiAddWrap');
        grid.innerHTML = '';
        const c = getContact(state.currentContactId);
        let items = [];
        // 拍一拍 tab: 显示自定义输入框 + 快捷短语
        if (state.emojiTab === 'pat') {
            patWrap.classList.remove('hidden');
            grid.classList.add('hidden');
            addWrap.classList.add('hidden');
            return;
        } else {
            patWrap.classList.add('hidden');
            grid.classList.remove('hidden');
        }
        grid.classList.toggle('emoji-small', true);
        const isCommon = state.emojiTab === 'common';
        const isExclusive = state.emojiTab === 'exclusive';
        addWrap.classList.toggle('hidden', !isCommon && !isExclusive);
        $('addCommonEmojiBtn').textContent = isExclusive ? '+ 添加图片' : '+ 添加';
        if (isCommon) {
            items = state.commonEmojis.map(e => ({ type: 'emoji', value: e }));
        } else if (isExclusive) {
            const list = c ? (c.settings.exclusiveEmojis || []) : [];
            items = list.map(e => ({ type: 'emoji', value: e }));
            if (items.length === 0) {
                grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:var(--text-light);padding:20px;font-size:13px;">暂无专属表情<br>点击下方「+ 添加图片」导入</div>';
                return;
            }
        }
        items.forEach((it, idx) => {
            const el = document.createElement('div');
            el.className = 'emoji-item';
            if (it.value.startsWith('data:image')) {
                el.innerHTML = `<img src="${escapeHtml(it.value)}" alt="emoji" draggable="false">`;
            } else {
                el.textContent = it.value;
            }
            if (isCommon) {
                el.classList.add('common-emoji-item');
                const delBtn = document.createElement('button');
                delBtn.className = 'emoji-del-btn';
                delBtn.innerHTML = '×';
                delBtn.addEventListener('click', e => {
                    e.stopPropagation();
                    state.commonEmojis.splice(idx, 1);
                    saveData();
                    renderEmojiGrid();
                });
                el.appendChild(delBtn);
            } else if (isExclusive) {
                el.classList.add('common-emoji-item');
                const delBtn = document.createElement('button');
                delBtn.className = 'emoji-del-btn';
                delBtn.innerHTML = '×';
                delBtn.addEventListener('click', e => {
                    e.stopPropagation();
                    c.settings.exclusiveEmojis.splice(idx, 1);
                    saveData();
                    renderEmojiGrid();
                });
                el.appendChild(delBtn);
            }
            el.addEventListener('click', () => {
                sendMessage({ type: 'emoji', content: it.value });
                $('emojiPanel').classList.add('hidden');
            });
            grid.appendChild(el);
        });
    }

    // ================= 事件绑定 =================
    function bindEvents() {
        // 头像裁剪
        bindAvatarCropEvents();
        // 页面切换
        $('backToListBtn').addEventListener('click', backToList);
        $('chatSettingBtn').addEventListener('click', () => {
            if (!state.currentContactId) return;
            const c = getContact(state.currentContactId);
            if (c && c.isGroup) {
                state.gsRemoveMode = false;
                state.gsRemoveSelected = new Set();
                renderGroupSettingPage();
                switchPage('groupSettingPage'); // 群聊进入独立的群聊设置页面
                return;
            }
            loadSettingModal();
            openModal('chatSettingModal');
        });
        // 群聊设置页返回群聊聊天界面
        $('groupSettingBackBtn').addEventListener('click', () => {
            state.gsRemoveMode = false;
            state.gsRemoveSelected = new Set();
            switchPage('chatDetailPage');
        });
        // 群聊设置页: 更换群头像
        $('groupAvatarInput').addEventListener('change', async e => {
            const f = e.target.files && e.target.files[0];
            if (!f) return;
            const b64 = await fileToBase64(f);
            if (b64) {
                openAvatarCrop(b64, 'groupEdit');
            }
            e.target.value = '';
        });
        // 群名称修改确认
        $('confirmGroupName').addEventListener('click', () => {
            const g = getContact(state.currentContactId);
            if (!g || !g.isGroup) return;
            const name = $('groupNameInput').value.trim();
            if (!name) {
                showSimpleToast('请输入群名称', 'error');
                $('groupNameInput').focus();
                return;
            }
            g.nickname = name;
            saveData();
            closeModal('groupNameModal');
            renderGroupSettingPage();
            renderChatList();
            $('detailNickname').textContent = name; // 同步聊天页顶部群名
            showSimpleToast('已保存');
        });
        // 邀请新成员确认
        $('confirmGroupInvite').addEventListener('click', handleGroupInviteSubmit);
        // 我在本群的昵称: 保存
        $('confirmGroupNickname').addEventListener('click', () => {
            const g = getContact(state.currentContactId);
            if (!g || !g.isGroup) return;
            g.groupNickname = $('groupNicknameInput').value.trim();
            saveData();
            closeModal('groupNicknameModal');
            renderGroupSettingPage();
            showSimpleToast('已保存');
        });
        // 群聊背景: 保存
        $('saveGroupBgBtn').addEventListener('click', () => {
            const g = getContact(state.currentContactId);
            if (!g || !g.isGroup) return;
            const activeBg = document.querySelector('#groupBgOptions .bg-option.active');
            if (activeBg) g.settings.chatBg = activeBg.dataset.value;
            saveData();
            applyChatBg(g);
            closeModal('groupBgModal');
            showSimpleToast('设置已保存');
        });
        // 群聊背景: 自定义上传
        $('groupCustomBgInput').addEventListener('change', async e => {
            const f = e.target.files && e.target.files[0];
            e.target.value = '';
            if (!f) return;
            const b64 = await fileToBase64(f);
            if (!b64) return;
            openAvatarCrop(b64, 'groupBg');
        });
        // 删除群聊天记录: 确认
        $('groupClearChatConfirmBtn').addEventListener('click', () => {
            const g = getContact(state.currentContactId);
            if (!g || !g.isGroup) return;
            g.messages = [];
            g.unread = 0;
            saveData();
            closeModal('groupClearChatModal');
            renderChatList();
            renderMessages();
            showSimpleToast('聊天记录已删除');
        });
        // 退出群聊: 确认
        $('groupQuitConfirmBtn').addEventListener('click', () => {
            const g = getContact(state.currentContactId);
            if (!g || !g.isGroup) return;
            closeModal('groupQuitModal');
            deleteContact(g.id);
            showSimpleToast('已退出群聊');
        });
        // 群成员页返回群聊设置页
        $('groupMembersBackBtn').addEventListener('click', () => {
            state.gmRemoveMode = false;
            state.gmRemoveSelected = new Set();
            renderGroupSettingPage();
            switchPage('groupSettingPage');
        });
        // 群成员页右上角三点: 弹出底部操作菜单 (群主为梦角时用户无法操作)
        $('groupMembersMoreBtn').addEventListener('click', () => {
            const g = getContact(state.currentContactId);
            if (g && g.isGroup && getGroupOwnerId(g) !== 'me') {
                showSimpleToast(`群主为${getGroupOwnerName(g)}，你无法操作`, 'error');
                return;
            }
            $('groupMemberSheet').classList.add('show');
        });
        // 群聊消息区: 入群申请的同意 / 拒绝按钮 (仅群主为我时显示)
        $('messagesContainer').addEventListener('click', e => {
            const btn = e.target.closest('.notice-act');
            if (!btn) return;
            respondJoinRequest(btn.dataset.msgId, btn.dataset.act);
        });
        // 底部操作菜单: 取消 / 点遮罩关闭
        $('sheetCancelBtn').addEventListener('click', () => {
            $('groupMemberSheet').classList.remove('show');
        });
        $('groupMemberSheet').addEventListener('click', e => {
            if (e.target === $('groupMemberSheet')) $('groupMemberSheet').classList.remove('show');
        });
        // 底部操作菜单: 邀请新成员
        $('sheetInviteBtn').addEventListener('click', () => {
            $('groupMemberSheet').classList.remove('show');
            initGroupInviteModal();
            openModal('groupInviteModal');
        });
        // 底部操作菜单: 移除群成员 (进入勾选模式)
        $('sheetRemoveBtn').addEventListener('click', () => {
            $('groupMemberSheet').classList.remove('show');
            state.gmRemoveMode = true;
            state.gmRemoveSelected = new Set();
            renderGroupMembersPage();
        });
        // 成员页移除模式: 取消 / 确认移除
        $('gmRemoveCancel').addEventListener('click', () => {
            state.gmRemoveMode = false;
            state.gmRemoveSelected = new Set();
            renderGroupMembersPage();
        });
        $('gmRemoveConfirm').addEventListener('click', () => removeGroupMembers(state.gmRemoveSelected, 'members'));

        // 新建 (先选择新建联系人或新建群聊)
        $('addContactBtn').addEventListener('click', () => {
            openModal('addTypeModal');
        });
        // 新建类型选择
        $('addTypeContact').addEventListener('click', () => {
            closeModal('addTypeModal');
            initAddContactModal();
            openModal('addContactModal');
        });
        $('addTypeGroup').addEventListener('click', () => {
            closeModal('addTypeModal');
            initAddGroupModal();
            openModal('addGroupModal');
        });
        $('confirmAddGroup').addEventListener('click', handleAddGroupSubmit);
        $('newGroupAvatarInput').addEventListener('change', async e => {
            const f = e.target.files && e.target.files[0];
            if (!f) return;
            const b64 = await fileToBase64(f);
            if (b64) {
                openAvatarCrop(b64, 'newGroup');
            }
            e.target.value = '';
        });
        $('confirmAddContact').addEventListener('click', handleAddContactSubmit);
        $('newAvatarInput').addEventListener('change', async e => {
            const f = e.target.files && e.target.files[0];
            if (!f) return;
            const b64 = await fileToBase64(f);
            if (b64) {
                openAvatarCrop(b64, 'new');
            }
            e.target.value = '';
        });

        // 搜索
        $('searchInput').addEventListener('input', e => renderChatList(e.target.value));

        // 顶部搜索框展开/收起
        $('searchToggleBtn').addEventListener('click', () => {
            const box = $('headerSearchBox');
            box.classList.toggle('open');
            if (box.classList.contains('open')) {
                $('searchInput').focus();
            }
        });

        // 底栏 tab 切换
        $('tabChatBtn').addEventListener('click', () => switchTab('chatListPage', 'tabChatBtn'));
        $('tabMomentsBtn').addEventListener('click', () => { switchTab('momentsPage', 'tabMomentsBtn'); renderMoments(); });
        $('tabProfileBtn').addEventListener('click', () => { switchTab('profilePage', 'tabProfileBtn'); renderProfile(); });

        // 首页
        $('homeChatCard').addEventListener('click', () => switchTab('chatListPage', 'tabChatBtn'));
        $('homeDivineCard').addEventListener('click', openDivinationPage);
        $('backToHomeBtn').addEventListener('click', () => switchPage('homePage'));

        // 数据管理
        $('dataManageBtn').addEventListener('click', () => openModal('dataManageModal'));
        $('exportDataBtn').addEventListener('click', exportData);
        $('importDataInput').addEventListener('change', e => {
            const f = e.target.files && e.target.files[0];
            if (f) importData(f);
            e.target.value = '';
        });
        $('resetDataBtn').addEventListener('click', resetData);
        $('resetDataConfirmBtn').addEventListener('click', doResetData);
        $('importDataConfirmBtn').addEventListener('click', doImportData);
        // 清空聊天记录
        $('clearChatBtn').addEventListener('click', openClearChatModal);
        $('clearChatContactList').addEventListener('click', e => {
            const item = e.target.closest('.wc-group-export-item');
            if (item) item.classList.toggle('checked');
        });
        $('clearChatNextBtn').addEventListener('click', confirmClearChatSelection);
        $('clearChatConfirmBtn').addEventListener('click', doClearChat);

        // 通用 Modal 关闭
        document.addEventListener('click', e => {
            const closeBtn = e.target.closest('[data-close]');
            if (closeBtn) {
                closeModal(closeBtn.dataset.close);
            }
            if (e.target.classList && e.target.classList.contains('modal-mask')) {
                closeAllModals();
            }
        });
        document.addEventListener('keydown', e => {
            if (e.key === 'Escape') closeAllModals();
        });

        // 聊天输入
        const input = $('messageInput');
        const autoResize = () => {
            input.style.height = 'auto';
            input.style.height = Math.min(input.scrollHeight, 100) + 'px';
        };
        input.addEventListener('input', autoResize);
        input.addEventListener('keydown', e => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendText();
            }
        });
        $('sendBtn').addEventListener('click', handleSendText);
        bindVoiceEvents();
        // 引用关闭按钮
        $('quoteCloseBtn').addEventListener('click', cancelQuote);

        // 表情
        $('emojiBtn').addEventListener('click', e => {
            e.stopPropagation();
            toggleEmojiPanel();
        });
        document.addEventListener('click', e => {
            const panel = $('emojiPanel');
            if (!panel.classList.contains('hidden')
                && Date.now() > state.emojiPanelKeepOpenUntil
                && !panel.contains(e.target)
                && !e.target.closest('#emojiBtn')
                && !e.target.closest('#commonEmojiAddModal')
                && !e.target.closest('#wcStickerCropModal')) {
                panel.classList.add('hidden');
            }
        });
        $$('.emoji-tab').forEach(b => {
            b.addEventListener('click', () => setEmojiTab(b.dataset.tab));
        });

        // 通用/专属表情: 添加按钮
        $('addCommonEmojiBtn').addEventListener('click', () => {
            if (state.emojiTab === 'exclusive') {
                // 文件选择器关闭后浏览器会触发合成点击事件, 此时间段内禁止关闭面板
                state.emojiPanelKeepOpenUntil = Date.now() + 2000;
                $('exclusiveEmojiFileInput').value = '';
                $('exclusiveEmojiFileInput').click();
            } else {
                $('commonEmojiInput').value = '';
                openModal('commonEmojiAddModal');
            }
        });
        // 通用表情: 添加确认
        $('commonEmojiAddConfirmBtn').addEventListener('click', () => {
            const val = $('commonEmojiInput').value.trim();
            if (!val) { showSimpleToast('请输入内容', 'error'); return; }
            state.commonEmojis.push(val);
            saveData();
            closeModal('commonEmojiAddModal');
            renderEmojiGrid();
            showSimpleToast('已添加');
        });

        // 拍一拍
        function sendPat(content) {
            const text = (content || '').trim();
            sendMessage({ type: 'pat', content: text });
            // 发送后关闭表情面板, 清空输入
            $('emojiPanel').classList.add('hidden');
            const pi = $('patInput');
            if (pi) pi.value = '';
        }
        // 拍一拍发送按钮
        const patSendBtn = $('patSendBtn');
        if (patSendBtn) {
            patSendBtn.addEventListener('click', () => sendPat($('patInput').value));
        }
        // 拍一拍输入框回车
        const patInput = $('patInput');
        if (patInput) {
            patInput.addEventListener('keydown', e => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    sendPat(patInput.value);
                }
            });
        }
        // 快捷短语点击
        $$('.pat-quick-item').forEach(el => {
            el.addEventListener('click', () => sendPat(el.textContent));
        });

        // 图片
        $('imageBtn').addEventListener('click', () => $('imageInput').click());
        // 视频通话
        $('videoCallBtn').addEventListener('click', () => {
            const c = getContact(state.currentContactId);
            if (!c) return;
            if (c.isGroup) {
                showSimpleToast('群聊暂不支持视频通话');
                return;
            }
            openVideoCall(c);
        });
        $('vcHangupBtn').addEventListener('click', closeVideoCall);
        // 梦角来电: 接听 / 拒绝
        $('incomingAcceptBtn').addEventListener('click', answerIncomingCall);
        $('incomingRejectBtn').addEventListener('click', rejectIncomingCall);
        $('vcImmersiveBtn').addEventListener('click', toggleVideoCallImmersive);
        $('vcBgBtn').addEventListener('click', () => $('vcBgInput').click());
        $('vcBgInput').addEventListener('change', async e => {
            const f = e.target.files && e.target.files[0];
            e.target.value = '';
            if (!f) return;
            const b64 = await fileToBase64(f);
            if (!b64) return;
            openAvatarCrop(b64, 'videoBg');
        });
        // 调整大小
        $('vcExpandBtn').addEventListener('click', e => {
            e.stopPropagation();
            $('vcSizeMenu').classList.toggle('hidden');
        });
        $$('#vcSizeMenu .vc-size-item').forEach(item => {
            item.addEventListener('click', () => {
                const size = item.dataset.size;
                const modal = $('videoCallModal');
                modal.classList.remove('vc-size-mini', 'vc-size-small', 'vc-size-standard', 'vc-size-large');
                modal.classList.add('vc-size-' + size);
                // 清除自由拖动设置的内联样式
                modal.style.width = '';
                modal.style.height = '';
                modal.style.zoom = '';
                modal.style.left = '';
                modal.style.top = '';
                // 重置为居中
                const mask = $('videoCallMask');
                const rect = mask.getBoundingClientRect();
                const w = modal.offsetWidth;
                const h = modal.offsetHeight;
                modal.style.left = (rect.left + (rect.width - w) / 2) + 'px';
                modal.style.top = (rect.top + (rect.height - h) / 2) + 'px';
                $$('#vcSizeMenu .vc-size-item').forEach(i => i.classList.remove('active'));
                item.classList.add('active');
                $('vcSizeMenu').classList.add('hidden');
            });
        });
        // 点击弹窗其他区域关闭尺寸菜单
        $('videoCallModal').addEventListener('click', e => {
            if (!e.target.closest('#vcSizeMenu') && !e.target.closest('#vcExpandBtn')) {
                $('vcSizeMenu').classList.add('hidden');
            }
        });
        // 最小化
        $('vcMinimizeBtn').addEventListener('click', () => {
            $('videoCallMask').classList.remove('show');
            $('vcPill').classList.remove('hidden');
        });
        // 胶囊点击恢复
        $('vcPill').addEventListener('click', e => {
            if (e.target.closest('#vcPillHangup')) return;
            if ($('vcPill').dataset.moved === '1') {
                $('vcPill').dataset.moved = '';
                return;
            }
            $('vcPill').classList.add('hidden');
            $('videoCallMask').classList.add('show');
        });
        // 胶囊挂断
        $('vcPillHangup').addEventListener('click', e => {
            e.stopPropagation();
            closeVideoCall();
            $('vcPill').classList.add('hidden');
        });
        // 胶囊拖动
        (function() {
            const pill = $('vcPill');
            let dragging = false, startX, startY, origLeft, origTop;
            pill.addEventListener('mousedown', e => {
                if (e.target.closest('#vcPillHangup')) return;
                dragging = true;
                pill.dataset.moved = '';
                const rect = pill.getBoundingClientRect();
                startX = e.clientX; startY = e.clientY;
                origLeft = rect.left; origTop = rect.top;
                pill.style.left = origLeft + 'px';
                pill.style.top = origTop + 'px';
                e.preventDefault();
            });
            document.addEventListener('mousemove', e => {
                if (!dragging) return;
                const dx = e.clientX - startX;
                const dy = e.clientY - startY;
                if (Math.abs(dx) > 3 || Math.abs(dy) > 3) pill.dataset.moved = '1';
                pill.style.left = (origLeft + dx) + 'px';
                pill.style.top = (origTop + dy) + 'px';
            });
            document.addEventListener('mouseup', () => {
                dragging = false;
            });
        })();
        // 弹窗拖动
        (function() {
            const modal = $('videoCallModal');
            let dragging = false, startX, startY, origLeft, origTop;
            function dragStart(x, y, target) {
                if (target.closest('.vc-resize-handle') || target.closest('button') || target.closest('input')) return false;
                dragging = true;
                startX = x; startY = y;
                origLeft = parseFloat(modal.style.left) || 0;
                origTop = parseFloat(modal.style.top) || 0;
                return true;
            }
            function dragMove(x, y) {
                if (!dragging) return;
                // 钳制在视口内, 防止弹窗被拖出屏幕
                const maxLeft = Math.max(0, window.innerWidth - modal.offsetWidth);
                const maxTop = Math.max(0, window.innerHeight - modal.offsetHeight);
                modal.style.left = Math.max(0, Math.min(origLeft + x - startX, maxLeft)) + 'px';
                modal.style.top = Math.max(0, Math.min(origTop + y - startY, maxTop)) + 'px';
            }
            modal.addEventListener('mousedown', e => {
                if (dragStart(e.clientX, e.clientY, e.target)) e.preventDefault();
            });
            document.addEventListener('mousemove', e => dragMove(e.clientX, e.clientY));
            document.addEventListener('mouseup', () => { dragging = false; });
            // 触屏拖动支持
            modal.addEventListener('touchstart', e => {
                if (dragStart(e.touches[0].clientX, e.touches[0].clientY, e.target)) e.preventDefault();
            }, { passive: false });
            document.addEventListener('touchmove', e => {
                if (!dragging) return;
                e.preventDefault();
                dragMove(e.touches[0].clientX, e.touches[0].clientY);
            }, { passive: false });
            document.addEventListener('touchend', () => { dragging = false; });
        })();
        // 弹窗 resize
        (function() {
            const handle = $('vcResizeHandle');
            const modal = $('videoCallModal');
            const MIN_W = 140;
            const MIN_H = 220;
            let resizing = false, startX, startY, startW, startH;
            function resizeStart(x, y) {
                resizing = true;
                startX = x; startY = y;
                const rect = modal.getBoundingClientRect();
                startW = rect.width; startH = rect.height;
            }
            function resizeMove(x, y) {
                if (!resizing) return;
                // 尺寸钳制在视口内
                const newW = Math.max(MIN_W, Math.min(startW + x - startX, window.innerWidth - 8));
                const newH = Math.max(MIN_H, Math.min(startH + y - startY, window.innerHeight - 8));
                modal.style.width = newW + 'px';
                modal.style.height = newH + 'px';
            }
            handle.addEventListener('mousedown', e => {
                resizeStart(e.clientX, e.clientY);
                e.preventDefault();
                e.stopPropagation();
            });
            document.addEventListener('mousemove', e => resizeMove(e.clientX, e.clientY));
            document.addEventListener('mouseup', () => { resizing = false; });
            // 触屏 resize 支持
            handle.addEventListener('touchstart', e => {
                resizeStart(e.touches[0].clientX, e.touches[0].clientY);
                e.preventDefault();
                e.stopPropagation();
            }, { passive: false });
            document.addEventListener('touchmove', e => {
                if (!resizing) return;
                e.preventDefault();
                resizeMove(e.touches[0].clientX, e.touches[0].clientY);
            }, { passive: false });
            document.addEventListener('touchend', () => { resizing = false; });
        })();
        $('imageInput').addEventListener('change', async e => {
            const f = e.target.files && e.target.files[0];
            e.target.value = '';
            if (!f) return;
            const b64 = await fileToBase64(f);
            if (b64) sendMessage({ type: 'image', content: b64 });
        });

        // 聊天设置内部
        $('saveBgBtn').addEventListener('click', saveBgSetting);
        $('saveReplyBtn').addEventListener('click', saveReplySetting);
        $('saveContactBtn').addEventListener('click', saveContactInfo);
        $('deleteContactBtn').addEventListener('click', () => {
            const c = getContact(state.currentContactId);
            if (!c) return;
            $('delContactHint').textContent = `删除联系人「${c.nickname}」后，所有聊天记录将一并删除且无法恢复。`;
            openModal('delContactModal');
        });
        $('delContactConfirmBtn').addEventListener('click', () => {
            const c = getContact(state.currentContactId);
            if (!c) return;
            closeModal('delContactModal');
            closeModal('chatSettingModal');
            deleteContact(c.id);
            showSimpleToast('已删除');
        });
        // 设置卡片点击
        $$('.settings-card').forEach(card => {
            card.addEventListener('click', () => {
                const target = card.dataset.open;
                if (target === 'wordcard') {
                    openWordcardPage();
                } else if (target === 'bg') {
                    loadSettingModal();
                    openModal('chatBgModal');
                } else if (target === 'reply') {
                    loadSettingModal();
                    openModal('replySettingModal');
                } else if (target === 'contact') {
                    loadSettingModal();
                    openModal('contactInfoModal');
                }
            });
        });
        $('autoSendSwitch').addEventListener('change', e => {
            $('autoIntervalWrap').style.display = e.target.checked ? 'block' : 'none';
        });
        $('soundEnabledSwitch').addEventListener('change', e => {
            $('soundOptionsWrap').style.display = e.target.checked ? 'block' : 'none';
        });
        $('editAvatarInput').addEventListener('change', async e => {
            const f = e.target.files && e.target.files[0];
            if (!f) return;
            const b64 = await fileToBase64(f);
            if (b64) {
                openAvatarCrop(b64, 'edit');
            }
            e.target.value = '';
        });
        $('meAvatarInput').addEventListener('change', async e => {
            const f = e.target.files && e.target.files[0];
            if (!f) return;
            const b64 = await fileToBase64(f);
            if (b64) {
                openAvatarCrop(b64, 'me');
            }
            e.target.value = '';
        });
        $('saveMeBtn').addEventListener('click', saveMeProfile);
        $('customBgInput').addEventListener('change', async e => {
            const f = e.target.files && e.target.files[0];
            e.target.value = '';
            if (!f) return;
            const b64 = await fileToBase64(f);
            if (!b64) return;
            openAvatarCrop(b64, 'bg');
        });
        // 气泡颜色取色器: 选色后清除预设色块的选中态
        ['sent', 'received'].forEach(target => {
            const picker = $(target + 'ColorPicker');
            if (picker) {
                picker.addEventListener('input', () => {
                    $$('.bubble-color-option', $(target + 'ColorOptions')).forEach(o => o.classList.remove('active'));
                });
            }
        });
        $('saveWordcardBtn').addEventListener('click', () => {
            if (state._interactionTab) {
                saveInteractionItem();
            } else {
                saveWordcard();
            }
        });

        // 语音条文件选择: 点击按钮 → 触发 file input
        $('wcVoiceFileBtn').addEventListener('click', () => {
            $('wcVoiceFileInput').value = '';
            $('wcVoiceFileInput').click();
        });
        $('wcVoiceFileInput').addEventListener('change', e => {
            handleVoiceFileInput(e.target.files);
        });
        // 语音条文件列表: 删除单条
        $('wcVoiceFileList').addEventListener('click', e => {
            const delBtn = e.target.closest('[data-voice-file-idx]');
            if (!delBtn) return;
            const idx = parseInt(delBtn.dataset.voiceFileIdx, 10);
            if (!isNaN(idx) && state._voiceSelectedFiles) {
                state._voiceSelectedFiles.splice(idx, 1);
                renderVoiceFileList();
            }
        });

        // 分组选择器: 按钮切换展开
        $('wcGroupPickerBtn').addEventListener('click', () => {
            const panel = $('wcGroupPickerPanel');
            const btn = $('wcGroupPickerBtn');
            const open = !panel.hidden;
            panel.hidden = open;
            btn.classList.toggle('active', !open);
        });
        // 分组选择器: 点击标签选中
        $('wcGroupPickerPanel').addEventListener('click', e => {
            const tag = e.target.closest('.wc-group-tag');
            if (!tag) return;
            state.wcBatchGroupId = tag.dataset.gid || '';
            if (state._interactionTab) {
                refreshInteractionGroupSelect(state._interactionTab);
            } else {
                refreshWcGroupSelect();
            }
            // 面板保持展开 (不收起)
        });

        // ===== 互动: 拍一拍 / 语音条 / 对方状态 事件 =====
        // 内容列表事件委托: 屏蔽/分组/编辑/删除
        ['wcPatGroupList', 'wcVoiceGroupList', 'wcConfessionGroupList', 'wcStatusGroupList'].forEach(listId => {
            $(listId).addEventListener('click', e => {
                const tab = listId === 'wcPatGroupList' ? 'pat' : (listId === 'wcVoiceGroupList' ? 'voice' : (listId === 'wcConfessionGroupList' ? 'confession' : 'status'));
                const cfg = getInteractionConfig(tab);
                const c = getContact(state.currentContactId);
                if (!c) return;
                ensureWordcardStructs(c);
                const editGroupBtn = e.target.closest('[data-action="edit-inter-group"]');
                if (editGroupBtn) {
                    const gid = editGroupBtn.dataset.groupId;
                    state._interactionGroupTab = tab;
                    openWcCreateGroupModal(gid, cfg.groupKey);
                    return;
                }
                // 语音条: 点击卡片播放音频
                const playVoiceBtn = e.target.closest('[data-action="play-voice"]');
                if (playVoiceBtn) {
                    const id = playVoiceBtn.dataset.itemId;
                    const it = c.settings[cfg.dataKey].find(x => x.id === id);
                    if (it && it.content) {
                        playAudioBubble(playVoiceBtn, it.content);
                    }
                    return;
                }
                // 语音条批量: 分组内全选
                const voiceSelGroupBtn = e.target.closest('[data-action="voice-select-group"]');
                if (voiceSelGroupBtn) {
                    const key = voiceSelGroupBtn.dataset.groupKey;
                    let groupCards;
                    if (key === '__ungrouped__') {
                        groupCards = (c.settings[cfg.dataKey] || []).filter(it => !it.groupId);
                    } else {
                        groupCards = (c.settings[cfg.dataKey] || []).filter(it => it.groupId === key);
                    }
                    const allSel = groupCards.every(it => state.wcVoiceSelectedIds.has(it.id));
                    if (allSel) {
                        groupCards.forEach(it => state.wcVoiceSelectedIds.delete(it.id));
                    } else {
                        groupCards.forEach(it => state.wcVoiceSelectedIds.add(it.id));
                    }
                    renderInteractionPage();
                    return;
                }
                // 语音条批量: 勾选单条
                const voiceToggleBox = e.target.closest('[data-action="voice-toggle-card"]');
                if (voiceToggleBox) {
                    const id = voiceToggleBox.dataset.itemId;
                    if (state.wcVoiceSelectedIds.has(id)) {
                        state.wcVoiceSelectedIds.delete(id);
                    } else {
                        state.wcVoiceSelectedIds.add(id);
                    }
                    renderInteractionPage();
                    return;
                }
                // 点击分组行 → 展开/收起
                const groupRow = e.target.closest('.wc-group-row');
                if (groupRow) {
                    const key = groupRow.dataset.groupKey;
                    if (key) {
                        state.wcExpandedGroups[key] = !state.wcExpandedGroups[key];
                        renderInteractionPage();
                    }
                    return;
                }
                const blockBtn = e.target.closest('[data-action="block-interaction"]');
                if (blockBtn) {
                    const id = blockBtn.dataset.itemId;
                    const it = c.settings[cfg.dataKey].find(x => x.id === id);
                    if (it) {
                        it.blocked = !it.blocked;
                        saveData();
                        renderInteractionPage();
                        showSimpleToast(it.blocked ? '已屏蔽' : '已取消屏蔽');
                    }
                    return;
                }
                const groupBtn = e.target.closest('[data-action="group-interaction"]');
                if (groupBtn) {
                    state.wcOperatingCardId = groupBtn.dataset.itemId;
                    state._interactionTab = tab;
                    openCardGroupModal();
                    return;
                }
                const editBtn = e.target.closest('[data-action="edit-interaction"]');
                if (editBtn) {
                    const id = editBtn.dataset.itemId;
                    const items = c.settings[cfg.dataKey];
                    const idx = items.findIndex(x => x.id === id);
                    if (idx >= 0) {
                        // 语音条走 wordcardModal, 重新选择 MP3 替换
                        if (tab === 'voice') {
                            openInteractionModal(tab, items, idx);
                        } else {
                            state.wcOperatingCardId = id;
                            state._interactionTab = tab;
                            $('wcCardEditText').value = items[idx].content || '';
                            openModal('wcCardEditModal');
                        }
                    }
                    return;
                }
                const delBtn = e.target.closest('[data-action="del-interaction"]');
                if (delBtn) {
                    state.wcOperatingCardId = delBtn.dataset.itemId;
                    state._interactionTab = tab;
                    openModal('wcCardDelModal');
                    return;
                }
            });
        });
        // 工具栏按键事件 (拍一拍 / 语音条 / 对方状态)
        document.querySelectorAll('#wcInteractionContent .wc-tool-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const action = btn.dataset.action;
                const tab = action.startsWith('pat-') ? 'pat' : (action.startsWith('voice-') ? 'voice' : (action.startsWith('confession-') ? 'confession' : 'status'));
                const cfg = getInteractionConfig(tab);
                if (action.endsWith('-search')) {
                    const bar = $(cfg.searchBarId);
                    const input = $(cfg.searchInputId);
                    if (!bar.hidden) {
                        bar.hidden = true;
                        input.value = '';
                        state[cfg.searchKeyword] = '';
                        renderInteractionPage();
                    } else {
                        bar.hidden = false;
                        setTimeout(() => input.focus(), 50);
                    }
                } else if (action.endsWith('-group')) {
                    openInteractionGroupModal(tab);
                } else if (action.endsWith('-sort')) {
                    interactionDedupe(tab);
                } else if (action === 'voice-batch') {
                    // 语音条批量管理
                    state.wcVoiceBatchMode = !state.wcVoiceBatchMode;
                    if (!state.wcVoiceBatchMode) state.wcVoiceSelectedIds.clear();
                    btn.classList.toggle('active', state.wcVoiceBatchMode);
                    renderInteractionPage();
                } else if (action.endsWith('-search-close')) {
                    const bar = $(cfg.searchBarId);
                    const input = $(cfg.searchInputId);
                    bar.hidden = true;
                    input.value = '';
                    state[cfg.searchKeyword] = '';
                    renderInteractionPage();
                }
            });
        });
        // 搜索框关闭按钮 (拍一拍 / 语音条 / 对方状态)
        document.querySelectorAll('#wcInteractionContent .wc-search-close').forEach(btn => {
            btn.addEventListener('click', () => {
                const action = btn.dataset.action;
                const tab = action.startsWith('pat-') ? 'pat' : (action.startsWith('voice-') ? 'voice' : (action.startsWith('confession-') ? 'confession' : 'status'));
                const cfg = getInteractionConfig(tab);
                const bar = $(cfg.searchBarId);
                const input = $(cfg.searchInputId);
                bar.hidden = true;
                input.value = '';
                state[cfg.searchKeyword] = '';
                renderInteractionPage();
            });
        });
        // 搜索输入实时过滤
        $('wcPatSearchInput').addEventListener('input', () => {
            state.wcPatSearchKeyword = $('wcPatSearchInput').value;
            renderInteractionPage();
        });
        $('wcStatusSearchInput').addEventListener('input', () => {
            state.wcStatusSearchKeyword = $('wcStatusSearchInput').value;
            renderInteractionPage();
        });
        $('wcVoiceSearchInput').addEventListener('input', () => {
            state.wcVoiceSearchKeyword = $('wcVoiceSearchInput').value;
            renderInteractionPage();
        });
        $('wcConfessionSearchInput').addEventListener('input', () => {
            state.wcConfessionSearchKeyword = $('wcConfessionSearchInput').value;
            renderInteractionPage();
        });
        // 分组管理弹窗: 编辑/删除分组
        $('wcGroupListEditor').addEventListener('click', e => {
            const tab = state._interactionGroupTab;
            if (!tab) return;
            const cfg = getInteractionConfig(tab);
            const c = getContact(state.currentContactId);
            if (!c) return;
            const editBtn = e.target.closest('[data-action="edit-inter-group"]');
            if (editBtn) {
                const gid = editBtn.dataset.groupId;
                openWcCreateGroupModal(gid, cfg.groupKey);
                return;
            }
            const delBtn = e.target.closest('[data-action="del-inter-group"]');
            if (delBtn) {
                const gid = delBtn.dataset.groupId;
                const g = c.settings[cfg.groupKey].find(x => x.id === gid);
                if (!g) return;
                const inGroup = (c.settings[cfg.dataKey] || []).filter(it => it.groupId === gid).length;
                if (!confirm(`删除分组「${g.name}」并同时删除分组内 ${inGroup} 条内容？`)) return;
                c.settings[cfg.groupKey] = c.settings[cfg.groupKey].filter(x => x.id !== gid);
                c.settings[cfg.dataKey] = (c.settings[cfg.dataKey] || []).filter(it => it.groupId !== gid);
                if (state[cfg.filterGroupId] === gid) state[cfg.filterGroupId] = '';
                if (state.wcExpandedGroups) delete state.wcExpandedGroups[gid];
                saveData();
                renderInteractionGroupEditorList(tab);
                renderInteractionPage();
                showSimpleToast('分组已删除');
                return;
            }
        });

        // 字卡管理独立页面
        $('wcCloseBtn').addEventListener('click', closeWordcardPage);
        $('wordcardPageMask').addEventListener('click', e => {
            if (e.target.id === 'wordcardPageMask') closeWordcardPage();
        });

        // 问卷管理独立页面: 事件委托
        $('surveyPageMask').addEventListener('click', e => {
            if (e.target.id === 'surveyPageMask') closeSurveyPage();
        });
        // 收藏页面: 返回按钮
        $('favoritesBackBtn').addEventListener('click', closeFavoritesPage);
        // 信箱页面: 返回按钮
        $('mailboxBackBtn').addEventListener('click', closeMailboxPage);
        // 寄出的信页面: 返回按钮
        $('mailboxSentBackBtn').addEventListener('click', closeMailboxSentPage);
        // 写信页面: 返回按钮
        $('mailboxWriteBackBtn').addEventListener('click', closeMailboxWritePage);
        // 收到的回信页面: 返回按钮
        $('mailboxReceivedBackBtn').addEventListener('click', closeMailboxReceivedPage);
        // 他的来信页面: 返回按钮
        $('mailboxHisBackBtn').addEventListener('click', closeMailboxHisPage);
        // 我的回信页面: 返回按钮
        $('mailboxMineBackBtn').addEventListener('click', closeMailboxMinePage);
        // 回信编辑页: 返回按钮
        $('mailboxReplyWriteBackBtn').addEventListener('click', closeMailboxReplyWritePage);
        // 用户朋友圈页面: 返回按钮 + 发表占位
        $('userMomentsBackBtn').addEventListener('click', e => { e.stopPropagation(); switchPage('momentsPage'); });
        $('userMomentsPublishBtn').addEventListener('click', () => {
            state.momentsEditFrom = 'userMomentsPage';
            state.momentsEditImages = [];
            renderMomentsEditImages();
            switchPage('momentsEditPage');
        });
        $('userMomentsSearchBtn').addEventListener('click', e => { e.stopPropagation(); openMomentsSearch(); });
        // 朋友圈搜索页
        $('momentsSearchCancelBtn').addEventListener('click', () => switchPage('userMomentsPage'));
        $('momentsSearchInput').addEventListener('input', e => {
            const val = e.target.value;
            state.momentsSearchKeyword = val;
            $('momentsSearchClearBtn').style.display = val ? 'block' : 'none';
            renderMomentsSearchResults();
        });
        $('momentsSearchClearBtn').addEventListener('click', () => {
            const input = $('momentsSearchInput');
            input.value = '';
            state.momentsSearchKeyword = '';
            $('momentsSearchClearBtn').style.display = 'none';
            renderMomentsSearchResults();
            input.focus();
        });
        $('momentsSearchResults').addEventListener('click', e => {
            const hideBtn = e.target.closest('.ms-hide-btn');
            if (hideBtn) {
                e.stopPropagation();
                const mid = hideBtn.dataset.mid;
                if (mid) momentsSearchHidden.add(mid);
                renderMomentsSearchResults();
                return;
            }
            if (e.target.closest('img')) return; // 图片点击由自身 onclick 处理
            const item = e.target.closest('.ms-item');
            if (item && item.dataset.mid) openMomentsDetail(item.dataset.mid);
        });
        $('userMomentsInteractBtn').addEventListener('click', e => { e.stopPropagation(); openMomentsInteractPage(); });
        // 互动消息页
        $('momentsInteractBackBtn').addEventListener('click', () => switchPage('userMomentsPage'));
        $('momentsInteractList').addEventListener('click', e => {
            const item = e.target.closest('.mi-item');
            if (!item || !item.dataset.mid) return;
            if (!findMomentAnywhere(item.dataset.mid)) return;
            openMomentsDetail(item.dataset.mid, true);
        });
        // 朋友圈聚合页按钮
        $('momentsFeedBackBtn').addEventListener('click', e => { e.stopPropagation(); switchPage('momentsPage'); });
        // 封面点击展开/收起 + 换封面
        $('momentsFeedCover').addEventListener('click', () => {
            $('momentsFeedCover').classList.toggle('expanded');
        });
        $('momentsFeedChangeCoverBtn').addEventListener('click', e => {
            e.stopPropagation();
            state.umContactId = null;
            $('momentsFeedCoverInput').click();
        });
        $('momentsFeedCoverInput').addEventListener('change', e => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = ev => openAvatarCrop(ev.target.result, 'cover');
            reader.readAsDataURL(file);
            e.target.value = '';
        });
        // 聚合页评论弹窗
        $('momentsFeedCommentModal').addEventListener('click', e => {
            if (e.target.id === 'momentsFeedCommentModal') {
                $('momentsFeedCommentModal').classList.remove('show');
                feedReplyToId = null;
                feedCommentImage = null;
                renderFeedCommentPreview();
                const input = $('momentsFeedCommentInput');
                if (input) input.placeholder = '发表评论...';
            }
        });
        $('momentsFeedCommentSendBtn').addEventListener('click', () => {
            const input = $('momentsFeedCommentInput');
            if (!input || !feedCommentMomentId) return;
            const text = input.value.trim();
            if (!text && !feedCommentImage) return;
            const m = findMomentAnywhere(feedCommentMomentId);
            if (!m) return;
            if (!m.comments) m.comments = [];
            const now = new Date();
            const timeStr = `${now.getMonth() + 1}月${now.getDate()}日 ${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;
            const newComment = { text, contactId: null, timeStr, createdAt: now.getTime() };
            if (feedReplyToId) newComment.replyToContactId = feedReplyToId;
            if (feedCommentImage) newComment.image = feedCommentImage;
            m.comments.push(newComment);
            // 用户回复梦角评论: 50% 概率该梦角在 0~10 分钟内随机时间回复
            if (feedReplyToId && Math.random() < 0.5) {
                state.momentSchedules.push({
                    id: uuid(),
                    type: 'reply',
                    momentId: feedCommentMomentId,
                    contactId: feedReplyToId,
                    at: Date.now() + Math.floor(Math.random() * 10 * 60 * 1000),
                    done: false
                });
            }
            saveData();
            renderMomentsFeed();
            $('momentsFeedCommentModal').classList.remove('show');
            feedReplyToId = null;
            feedCommentImage = null;
            renderFeedCommentPreview();
            input.placeholder = '发表评论...';
        });
        $('momentsFeedCommentInput').addEventListener('keydown', e => {
            if (e.key === 'Enter') {
                e.preventDefault();
                $('momentsFeedCommentSendBtn').click();
            }
        });
        // 聚合页评论表情按钮
        $('momentsFeedEmojiBtn').addEventListener('click', e => {
            e.stopPropagation();
            const modal = $('momentsFeedEmojiModal');
            if (modal.classList.contains('show')) {
                modal.classList.remove('show');
            } else {
                feedEmojiTab = 'common';
                $$('.moment-feed-emoji-panel .emoji-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === 'common'));
                renderFeedEmojiGrid();
                modal.classList.add('show');
            }
        });
        // 聚合页评论表情面板：点击背景关闭
        $('momentsFeedEmojiModal').addEventListener('click', e => {
            if (e.target.id === 'momentsFeedEmojiModal') {
                $('momentsFeedEmojiModal').classList.remove('show');
            }
        });
        // 聚合页评论表情面板：选项卡切换
        $$('.moment-feed-emoji-panel .emoji-tab').forEach(btn => {
            btn.addEventListener('click', () => {
                feedEmojiTab = btn.dataset.tab;
                $$('.moment-feed-emoji-panel .emoji-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === feedEmojiTab));
                renderFeedEmojiGrid();
            });
        });
        // 聚合页评论图片按钮
        $('momentsFeedImgBtn').addEventListener('click', e => {
            e.stopPropagation();
            $('feedCommentFileInput').value = '';
            $('feedCommentFileInput').click();
        });
        $('feedCommentFileInput').addEventListener('change', e => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = ev => openAvatarCrop(ev.target.result, 'feedComment');
            reader.readAsDataURL(file);
        });
        // 聚合页评论删除小卡片
        $('feedCommentDelBtn').addEventListener('click', () => {
            if (!feedDelTarget) return;
            const m = findMomentAnywhere(feedDelTarget.momentId);
            if (m && m.comments) {
                m.comments.splice(feedDelTarget.cIdx, 1);
                saveData();
                renderMomentsFeed();
            }
            $('feedCommentDelCard').style.display = 'none';
            feedDelTarget = null;
        });
        document.addEventListener('click', e => {
            const card = $('feedCommentDelCard');
            if (card && card.style.display === 'block' && !card.contains(e.target)) {
                card.style.display = 'none';
                feedDelTarget = null;
            }
        });
        // 封面点击展开/收起 + 换封面
        $('userMomentsCover').addEventListener('click', () => {
            $('userMomentsCover').classList.toggle('expanded');
        });
        $('userMomentsChangeCoverBtn').addEventListener('click', e => {
            e.stopPropagation();
            $('userMomentsCoverInput').click();
        });
        $('userMomentsCoverInput').addEventListener('change', e => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = ev => openAvatarCrop(ev.target.result, 'cover');
            reader.readAsDataURL(file);
            e.target.value = '';
        });
        // 朋友圈编辑页面: 取消返回 + 发表/添加/选项占位
        $('momentsEditCancelBtn').addEventListener('click', () => {
            const returnTo = state.momentsEditFrom || 'userMomentsPage';
            state.momentsEditFrom = null;
            switchPage(returnTo);
            if (returnTo === 'momentsFeedPage') renderMomentsFeed();
        });
        $('momentsEditPublishBtn').addEventListener('click', publishMoment);
        $('momentsEditAddBtn').addEventListener('click', () => $('momentsEditFileInput').click());
        $('momentsEditFileInput').addEventListener('change', (e) => {
            const files = Array.from(e.target.files);
            if (!files.length) return;
            let pending = files.length;
            files.forEach(file => {
                const reader = new FileReader();
                reader.onload = (ev) => {
                    state.momentsEditImages.push(ev.target.result);
                    if (--pending === 0) renderMomentsEditImages();
                };
                reader.readAsDataURL(file);
            });
            e.target.value = '';
        });
        $('momentsEditLocationBtn').addEventListener('click', () => showSimpleToast('功能开发中'));
        $('momentsEditRemindBtn').addEventListener('click', () => openRemindPage());
        // 朋友圈图片浏览弹窗
        $('momentsViewerBackBtn').addEventListener('click', closeMomentsViewer);
        $('momentsViewerLikeBtn').addEventListener('click', toggleMomentLike);
        $('momentsViewerCommentBtn').addEventListener('click', () => {
            renderMomentsCommentList();
            closeMomentsViewer();
            switchPage('momentsCommentPage');
        });
        $('momentsViewerDetailBtn').addEventListener('click', () => {
            const mid = mvMoment ? mvMoment.id : null;
            closeMomentsViewer();
            if (mid) openMomentsDetail(mid);
        });
        // 弹窗触摸/鼠标滑动
        let mvTouchX = 0, mvMouseX = 0, mvIsMouse = false;
        const mvBody = $('momentsViewerBody');
        mvBody.addEventListener('touchstart', e => { mvTouchX = e.touches[0].clientX; });
        mvBody.addEventListener('touchend', e => {
            const diff = e.changedTouches[0].clientX - mvTouchX;
            if (Math.abs(diff) > 50) mvSlide(diff > 0 ? -1 : 1);
            else closeMomentsViewer();
        });
        mvBody.addEventListener('mousedown', e => { mvMouseX = e.clientX; mvIsMouse = true; });
        document.addEventListener('mousemove', e => { if (mvIsMouse) {} });
        document.addEventListener('mouseup', e => {
            if (!mvIsMouse) return;
            mvIsMouse = false;
            const diff = e.clientX - mvMouseX;
            if (Math.abs(diff) > 50) mvSlide(diff > 0 ? -1 : 1);
            else closeMomentsViewer();
        });
        // 详情页面
        $('momentsDetailBackBtn').addEventListener('click', () => {
            if (state.momentsInteractBack) {
                state.momentsInteractBack = false;
                openMomentsInteractPage();
            } else {
                switchPage('userMomentsPage');
            }
        });
        $('momentsDetailMoreBtn').addEventListener('click', () => showSimpleToast('功能开发中'));
        $('momentsDetailSendBtn').addEventListener('click', () => {
            const input = $('momentsDetailCommentInput');
            if (!input || !input.value.trim()) return;
            addMomentComment(input.value);
            input.value = '';
            if (mvMoment) openMomentsDetail(mvMoment.id, state.momentsInteractBack);
        });
        // 评论页面
        $('momentsCommentBackBtn').addEventListener('click', () => {
            if (mvMoment) openMomentsViewer(mvMoment.id, mvIndex);
            else switchPage('userMomentsPage');
        });
        $('momentsCommentSendBtn').addEventListener('click', () => {
            const input = $('momentsCommentInput');
            if (!input || !input.value.trim()) return;
            addMomentComment(input.value);
            input.value = '';
            if (mvMoment) openMomentsViewer(mvMoment.id, mvIndex);
            else switchPage('userMomentsPage');
        });
        // 提醒谁看页面: 返回 + 确定 + 搜索
        $('remindBackBtn').addEventListener('click', () => switchPage('momentsEditPage'));
        $('remindConfirmBtn').addEventListener('click', confirmRemindSelect);
        $('remindSearchInput').addEventListener('input', (e) => {
            state.remindSearchKeyword = e.target.value;
            renderRemindPage();
        });
        $('momentsEditVisibleBtn').addEventListener('click', () => { switchPage('visiblePage'); renderVisiblePage(); });
        // 谁可以看页面: 返回 + 完成
        $('visibleBackBtn').addEventListener('click', () => switchPage('momentsEditPage'));
        $('visibleConfirmBtn').addEventListener('click', () => {
            if ($('visibleConfirmBtn').classList.contains('disabled')) return;
            confirmVisibleSelect();
        });
        // 图片浏览弹窗: 返回 + 删除 + 滑动
        $('imageViewerBackBtn').addEventListener('click', closeMomentsEditImageViewer);
        $('imageViewerDeleteBtn').addEventListener('click', deleteMomentsEditImage);
        (function() {
            var startX = 0, curX = 0, dragging = false;
            var body = $('imageViewerBody');
            function startDrag(x) {
                startX = x;
                dragging = true;
                $('imageViewerSlider').style.transition = 'none';
            }
            function moveDrag(x) {
                if (!dragging) return;
                curX = x;
                var diff = curX - startX;
                var idx = state.momentsEditImageViewerIndex;
                $('imageViewerSlider').style.transform = 'translateX(calc(-' + idx * 100 + '% + ' + diff + 'px))';
            }
            function endDrag() {
                if (!dragging) return;
                dragging = false;
                $('imageViewerSlider').style.transition = '';
                var diff = curX - startX;
                var threshold = 50;
                if (diff < -threshold && state.momentsEditImageViewerIndex < state.momentsEditImages.length - 1) {
                    state.momentsEditImageViewerIndex++;
                } else if (diff > threshold && state.momentsEditImageViewerIndex > 0) {
                    state.momentsEditImageViewerIndex--;
                }
                renderMomentsEditImageViewer();
            }
            // 触摸事件
            body.addEventListener('touchstart', function(e) { startDrag(e.touches[0].clientX); });
            body.addEventListener('touchmove', function(e) { moveDrag(e.touches[0].clientX); });
            body.addEventListener('touchend', endDrag);
            // 鼠标事件
            body.addEventListener('mousedown', function(e) { startDrag(e.clientX); });
            document.addEventListener('mousemove', function(e) { if (dragging) moveDrag(e.clientX); });
            document.addEventListener('mouseup', function() { if (dragging) endDrag(); });
        })();
        // 占卜入口页面: 返回按钮
        $('divinationBackBtn').addEventListener('click', closeDivinationPage);
        // 占卜入口: 雷诺曼 / 塔罗
        $('lenormandEntryBtn').addEventListener('click', openLenormandPage);
        $('tarotEntryBtn').addEventListener('click', openTarotPage);
        // 雷诺曼页面: 返回 + 抽牌
        $('lenormandBackBtn').addEventListener('click', closeLenormandPage);
        $('lenormandDrawBtn').addEventListener('click', handleLenormandDraw);
        // 雷诺曼抽牌数量切换
        $$('.len-count-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                $$('.len-count-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                lenormandSelectedCount = parseInt(btn.dataset.count, 10);
                $('lenormandCountHint').textContent = lenormandSelectedCount === 1 ? '单张牌 · 直达答案' : '三张牌 · 洞察全局';
            });
        });
        // 塔罗页面: 返回 + 抽牌
        $('tarotBackBtn').addEventListener('click', closeTarotPage);
        $('tarotDrawBtn').addEventListener('click', handleTarotDraw);
        // 塔罗牌阵选择切换
        $$('.tarot-count-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                $$('.tarot-count-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                tarotSelectedCount = parseInt(btn.dataset.count, 10);
                $('tarotCountHint').textContent = tarotSelectedCount === 1 ? '单张牌 · 直指当下' : '三张牌 · 洞察全局';
            });
        });
        // 收藏详情页面: 返回按钮
        $('favoriteDetailBackBtn').addEventListener('click', closeFavoriteDetailPage);
        // 新建问卷命名弹窗: 确定
        $('confirmSurveyName').addEventListener('click', confirmAddSurvey);
        $('surveyNameInput').addEventListener('keydown', e => {
            if (e.key === 'Enter') { e.preventDefault(); confirmAddSurvey(); }
        });
        // 问卷删除确认弹窗: 确定
        $('surveyDelConfirmBtn').addEventListener('click', confirmDeleteSurvey);
        // 收藏日期删除确认弹窗: 确定
        $('favDateDelConfirmBtn').addEventListener('click', confirmDeleteFavDate);
        // 信件删除确认弹窗: 确定
        $('letterDelConfirmBtn').addEventListener('click', confirmDeleteLetter);
        // 朋友圈删除确认弹窗: 确定
        $('momentDelConfirmBtn').addEventListener('click', () => {
            closeModal('momentDelModal');
            if (!mvMoment) return;
            const arr = getMomentsArray();
            const idx = arr.findIndex(m => m.id === mvMoment.id);
            if (idx !== -1) arr.splice(idx, 1);
            mvMoment = null;
            saveData();
            switchPage('userMomentsPage');
            renderMomentsList();
        });
        // 信件详情弹窗: 编辑按钮
        $('letterDetailEditBtn').addEventListener('click', () => { if (currentViewLetterId) openLetterEdit(currentViewLetterId); });
        // 信件编辑弹窗: 关闭/取消/保存
        $('letterEditCloseBtn').addEventListener('click', closeLetterEditAll);
        $('letterEditCancelBtn').addEventListener('click', cancelLetterEdit);
        $('letterEditSaveBtn').addEventListener('click', saveLetterEdit);
        // 收到的回信编辑弹窗: 关闭/取消/保存
        $('letterReceivedEditCloseBtn').addEventListener('click', closeLetterReceivedEditAll);
        $('letterReceivedEditCancelBtn').addEventListener('click', cancelLetterReceivedEdit);
        $('letterReceivedEditSaveBtn').addEventListener('click', saveLetterReceivedEdit);
        // 收到的回信浏览弹窗: 编辑按钮
        $('letterReceivedDetailEditBtn').addEventListener('click', openLetterReceivedEdit);
        // 收到的回信浏览弹窗: 原信展开/收起
        $('letterReceivedOriginalToggle').addEventListener('click', () => {
            const origEl = $('letterReceivedOriginal');
            const toggleEl = $('letterReceivedOriginalToggle');
            if (!origEl || !origEl.dataset.full) return;
            if (origEl.classList.contains('expanded')) {
                origEl.textContent = origEl.dataset.full.slice(0, 60) + '...';
                origEl.classList.remove('expanded');
                toggleEl.textContent = '展开查看全文';
            } else {
                origEl.textContent = origEl.dataset.full;
                origEl.classList.add('expanded');
                toggleEl.textContent = '收起';
            }
        });
        // 他的来信删除确认弹窗: 确定
        $('letterHisDelConfirmBtn').addEventListener('click', confirmDeleteHisLetter);
        // 他的来信编辑弹窗: 关闭/取消/保存
        $('letterHisEditCloseBtn').addEventListener('click', closeLetterHisEditAll);
        $('letterHisEditCancelBtn').addEventListener('click', cancelLetterHisEdit);
        $('letterHisEditSaveBtn').addEventListener('click', saveLetterHisEdit);
        // 他的来信浏览弹窗: 编辑按钮
        $('letterHisDetailEditBtn').addEventListener('click', openLetterHisEdit);
        // 我的回信删除确认弹窗: 确定
        $('letterMineDelConfirmBtn').addEventListener('click', confirmDeleteMineLetter);
        // 我的回信编辑弹窗: 关闭/取消/保存
        $('letterMineEditCloseBtn').addEventListener('click', closeLetterMineEditAll);
        $('letterMineEditCancelBtn').addEventListener('click', cancelLetterMineEdit);
        $('letterMineEditSaveBtn').addEventListener('click', saveLetterMineEdit);
        // 我的回信浏览弹窗: 编辑按钮
        $('letterMineDetailEditBtn').addEventListener('click', openLetterMineEdit);
        // 我的回信浏览弹窗: 梦角来信展开/收起
        $('letterMineOriginalToggle').addEventListener('click', () => {
            const origEl = $('letterMineOriginal');
            const toggleEl = $('letterMineOriginalToggle');
            if (!origEl || !origEl.dataset.full) return;
            if (origEl.classList.contains('expanded')) {
                origEl.textContent = origEl.dataset.full.slice(0, 60) + '...';
                origEl.classList.remove('expanded');
                toggleEl.textContent = '展开查看全文';
            } else {
                origEl.textContent = origEl.dataset.full;
                origEl.classList.add('expanded');
                toggleEl.textContent = '收起';
            }
        });
        // 我的回信编辑弹窗: 梦角来信展开/收起
        $('letterMineEditOriginalToggle').addEventListener('click', () => {
            const origEl = $('letterMineEditOriginal');
            const toggleEl = $('letterMineEditOriginalToggle');
            if (!origEl || !origEl.dataset.full) return;
            if (origEl.classList.contains('expanded')) {
                origEl.textContent = origEl.dataset.full.slice(0, 60) + '...';
                origEl.classList.remove('expanded');
                toggleEl.textContent = '展开查看全文';
            } else {
                origEl.textContent = origEl.dataset.full;
                origEl.classList.add('expanded');
                toggleEl.textContent = '收起';
            }
        });
        $('surveyPageBody').addEventListener('click', e => {
            const btn = e.target.closest('[data-action]');
            if (!btn) return;
            const action = btn.dataset.action;
            const sid = btn.dataset.sid || surveyEditingId;
            switch (action) {
                case 'close-survey': closeSurveyPage(); break;
                case 'back-list': surveyEditingId = null; renderSurveyPage(); break;
                case 'add-survey': addSurvey(); break;
                case 'del-survey': deleteSurvey(btn.dataset.sid); break;
                case 'add-question': addQuestion(sid); break;
                case 'del-question': deleteQuestion(sid, btn.dataset.qid); break;
                case 'set-type': setQuestionType(sid, btn.dataset.qid, btn.dataset.type); break;
                case 'set-rt-mode': setReplyTimeMode(sid, btn.dataset.mode); break;
                case 'add-option': addOption(sid, btn.dataset.qid); break;
                case 'del-option': deleteOption(sid, btn.dataset.qid, btn.dataset.oid); break;
                case 'del-response': deleteResponse(sid, btn.dataset.cid); break;
                case 'invite': openInviteModal(sid); break;
            }
        });
        // 输入框实时保存
        $('surveyPageBody').addEventListener('input', e => {
            const el = e.target;
            const action = el.dataset.action;
            const sid = surveyEditingId;
            if (!sid) return;
            if (action === 'survey-title') saveSurveyTitle(sid, el.value);
            else if (action === 'q-text') updateQuestionText(sid, el.dataset.qid, el.value);
            else if (action === 'opt-text') updateOptionText(sid, el.dataset.qid, el.dataset.oid, el.value);
            else if (action === 'rt-seconds') {
                setReplyTimeSeconds(sid, el.value);
                const pct = (Number(el.value) / Number(el.max)) * 100;
                el.style.background = `linear-gradient(to right, #f0d98c ${pct}%, rgba(0,0,0,0.08) ${pct}%)`;
                const label = el.nextElementSibling;
                if (label && label.classList.contains('sv-slider-value')) {
                    label.textContent = `${el.value} 秒`;
                }
            }
        });
        // 点击问卷卡片进入编辑
        $('surveyPageBody').addEventListener('click', e => {
            const card = e.target.closest('.survey-card');
            if (!card) return;
            if (e.target.closest('[data-action]')) return; // 按键不触发进入
            openSurveyEditor(card.dataset.sid);
        });
        $('wcAddBtn').addEventListener('click', () => {
            const c = getContact(state.currentContactId);
            if (!c) return;
            ensureWordcardStructs(c);
            // 互动页面: 拍一拍 / 对方状态
            if (state.wcTopTab === 'interaction') {
                const tab = state.wcInteractionTab;
                const cfg = getInteractionConfig(tab);
                openInteractionModal(tab, c.settings[cfg.dataKey], -1);
                return;
            }
            if (state.wcSubTab === 'emoji') {
                // Emoji 页: 打开新增 Emoji 弹窗
                $('wcEmojiInput').value = '';
                openModal('wcEmojiAddModal');
            } else if (state.wcSubTab === 'sticker') {
                // 表情库页: 打开本地文件选择
                $('wcStickerFileInput').value = '';
                $('wcStickerFileInput').click();
            } else if (state.wcSubTab === 'momentImage') {
                // 图片页: 打开本地文件选择 (支持多选)
                $('wcMomentImageFileInput').value = '';
                $('wcMomentImageFileInput').click();
            } else {
                openWordcardModal(c.settings[getWordcardSrc().dataKey], -1, { groupId: '' });
            }
        });
        // Emoji 新增弹窗: 确认
        $('wcEmojiAddConfirmBtn').addEventListener('click', () => {
            const c = getContact(state.currentContactId);
            if (!c) return;
            const val = $('wcEmojiInput').value.trim();
            if (!val) { showSimpleToast('请输入内容', 'error'); return; }
            ensureWordcardStructs(c);
            c.settings.emojis.push({ id: uuid(), content: val });
            saveData();
            closeModal('wcEmojiAddModal');
            renderWordcardPage();
            showSimpleToast('已添加');
        });
        // Emoji 卡片: 点击切换 active (移动端显示删除按钮) / 删除
        $('wcEmojiGrid').addEventListener('click', e => {
            const delBtn = e.target.closest('[data-action="del-emoji"]');
            if (delBtn) {
                const id = delBtn.dataset.emojiId;
                const c = getContact(state.currentContactId);
                if (!c) return;
                ensureWordcardStructs(c);
                c.settings.emojis = (c.settings.emojis || []).filter(x => x.id !== id);
                saveData();
                renderWordcardPage();
                showSimpleToast('已删除');
                return;
            }
            const card = e.target.closest('.wc-emoji-card');
            if (card) {
                // 切换 active 状态 (仅移动端无 hover 时用点击显示删除按钮)
                document.querySelectorAll('.wc-emoji-card.active').forEach(x => {
                    if (x !== card) x.classList.remove('active');
                });
                card.classList.toggle('active');
            }
        });

        // ===== 表情库: 文件选择 -> 打开裁剪弹窗 =====
        let pendingStickerImg = null;
        $('wcStickerFileInput').addEventListener('change', e => {
            const file = e.target.files[0];
            if (!file) return;
            state.emojiCropTarget = 'stickers';
            const reader = new FileReader();
            reader.onload = ev => {
                pendingStickerImg = new Image();
                pendingStickerImg.onload = () => {
                    const cropImg = $('wcCropImg');
                    cropImg.src = ev.target.result;
                    cropImg.dataset.naturalW = pendingStickerImg.naturalWidth;
                    cropImg.dataset.naturalH = pendingStickerImg.naturalHeight;
                    // 初始化裁剪框 (居中, 占图片 60%)
                    setTimeout(() => initCropBox(), 50);
                    openModal('wcStickerCropModal');
                };
                pendingStickerImg.src = ev.target.result;
            };
            reader.readAsDataURL(file);
        });

        // ===== 专属表情: 文件选择 -> 打开裁剪弹窗 =====
        $('exclusiveEmojiFileInput').addEventListener('change', e => {
            const file = e.target.files[0];
            if (!file) return;
            state.emojiCropTarget = 'emojis';
            const reader = new FileReader();
            reader.onload = ev => {
                pendingStickerImg = new Image();
                pendingStickerImg.onload = () => {
                    const cropImg = $('wcCropImg');
                    cropImg.src = ev.target.result;
                    cropImg.dataset.naturalW = pendingStickerImg.naturalWidth;
                    cropImg.dataset.naturalH = pendingStickerImg.naturalHeight;
                    setTimeout(() => initCropBox(), 50);
                    openModal('wcStickerCropModal');
                };
                pendingStickerImg.src = ev.target.result;
            };
            reader.readAsDataURL(file);
        });

        // ===== 图片库: 文件选择(多选) -> 逐个打开裁剪弹窗 =====
        let momentImageQueue = [];
        function loadNextMomentImageCrop() {
            const file = momentImageQueue.shift();
            if (!file) return;
            const reader = new FileReader();
            reader.onload = ev => {
                pendingStickerImg = new Image();
                pendingStickerImg.onload = () => {
                    const cropImg = $('wcCropImg');
                    cropImg.src = ev.target.result;
                    cropImg.dataset.naturalW = pendingStickerImg.naturalWidth;
                    cropImg.dataset.naturalH = pendingStickerImg.naturalHeight;
                    setTimeout(() => initCropBox(), 50);
                    openModal('wcStickerCropModal');
                };
                pendingStickerImg.src = ev.target.result;
            };
            reader.readAsDataURL(file);
        }
        $('wcMomentImageFileInput').addEventListener('change', e => {
            const files = Array.from(e.target.files || []);
            if (!files.length) return;
            state.emojiCropTarget = 'momentImages';
            momentImageQueue = files.slice();
            loadNextMomentImageCrop();
        });

        // 裁剪框: 拖动 & 四角缩放
        let cropState = null;
        function initCropBox() {
            const area = $('wcCropArea');
            const img = $('wcCropImg');
            const box = $('wcCropBox');
            const aw = area.clientWidth;
            const ah = area.clientHeight;
            const iw = img.clientWidth;
            const ih = img.clientHeight;
            const ox = (aw - iw) / 2;
            const oy = (ah - ih) / 2;
            const size = Math.min(iw, ih) * 0.6;
            box.style.left = (ox + (iw - size) / 2) + 'px';
            box.style.top = (oy + (ih - size) / 2) + 'px';
            box.style.width = size + 'px';
            box.style.height = size + 'px';
        }
        function setupCropDrag() {
            const box = $('wcCropBox');
            const area = $('wcCropArea');
            let mode = null, startX, startY, startL, startT, startW, startH;
            const onMove = e => {
                if (!mode) return;
                e.preventDefault();
                const cx = (e.touches ? e.touches[0].clientX : e.clientX);
                const cy = (e.touches ? e.touches[0].clientY : e.clientY);
                const dx = cx - startX;
                const dy = cy - startY;
                const img = $('wcCropImg');
                const aw = area.clientWidth, ah = area.clientHeight;
                const iw = img.clientWidth, ih = img.clientHeight;
                const minX = (aw - iw) / 2, maxX = (aw + iw) / 2;
                const minY = (ah - ih) / 2, maxY = (ah + ih) / 2;
                let l = startL, t = startT, w = startW, h = startH;
                if (mode === 'move') {
                    l = Math.max(minX, Math.min(maxX - w, startL + dx));
                    t = Math.max(minY, Math.min(maxY - h, startT + dy));
                } else {
                    if (mode.includes('e')) w = Math.max(20, startW + dx);
                    if (mode.includes('s')) h = Math.max(20, startH + dy);
                    if (mode.includes('w')) { const nw = Math.max(20, startW - dx); l = startL + (startW - nw); w = nw; }
                    if (mode.includes('n')) { const nh = Math.max(20, startH - dy); t = startT + (startH - nh); h = nh; }
                }
                box.style.left = l + 'px';
                box.style.top = t + 'px';
                box.style.width = w + 'px';
                box.style.height = h + 'px';
            };
            const onUp = () => { mode = null; };
            box.addEventListener('mousedown', e => {
                if (e.target.classList.contains('wc-crop-handle')) {
                    const h = e.target;
                    if (h.classList.contains('wc-crop-handle-nw')) mode = 'nw';
                    else if (h.classList.contains('wc-crop-handle-ne')) mode = 'ne';
                    else if (h.classList.contains('wc-crop-handle-sw')) mode = 'sw';
                    else if (h.classList.contains('wc-crop-handle-se')) mode = 'se';
                } else {
                    mode = 'move';
                }
                startX = e.clientX; startY = e.clientY;
                startL = parseFloat(box.style.left); startT = parseFloat(box.style.top);
                startW = parseFloat(box.style.width); startH = parseFloat(box.style.height);
                e.preventDefault();
            });
            box.addEventListener('touchstart', e => {
                if (e.target.classList.contains('wc-crop-handle')) {
                    const h = e.target;
                    if (h.classList.contains('wc-crop-handle-nw')) mode = 'nw';
                    else if (h.classList.contains('wc-crop-handle-ne')) mode = 'ne';
                    else if (h.classList.contains('wc-crop-handle-sw')) mode = 'sw';
                    else if (h.classList.contains('wc-crop-handle-se')) mode = 'se';
                } else {
                    mode = 'move';
                }
                const t = e.touches[0];
                startX = t.clientX; startY = t.clientY;
                startL = parseFloat(box.style.left); startT = parseFloat(box.style.top);
                startW = parseFloat(box.style.width); startH = parseFloat(box.style.height);
            }, { passive: false });
            document.addEventListener('mousemove', onMove);
            document.addEventListener('touchmove', onMove, { passive: false });
            document.addEventListener('mouseup', onUp);
            document.addEventListener('touchend', onUp);
        }
        setupCropDrag();

        // 裁剪确认: 裁剪并保存
        $('wcCropConfirmBtn').addEventListener('click', e => {
            e.stopPropagation();
            const c = getContact(state.currentContactId);
            if (!c) return;
            const img = $('wcCropImg');
            const box = $('wcCropBox');
            const area = $('wcCropArea');
            const aw = area.clientWidth, ah = area.clientHeight;
            const iw = img.clientWidth, ih = img.clientHeight;
            const ox = (aw - iw) / 2, oy = (ah - ih) / 2;
            const bl = parseFloat(box.style.left) - ox;
            const bt = parseFloat(box.style.top) - oy;
            const bw = parseFloat(box.style.width);
            const bh = parseFloat(box.style.height);
            const nw = parseInt(img.dataset.naturalW);
            const nh = parseInt(img.dataset.naturalH);
            const sx = bl / iw * nw;
            const sy = bt / ih * nh;
            const sw = bw / iw * nw;
            const sh = bh / ih * nh;
            const canvas = document.createElement('canvas');
            canvas.width = sw;
            canvas.height = sh;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
            const dataUrl = canvas.toDataURL('image/png');
            if (state.emojiCropTarget === 'momentImages') {
                // 图片库: 保存裁剪结果, 队列有剩余则继续裁剪下一张
                ensureWordcardStructs(c);
                c.settings.momentImages.push({ id: uuid(), dataUrl, name: '', blocked: false });
                saveData();
                if (momentImageQueue.length > 0) {
                    loadNextMomentImageCrop();
                } else {
                    closeModal('wcStickerCropModal');
                }
                renderWordcardPage();
                showSimpleToast('已添加');
            } else if (state.emojiCropTarget === 'emojis') {
                if (!c.settings.exclusiveEmojis) c.settings.exclusiveEmojis = [];
                c.settings.exclusiveEmojis.push(dataUrl);
                saveData();
                closeModal('wcStickerCropModal');
                renderEmojiGrid();
                showSimpleToast('已添加');
            } else {
                ensureWordcardStructs(c);
                c.settings.stickers.push({ id: uuid(), dataUrl, name: '' });
                saveData();
                closeModal('wcStickerCropModal');
                renderWordcardPage();
                showSimpleToast('已添加');
            }
        });

        // 表情库: 禁止右键下载图片
        $('wcStickerGrid').addEventListener('contextmenu', e => e.preventDefault());
        // 表情库: 卡片点击 (删除 + active 切换 + 批量选中)
        let pendingDelStickerId = null;
        $('wcStickerGrid').addEventListener('click', e => {
            const delBtn = e.target.closest('[data-action="del-sticker"]');
            if (delBtn) {
                pendingDelStickerId = delBtn.dataset.stickerId;
                openModal('wcStickerDelModal');
                return;
            }
            const card = e.target.closest('.wc-sticker-card');
            if (card) {
                if (state.wcStickerBatchMode) {
                    // 批量模式: 切换选中
                    const sid = card.dataset.stickerId;
                    if (state.wcSelectedStickerIds.has(sid)) {
                        state.wcSelectedStickerIds.delete(sid);
                    } else {
                        state.wcSelectedStickerIds.add(sid);
                    }
                    renderWordcardPage();
                    return;
                }
                document.querySelectorAll('.wc-sticker-card.active').forEach(x => {
                    if (x !== card) x.classList.remove('active');
                });
                card.classList.toggle('active');
            }
        });
        // 表情库: 删除确认
        let pendingDelMomentImageId = null;
        $('wcStickerDelConfirmBtn').addEventListener('click', () => {
            const c = getContact(state.currentContactId);
            if (!c) return;
            ensureWordcardStructs(c);
            // 图片库删除
            if (pendingDelMomentImageId) {
                c.settings.momentImages = (c.settings.momentImages || []).filter(s => s.id !== pendingDelMomentImageId);
                pendingDelMomentImageId = null;
                saveData();
                closeModal('wcStickerDelModal');
                renderWordcardPage();
                showSimpleToast('已删除');
                return;
            }
            if (!pendingDelStickerId) return;
            c.settings.stickers = (c.settings.stickers || []).filter(s => s.id !== pendingDelStickerId);
            saveData();
            closeModal('wcStickerDelModal');
            pendingDelStickerId = null;
            renderWordcardPage();
            showSimpleToast('已删除');
        });
        // 图片库: 禁止右键下载图片
        $('wcMomentImageGrid').addEventListener('contextmenu', e => e.preventDefault());
        // 图片库: 卡片点击 (删除 + active 切换 + 批量选中)
        $('wcMomentImageGrid').addEventListener('click', e => {
            const delBtn = e.target.closest('[data-action="del-moment-image"]');
            if (delBtn) {
                pendingDelMomentImageId = delBtn.dataset.momentImageId;
                openModal('wcStickerDelModal');
                return;
            }
            const card = e.target.closest('.wc-sticker-card');
            if (card) {
                if (state.wcMomentImageBatchMode) {
                    // 批量模式: 切换选中
                    const sid = card.dataset.momentImageId;
                    if (state.wcSelectedMomentImageIds.has(sid)) {
                        state.wcSelectedMomentImageIds.delete(sid);
                    } else {
                        state.wcSelectedMomentImageIds.add(sid);
                    }
                    renderWordcardPage();
                    return;
                }
                document.querySelectorAll('#wcMomentImageGrid .wc-sticker-card.active').forEach(x => {
                    if (x !== card) x.classList.remove('active');
                });
                card.classList.toggle('active');
            }
        });
        // 字卡弹窗: 输入实时计数
        const rpEl = $('wordcardReply');
        if (rpEl) rpEl.addEventListener('input', updateWcCounters);
        // 顶栏一级 Tab (回复库 / 互动)
        $('wcTopTabs').addEventListener('click', e => {
            const tab = e.target.closest('.wc-top-tab');
            if (!tab) return;
            switchWcTopTab(tab.dataset.topTab);
        });
        // 子 Tab (主字卡 / Emoji / 表情库)
        document.querySelectorAll('#wcReplyContent .wc-sub-tabs .wc-tab').forEach(t => {
            t.addEventListener('click', () => switchWcSubTab(t.dataset.subTab));
        });
        // 互动子 Tab (拍一拍 / 语音条 / 对方状态): 切换激活态 + 切换内容区 + 渲染
        document.querySelectorAll('#wcInteractionContent .wc-sub-tabs .wc-tab').forEach(t => {
            t.addEventListener('click', () => {
                document.querySelectorAll('#wcInteractionContent .wc-sub-tabs .wc-tab').forEach(b => b.classList.remove('active'));
                t.classList.add('active');
                state.wcInteractionTab = t.dataset.interactionTab;
                // 切到非语音条 Tab 时退出语音条批量模式
                if (state.wcInteractionTab !== 'voice') {
                    state.wcVoiceBatchMode = false;
                    state.wcVoiceSelectedIds.clear();
                }
                $('wcPatContent').hidden = state.wcInteractionTab !== 'pat';
                $('wcVoiceContent').hidden = state.wcInteractionTab !== 'voice';
                $('wcConfessionContent').hidden = state.wcInteractionTab !== 'confession';
                $('wcStatusContent').hidden = state.wcInteractionTab !== 'status';
                renderInteractionPage();
            });
        });
        // 列表事件委托: 字卡编辑/删除
        $('wcGroupList').addEventListener('click', e => {
            const c = getContact(state.currentContactId);
            if (!c) return;
            const cards = c.settings[getWordcardSrc().dataKey] || [];
            const groupMap = getGroupMap(c);

            // ---- 点击编辑分组按钮 ----
            const editGroupBtn = e.target.closest('[data-action="edit-group"]');
            if (editGroupBtn) {
                const gid = editGroupBtn.dataset.groupId;
                openWcCreateGroupModal(gid);
                return;
            }

            // ---- 字卡屏蔽按钮 ----
            const blockBtn = e.target.closest('[data-action="block-card"]');
            if (blockBtn) {
                const cardId = blockBtn.dataset.cardId;
                const w = cards.find(x => x.id === cardId);
                if (w) {
                    w.blocked = !w.blocked;
                    saveData();
                    renderWordcardPage();
                    showSimpleToast(w.blocked ? '已屏蔽' : '已取消屏蔽');
                }
                return;
            }

            // ---- 字卡分组按钮 ----
            const groupBtn = e.target.closest('[data-action="group-card"]');
            if (groupBtn) {
                state.wcOperatingCardId = groupBtn.dataset.cardId;
                openCardGroupModal();
                return;
            }

            // ---- 字卡编辑按钮 ----
            const editCardBtn = e.target.closest('[data-action="edit-card"]');
            if (editCardBtn) {
                const cardId = editCardBtn.dataset.cardId;
                const w = cards.find(x => x.id === cardId);
                if (w) {
                    state.wcOperatingCardId = cardId;
                    $('wcCardEditText').value = w.reply || '';
                    openModal('wcCardEditModal');
                }
                return;
            }

            // ---- 字卡删除按钮 ----
            const delCardBtn = e.target.closest('[data-action="del-card"]');
            if (delCardBtn) {
                state.wcOperatingCardId = delCardBtn.dataset.cardId;
                openModal('wcCardDelModal');
                return;
            }

            // ---- 批量: 勾选字卡 ----
            const toggleBox = e.target.closest('[data-action="toggle-card"]');
            if (toggleBox) {
                const cardId = toggleBox.dataset.cardId;
                if (state.wcSelectedCardIds.has(cardId)) {
                    state.wcSelectedCardIds.delete(cardId);
                } else {
                    state.wcSelectedCardIds.add(cardId);
                }
                renderWordcardPage();
                return;
            }

            // ---- 批量: 分组内全选 ----
            const selGroupBtn = e.target.closest('[data-action="select-group"]');
            if (selGroupBtn) {
                const key = selGroupBtn.dataset.groupKey;
                let groupCards;
                if (key === '__ungrouped__') {
                    groupCards = cards.filter(w => !w.groupId || !groupMap.has(w.groupId));
                } else {
                    groupCards = cards.filter(w => w.groupId === key);
                }
                const allSel = groupCards.every(w => state.wcSelectedCardIds.has(w.id));
                if (allSel) {
                    groupCards.forEach(w => state.wcSelectedCardIds.delete(w.id));
                } else {
                    groupCards.forEach(w => state.wcSelectedCardIds.add(w.id));
                }
                renderWordcardPage();
                return;
            }

            // ---- 点击分组行 → 展开/收起 ----
            const groupRow = e.target.closest('.wc-group-row');
            if (groupRow) {
                const key = groupRow.dataset.groupKey;
                if (key) {
                    state.wcExpandedGroups[key] = !state.wcExpandedGroups[key];
                    renderWordcardPage();
                }
                return;
            }
        });
        // 工具栏: 分组管理按钮 → 打开分组管理弹窗
        $('wcGroupManageBtn').addEventListener('click', openWcGroupModal);
        // 导入文件 input (保留, 暂无触发按钮)
        $('wcImportFile').addEventListener('change', e => {
            const f = e.target.files && e.target.files[0];
            if (!f) return;
            importWordcardsFromFile(f);
        });
        // 工具栏: 搜索/排序/视图/下载/导出 (占位, 功能开发中)
        $('wcSearchBtn').addEventListener('click', () => {
            const bar = $('wcSearchBar');
            const input = $('wcSearchInput');
            const open = !bar.hidden;
            if (open) {
                // 当前是展开状态 -> 收起
                bar.hidden = true;
                input.value = '';
                state.wcSearchKeyword = '';
                renderWordcardPage();
            } else {
                // 当前是收起状态 -> 展开并聚焦
                bar.hidden = false;
                setTimeout(() => input.focus(), 50);
            }
        });
        // 搜索框输入 -> 实时过滤
        $('wcSearchInput').addEventListener('input', () => {
            state.wcSearchKeyword = $('wcSearchInput').value;
            renderWordcardPage();
        });
        // 关闭搜索框
        $('wcSearchCloseBtn').addEventListener('click', () => {
            const bar = $('wcSearchBar');
            const input = $('wcSearchInput');
            bar.hidden = true;
            input.value = '';
            state.wcSearchKeyword = '';
            renderWordcardPage();
        });
        $('wcViewBtn').addEventListener('click', () => {
            if (state.wcSubTab === 'sticker') {
                // 表情库批量管理
                state.wcStickerBatchMode = !state.wcStickerBatchMode;
                if (!state.wcStickerBatchMode) state.wcSelectedStickerIds.clear();
                $('wcViewBtn').classList.toggle('active', state.wcStickerBatchMode);
            } else if (state.wcSubTab === 'momentImage') {
                // 图片库批量管理
                state.wcMomentImageBatchMode = !state.wcMomentImageBatchMode;
                if (!state.wcMomentImageBatchMode) state.wcSelectedMomentImageIds.clear();
                $('wcViewBtn').classList.toggle('active', state.wcMomentImageBatchMode);
            } else {
                state.wcBatchMode = !state.wcBatchMode;
                if (!state.wcBatchMode) state.wcSelectedCardIds.clear();
                $('wcViewBtn').classList.toggle('active', state.wcBatchMode);
            }
            renderWordcardPage();
        });
        $('wcExportBtn').addEventListener('click', openWcExportMode);
        $('wcImportBtn').addEventListener('click', triggerWcImport);
        // 导出方式弹窗: 选择全量/按分组
        document.querySelectorAll('#wcExportModeModal .wc-export-option').forEach(el => {
            el.addEventListener('click', () => {
                const mode = el.dataset.exportMode;
                if (mode === 'full') openWcFullExport();
                else if (mode === 'group') openWcGroupExport();
            });
        });
        // 全量导出确认
        $('wcFullExportConfirmBtn').addEventListener('click', confirmWcFullExport);
        // 按分组导出: 勾选切换 + 确认
        $('wcGroupExportList').addEventListener('click', e => {
            const item = e.target.closest('.wc-group-export-item');
            if (item) item.classList.toggle('checked');
        });
        $('wcGroupExportConfirmBtn').addEventListener('click', confirmWcGroupExport);
        // 导入文件选择
        $('wcImportFileInput').addEventListener('change', handleWcImportFile);
        $('wcImportConfirmBtn').addEventListener('click', confirmWcImport);
        // 拍一拍 / 语音条 / 对方状态 导入导出
        document.querySelectorAll('[data-action="pat-export"],[data-action="voice-export"],[data-action="confession-export"],[data-action="status-export"]').forEach(b => b.addEventListener('click', openWcExportMode));
        document.querySelectorAll('[data-action="pat-import"],[data-action="voice-import"],[data-action="confession-import"],[data-action="status-import"]').forEach(b => b.addEventListener('click', triggerWcImport));
        $('wcSortBtn').addEventListener('click', () => {
            const c = getContact(state.currentContactId);
            if (!c) return;
            if (state.wcSubTab === 'emoji') {
                // Emoji 页: 对 emoji 按 content 去重
                ensureWordcardStructs(c);
                const before = (c.settings.emojis || []).length;
                const seen = new Set();
                c.settings.emojis = (c.settings.emojis || []).filter(e => {
                    const key = (e.content || '').trim();
                    if (seen.has(key)) return false;
                    seen.add(key);
                    return true;
                });
                const after = c.settings.emojis.length;
                const removed = before - after;
                saveData();
                renderWordcardPage();
                showSimpleToast(removed > 0 ? `已去重，删除了 ${removed} 条` : '没有重复内容~');
            } else if (state.wcSubTab === 'sticker') {
                // 表情库页: 对表情按 dataUrl 去重
                ensureWordcardStructs(c);
                const before = (c.settings.stickers || []).length;
                const seen = new Set();
                c.settings.stickers = (c.settings.stickers || []).filter(s => {
                    const key = s.dataUrl || '';
                    if (seen.has(key)) return false;
                    seen.add(key);
                    return true;
                });
                const after = c.settings.stickers.length;
                const removed = before - after;
                saveData();
                renderWordcardPage();
                showSimpleToast(removed > 0 ? `已去重，删除了 ${removed} 条` : '没有重复内容~');
            } else if (state.wcSubTab === 'momentImage') {
                // 图片库页: 对图片按 dataUrl 去重
                ensureWordcardStructs(c);
                const before = (c.settings.momentImages || []).length;
                const seen = new Set();
                c.settings.momentImages = (c.settings.momentImages || []).filter(s => {
                    const key = s.dataUrl || '';
                    if (seen.has(key)) return false;
                    seen.add(key);
                    return true;
                });
                const after = c.settings.momentImages.length;
                const removed = before - after;
                saveData();
                renderWordcardPage();
                showSimpleToast(removed > 0 ? `已去重，删除了 ${removed} 条` : '没有重复内容~');
            } else {
                const wcSrc = getWordcardSrc();
                const before = (c.settings[wcSrc.dataKey] || []).length;
                dedupeWordcardsByIdentity(c.settings[wcSrc.dataKey]);
                const after = (c.settings[wcSrc.dataKey] || []).length;
                const removed = before - after;
                saveData();
                renderWordcardPage();
                showSimpleToast(removed > 0 ? `已去重，删除了 ${removed} 条` : '没有重复内容~');
            }
        });

        // ===== 批量管理操作栏 =====
        // 全选 / 取消全选
        $('wcBatchSelectAll').addEventListener('click', () => {
            const c = getContact(state.currentContactId);
            if (!c) return;
            if (state.wcSubTab === 'sticker') {
                const stickers = c.settings.stickers || [];
                const kw = (state.wcSearchKeyword || '').trim();
                const filtered = kw ? stickers.filter(s => (s.dataUrl || '').includes(kw) || (s.name || '').includes(kw)) : stickers;
                const allSel = filtered.length > 0 && filtered.every(s => state.wcSelectedStickerIds.has(s.id));
                if (allSel) {
                    filtered.forEach(s => state.wcSelectedStickerIds.delete(s.id));
                } else {
                    filtered.forEach(s => state.wcSelectedStickerIds.add(s.id));
                }
                renderWordcardPage();
                return;
            }
            if (state.wcSubTab === 'momentImage') {
                const images = c.settings.momentImages || [];
                const kw = (state.wcSearchKeyword || '').trim();
                const filtered = kw ? images.filter(s => (s.dataUrl || '').includes(kw) || (s.name || '').includes(kw)) : images;
                const allSel = filtered.length > 0 && filtered.every(s => state.wcSelectedMomentImageIds.has(s.id));
                if (allSel) {
                    filtered.forEach(s => state.wcSelectedMomentImageIds.delete(s.id));
                } else {
                    filtered.forEach(s => state.wcSelectedMomentImageIds.add(s.id));
                }
                renderWordcardPage();
                return;
            }
            let cards = c.settings[getWordcardSrc().dataKey] || [];
            const kw = (state.wcSearchKeyword || '').trim().toLowerCase();
            if (kw) cards = cards.filter(w => (w.reply || '').toLowerCase().includes(kw));
            const groupMap = getGroupMap(c);
            if (state.wcFilterGroupId === '') {
                cards = cards.filter(w => !w.groupId || !groupMap.has(w.groupId));
            } else if (state.wcFilterGroupId && state.wcFilterGroupId !== 'all') {
                cards = cards.filter(w => w.groupId === state.wcFilterGroupId);
            }
            const allSel = cards.length > 0 && cards.every(w => state.wcSelectedCardIds.has(w.id));
            if (allSel) {
                cards.forEach(w => state.wcSelectedCardIds.delete(w.id));
            } else {
                cards.forEach(w => state.wcSelectedCardIds.add(w.id));
            }
            renderWordcardPage();
        });
        // 批量分组
        $('wcBatchGroup').addEventListener('click', () => {
            if (state.wcSelectedCardIds.size === 0) { showSimpleToast('请先选择字卡', 'error'); return; }
            state.wcBatchGroupMode = true;
            openCardGroupModal();
        });
        // 批量屏蔽 (切换)
        $('wcBatchBlock').addEventListener('click', () => {
            const c = getContact(state.currentContactId);
            if (!c) return;
            if (state.wcSubTab === 'sticker') {
                if (state.wcSelectedStickerIds.size === 0) { showSimpleToast('请先选择表情', 'error'); return; }
                const stickers = c.settings.stickers || [];
                const sel = stickers.filter(s => state.wcSelectedStickerIds.has(s.id));
                const allBlocked = sel.every(s => s.blocked);
                sel.forEach(s => { s.blocked = !allBlocked; });
                saveData();
                renderWordcardPage();
                showSimpleToast(allBlocked ? `已取消屏蔽 ${sel.length} 条` : `已屏蔽 ${sel.length} 条`);
                return;
            }
            if (state.wcSubTab === 'momentImage') {
                if (state.wcSelectedMomentImageIds.size === 0) { showSimpleToast('请先选择图片', 'error'); return; }
                const images = c.settings.momentImages || [];
                const sel = images.filter(s => state.wcSelectedMomentImageIds.has(s.id));
                const allBlocked = sel.every(s => s.blocked);
                sel.forEach(s => { s.blocked = !allBlocked; });
                saveData();
                renderWordcardPage();
                showSimpleToast(allBlocked ? `已取消屏蔽 ${sel.length} 条` : `已屏蔽 ${sel.length} 条`);
                return;
            }
            if (state.wcSelectedCardIds.size === 0) { showSimpleToast('请先选择字卡', 'error'); return; }
            const cards = c.settings[getWordcardSrc().dataKey] || [];
            const sel = cards.filter(w => state.wcSelectedCardIds.has(w.id));
            const allBlocked = sel.every(w => w.blocked);
            sel.forEach(w => { w.blocked = !allBlocked; });
            saveData();
            renderWordcardPage();
            showSimpleToast(allBlocked ? `已取消屏蔽 ${sel.length} 条` : `已屏蔽 ${sel.length} 条`);
        });
        // 批量删除
        $('wcBatchDelete').addEventListener('click', () => {
            const c = getContact(state.currentContactId);
            if (!c) return;
            if (state.wcSubTab === 'sticker') {
                if (state.wcSelectedStickerIds.size === 0) { showSimpleToast('请先选择表情', 'error'); return; }
                c.settings.stickers = (c.settings.stickers || []).filter(s => !state.wcSelectedStickerIds.has(s.id));
                const cnt = state.wcSelectedStickerIds.size;
                state.wcSelectedStickerIds.clear();
                saveData();
                renderWordcardPage();
                showSimpleToast(`已删除 ${cnt} 条`);
                return;
            }
            if (state.wcSubTab === 'momentImage') {
                if (state.wcSelectedMomentImageIds.size === 0) { showSimpleToast('请先选择图片', 'error'); return; }
                c.settings.momentImages = (c.settings.momentImages || []).filter(s => !state.wcSelectedMomentImageIds.has(s.id));
                const cnt = state.wcSelectedMomentImageIds.size;
                state.wcSelectedMomentImageIds.clear();
                saveData();
                renderWordcardPage();
                showSimpleToast(`已删除 ${cnt} 条`);
                return;
            }
            if (state.wcSelectedCardIds.size === 0) { showSimpleToast('请先选择字卡', 'error'); return; }
            // 主字卡批量删除: 弹出确认弹窗(与单条删除复用), operatingCardId 为空表示批量模式
            state.wcOperatingCardId = null;
            openModal('wcCardDelModal');
        });

        // ===== 语音条批量管理操作栏 =====
        // 全选 / 取消全选
        $('wcVoiceBatchSelectAll').addEventListener('click', () => {
            const c = getContact(state.currentContactId);
            if (!c) return;
            ensureWordcardStructs(c);
            const cfg = getInteractionConfig('voice');
            const items = c.settings[cfg.dataKey] || [];
            const kw = (state.wcVoiceSearchKeyword || '').trim().toLowerCase();
            let viewCards = items;
            if (kw) viewCards = viewCards.filter(it => (it.content || '').toLowerCase().includes(kw));
            const filterGid = state.wcVoiceFilterGroupId || '';
            if (filterGid === '__ungrouped__') {
                viewCards = viewCards.filter(it => !it.groupId);
            } else if (filterGid) {
                viewCards = viewCards.filter(it => it.groupId === filterGid);
            }
            const allSel = viewCards.length > 0 && viewCards.every(w => state.wcVoiceSelectedIds.has(w.id));
            if (allSel) {
                viewCards.forEach(w => state.wcVoiceSelectedIds.delete(w.id));
            } else {
                viewCards.forEach(w => state.wcVoiceSelectedIds.add(w.id));
            }
            renderInteractionPage();
        });
        // 批量分组
        $('wcVoiceBatchGroup').addEventListener('click', () => {
            if (state.wcVoiceSelectedIds.size === 0) { showSimpleToast('请先选择内容', 'error'); return; }
            state.wcBatchGroupMode = true;
            state._interactionTab = 'voice';
            openCardGroupModal();
        });
        // 批量屏蔽 (切换)
        $('wcVoiceBatchBlock').addEventListener('click', () => {
            const c = getContact(state.currentContactId);
            if (!c) return;
            if (state.wcVoiceSelectedIds.size === 0) { showSimpleToast('请先选择内容', 'error'); return; }
            ensureWordcardStructs(c);
            const cfg = getInteractionConfig('voice');
            const items = c.settings[cfg.dataKey] || [];
            const sel = items.filter(it => state.wcVoiceSelectedIds.has(it.id));
            const allBlocked = sel.every(it => it.blocked);
            sel.forEach(it => { it.blocked = !allBlocked; });
            saveData();
            renderInteractionPage();
            showSimpleToast(allBlocked ? `已取消屏蔽 ${sel.length} 条` : `已屏蔽 ${sel.length} 条`);
        });
        // 批量删除
        $('wcVoiceBatchDelete').addEventListener('click', () => {
            if (state.wcVoiceSelectedIds.size === 0) { showSimpleToast('请先选择内容', 'error'); return; }
            // 弹出确认弹窗 (复用 wcCardDelModal, _interactionTab=voice 表示语音条批量模式)
            state.wcOperatingCardId = null;
            state._interactionTab = 'voice';
            openModal('wcCardDelModal');
        });
        // 分组管理弹窗: 新建分组按钮
        $('wcNewGroupBtn').addEventListener('click', () => openWcCreateGroupModal());
        // 新建/编辑分组弹窗: 保存按钮
        $('wcSaveGroupBtn').addEventListener('click', saveWcGroup);
        // 字卡: 选择分组确认
        $('wcCardGroupConfirmBtn').addEventListener('click', () => {
            const c = getContact(state.currentContactId);
            if (!c) return;
            const gid = state.wcPickedCardGroup || '';
            const interTab = state._interactionTab;
            const cfg = interTab ? getInteractionConfig(interTab) : null;
            const cards = cfg ? (c.settings[cfg.dataKey] || []) : (c.settings[getWordcardSrc().dataKey] || []);
            if (state.wcBatchGroupMode) {
                if (interTab === 'voice') {
                    // 语音条批量分组
                    const cnt = state.wcVoiceSelectedIds.size;
                    cards.forEach(w => {
                        if (state.wcVoiceSelectedIds.has(w.id)) w.groupId = gid;
                    });
                    state.wcBatchGroupMode = false;
                    saveData();
                    renderInteractionPage();
                    showSimpleToast(`已移动 ${cnt} 条到${gid ? '该分组' : '未分组'}`);
                } else {
                    // 主字卡批量分组
                    const cnt = state.wcSelectedCardIds.size;
                    cards.forEach(w => {
                        if (state.wcSelectedCardIds.has(w.id)) w.groupId = gid;
                    });
                    state.wcBatchGroupMode = false;
                    saveData();
                    renderWordcardPage();
                    showSimpleToast(`已移动 ${cnt} 条到${gid ? '该分组' : '未分组'}`);
                }
            } else if (state.wcOperatingCardId) {
                const card = cards.find(w => w.id === state.wcOperatingCardId);
                if (card) {
                    card.groupId = gid;
                    saveData();
                    if (interTab) {
                        renderInteractionPage();
                    } else {
                        renderWordcardPage();
                    }
                    showSimpleToast('已移动分组');
                }
            }
            closeModal('wcCardGroupModal');
            state.wcOperatingCardId = null;
            state._interactionTab = null;
        });
        // 字卡: 编辑保存
        $('wcCardEditSaveBtn').addEventListener('click', () => {
            const c = getContact(state.currentContactId);
            if (!c || !state.wcOperatingCardId) return;
            const interTab = state._interactionTab;
            const cfg = interTab ? getInteractionConfig(interTab) : null;
            const cards = cfg ? (c.settings[cfg.dataKey] || []) : (c.settings[getWordcardSrc().dataKey] || []);
            const card = cards.find(w => w.id === state.wcOperatingCardId);
            if (card) {
                const val = $('wcCardEditText').value;
                if (!val.trim()) { showSimpleToast('内容不能为空', 'error'); return; }
                if (interTab) {
                    card.content = val;
                } else {
                    card.reply = val;
                }
                saveData();
                if (interTab) {
                    renderInteractionPage();
                } else {
                    renderWordcardPage();
                }
                showSimpleToast('已保存');
            }
            closeModal('wcCardEditModal');
            state.wcOperatingCardId = null;
            state._interactionTab = null;
        });
        // 字卡: 删除确认
        $('wcCardDelConfirmBtn').addEventListener('click', () => {
            const c = getContact(state.currentContactId);
            if (!c) return;
            const interTab = state._interactionTab;
            const cfg = interTab ? getInteractionConfig(interTab) : null;
            if (state.wcOperatingCardId) {
                // 单条删除
                const wcSrc = getWordcardSrc();
                const cards = cfg ? (c.settings[cfg.dataKey] || []) : (c.settings[wcSrc.dataKey] || []);
                const idx = cards.findIndex(w => w.id === state.wcOperatingCardId);
                if (idx >= 0) {
                    const w = cards[idx];
                    const text = interTab ? (w.content || '') : (w.reply || '');
                    if (cfg) {
                        c.settings[cfg.dataKey].splice(idx, 1);
                    } else {
                        c.settings[wcSrc.dataKey].splice(idx, 1);
                    }
                    saveData();
                    if (interTab) {
                        renderInteractionPage();
                    } else {
                        renderWordcardPage();
                    }
                    showSimpleToast(`已删除「${text.slice(0,20)}${text.length > 20 ? '…' : ''}」`);
                }
            } else {
                // 批量删除
                if (interTab === 'voice') {
                    // 语音条批量删除
                    const cnt = state.wcVoiceSelectedIds.size;
                    const voiceCfg = getInteractionConfig('voice');
                    c.settings[voiceCfg.dataKey] = (c.settings[voiceCfg.dataKey] || []).filter(w => !state.wcVoiceSelectedIds.has(w.id));
                    state.wcVoiceSelectedIds.clear();
                    saveData();
                    renderInteractionPage();
                    showSimpleToast(`已删除 ${cnt} 条`);
                } else {
                    // 主字卡/群聊字卡批量删除
                    const cnt = state.wcSelectedCardIds.size;
                    const wcSrc2 = getWordcardSrc();
                    c.settings[wcSrc2.dataKey] = (c.settings[wcSrc2.dataKey] || []).filter(w => !state.wcSelectedCardIds.has(w.id));
                    state.wcSelectedCardIds.clear();
                    saveData();
                    renderWordcardPage();
                    showSimpleToast(`已删除 ${cnt} 条`);
                }
            }
            closeModal('wcCardDelModal');
            state.wcOperatingCardId = null;
            state._interactionTab = null;
        });
        // 分组名称输入 → 实时更新预览按钮文字
        $('wcGroupNameInput').addEventListener('input', updatePreviewBtn);
        // 新建/编辑分组弹窗: 自定义颜色预览按钮
        $('wcPreviewColorBtn').addEventListener('click', () => {
            const val = $('wcCustomColorInput').value.trim();
            if (/^#?[0-9a-fA-F]{6}$/.test(val)) {
                const hex = val.startsWith('#') ? val : '#' + val;
                $('wcCustomSwatch').style.background = hex;
                $('wcColorPicker').querySelectorAll('.wc-dot').forEach(d => d.classList.remove('active'));
                updatePreviewBtn();
            } else {
                showSimpleToast('请输入正确的 HEX 颜色值 (如 #DA77F2)', 'error');
            }
        });
        // 自定义颜色输入实时更新色块 + 预览按钮
        $('wcCustomColorInput').addEventListener('input', () => {
            const val = $('wcCustomColorInput').value.trim();
            if (/^#?[0-9a-fA-F]{6}$/.test(val)) {
                const hex = val.startsWith('#') ? val : '#' + val;
                $('wcCustomSwatch').style.background = hex;
                $('wcColorPicker').querySelectorAll('.wc-dot').forEach(d => d.classList.remove('active'));
                // 同步 HSV 状态和选择器 UI
                const hsv = hexToHsv(hex);
                state.wcColorHue = hsv.h;
                state.wcColorSat = hsv.s;
                state.wcColorVal = hsv.v;
                syncColorPickerUI();
                updatePreviewBtn();
            }
        });
        // 点击色块卡片 → 切换自定义颜色选择器面板
        $('wcCustomSwatch').addEventListener('click', () => {
            const panel = $('wcColorPickerPanel');
            if (panel.hidden) {
                // 根据当前色块颜色初始化 HSV
                const cur = $('wcCustomSwatch').style.background || '#ffb6bd';
                const hsv = hexToHsv(cur);
                state.wcColorHue = hsv.h;
                state.wcColorSat = hsv.s;
                state.wcColorVal = hsv.v;
                syncColorPickerUI();
                panel.hidden = false;
            } else {
                panel.hidden = true;
            }
        });
        // 色相滑块
        $('wcHueSlider').addEventListener('input', e => {
            state.wcColorHue = parseInt(e.target.value);
            updateColorFromPicker();
        });
        // SV 方块拖拽选色
        const svSquare = $('wcSvSquare');
        let svDragging = false;
        function handleSvMove(e) {
            const rect = svSquare.getBoundingClientRect();
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            let x = (clientX - rect.left) / rect.width;
            let y = (clientY - rect.top) / rect.height;
            x = Math.max(0, Math.min(1, x));
            y = Math.max(0, Math.min(1, y));
            state.wcColorSat = x;
            state.wcColorVal = 1 - y;
            updateColorFromPicker();
        }
        svSquare.addEventListener('mousedown', e => { svDragging = true; handleSvMove(e); });
        svSquare.addEventListener('touchstart', e => { svDragging = true; handleSvMove(e); e.preventDefault(); }, { passive: false });
        document.addEventListener('mousemove', e => { if (svDragging) handleSvMove(e); });
        document.addEventListener('touchmove', e => { if (svDragging) handleSvMove(e); }, { passive: false });
        document.addEventListener('mouseup', () => { svDragging = false; });
        document.addEventListener('touchend', () => { svDragging = false; });
        // 分组列表: 编辑分组 → 打开编辑弹窗
        $('wcGroupListEditor').addEventListener('click', e => {
            // 互动模式下由互动事件委托处理
            if (state._interactionGroupTab) return;
            const c = getContact(state.currentContactId);
            if (!c) return;
            const editBtn = e.target.closest('.wc-group-btn-edit');
            const delBtn  = e.target.closest('.wc-group-btn-del');
            const wcSrc = getWordcardSrc();
            const groups = c.settings[wcSrc.groupKey] || [];
            if (editBtn) {
                const gid = editBtn.dataset.gid;
                openWcCreateGroupModal(gid);
            } else if (delBtn) {
                const gid = delBtn.dataset.gid;
                const g = groups.find(x => x.id === gid);
                if (!g) return;
                const inGroup = (c.settings[wcSrc.dataKey] || []).filter(w => w.groupId === gid).length;
                if (!confirm(`删除分组「${g.name}」并同时删除分组内 ${inGroup} 条字卡？`)) return;
                c.settings[wcSrc.groupKey] = groups.filter(x => x.id !== gid);
                c.settings[wcSrc.dataKey] = (c.settings[wcSrc.dataKey] || []).filter(w => w.groupId !== gid);
                if (state.wcFilterGroupId === gid) state.wcFilterGroupId = 'all';
                if (state.wcExpandedGroups) delete state.wcExpandedGroups[gid];
                saveData();
                renderWcGroupEditorList();
                refreshWcGroupSelect();
                renderWordcardPage();
                showSimpleToast('分组已删除');
            }
        });
    }

    // ================= 问卷功能 =================
    let surveyEditingId = null; // 当前编辑的问卷 id (null 表示列表页)
    let pendingSurveyDelId = null; // 待删除的问卷 id (删除确认弹窗暂存)

    function openSurveyPage() {
        surveyEditingId = null;
        $('surveyPageMask').classList.add('show');
        renderSurveyPage();
    }
    function closeSurveyPage() {
        surveyEditingId = null;
        $('surveyPageMask').classList.remove('show');
    }
    function renderSurveyPage() {
        const body = $('surveyPageBody');
        if (!body) return;
        if (surveyEditingId) {
            const s = state.surveys.find(x => x.id === surveyEditingId);
            if (s) renderSurveyEditor(body, s);
            else renderSurveyList(body);
        } else {
            renderSurveyList(body);
        }
    }
    // ---------- 问卷列表 ----------
    function renderSurveyList(body) {
        const surveys = state.surveys;
        let listHtml = '';
        if (surveys.length === 0) {
            listHtml = `<div class="survey-empty">还没有问卷，点击下方「新增」创建第一份</div>`;
        } else {
            listHtml = surveys.map(s => {
                const qCount = (s.questions || []).length;
                const rCount = (s.responses || []).length;
                return `
                    <div class="survey-card" data-sid="${escapeHtml(s.id)}">
                        <div class="survey-card-main">
                            <div class="survey-card-title">${escapeHtml(s.title || '未命名问卷')}</div>
                            <div class="survey-card-meta">${qCount} 题 · ${rCount} 位梦角已回答</div>
                        </div>
                        <button class="survey-card-del" data-action="del-survey" data-sid="${escapeHtml(s.id)}" title="删除">
                            <svg viewBox="0 0 24 24" style="width:16px;height:16px;" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                        </button>
                    </div>`;
            }).join('');
        }
        body.innerHTML = `
            <header class="survey-header">
                <button class="survey-back" data-action="close-survey" title="返回">
                    <svg viewBox="0 0 24 24" style="width:20px;height:20px;" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
                </button>
                <div class="survey-title">问卷</div>
            </header>
            <div class="survey-body">${listHtml}</div>
            <footer class="survey-footer">
                <button class="btn btn-primary" data-action="add-survey">
                    <svg viewBox="0 0 24 24" style="width:18px;height:18px;" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
                    新增问卷
                </button>
            </footer>
        `;
    }
    function addSurvey() {
        const input = $('surveyNameInput');
        if (input) input.value = '';
        openModal('surveyNamingModal');
    }
    function confirmAddSurvey() {
        const input = $('surveyNameInput');
        const name = input ? input.value.trim() : '';
        const s = {
            id: uuid(),
            title: name || '未命名问卷',
            createdAt: Date.now(),
            questions: [],
            responses: [],
            replyTime: { mode: 'instant', seconds: 0 }
        };
        state.surveys.unshift(s);
        saveData();
        surveyEditingId = s.id;
        closeModal('surveyNamingModal');
        if (input) input.value = '';
        renderSurveyPage();
    }
    function deleteSurvey(id) {
        pendingSurveyDelId = id;
        openModal('surveyDelModal');
    }
    function confirmDeleteSurvey() {
        const id = pendingSurveyDelId;
        pendingSurveyDelId = null;
        if (!id) return;
        state.surveys = state.surveys.filter(s => s.id !== id);
        saveData();
        if (surveyEditingId === id) surveyEditingId = null;
        closeModal('surveyDelModal');
        renderSurveyPage();
    }
    // ---------- 问卷编辑器 ----------
    function openSurveyEditor(id) {
        surveyEditingId = id;
        renderSurveyPage();
    }
    function renderSurveyEditor(body, s) {
        // 兼容旧问卷: 补齐 replyTime
        if (!s.replyTime) s.replyTime = { mode: 'instant', seconds: 0 };
        const rtMode = s.replyTime.mode || 'instant';
        const rtSeconds = Number(s.replyTime.seconds) || 0;
        const rtCardHtml = `
            <div class="sv-replytime-cards">
                <div class="sv-rt-card ${rtMode === 'instant' ? 'active' : ''}"
                    data-action="set-rt-mode" data-mode="instant">立即回复</div>
                <div class="sv-rt-card ${rtMode === 'random' ? 'active' : ''}"
                    data-action="set-rt-mode" data-mode="random">随机时间</div>
            </div>
            ${rtMode === 'instant'
                ? `<div class="sv-slider-wrap">
                        <input type="range" min="0" max="600" step="1" value="${rtSeconds}"
                            class="sv-rt-slider" data-action="rt-seconds"
                            style="background: linear-gradient(to right, #f0d98c ${(rtSeconds / 600) * 100}%, rgba(0,0,0,0.08) ${(rtSeconds / 600) * 100}%);">
                        <span class="sv-slider-value">${rtSeconds} 秒</span>
                    </div>`
                : `<div class="sv-rt-hint">梦角将在 8-30 分钟内的随机时间回复</div>`}
        `;
        const questionsHtml = (s.questions || []).map((q, qi) => {
            const optionsHtml = (q.options || []).map((o, oi) => `
                <div class="sv-option-row">
                    <span class="sv-option-bullet">${q.type === 'single' ? '○' : '☐'}</span>
                    <input type="text" class="sv-option-input" value="${escapeHtml(o.text)}"
                        data-action="opt-text" data-qid="${escapeHtml(q.id)}" data-oid="${escapeHtml(o.id)}" placeholder="选项 ${oi + 1}">
                    <button class="sv-icon-btn" data-action="del-option" data-qid="${escapeHtml(q.id)}" data-oid="${escapeHtml(o.id)}" title="删除选项">
                        <svg viewBox="0 0 24 24" style="width:14px;height:14px;" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
                    </button>
                </div>
            `).join('');
            return `
                <div class="sv-question">
                    <div class="sv-q-head">
                        <span class="sv-q-index">Q${qi + 1}</span>
                        <div class="sv-type-group">
                            <button class="sv-type-btn ${q.type === 'single' ? 'active' : ''}"
                                data-action="set-type" data-type="single" data-qid="${escapeHtml(q.id)}">单选</button>
                            <button class="sv-type-btn ${q.type === 'multiple' ? 'active' : ''}"
                                data-action="set-type" data-type="multiple" data-qid="${escapeHtml(q.id)}">多选</button>
                        </div>
                        <button class="sv-icon-btn" data-action="del-question" data-qid="${escapeHtml(q.id)}" title="删除问题">
                            <svg viewBox="0 0 24 24" style="width:15px;height:15px;" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                        </button>
                    </div>
                    <input type="text" class="sv-q-text" value="${escapeHtml(q.text || '')}"
                        data-action="q-text" data-qid="${escapeHtml(q.id)}" placeholder="请输入问题内容">
                    <div class="sv-options">${optionsHtml}</div>
                    <button class="sv-add-option" data-action="add-option" data-qid="${escapeHtml(q.id)}">
                        <svg viewBox="0 0 24 24" style="width:14px;height:14px;" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
                        添加选项
                    </button>
                </div>
            `;
        }).join('');

        const responsesHtml = renderSurveyResponses(s);

        body.innerHTML = `
            <header class="survey-header">
                <button class="survey-back" data-action="back-list" title="返回">
                    <svg viewBox="0 0 24 24" style="width:20px;height:20px;" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
                </button>
                <input type="text" class="survey-title-input" value="${escapeHtml(s.title || '')}"
                    data-action="survey-title" placeholder="问卷标题">
            </header>
            <div class="survey-body">
                <div class="sv-section">
                    <div class="sv-section-title">问题设置</div>
                    ${questionsHtml || '<div class="sv-empty">暂无问题，点击下方按钮添加</div>'}
                    <button class="sv-add-question" data-action="add-question">
                        <svg viewBox="0 0 24 24" style="width:16px;height:16px;" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
                        添加问题
                    </button>
                </div>
                <div class="sv-section">
                    <div class="sv-section-title">回复时间</div>
                    ${rtCardHtml}
                </div>
                <div class="sv-section">
                    <div class="sv-section-title-row">
                        <div class="sv-section-title">梦角回答</div>
                        <button class="btn btn-primary sv-invite-btn" data-action="invite">
                            <svg viewBox="0 0 24 24" style="width:16px;height:16px;" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 11h-6M19 8v6"/></svg>
                            邀请梦角回答
                        </button>
                    </div>
                    ${responsesHtml}
                </div>
            </div>
            <footer class="survey-footer">
                <button class="btn btn-secondary" data-action="del-survey" data-sid="${escapeHtml(s.id)}">删除问卷</button>
            </footer>
        `;
    }
    function renderSurveyResponses(s) {
        const responses = s.responses || [];
        if (responses.length === 0) {
            return '<div class="sv-empty">暂无梦角回答，点击「邀请梦角回答」</div>';
        }
        return responses.map(r => {
            const ansRows = (s.questions || []).map(q => {
                const picked = (r.answers[q.id] || []).map(oid => {
                    const opt = (q.options || []).find(o => o.id === oid);
                    return opt ? opt.text : '';
                }).filter(Boolean);
                const ansText = picked.length ? picked.join('、') : '（未作答）';
                return `
                    <div class="sv-ans-row">
                        <div class="sv-ans-q">${escapeHtml(q.text || '未命名问题')}</div>
                        <div class="sv-ans-a">${escapeHtml(ansText)}</div>
                    </div>
                `;
            }).join('');
            return `
                <div class="sv-response">
                    <div class="sv-response-head">
                        <div class="sv-response-name">${escapeHtml(r.contactName || '梦角')}</div>
                        <button class="sv-icon-btn" data-action="del-response" data-cid="${escapeHtml(r.contactId)}" title="移除该回答">
                            <svg viewBox="0 0 24 24" style="width:14px;height:14px;" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
                        </button>
                    </div>
                    ${ansRows}
                </div>
            `;
        }).join('');
    }
    // ---------- 数据操作 ----------
    function getSurvey(id) { return state.surveys.find(s => s.id === id); }

    function saveSurveyTitle(id, title) {
        const s = getSurvey(id); if (!s) return;
        s.title = title; saveData();
    }
    function addQuestion(id) {
        const s = getSurvey(id); if (!s) return;
        s.questions = s.questions || [];
        s.questions.push({
            id: uuid(),
            text: '',
            type: 'single',
            options: [
                { id: uuid(), text: '选项1' },
                { id: uuid(), text: '选项2' }
            ]
        });
        saveData(); renderSurveyPage();
    }
    function updateQuestionText(sid, qid, text) {
        const s = getSurvey(sid); if (!s) return;
        const q = s.questions.find(x => x.id === qid); if (!q) return;
        q.text = text; saveData();
    }
    function setQuestionType(sid, qid, type) {
        const s = getSurvey(sid); if (!s) return;
        const q = s.questions.find(x => x.id === qid); if (!q) return;
        if (q.type === type) return;
        q.type = type;
        saveData(); renderSurveyPage();
    }
    function setReplyTimeMode(sid, mode) {
        const s = getSurvey(sid); if (!s) return;
        if (!s.replyTime) s.replyTime = { mode: 'instant', seconds: 0 };
        if (s.replyTime.mode === mode) return;
        s.replyTime.mode = mode;
        saveData(); renderSurveyPage();
    }
    function setReplyTimeSeconds(sid, val) {
        const s = getSurvey(sid); if (!s) return;
        if (!s.replyTime) s.replyTime = { mode: 'instant', seconds: 0 };
        s.replyTime.seconds = Math.max(0, Number(val) || 0);
        saveData();
    }
    function deleteQuestion(sid, qid) {
        const s = getSurvey(sid); if (!s) return;
        s.questions = s.questions.filter(q => q.id !== qid);
        saveData(); renderSurveyPage();
    }
    function addOption(sid, qid) {
        const s = getSurvey(sid); if (!s) return;
        const q = s.questions.find(x => x.id === qid); if (!q) return;
        q.options = q.options || [];
        q.options.push({ id: uuid(), text: `选项${q.options.length + 1}` });
        saveData(); renderSurveyPage();
    }
    function updateOptionText(sid, qid, oid, text) {
        const s = getSurvey(sid); if (!s) return;
        const q = s.questions.find(x => x.id === qid); if (!q) return;
        const o = (q.options || []).find(x => x.id === oid); if (!o) return;
        o.text = text; saveData();
    }
    function deleteOption(sid, qid, oid) {
        const s = getSurvey(sid); if (!s) return;
        const q = s.questions.find(x => x.id === qid); if (!q) return;
        q.options = (q.options || []).filter(o => o.id !== oid);
        saveData(); renderSurveyPage();
    }
    function deleteResponse(sid, cid) {
        const s = getSurvey(sid); if (!s) return;
        s.responses = (s.responses || []).filter(r => r.contactId !== cid);
        saveData(); renderSurveyPage();
    }
    // ---------- 邀请梦角 ----------
    function openInviteModal(sid) {
        const s = getSurvey(sid); if (!s) return;
        if (!s.questions || s.questions.length === 0) {
            showSimpleToast('请先添加问题', 'error'); return;
        }
        const contacts = (state.contacts || []).filter(c => !c.isGroup); // 群聊不参与问卷
        if (contacts.length === 0) {
            showSimpleToast('还没有梦角，先去创建一个吧', 'error'); return;
        }
        const items = contacts.map(c => `
            <label class="sv-contact-item">
                <input type="checkbox" class="sv-contact-check" data-cid="${escapeHtml(c.id)}">
                <div class="sv-contact-avatar" style="${c.avatar ? `background-image:url('${c.avatar}');background-size:cover;background-position:center;` : 'background:linear-gradient(135deg,#afdcf1,#c7eaf9);'}"></div>
                <span class="sv-contact-name">${escapeHtml(c.nickname || '梦角')}</span>
            </label>
        `).join('');
        // 用简易弹窗 DOM 注入
        const mask = document.createElement('div');
        mask.className = 'modal-mask show';
        mask.innerHTML = `
            <div class="modal glass sv-invite-modal">
                <div class="modal-header">
                    <h3>邀请梦角回答</h3>
                    <button class="icon-btn modal-close" data-invite-close>
                        <svg viewBox="0 0 24 24" class="icon"><path d="M18 6 6 18M6 6l12 12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="sv-contact-list">${items}</div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" data-invite-close>取消</button>
                    <button class="btn btn-primary" data-invite-confirm>邀请回答</button>
                </div>
            </div>
        `;
        document.body.appendChild(mask);
        const close = () => mask.remove();
        mask.querySelectorAll('[data-invite-close]').forEach(b => b.addEventListener('click', close));
        mask.addEventListener('click', e => { if (e.target === mask) close(); });
        mask.querySelector('[data-invite-confirm]').addEventListener('click', () => {
            const ids = Array.from(mask.querySelectorAll('.sv-contact-check:checked')).map(cb => cb.dataset.cid);
            if (ids.length === 0) { showSimpleToast('请至少选择一个梦角', 'error'); return; }
            inviteContacts(sid, ids);
            close();
        });
    }
    function inviteContacts(sid, contactIds) {
        const s = getSurvey(sid); if (!s) return;
        s.responses = s.responses || [];
        // 计算回复延迟
        const rt = s.replyTime || { mode: 'instant', seconds: 0 };
        let delayMs = 0;
        if (rt.mode === 'random') {
            // 8-30 分钟随机
            delayMs = (8 * 60 + Math.random() * 22 * 60) * 1000;
        } else {
            delayMs = Math.max(0, Number(rt.seconds) || 0) * 1000;
        }
        showSimpleToast(`已邀请 ${contactIds.length} 位梦角回答`);
        setTimeout(() => {
            const cur = getSurvey(sid); if (!cur) return;
            cur.responses = cur.responses || [];
            contactIds.forEach(cid => {
                const c = getContact(cid); if (!c) return;
                const answers = {};
                (cur.questions || []).forEach(q => {
                    const opts = q.options || [];
                    if (opts.length === 0) { answers[q.id] = []; return; }
                    if (q.type === 'single') {
                        const idx = Math.floor(Math.random() * opts.length);
                        answers[q.id] = [opts[idx].id];
                    } else {
                        const shuffled = opts.slice().sort(() => Math.random() - 0.5);
                        const n = 1 + Math.floor(Math.random() * opts.length);
                        answers[q.id] = shuffled.slice(0, n).map(o => o.id);
                    }
                });
                cur.responses = cur.responses.filter(r => r.contactId !== cid);
                cur.responses.push({
                    contactId: cid,
                    contactName: c.nickname || '梦角',
                    answeredAt: Date.now(),
                    answers
                });
            });
            saveData();
            renderSurveyPage();
        }, delayMs);
    }

    // ================= 消息操作: 引用 / 收藏 / 删除 =================
    let activeQuoteMsg = null;
    // 取消息的引用预览文本
    function getMsgQuoteText(msg) {
        switch (msg.type) {
            case 'text':
            case 'wordcard':
                return msg.content || '';
            case 'image': return '[图片]';
            case 'audio': return '[语音]';
            case 'emoji':
                return msg.content && msg.content.startsWith('data:image') ? '[图片表情]' : (msg.content || '');
            default: return msg.content ? String(msg.content) : '';
        }
    }
    // 引用: 显示引用预览条, 等待用户输入回复后发送
    function quoteMessage(msg) {
        activeQuoteMsg = msg;
        const bar = $('quoteBar');
        const textEl = $('quoteText');
        // 引用条标签: "回复 被引用者昵称"
        const c = getContact(state.currentContactId);
        const nickname = msg.from === 'me' ? (state.me.nickname || '我') : (c ? c.nickname : '');
        $('quoteLabel').textContent = '回复 ' + nickname;
        // 表情包(图片表情)在引用框中显示缩略图, 其他类型显示完整文字
        if (msg.type === 'emoji' && msg.content && msg.content.startsWith('data:image')) {
            textEl.innerHTML = `<img src="${escapeHtml(msg.content)}" class="quote-img" alt="表情">`;
        } else {
            textEl.textContent = getMsgQuoteText(msg);
        }
        bar.classList.remove('hidden');
        const input = $('messageInput');
        input.focus();
        // 若在语音模式, 切回文字输入
        if (voiceState.voiceMode) toggleVoiceMode(true);
    }
    // 取消引用
    function cancelQuote() {
        activeQuoteMsg = null;
        $('quoteBar').classList.add('hidden');
        $('quoteText').textContent = '';
    }
    // 收藏: 切换 favorited 状态
    function toggleFavorite(msgId, btnEl) {
        const c = getContact(state.currentContactId);
        if (!c) return;
        const msg = c.messages.find(m => m.id === msgId);
        if (!msg) return;
        msg.favorited = !msg.favorited;
        saveData();
        // 更新按钮样式与图标
        if (msg.favorited) {
            btnEl.classList.add('favorited');
            btnEl.title = '取消收藏';
            btnEl.innerHTML = '<svg viewBox="0 0 24 24" class="icon"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z" fill="currentColor" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/></svg>';
            showSimpleToast('已收藏');
        } else {
            btnEl.classList.remove('favorited');
            btnEl.title = '收藏';
            btnEl.innerHTML = '<svg viewBox="0 0 24 24" class="icon"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>';
            showSimpleToast('已取消收藏');
        }
    }
    // 删除消息
    function deleteMessage(msgId) {
        const c = getContact(state.currentContactId);
        if (!c) return;
        const idx = c.messages.findIndex(m => m.id === msgId);
        if (idx === -1) return;
        c.messages.splice(idx, 1);
        saveData();
        // 移除 DOM 元素
        const el = document.querySelector(`.msg[data-msg-id="${msgId}"]`);
        if (el) el.remove();
        // 若被删的是当前引用的消息, 取消引用
        if (activeQuoteMsg && activeQuoteMsg.id === msgId) cancelQuote();
        renderChatList();
        showSimpleToast('已删除');
    }

    function handleSendText() {
        const input = $('messageInput');
        const text = input.value.replace(/\s+$/g, '');
        if (!text) return;
        // 潜水群: 我在群外, 只能看不能发言
        const cur = getContact(state.currentContactId);
        if (cur && cur.isGroup && cur.lurk) {
            showSimpleToast('你在群外潜水围观，只能看不能发言', 'error');
            return;
        }
        // 若有活跃引用, 把引用信息作为独立字段传入 (不拼接前缀文字)
        let quote = null;
        if (activeQuoteMsg) {
            const c = getContact(state.currentContactId);
            quote = {
                id: activeQuoteMsg.id,
                from: activeQuoteMsg.from,
                type: activeQuoteMsg.type,
                name: activeQuoteMsg.from === 'me' ? (state.me.nickname || '我') : (c ? c.nickname : ''),
                content: activeQuoteMsg.content || ''
            };
            cancelQuote();
        }
        sendMessage({ type: 'text', content: text, quote });
        input.value = '';
        input.style.height = 'auto';
    }

    // ================= 语音消息播放 (单一实例, 点击切换播放/暂停) =================
    let __audioPlayer = null;
    let __audioPlayingBubble = null;
    function stopCurrentAudio() {
        if (__audioPlayer) {
            __audioPlayer.pause();
            try { __audioPlayer.currentTime = 0; } catch (_) {}
            __audioPlayer = null;
        }
        if (__audioPlayingBubble) {
            __audioPlayingBubble.classList.remove('playing');
            __audioPlayingBubble = null;
        }
    }
    function playAudioBubble(bubble, src) {
        // 已在播放: 点击同一条 -> 暂停
        if (__audioPlayingBubble === bubble && __audioPlayer && !__audioPlayer.paused) {
            stopCurrentAudio();
            return;
        }
        // 切换到新条: 先停旧的
        stopCurrentAudio();
        const audio = new Audio(src);
        audio.addEventListener('ended', () => stopCurrentAudio());
        audio.addEventListener('error', () => {
            stopCurrentAudio();
            showSimpleToast('语音播放失败', 'error');
        });
        audio.play().catch(() => {
            stopCurrentAudio();
            showSimpleToast('语音播放失败', 'error');
        });
        __audioPlayer = audio;
        __audioPlayingBubble = bubble;
        bubble.classList.add('playing');
    }

    // ================= 语音消息 (按住说话) =================
    const voiceState = {
        mediaRecorder: null,
        chunks: [],
        stream: null,
        startTime: 0,
        maxTimer: null,
        active: false,        // 是否正在录音(按下中)
        voiceMode: false,     // 是否处于"按住说话"模式
        permFailed: false     // 上一次权限失败
    };
    const VOICE_MAX_MS = 60000;   // 最长 60s
    const VOICE_MIN_MS = 1000;    // 最短 1s
    // 切换: 文字输入框 <-> 按住说话
    function toggleVoiceMode(forceOff) {
        const voiceBtn = $('voiceBtn');
        const inputWrapper = $('inputWrapper');
        const holdToTalk = $('holdToTalk');
        const on = forceOff ? false : !voiceState.voiceMode;
        voiceState.voiceMode = on;
        if (on) {
            inputWrapper.classList.add('hidden');
            holdToTalk.classList.remove('hidden');
            voiceBtn.classList.add('active');
        } else {
            inputWrapper.classList.remove('hidden');
            holdToTalk.classList.add('hidden');
            voiceBtn.classList.remove('active');
        }
    }
    // 释放麦克风资源
    function releaseMic() {
        if (voiceState.stream) {
            voiceState.stream.getTracks().forEach(t => t.stop());
            voiceState.stream = null;
        }
        if (voiceState.maxTimer) {
            clearTimeout(voiceState.maxTimer);
            voiceState.maxTimer = null;
        }
        voiceState.mediaRecorder = null;
        voiceState.chunks = [];
        voiceState.active = false;
        const h = $('holdToTalk');
        if (h) h.classList.remove('recording');
    }
    // 开始录音
    async function startRecording() {
        if (voiceState.active) return;
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || typeof MediaRecorder === 'undefined') {
            showSimpleToast('当前浏览器不支持录音', 'error');
            return;
        }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            voiceState.stream = stream;
            voiceState.permFailed = false;
            const mr = new MediaRecorder(stream);
            voiceState.chunks = [];
            mr.ondataavailable = e => { if (e.data && e.data.size) voiceState.chunks.push(e.data); };
            mr.onstop = () => {
                const dur = Date.now() - voiceState.startTime;
                if (dur < VOICE_MIN_MS) {
                    showSimpleToast('说话太短啦', 'error');
                    releaseMic();
                    return;
                }
                if (voiceState.chunks.length === 0) { releaseMic(); return; }
                const blob = new Blob(voiceState.chunks, { type: mr.mimeType || 'audio/webm' });
                const reader = new FileReader();
                reader.onload = () => {
                    const b64 = reader.result;
                    sendMessage({ type: 'audio', content: b64, duration: Math.round(dur / 1000) });
                    releaseMic();
                };
                reader.onerror = () => { showSimpleToast('录音读取失败', 'error'); releaseMic(); };
                reader.readAsDataURL(blob);
            };
            mr.onerror = () => { showSimpleToast('录音出错', 'error'); releaseMic(); };
            mr.start();
            voiceState.mediaRecorder = mr;
            voiceState.active = true;
            voiceState.startTime = Date.now();
            $('holdToTalk').classList.add('recording');
            // 最长 60s 自动停止
            voiceState.maxTimer = setTimeout(() => {
                if (voiceState.active && voiceState.mediaRecorder && voiceState.mediaRecorder.state === 'recording') {
                    try { voiceState.mediaRecorder.stop(); } catch (_) {}
                }
            }, VOICE_MAX_MS);
        } catch (err) {
            voiceState.permFailed = true;
            showSimpleToast('无法访问麦克风, 请检查权限', 'error');
            // 保持按住说话态, 允许重试
            releaseMic();
        }
    }
    // 停止录音
    function stopRecording(cancel) {
        if (!voiceState.active) return;
        if (cancel) {
            // 取消: 标记非活动, 直接释放, 不触发 onstop 发送
            try { if (voiceState.mediaRecorder && voiceState.mediaRecorder.state === 'recording') voiceState.mediaRecorder.stop(); } catch (_) {}
            // 让 onstop 仍会触发, 但 chunks 可能空 -> 不发送
            // 为确保不发送, 临时覆写: 通过 startTime=0 让时长判定失败
            voiceState.startTime = 0;
            releaseMic();
            return;
        }
        try {
            if (voiceState.mediaRecorder && voiceState.mediaRecorder.state === 'recording') voiceState.mediaRecorder.stop();
        } catch (_) {}
    }
    // 绑定语音按钮 + 按住说话事件
    function bindVoiceEvents() {
        const voiceBtn = $('voiceBtn');
        const holdToTalk = $('holdToTalk');
        voiceBtn.addEventListener('click', () => toggleVoiceMode());
        // 鼠标按住
        holdToTalk.addEventListener('mousedown', e => {
            e.preventDefault();
            startRecording();
        });
        holdToTalk.addEventListener('mouseup', () => stopRecording(false));
        holdToTalk.addEventListener('mouseleave', () => { if (voiceState.active) stopRecording(false); });
        // 触摸按住
        holdToTalk.addEventListener('touchstart', e => {
            e.preventDefault();
            startRecording();
        }, { passive: false });
        holdToTalk.addEventListener('touchend', () => stopRecording(false));
        holdToTalk.addEventListener('touchcancel', () => stopRecording(true));
    }

    // 覆盖 renderBgOptions 的 activeBg data.value 对于自定义背景的取值:
    // 当 isCustomBg=1 时, dataset.value 是 base64, 保存时转成 url() 形式
    const _origSaveBgSetting = saveBgSetting;
    // 直接替换逻辑: 在 saveBgSetting 中加特殊处理
    window.__patchSaveSettingsBg = function () {
        const activeBg = document.querySelector('#bgOptions .bg-option.active');
        if (activeBg && activeBg.dataset.isCustomBg === '1') {
            activeBg.dataset.value = `linear-gradient(rgba(255,255,255,0.08), rgba(255,255,255,0.08)), url("${activeBg.dataset.value}") center/cover no-repeat`;
            activeBg.dataset.isCustomBg = '0';
        }
    };
    // 注入 hook
    const origSaveBgSetting = saveBgSetting;
    // 由于 JS 函数引用已绑定, 我们重写:
    window.saveBgSettingWrapper = function() {
        window.__patchSaveSettingsBg();
        return origSaveBgSetting.call(null);
    };
    // 重新绑定按钮
    document.addEventListener('DOMContentLoaded', () => {
        const btn = $('saveBgBtn');
        if (btn) {
            btn.removeEventListener('click', saveBgSetting);
            btn.addEventListener('click', window.saveBgSettingWrapper);
        }
    });

    // ================= 初始化 =================
    async function init() {
        await loadData();
        checkDueLetterReplies();
        checkDailyHisLetters();
        checkMomentInteractions();
        checkContactMoments();
        // 每小时检查一次到期回信和每日来信
        setInterval(checkDueLetterReplies, 3600 * 1000);
        setInterval(checkDailyHisLetters, 3600 * 1000);
        // 每分钟检查一次朋友圈互动调度和梦角发表调度
        setInterval(checkMomentInteractions, 60 * 1000);
        setInterval(checkContactMoments, 60 * 1000);
        if (!state.me) {
            state.me = {
                nickname: '我',
                signature: '',
                avatar: '',
                status: ''
            };
        }
        if (state.me.status === undefined) state.me.status = '';
        bindEvents();
        renderChatList();
        startAllAutoTimers();
        initHomePage();
        switchPage('homePage');
        // 启动梦角来电调度
        scheduleIncomingCallCheck();

        // PWA: 注册 service worker (可选)
        if ('serviceWorker' in navigator) {
            // 由于用户未要求单独 sw.js 文件, 这里暂不注册, 避免 404。
            // 后续可添加 sw.js 后启用:
            // navigator.serviceWorker.register('./sw.js').catch(console.warn);
        }

        // 初始化完成, 移除启动加载遮罩
        const _ld = $('appLoading');
        if (_ld) {
            _ld.classList.add('hide');
            setTimeout(() => _ld.remove(), 320);
        }
    }

    // 启动
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
