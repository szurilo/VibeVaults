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
  const API_FEEDBACKS = `${origin}/api/widget/feedbacks`;
  const API_STREAM = `${origin}/api/widget/stream`;

  const apiKey = scriptTag ? scriptTag.getAttribute('data-key') : null;

  if (!apiKey) {
    console.warn('VibeVaults: Missing data-key attribute on script tag.');
    return;
  }

  // --- State Management ---
  let isOpen = false;
  const emailKey = `vv_email_${apiKey}`;

  // Clean up legacy storage
  const legacyStorageKey = `vv_last_feedback_id_${apiKey}`;
  const legacyTokenKey = `vv_session_token_${apiKey}`;
  localStorage.removeItem(legacyStorageKey);
  localStorage.removeItem(legacyTokenKey);
  localStorage.removeItem(`vv_tokens_${apiKey}`);

  let clientEmail = localStorage.getItem(emailKey) || '';
  let selectedFeedbackId = null;
  let cachedFeedbacks = [];
  let pollInterval = null;
  let eventSource = null;
  let sseSupported = typeof EventSource !== 'undefined';

  // --- Metadata & Logs Collection ---
  const logs = [];
  const MAX_LOGS = 50;
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
  host.id = 'vibe-vaults-widget-host';
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
      position: absolute; bottom: 72px; right: 0; width: 380px; max-width: calc(100vw - 40px); height: 520px;
      background: white; border-radius: 16px; display: none; flex-direction: column; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1);
      border: 1px solid #e5e7eb; overflow: hidden; animation: slideUp 0.3s ease-out;
    }
    @keyframes slideUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
    .popup.open { display: flex; }
    .header { padding: 16px 20px; background: #209CEE; color: white; position: relative; }
    .header h3 { margin: 0; font-size: 16px; font-weight: 700; }
    .header p { margin: 4px 0 0; font-size: 13px; opacity: 0.8; }
    .nav { display: flex; background: #f9fafb; border-bottom: 1px solid #e5e7eb; }
    .nav-item { flex: 1; padding: 12px; font-size: 13px; font-weight: 600; color: #6b7280; text-align: center; cursor: pointer; border-bottom: 2px solid transparent; transition: all 0.15s; }
    .nav-item.active { color: #209CEE; border-bottom-color: #209CEE; background: white; }
    .content { flex: 1; overflow-y: auto; display: flex; flex-direction: column; }
    .view-form { display: flex; flex-direction: column; gap: 16px; padding: 20px; }
    textarea { width: 100%; height: 120px; padding: 12px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 14px; resize: none; font-family: inherit; }
    .sender-input { width: 100%; padding: 10px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 13px; font-family: inherit; }

    /* Feedbacks list */
    .view-feedbacks { display: none; flex-direction: column; height: 100%; }
    .feedbacks-list { flex: 1; overflow-y: auto; }
    .feedback-item {
      padding: 14px 20px; border-bottom: 1px solid #f3f4f6; cursor: pointer; transition: background 0.15s;
    }
    .feedback-item:hover { background: #f9fafb; }
    .feedback-item-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
    .feedback-status {
      font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;
      padding: 2px 8px; border-radius: 10px; line-height: 1.4;
    }
    .feedback-status.open { background: #f1f5f9; color: #64748b; }
    .feedback-status.in-progress { background: #eff6ff; color: #3b82f6; }
    .feedback-status.in-review { background: #fffbeb; color: #d97706; }
    .feedback-status.completed { background: #ecfdf5; color: #10b981; }
    .feedback-time { font-size: 11px; color: #9ca3af; }
    .feedback-preview {
      font-size: 13px; color: #374151; line-height: 1.4; margin: 0 0 8px;
      display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
    }
    .feedback-footer { display: flex; align-items: center; justify-content: space-between; }
    .feedback-sender { font-size: 11px; color: #9ca3af; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 180px; }
    .feedback-replies { font-size: 11px; color: #6b7280; display: flex; align-items: center; gap: 4px; }
    .feedbacks-empty { padding: 40px 20px; text-align: center; color: #9ca3af; }
    .feedbacks-empty-icon { width: 40px; height: 40px; background: #f3f4f6; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 12px; }
    .feedbacks-loading { padding: 40px 20px; text-align: center; color: #9ca3af; font-size: 13px; }

    /* Conversation detail */
    .view-detail { display: none; flex-direction: column; height: 100%; }
    .back-btn {
      display: flex; align-items: center; gap: 6px; padding: 10px 20px; font-size: 12px; font-weight: 600;
      color: #6b7280; background: #f9fafb; border: none; border-bottom: 1px solid #e5e7eb;
      cursor: pointer; transition: color 0.15s;
    }
    .back-btn:hover { color: #209CEE; }
    .detail-header { padding: 14px 20px; border-bottom: 1px solid #f3f4f6; }
    .detail-header-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
    .detail-sender { font-size: 12px; color: #6b7280; font-weight: 500; }
    .detail-content { font-size: 13px; color: #1f2937; line-height: 1.5; margin: 0; white-space: pre-wrap; }

    .chat-messages { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 12px; padding: 16px 20px; }
    .msg-wrapper { display: flex; flex-direction: column; max-width: 85%; gap: 4px; }
    .msg-wrapper.agency { align-self: flex-start; }
    .msg-wrapper.client { align-self: flex-end; }
    .message { padding: 10px 14px; border-radius: 14px; font-size: 13px; line-height: 1.4; }
    .message.agency { background: #f3f4f6; color: #1f2937; border-bottom-left-radius: 2px; }
    .message.client { background: #209CEE; color: white; border-bottom-right-radius: 2px; }
    .msg-meta { font-size: 10px; color: #9ca3af; padding: 0 4px; display: flex; gap: 4px; align-items: center; }
    .msg-meta.agency { justify-content: flex-start; }
    .msg-meta.client { justify-content: flex-end; }
    .chat-input { display: flex; gap: 8px; border-top: 1px solid #f3f4f6; padding: 12px 20px; }
    .chat-input input { flex: 1; padding: 10px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 13px; font-family: inherit; }
    .chat-no-replies { padding: 30px 20px; text-align: center; color: #9ca3af; font-size: 12px; }

    .btn { background: #209CEE; color: white; border: none; padding: 10px 16px; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 14px; }
    .btn:disabled { opacity: 0.6; cursor: not-allowed; }
    .btn-sm { padding: 8px 12px; font-size: 12px; }
    .success-view { display: none; text-align: center; padding: 40px 20px; }
    .branding { padding: 10px; text-align: center; font-size: 11px; color: #9ca3af; background: #f9fafb; border-top: 1px solid #f3f4f6; }
    .branding a { color: #209CEE; text-decoration: none; }
    .close-btn { position: absolute; top: 16px; right: 16px; background: rgba(255,255,255,0.1); border: none; border-radius: 50%; width: 28px; height: 28px; color: white; cursor: pointer; display: flex; align-items: center; justify-content: center; }

    /* Email prompt for replying */
    .email-prompt { display: flex; flex-direction: column; gap: 8px; padding: 12px 20px; border-top: 1px solid #f3f4f6; background: #f9fafb; }
    .email-prompt label { font-size: 11px; color: #6b7280; font-weight: 600; }
    .email-prompt input { padding: 8px 10px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 12px; font-family: inherit; }
    .email-prompt-row { display: flex; gap: 8px; }
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
      <div class="nav">
        <div class="nav-item active" data-view="form">New</div>
        <div class="nav-item" data-view="feedbacks">Feedbacks</div>
      </div>
      <div class="content">
        <div class="view-form">
          <textarea id="vv-textarea" placeholder="Describe your issue..."></textarea>
          <div id="vv-text-error" style="display:none; color: #ef4444; font-size: 12px; margin-top: -12px; margin-bottom: 4px; padding-left: 4px;">Please describe your issue.</div>
          <input type="email" id="vv-sender" class="sender-input" placeholder="Your Email (required)">
          <div id="vv-email-error" style="display:none; color: #ef4444; font-size: 12px; margin-top: -8px; padding-left: 4px;">Please provide a valid email address so we can reply.</div>
          <button class="btn" id="vv-submit">Send Feedback</button>
        </div>
        <div class="view-feedbacks">
          <div class="feedbacks-list" id="vv-feedbacks-list">
            <div class="feedbacks-loading">Loading feedbacks...</div>
          </div>
        </div>
        <div class="view-detail">
          <button class="back-btn" id="vv-back-btn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
            All Feedbacks
          </button>
          <div class="detail-header" id="vv-detail-header"></div>
          <div class="chat-messages" id="vv-chat"></div>
          <div id="vv-reply-section"></div>
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

  // Fetch project setting context asynchronously
  fetch(`${API_BASE}?key=${apiKey}`).catch(() => { });

  // --- View switching ---
  const switchView = (v) => {
    wrapper.querySelectorAll('.nav-item').forEach(i => i.classList.toggle('active', i.dataset.view === v));
    wrapper.querySelector('.view-form').style.display = v === 'form' ? 'flex' : 'none';
    wrapper.querySelector('.view-feedbacks').style.display = v === 'feedbacks' ? 'flex' : 'none';
    wrapper.querySelector('.view-detail').style.display = v === 'detail' ? 'flex' : 'none';
    wrapper.querySelector('#vv-success').style.display = v === 'success' ? 'block' : 'none';
    if (v === 'feedbacks') { fetchAllFeedbacks(); }
    if (v === 'detail') { startStream(); } else { stopAll(); }
  };

  // --- Feedbacks list ---
  const getStatusClass = (status) => {
    const s = (status || 'open').toLowerCase();
    if (s === 'in progress') return 'in-progress';
    if (s === 'in review') return 'in-review';
    return s;
  };

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  const fetchAllFeedbacks = async () => {
    const listEl = wrapper.querySelector('#vv-feedbacks-list');
    listEl.innerHTML = '<div class="feedbacks-loading">Loading feedbacks...</div>';
    try {
      const res = await fetch(`${API_FEEDBACKS}?key=${apiKey}`);
      const data = await res.json();
      if (data.feedbacks && data.feedbacks.length > 0) {
        cachedFeedbacks = data.feedbacks;
        renderFeedbacksList(data.feedbacks);
      } else {
        listEl.innerHTML = `
          <div class="feedbacks-empty">
            <div class="feedbacks-empty-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
            </div>
            <p style="font-weight:600;margin:0 0 4px;font-size:13px;color:#6b7280">No feedbacks yet</p>
            <p style="font-size:12px;margin:0">Switch to "New" to submit your first one.</p>
          </div>
        `;
      }
    } catch (e) {
      listEl.innerHTML = '<div class="feedbacks-loading">Failed to load feedbacks.</div>';
    }
  };

  const renderFeedbacksList = (feedbacks) => {
    const listEl = wrapper.querySelector('#vv-feedbacks-list');
    listEl.innerHTML = feedbacks.map(f => `
      <div class="feedback-item" data-id="${f.id}">
        <div class="feedback-item-header">
          <span class="feedback-status ${getStatusClass(f.status)}">${f.status || 'open'}</span>
          <span class="feedback-time">${formatDate(f.created_at)}</span>
        </div>
        <p class="feedback-preview">${escapeHtml(f.content)}</p>
        <div class="feedback-footer">
          <span class="feedback-sender">${escapeHtml(f.sender)}</span>
          <span class="feedback-replies">${f.reply_count > 0 ? '💬 ' + f.reply_count : ''}</span>
        </div>
      </div>
    `).join('');

    listEl.querySelectorAll('.feedback-item').forEach(item => {
      item.onclick = () => openFeedbackDetail(item.dataset.id);
    });
  };

  // --- Feedback detail / conversation ---
  const openFeedbackDetail = (feedbackId) => {
    selectedFeedbackId = feedbackId;
    const feedback = cachedFeedbacks.find(f => f.id === feedbackId);

    // Render detail header
    const headerEl = wrapper.querySelector('#vv-detail-header');
    if (feedback) {
      headerEl.innerHTML = `
        <div class="detail-header-top">
          <span class="feedback-status ${getStatusClass(feedback.status)}">${feedback.status || 'open'}</span>
          <span class="detail-sender">${escapeHtml(feedback.sender)}</span>
        </div>
        <p class="detail-content">${escapeHtml(feedback.content)}</p>
      `;
    }

    // Render reply section (email prompt if no email stored, or chat input)
    renderReplySection();

    // Switch to detail view and fetch replies
    wrapper.querySelector('.view-feedbacks').style.display = 'none';
    wrapper.querySelector('.view-detail').style.display = 'flex';
    // Highlight feedbacks tab in nav
    wrapper.querySelectorAll('.nav-item').forEach(i => i.classList.toggle('active', i.dataset.view === 'feedbacks'));
    fetchReplies();
    startStream();
  };

  const renderReplySection = () => {
    const section = wrapper.querySelector('#vv-reply-section');
    if (clientEmail) {
      section.innerHTML = `
        <div class="chat-input">
          <input type="text" id="vv-reply-text" placeholder="Type a reply...">
          <button class="btn btn-sm" id="vv-send-reply">Send</button>
        </div>
      `;
      section.querySelector('#vv-send-reply').onclick = sendReply;
      section.querySelector('#vv-reply-text').onkeydown = (e) => {
        if (e.key === 'Enter') sendReply();
      };
    } else {
      section.innerHTML = `
        <div class="email-prompt">
          <label>Enter your email to join the conversation</label>
          <div class="email-prompt-row">
            <input type="email" id="vv-reply-email" placeholder="you@example.com" style="flex:1">
            <button class="btn btn-sm" id="vv-save-email">Go</button>
          </div>
        </div>
      `;
      section.querySelector('#vv-save-email').onclick = () => {
        const email = section.querySelector('#vv-reply-email').value.trim();
        if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          clientEmail = email;
          localStorage.setItem(emailKey, email);
          renderReplySection();
        }
      };
      section.querySelector('#vv-reply-email').onkeydown = (e) => {
        if (e.key === 'Enter') section.querySelector('#vv-save-email').onclick();
      };
    }
  };

  const goBackToList = () => {
    selectedFeedbackId = null;
    stopAll();
    wrapper.querySelector('.view-detail').style.display = 'none';
    wrapper.querySelector('.view-feedbacks').style.display = 'flex';
    fetchAllFeedbacks(); // Refresh list
  };

  // --- Replies ---
  const renderReplyBubble = (r) => `
    <div class="msg-wrapper ${r.author_role}">
      <div class="msg-meta ${r.author_role}">
        <span style="font-weight:700; color:#6b7280; text-transform:uppercase; letter-spacing:-0.5px;">${r.author_role === 'agency' ? 'Support' : escapeHtml(r.author_name || 'Client')}</span>
        <span style="color:#d1d5db;">•</span>
        <span>${new Date(r.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
      </div>
      <div class="message ${r.author_role}">
        ${escapeHtml(r.content)}
      </div>
    </div>
  `;

  const appendReply = (reply) => {
    const chatEl = wrapper.querySelector('#vv-chat');
    if (!chatEl) return;

    // Check if user is near the bottom before appending
    const wasAtBottom = chatEl.scrollHeight - chatEl.scrollTop - chatEl.clientHeight < 60;

    // Remove the "no replies" placeholder if present
    const noReplies = chatEl.querySelector('.chat-no-replies');
    if (noReplies) noReplies.remove();

    // Avoid duplicates (same reply ID)
    if (reply.id && chatEl.querySelector(`[data-reply-id="${reply.id}"]`)) return;

    const div = document.createElement('div');
    div.setAttribute('data-reply-id', reply.id || '');
    div.innerHTML = renderReplyBubble(reply);
    chatEl.appendChild(div.firstElementChild);

    if (wasAtBottom) {
      chatEl.scrollTop = chatEl.scrollHeight;
    }
  };

  const fetchReplies = async () => {
    if (!selectedFeedbackId) return;
    try {
      const res = await fetch(`${API_REPLY}?feedbackId=${selectedFeedbackId}&key=${apiKey}`);
      const data = await res.json();
      const chatEl = wrapper.querySelector('#vv-chat');
      if (data.replies && data.replies.length > 0) {
        chatEl.innerHTML = data.replies.map(r =>
          `<div data-reply-id="${r.id || ''}">${renderReplyBubble(r)}</div>`
        ).join('');
        chatEl.scrollTop = chatEl.scrollHeight;
      } else {
        chatEl.innerHTML = '<div class="chat-no-replies">No replies yet. Start the conversation!</div>';
      }
    } catch (e) { }
  };

  // --- SSE Realtime (primary) with polling fallback ---
  const startStream = () => {
    stopStream();
    if (!selectedFeedbackId) return;

    if (sseSupported) {
      const url = `${API_STREAM}?feedbackId=${selectedFeedbackId}&key=${apiKey}`;
      eventSource = new EventSource(url);

      eventSource.addEventListener('new_reply', (e) => {
        try {
          const reply = JSON.parse(e.data);
          appendReply(reply);
        } catch (err) { }
      });

      eventSource.addEventListener('connected', () => {
        // SSE connected — stop any polling fallback
        stopPolling();
      });

      eventSource.onerror = () => {
        // SSE failed — fall back to polling
        stopStream();
        sseSupported = false;
        startPolling();
      };
    } else {
      // SSE not available — use polling
      startPolling();
    }
  };

  const stopStream = () => {
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
  };

  const startPolling = () => { stopPolling(); pollInterval = setInterval(fetchReplies, 5000); };
  const stopPolling = () => { if (pollInterval) clearInterval(pollInterval); pollInterval = null; };

  const stopAll = () => { stopStream(); stopPolling(); };

  // --- Send feedback ---
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
      errorMsg.textContent = 'Please provide a valid email address so we can reply.';
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
        // Remember email
        clientEmail = email;
        localStorage.setItem(emailKey, email);

        // Pre-fill the sender field for next time
        wrapper.querySelector('#vv-sender').value = email;

        switchView('success');
      } else {
        alert(data.error || 'Error sending feedback.');
      }
    } catch (e) { alert('Network error.'); } finally { btn.disabled = false; }
  };

  // --- Send reply ---
  const sendReply = async () => {
    const textEl = wrapper.querySelector('#vv-reply-text');
    if (!textEl) return;
    const text = textEl.value.trim();
    if (!text || !selectedFeedbackId || !clientEmail) return;
    const btn = wrapper.querySelector('#vv-send-reply');
    btn.disabled = true;
    try {
      const res = await fetch(API_REPLY, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedbackId: selectedFeedbackId, content: text, apiKey, senderEmail: clientEmail })
      });
      if (res.ok) {
        textEl.value = '';
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

  // --- Utility ---
  const escapeHtml = (str) => {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  };

  // --- Event bindings ---
  const triggerBtn = wrapper.querySelector('.trigger-btn');

  triggerBtn.onclick = () => {
    isOpen = !isOpen;
    wrapper.querySelector('.popup').classList.toggle('open', isOpen);
    if (isOpen) {
      wrapper.querySelector('.badge').style.display = 'none';
      // Pre-fill email if stored
      if (clientEmail) {
        const senderInput = wrapper.querySelector('#vv-sender');
        if (senderInput && !senderInput.value) senderInput.value = clientEmail;
      }
    } else {
      stopAll();
    }
  };
  wrapper.querySelector('.close-btn').onclick = () => triggerBtn.onclick();
  wrapper.querySelector('#vv-submit').onclick = sendFeedback;
  wrapper.querySelector('#vv-back-btn').onclick = goBackToList;
  wrapper.querySelectorAll('.nav-item').forEach(i => i.onclick = () => {
    if (i.dataset.view === 'feedbacks' && selectedFeedbackId) {
      // If user is in detail view and clicks "Feedbacks" tab, go back to list
      goBackToList();
    }
    switchView(i.dataset.view);
  });
})();
