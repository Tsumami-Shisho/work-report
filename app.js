// ─── Supabase Client ───
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ─── Constants ───
const WORK_TYPES = [
  { id: 'dev',      label: '開発',     icon: '⌨️', color: '#3B82F6' },
  { id: 'meeting',  label: '会議',     icon: '🗣️', color: '#8B5CF6' },
  { id: 'review',   label: 'レビュー', icon: '🔍', color: '#EC4899' },
  { id: 'docs',     label: '資料作成', icon: '📄', color: '#F59E0B' },
  { id: 'research', label: '調査',     icon: '🔬', color: '#10B981' },
  { id: 'support',  label: 'サポート', icon: '🤝', color: '#EF4444' },
  { id: 'break',    label: '休憩',     icon: '☕', color: '#6B7280' },
  { id: 'other',    label: 'その他',   icon: '📌', color: '#78716C' },
];
const HOURS = [9, 10, 11, 12, 13, 14, 15, 16, 17];

// ─── State ───
let state = {
  user: null,
  reports: {},       // { '2026-03-31': { 9: { work_type, memo, ... }, ... } }
  currentDate: todayStr(),
  view: 'input',     // 'input' | 'summary'
  editingHour: null,
  syncStatus: 'idle', // 'idle' | 'saving' | 'saved' | 'error'
  loading: true,
  authMode: 'login',  // 'login' | 'signup'
  authError: '',
  authMsg: '',
  showNotifBanner: true,
};

// ─── Helpers ───
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function formatDate(s) {
  const [y,m,d] = s.split('-');
  const days = ['日','月','火','水','木','金','土'];
  const dt = new Date(+y, +m-1, +d);
  return `${y}/${m}/${d}（${days[dt.getDay()]}）`;
}
function getType(id) { return WORK_TYPES.find(w => w.id === id); }
function $(sel) { return document.querySelector(sel); }

// ─── Auth ───
async function handleAuth(e) {
  e.preventDefault();
  const email = $('#auth-email').value.trim();
  const password = $('#auth-password').value;
  state.authError = '';
  state.authMsg = '';

  if (!email || !password) { state.authError = 'メールとパスワードを入力してください'; render(); return; }
  if (password.length < 6) { state.authError = 'パスワードは6文字以上にしてください'; render(); return; }

  if (state.authMode === 'signup') {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) { state.authError = error.message; render(); }
    else { state.authMsg = '確認メールを送信しました。メール内のリンクをクリックしてください。'; render(); }
  } else {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { state.authError = 'メールまたはパスワードが正しくありません'; render(); }
  }
}

async function handleLogout() {
  await supabase.auth.signOut();
  state.user = null;
  state.reports = {};
  render();
}

// ─── Data (Supabase) ───
async function loadReports() {
  state.loading = true;
  render();
  const { data, error } = await supabase
    .from('work_reports')
    .select('*')
    .eq('user_id', state.user.id)
    .order('report_date', { ascending: false });

  if (!error && data) {
    state.reports = {};
    data.forEach(row => {
      if (!state.reports[row.report_date]) state.reports[row.report_date] = {};
      state.reports[row.report_date][row.hour] = {
        work_type: row.work_type,
        memo: row.memo || '',
        id: row.id,
      };
    });
  }
  state.loading = false;
  render();
}

async function saveReport(date, hour, workType, memo) {
  state.syncStatus = 'saving';
  render();
  const existing = state.reports[date]?.[hour];

  let result;
  if (existing?.id) {
    result = await supabase.from('work_reports')
      .update({ work_type: workType, memo, updated_at: new Date().toISOString() })
      .eq('id', existing.id)
      .select().single();
  } else {
    result = await supabase.from('work_reports')
      .insert({ user_id: state.user.id, report_date: date, hour, work_type: workType, memo })
      .select().single();
  }

  if (result.error) {
    state.syncStatus = 'error';
  } else {
    if (!state.reports[date]) state.reports[date] = {};
    state.reports[date][hour] = { work_type: workType, memo, id: result.data.id };
    state.syncStatus = 'saved';
  }
  render();
  setTimeout(() => { state.syncStatus = 'idle'; render(); }, 1500);
}

async function deleteReport(date, hour) {
  const existing = state.reports[date]?.[hour];
  if (!existing?.id) return;

  state.syncStatus = 'saving';
  render();
  const { error } = await supabase.from('work_reports').delete().eq('id', existing.id);

  if (!error) {
    delete state.reports[date][hour];
    if (Object.keys(state.reports[date]).length === 0) delete state.reports[date];
    state.syncStatus = 'saved';
  } else {
    state.syncStatus = 'error';
  }
  render();
  setTimeout(() => { state.syncStatus = 'idle'; render(); }, 1500);
}

// ─── Notifications ───
function scheduleNotifications() {
  if (Notification.permission !== 'granted') return;
  const now = new Date();
  HOURS.forEach(hour => {
    const target = new Date(); target.setHours(hour, 0, 0, 0);
    const diff = target - now;
    if (diff > 0) {
      setTimeout(() => {
        new Notification('作業報告リマインド 📋', { body: `${hour}:00 の作業内容を記録しましょう`, tag: `wr-${hour}` });
      }, diff);
    }
  });
}

