(function () {
  const scriptTag = document.currentScript;

  // Dynamically determine API base from script source (works for local & prod)
  const scriptUrl = new URL(scriptTag.src);
  let origin = scriptUrl.origin;

  // If loaded from apex domain, force canonical www to avoid CORS preflight redirects
  if (origin === 'https://vibe-vaults.com') {
    origin = 'https://www.vibe-vaults.com';
  }

  const API_BASE = `${origin}/api/widget`;
  const API_REPLY = `${origin}/api/widget/reply`;

  const apiKey = scriptTag ? scriptTag.getAttribute('data-key') : null;

  if (!apiKey) {
    console.warn('VibeVaults: Missing data-key attribute on script tag.');
    return;
  }

  // --- State Management ---
  let isOpen = false;
  const storageKey = `vv_last_feedback_id_${apiKey}`;
  const tokenKey = `vv_session_token_${apiKey}`;
  let activeFeedbackId = localStorage.getItem(storageKey);
  let sessionToken = localStorage.getItem(tokenKey);
  let pollInterval = null;

  // --- Metadata & Logs Collection ---
  const logs = [];
  const MAX_LOGS = 50;
  // ... (captureLog code)
  const originalConsole = {
    log: console.log,
    warn: console.warn,
    error: console.error
  };

  const captureLog = (type, args) => {
    try {
      const argsArray = Array.from(args);
      let content = '';
      const containsFormatting = argsArray.some(arg => typeof arg === 'string' && arg.includes('%c'));
      if (containsFormatting) {
        content = argsArray
          .filter(arg => {
            if (typeof arg !== 'string') return true;
            const isCss = (arg.includes(':') && (arg.includes('color') || arg.includes('font') || arg.includes('bg'))) ||
              (arg.startsWith('font-') || arg.startsWith('background:'));
            return !isCss;
          })
          .map(arg => {
            try {
              let str = typeof arg === 'object' ? JSON.stringify(arg) : String(arg);
              return str.replace(/%c/g, '');
            } catch (e) { return '[Object]'; }
          })
          .join(' ');
      } else {
        content = argsArray.map(arg => {
          try { return typeof arg === 'object' ? JSON.stringify(arg) : String(arg); }
          catch (e) { return '[Object]'; }
        }).join(' ');
      }
      logs.push({ type, time: new Date().toLocaleTimeString(), content: content.trim() });
      if (logs.length > MAX_LOGS) logs.shift();
    } catch (e) { }
  };

  console.log = (...args) => { captureLog('log', args); originalConsole.log.apply(console, args); };
  console.warn = (...args) => { captureLog('warn', args); originalConsole.warn.apply(console, args); };
  console.error = (...args) => { captureLog('error', args); originalConsole.error.apply(console, args); };

  const getMetadata = () => ({
    url: window.location.href,
    userAgent: navigator.userAgent,
    screen: `${window.innerWidth}x${window.innerHeight}`,
    viewport: `${document.documentElement.clientWidth}x${document.documentElement.clientHeight}`,
    language: navigator.language,
    logs: logs
  });

  // --- UI Construction ---
  const host = document.createElement('div');
  const shadow = host.attachShadow({ mode: 'open' });
  document.body.appendChild(host);

  const style = document.createElement('style');
  style.textContent = `
    :host {
      position: fixed; bottom: 20px; right: 20px; z-index: 999999;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }
    * { box-sizing: border-box; }
    .trigger-btn {
      width: 56px; height: 56px; border-radius: 50%; background: linear-gradient(135deg, #209CEE 0%, #1a8ad4 100%);
      color: white; border: none; cursor: pointer; box-shadow: 0 4px 12px rgba(32, 156, 238, 0.4);
      display: flex; align-items: center; justify-content: center; transition: all 0.2s; position: relative;
    }
    .trigger-btn:hover { transform: scale(1.05) translateY(-2px); }
    .badge { position: absolute; top: -2px; right: -2px; width: 14px; height: 14px; background: #ef4444; border: 2px solid white; border-radius: 50%; display: none; }

    .popup {
      position: absolute; bottom: 72px; right: 0; width: 360px; max-width: calc(100vw - 40px); height: 500px;
      background: white; border-radius: 16px; display: none; flex-direction: column; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1);
      border: 1px solid #e5e7eb; overflow: hidden; animation: slideUp 0.3s ease-out;
    }
    @keyframes slideUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
    .popup.open { display: flex; }
    .header { padding: 16px 20px; background: #209CEE; color: white; position: relative; }
    .header h3 { margin: 0; font-size: 16px; font-weight: 700; }
    .header p { margin: 4px 0 0; font-size: 13px; opacity: 0.8; }
    .nav { display: flex; background: #f9fafb; border-bottom: 1px solid #e5e7eb; }
    .nav-item { flex: 1; padding: 12px; font-size: 13px; font-weight: 600; color: #6b7280; text-align: center; cursor: pointer; border-bottom: 2px solid transparent; }
    .nav-item.active { color: #209CEE; border-bottom-color: #209CEE; background: white; }
    .content { flex: 1; overflow-y: auto; display: flex; flex-direction: column; padding: 20px; }
    .view-form { display: flex; flex-direction: column; gap: 16px; }
    textarea { width: 100%; height: 120px; padding: 12px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 14px; resize: none; font-family: inherit; }
    .sender-input { width: 100%; padding: 10px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 13px; font-family: inherit; }
    .view-convo { display: none; flex-direction: column; height: 100%; }
    .chat-messages { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 12px; margin-bottom: 16px; }
    .msg-wrapper { display: flex; flex-direction: column; max-width: 85%; gap: 4px; }
    .msg-wrapper.agency { align-self: flex-start; }
    .msg-wrapper.client { align-self: flex-end; }
    .message { padding: 10px 14px; border-radius: 14px; font-size: 13px; line-height: 1.4; }
    .message.agency { background: #f3f4f6; color: #1f2937; border-bottom-left-radius: 2px; }
    .message.client { background: #209CEE; color: white; border-bottom-right-radius: 2px; }
    .msg-meta { font-size: 10px; color: #9ca3af; padding: 0 4px; display: flex; gap: 4px; align-items: center; }
    .msg-meta.agency { justify-content: flex-start; }
    .msg-meta.client { justify-content: flex-end; }
    .chat-input { display: flex; gap: 8px; border-top: 1px solid #f3f4f6; padding-top: 16px; }
    .chat-input input { flex: 1; padding: 10px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 13px; font-family: inherit; }
    .btn { background: #209CEE; color: white; border: none; padding: 10px 16px; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 14px; }
    .btn:disabled { opacity: 0.6; cursor: not-allowed; }
    .success-view { display: none; text-align: center; padding: 40px 0; }
    .branding { padding: 10px; text-align: center; font-size: 11px; color: #9ca3af; background: #f9fafb; border-top: 1px solid #f3f4f6; }
    .branding a { color: #209CEE; text-decoration: none; }
    .close-btn { position: absolute; top: 16px; right: 16px; background: rgba(255,255,255,0.1); border: none; border-radius: 50%; width: 28px; height: 28px; color: white; cursor: pointer; display: flex; align-items: center; justify-content: center; }
  `;
  shadow.appendChild(style);

  const wrapper = document.createElement('div');
  wrapper.innerHTML = `
    <button class="trigger-btn">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
      <div class="badge"></div>
    </button>
    <div class="popup">
      <div class="header">
        <h3>Send Feedback</h3><p>We'd love to hear from you!</p>
        <button class="close-btn"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
      </div>
      <div class="nav" style="display: ${activeFeedbackId ? 'flex' : 'none'}">
        <div class="nav-item active" data-view="form">New</div>
        <div class="nav-item" data-view="conversation">Chat</div>
      </div>
      <div class="content">
        <div class="view-form">
          <textarea id="vv-textarea" placeholder="Describe your issue..."></textarea>
          <div id="vv-text-error" style="display:none; color: #ef4444; font-size: 12px; margin-top: -12px; margin-bottom: 4px; padding-left: 4px;">Please describe your issue.</div>
          <input type="email" id="vv-sender" class="sender-input" placeholder="Your Email (required)">
          <div id="vv-email-error" style="display:none; color: #ef4444; font-size: 12px; margin-top: -8px; padding-left: 4px;">Please provide a valid email address so we can reply.</div>
          <button class="btn" id="vv-submit">Send Feedback</button>
        </div>
        <div class="view-convo">
          <div class="chat-messages" id="vv-chat"></div>
          <div class="chat-input"><input type="text" id="vv-reply-text" placeholder="Type a reply..."><button class="btn" id="vv-send-reply">Send</button></div>
        </div>
        <div class="success-view" id="vv-success">
          <div style="width:40px;height:40px;background:#ecfdf5;color:#10b981;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 12px"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg></div>
          <p style="font-weight:700;margin:0">Sent!</p><p style="font-size:14px;color:#6b7280;margin:8px 0 0">We'll chat soon.</p>
        </div>
      </div>
      <div class="branding">Powered by <a href="https://vibe-vaults.com" target="_blank">VibeVaults</a></div>
    </div>
  `;
  shadow.appendChild(wrapper);

  const switchView = (v) => {
    wrapper.querySelectorAll('.nav-item').forEach(i => i.classList.toggle('active', i.dataset.view === v));
    wrapper.querySelector('.view-form').style.display = v === 'form' ? 'flex' : 'none';
    wrapper.querySelector('.view-convo').style.display = v === 'conversation' ? 'flex' : 'none';
    wrapper.querySelector('#vv-success').style.display = v === 'success' ? 'block' : 'none';
    if (v === 'conversation') { fetchReplies(); startPolling(); } else { stopPolling(); }
  };

  const fetchReplies = async () => {
    if (!activeFeedbackId || !sessionToken) return;
    try {
      const res = await fetch(`${API_REPLY}?feedbackId=${activeFeedbackId}`, {
        headers: { 'Authorization': `Bearer ${sessionToken}` }
      });
      const data = await res.json();
      if (data.replies) {
        wrapper.querySelector('#vv-chat').innerHTML = data.replies.map(r => `
          <div class="msg-wrapper ${r.author_role}">
            <div class="msg-meta ${r.author_role}">
              <span style="font-weight:700; color:#6b7280; text-transform:uppercase; letter-spacing:-0.5px;">${r.author_role === 'agency' ? 'Support' : (r.author_name || 'Client')}</span>
              <span style="color:#d1d5db;">•</span>
              <span>${new Date(r.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <div class="message ${r.author_role}">
              ${r.content}
            </div>
          </div>
        `).join('');
        const chatBox = wrapper.querySelector('#vv-chat');
        if (chatBox) chatBox.scrollTop = chatBox.scrollHeight;
        const last = data.replies[data.replies.length - 1];
        if (last && last.author_role === 'agency' && !isOpen) wrapper.querySelector('.badge').style.display = 'block';
      }
    } catch (e) { }
  };

  const startPolling = () => { stopPolling(); pollInterval = setInterval(fetchReplies, 5000); };
  const stopPolling = () => { if (pollInterval) clearInterval(pollInterval); };

  const sendFeedback = async () => {
    const text = wrapper.querySelector('#vv-textarea').value.trim();
    const email = wrapper.querySelector('#vv-sender').value.trim();
    const textErrorMsg = wrapper.querySelector('#vv-text-error');
    if (!text) {
      textErrorMsg.style.display = 'block';
      return;
    }
    textErrorMsg.style.display = 'none';

    const errorMsg = wrapper.querySelector('#vv-email-error');
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errorMsg.style.display = 'block';
      return;
    }
    errorMsg.style.display = 'none';
    const btn = wrapper.querySelector('#vv-submit');
    btn.disabled = true;
    try {
      const res = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey, content: text, sender: email, metadata: getMetadata() })
      });
      const data = await res.json();
      if (data.success && data.feedback_id) {
        activeFeedbackId = data.feedback_id;
        sessionToken = data.token;
        localStorage.setItem(storageKey, activeFeedbackId);
        localStorage.setItem(tokenKey, sessionToken);
        wrapper.querySelector('.nav').style.display = 'flex';
        switchView('success');
      } else {
        alert(data.error || 'Error sending feedback.');
      }
    } catch (e) { alert('Network error.'); } finally { btn.disabled = false; }
  };

  const sendReply = async () => {
    const text = wrapper.querySelector('#vv-reply-text').value.trim();
    if (!text || !activeFeedbackId || !sessionToken) return;
    const btn = wrapper.querySelector('#vv-send-reply');
    btn.disabled = true;
    try {
      const res = await fetch(API_REPLY, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify({ feedbackId: activeFeedbackId, content: text })
      });
      if (res.ok) {
        wrapper.querySelector('#vv-reply-text').value = '';
        fetchReplies();
      } else {
        const err = await res.json();
        console.error('VibeVaults: Failed to send reply', err);
      }
    } catch (e) {
      console.error('VibeVaults: Network error sending reply', e);
    } finally {
      btn.disabled = false;
    }
  };

  const triggerBtn = wrapper.querySelector('.trigger-btn');

  triggerBtn.onclick = () => {
    isOpen = !isOpen;
    wrapper.querySelector('.popup').classList.toggle('open', isOpen);
    if (isOpen) {
      wrapper.querySelector('.badge').style.display = 'none';
      if (activeFeedbackId) wrapper.querySelector('.nav').style.display = 'flex';
    } else {
      stopPolling();
    }
  };
  wrapper.querySelector('.close-btn').onclick = () => triggerBtn.onclick();
  wrapper.querySelector('#vv-submit').onclick = sendFeedback;
  wrapper.querySelector('#vv-send-reply').onclick = sendReply;
  wrapper.querySelector('#vv-reply-text').onkeydown = (e) => {
    if (e.key === 'Enter') sendReply();
  };
  wrapper.querySelectorAll('.nav-item').forEach(i => i.onclick = () => switchView(i.dataset.view));
})();