async function requestNotifPermission() {
  if ('Notification' in window) {
    const result = await Notification.requestPermission();
    if (result === 'granted') scheduleNotifications();
    state.showNotifBanner = false;
    render();
  }
}

// ─── Render ───
function render() {
  const app = $('#app');
  if (!state.user) { app.innerHTML = renderAuth(); return; }
  if (state.view === 'summary') { app.innerHTML = renderSummary(); return; }
  app.innerHTML = renderMain();
}

function renderAuth() {
  const isSignup = state.authMode === 'signup';
  return `
    <div class="auth-screen">
      <div class="auth-logo">📋</div>
      <div class="auth-title">作業メモ</div>
      <div class="auth-sub">チームの作業を記録・共有</div>
      <div class="auth-form">
        ${state.authError ? `<div class="auth-error">${state.authError}</div>` : ''}
        ${state.authMsg ? `<div class="auth-msg">${state.authMsg}</div>` : ''}
        <input id="auth-email" class="auth-input" type="email" placeholder="メールアドレス" autocomplete="email">
        <input id="auth-password" class="auth-input" type="password" placeholder="パスワード（6文字以上）" autocomplete="${isSignup ? 'new-password' : 'current-password'}">
        <button class="auth-btn" onclick="handleAuth(event)">${isSignup ? 'アカウント作成' : 'ログイン'}</button>
        <button class="auth-toggle" onclick="toggleAuthMode()">
          ${isSignup ? 'すでにアカウントをお持ちの方は <span>ログイン</span>' : 'アカウントをお持ちでない方は <span>新規登録</span>'}
        </button>
      </div>
    </div>`;
}

function toggleAuthMode() {
  state.authMode = state.authMode === 'login' ? 'signup' : 'login';
  state.authError = '';
  state.authMsg = '';
  render();
}

function renderMain() {
  const todayReports = state.reports[state.currentDate] || {};
  const filledCount = Object.keys(todayReports).length;
  const currentHour = new Date().getHours();
  const pct = (filledCount / HOURS.length) * 100;

  let syncBadge = '';
  if (state.syncStatus === 'saving') syncBadge = '<span class="sync-badge sync-saving">⏳ 保存中…</span>';
  else if (state.syncStatus === 'saved') syncBadge = '<span class="sync-badge sync-saved">☁️ 同期済</span>';
  else if (state.syncStatus === 'error') syncBadge = '<span class="sync-badge sync-error">⚠️ 保存失敗</span>';

  const notifBanner = (state.showNotifBanner && 'Notification' in window && Notification.permission !== 'granted') ? `
    <div class="notif-banner">
      <span style="font-size:20px">🔔</span>
      <div class="notif-banner-text">通知を許可すると1時間ごとにリマインド</div>
      <button class="notif-btn" onclick="requestNotifPermission()">許可</button>
      <button class="notif-close" onclick="state.showNotifBanner=false;render()">✕</button>
    </div>` : '';

  const timeline = HOURS.map(hour => {
    const entry = todayReports[hour];
    const isNow = hour === currentHour && state.currentDate === todayStr();
    const type = entry ? getType(entry.work_type) : null;
    const dotClass = `entry-dot${isNow ? ' now' : ''}${entry ? ' filled' : ''}`;
    const cardClass = `entry-card${isNow ? ' now' : ''}${entry ? ' filled' : ''}`;
    const dotStyle = entry && type ? `--dot-color:${type.color}` : '';
    const cardStyle = entry && type ? `--card-color:${type.color}` : '';

    const content = entry
      ? `<span class="icon">${type?.icon}</span>
         <div style="flex:1;min-width:0">
           <div class="label">${type?.label}</div>
           ${entry.memo ? `<div class="memo">${escapeHtml(entry.memo)}</div>` : ''}
         </div>`
      : `<span class="placeholder">${isNow ? '⏎ タップして記録' : 'タップして記録'}</span>`;

    return `
      <div class="entry-row">
        <div class="entry-time">
          <span class="entry-hour${isNow ? ' now' : ''}">${hour}:00</span>
          <div class="${dotClass}" style="${dotStyle}"></div>
          <div class="entry-line"></div>
        </div>
        <button class="${cardClass}" style="${cardStyle}" onclick="openModal(${hour})">${content}</button>
      </div>`;
  }).join('');

  const modal = state.editingHour !== null ? renderModal(state.editingHour, todayReports[state.editingHour]) : '';

  return `
    <div class="header">
      <div class="header-top">
        <div class="header-left">
          <h1>作業メモ ${syncBadge}</h1>
          <div class="header-sub">${formatDate(state.currentDate)}・${filledCount}/${HOURS.length} 記録済</div>
        </div>
        <div class="header-actions">
          <button class="btn-summary" onclick="state.view='summary';render()">📊 サマリー</button>
          <button class="btn-logout" onclick="handleLogout()">↩</button>
        </div>
      </div>
      <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
    </div>
    ${notifBanner}
    ${state.loading ? '<div class="loading">読み込み中...</div>' : `<div class="timeline">${timeline}</div>`}
    ${modal}`;
}

function renderModal(hour, entry) {
  const typeGrid = WORK_TYPES.map(t => {
    const selected = state._modalType === t.id;
    return `<button class="type-btn${selected ? ' selected' : ''}"
      style="--type-color:${t.color};--type-bg:${t.color}10"
      onclick="state._modalType='${t.id}';render()">
      <span class="type-icon">${t.icon}</span>
      <span class="type-label">${t.label}</span>
    </button>`;
  }).join('');

  const memoVal = state._modalMemo ?? '';
  const deleteBtn = entry ? `<button class="btn-delete" onclick="deleteAndClose(${hour})">削除</button>` : '';
  const canSave = !!state._modalType;

  return `
    <div class="modal-backdrop" onclick="if(event.target===this)closeModal()">
      <div class="modal-sheet">
        <div class="modal-handle"></div>
        <div class="modal-title">${hour}:00 の作業記録</div>
        <div class="type-grid">${typeGrid}</div>
        <textarea class="memo-input" rows="2" placeholder="一言メモ（任意）"
          oninput="state._modalMemo=this.value">${escapeHtml(memoVal)}</textarea>
        <div class="modal-actions">
          ${deleteBtn}
          <button class="btn-cancel" onclick="closeModal()">キャンセル</button>
          <button class="btn-save" ${canSave ? '' : 'disabled'} onclick="saveAndClose(${hour})">保存</button>
        </div>
      </div>
    </div>`;
}

function renderSummary() {
  const dates = Object.keys(state.reports).sort().reverse();

  const cards = dates.length === 0
    ? `<div class="empty-state"><div class="empty-icon">📋</div><p>まだ記録がありません</p></div>`
    : dates.map(date => {
        const dr = state.reports[date];
        const entries = Object.values(dr);
        const counts = {};
        entries.forEach(e => { counts[e.work_type] = (counts[e.work_type] || 0) + 1; });
        const total = entries.length;
        const sortedHours = Object.keys(dr).map(Number).sort((a,b) => a-b);

        const bar = Object.entries(counts).map(([tid, cnt]) => {
          const t = getType(tid);
          return `<div style="flex:${cnt};background:${t?.color || '#ccc'};border-radius:2px"></div>`;
        }).join('');

        const tags = Object.entries(counts).map(([tid, cnt]) => {
          const t = getType(tid);
          return `<span class="category-tag" style="background:${t?.color}15;color:${t?.color}">${t?.icon} ${t?.label} ×${cnt}</span>`;
        }).join('');

        const rows = sortedHours.map(hour => {
          const e = dr[hour]; const t = getType(e.work_type);
          return `<div class="detail-row">
            <span class="detail-hour">${hour}:00</span>
            <span class="detail-icon">${t?.icon}</span>
            <span class="detail-label">${t?.label}</span>
            <span class="detail-memo">${e.memo ? escapeHtml(e.memo) : '—'}</span>
          </div>`;
        }).join('');

        return `<div class="day-card">
          <div class="day-header"><h3>${formatDate(date)}</h3><span class="day-count">${total}件記録</span></div>
          <div class="category-bar">${bar}</div>
          <div class="category-tags">${tags}</div>
          <div class="detail-table">${rows}</div>
        </div>`;
      }).join('');

  return `
    <div class="summary-header">
      <button class="btn-back" onclick="state.view='input';render()">←</button>
      <h2>サマリー報告</h2>
      <button class="btn-refresh" onclick="loadReports()">🔄 更新</button>
    </div>
    <div class="summary-content">
      ${state.loading ? '<div class="loading">読み込み中...</div>' : cards}
    </div>`;
}

// ─── Modal helpers ───
function openModal(hour) {
  const entry = (state.reports[state.currentDate] || {})[hour];
  state.editingHour = hour;
  state._modalType = entry?.work_type || '';
  state._modalMemo = entry?.memo || '';
  render();
}
function closeModal() {
  state.editingHour = null;
  state._modalType = '';
  state._modalMemo = '';
  render();
}
async function saveAndClose(hour) {
  if (!state._modalType) return;
  await saveReport(state.currentDate, hour, state._modalType, state._modalMemo);
  closeModal();
}
async function deleteAndClose(hour) {
  await deleteReport(state.currentDate, hour);
  closeModal();
}

function escapeHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ─── Init ───
async function init() {
  // Check existing session
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) {
    state.user = session.user;
    render();
    await loadReports();
    scheduleNotifications();
  } else {
    state.loading = false;
    render();
  }

  // Listen for auth changes
  supabase.auth.onAuthStateChange(async (event, session) => {
    if (session?.user) {
      state.user = session.user;
      render();
      await loadReports();
      scheduleNotifications();
    } else {
      state.user = null;
      state.reports = {};
      render();
    }
  });
}

init();
