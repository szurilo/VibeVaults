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
  const API_UPLOAD = `${origin}/api/widget/upload`;
  const API_VERIFY = `${origin}/api/widget/verify-email`;

  const apiKey = scriptTag ? scriptTag.getAttribute('data-key') : null;

  if (!apiKey) {
    console.warn('VibeVaults: Missing data-key attribute on script tag.');
    return;
  }

  const isVibeVaults = apiKey === 'e3917e214418009aea8b7a2712cb0059';

  // --- State Management ---
  let isOpen = false;
  const emailKey = `vv_email_${apiKey}`;


  let clientEmail = localStorage.getItem(emailKey) || '';

  // Extract identity if passed via invite link URL parameter
  const urlParams = new URLSearchParams(window.location.search);
  const invitedEmail = urlParams.get('vv_email');
  if (invitedEmail) {
    clientEmail = invitedEmail;
    localStorage.setItem(emailKey, clientEmail);
    // Remove it from the URL so it's clean and doesn't get shared accidentally
    urlParams.delete('vv_email');
    const newParams = urlParams.toString();
    const cleanUrl = window.location.pathname + (newParams ? '?' + newParams : '') + window.location.hash;
    window.history.replaceState({}, '', cleanUrl);
  }

  const prefsKey = `vv_prefs_${apiKey}`;
  let notifyRepliesSetting = localStorage.getItem(prefsKey) !== 'false';


  // Track whether the user needs to verify their email before using the widget
  let needsEmailVerification = !clientEmail;

  let selectedFeedbackId = null;
  let cachedFeedbacks = [];
  let pollInterval = null;
  let listPollInterval = null;
  let eventSource = null;
  let sseSupported = typeof EventSource !== 'undefined';
  let domSelector = null;
  let pendingAttachments = []; // Files queued for upload with feedback
  let replyAttachments = []; // Files queued for upload with reply

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

  // --- File Upload Helpers ---
  const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/plain', 'text/csv'];
  const MAX_FILE_SIZE = 10 * 1024 * 1024;
  const MAX_FILES = 10;

  const uploadFiles = async (files, feedbackId, replyId) => {
    if (files.length === 0) return { attachments: [] };
    const formData = new FormData();
    formData.append('apiKey', apiKey);
    formData.append('senderEmail', clientEmail);
    if (feedbackId) formData.append('feedbackId', feedbackId);
    if (replyId) formData.append('replyId', replyId);
    for (const f of files) formData.append('files', f);
    const res = await fetch(API_UPLOAD, { method: 'POST', body: formData });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Upload failed');
    }
    return await res.json();
  };

  const isImageType = (mimeType) => mimeType && mimeType.startsWith('image/');

  const getFileExtension = (name) => {
    const parts = name.split('.');
    return parts.length > 1 ? parts.pop().toUpperCase() : 'FILE';
  };

  const renderAttachPreviews = (files, containerId, removeCallback) => {
    const container = wrapper.querySelector(containerId);
    if (!container) return;
    container.innerHTML = '';
    files.forEach((file, idx) => {
      const el = document.createElement('div');
      el.className = containerId.includes('reply') ? 'reply-attach-preview' : 'attach-preview';
      if (isImageType(file.type)) {
        const img = document.createElement('img');
        img.src = URL.createObjectURL(file);
        el.appendChild(img);
      } else {
        const icon = document.createElement('div');
        icon.className = 'file-icon';
        icon.textContent = getFileExtension(file.name);
        el.appendChild(icon);
      }
      const btn = document.createElement('button');
      btn.className = 'remove-attach';
      btn.textContent = '✕';
      btn.onclick = (e) => { e.preventDefault(); removeCallback(idx); };
      el.appendChild(btn);
      container.appendChild(el);
    });
  };

  const validateFiles = (fileList) => {
    const valid = [];
    for (const file of fileList) {
      if (file.size > MAX_FILE_SIZE) { alert(`"${file.name}" exceeds the 10MB limit.`); continue; }
      if (!ALLOWED_TYPES.includes(file.type)) { alert(`"${file.name}" has an unsupported file type.`); continue; }
      valid.push(file);
    }
    return valid;
  };

  const updatePopupHeight = () => {
    // In compact mode the popup auto-sizes to content; no-op kept for call-site compatibility.
  };

  const refreshFeedbackPreviews = () => {
    renderAttachPreviews(pendingAttachments, '#vv-attach-previews', (idx) => {
      pendingAttachments.splice(idx, 1);
      refreshFeedbackPreviews();
    });
    updatePopupHeight();
  };

  const refreshReplyPreviews = () => {
    renderAttachPreviews(replyAttachments, '#vv-reply-attach-previews', (idx) => {
      replyAttachments.splice(idx, 1);
      refreshReplyPreviews();
    });
  };

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
      color: #1f2937;
    }
    * { box-sizing: border-box; }
    .trigger-btn {
      width: 80px; height: 80px; border-radius: 16px; background: linear-gradient(135deg, #209CEE 0%, #1a8ad4 100%);
      color: white; border: none; cursor: pointer; box-shadow: 0 4px 12px rgba(32, 156, 238, 0.4);
      display: flex; flex-direction: column; align-items: center; justify-content: center; transition: all 0.2s; position: relative;
      padding: 8px; line-height: 1.2;
    }
    .trigger-btn div { pointer-events: none; width: 100%; text-align: center; }
    .trigger-btn .top-text { font-size: 7px; font-weight: 800; opacity: 0.8; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
    .trigger-btn .bottom-text { font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.8px; }
    .trigger-btn:hover { transform: scale(1.05) translateY(-2px); }
    .badge { position: absolute; top: -2px; right: -2px; width: 14px !important; height: 14px; background: #ef4444; border: 2px solid white; border-radius: 50%; display: none; }

    .popup {
      position: absolute; bottom: 100px; right: 0; width: 380px; max-width: calc(100vw - 40px); height: 520px; max-height: calc(100vh - 140px);
      background: white; border-radius: 16px; display: none; flex-direction: column; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1);
      border: 1px solid #e5e7eb; overflow: hidden; animation: slideUp 0.3s ease-out; transition: height 0.15s ease;
    }
    .popup.compact { height: auto; }
    .popup.tall { height: 620px; }
    .popup ::-webkit-scrollbar { width: 6px; height: 6px; }
    .popup ::-webkit-scrollbar-track { background: transparent; }
    .popup ::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 10px; }
    .popup ::-webkit-scrollbar-thumb:hover { background: #9ca3af; }
    
    @keyframes slideUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
    .popup.open { display: flex; }
    .header { padding: 12px 20px; background: #209CEE; color: white; position: relative; }
    .header h3 { margin: 0; font-size: 15px; font-weight: 700; }
    .header p { margin: 2px 0 0; font-size: 12px; opacity: 0.8; }
    .nav { display: flex; background: #f1f5f9; padding: 4px; margin: 8px 20px 8px; border-radius: 8px; gap: 4px; flex-shrink: 0; }
    .nav-item { flex: 1; padding: 8px 12px; font-size: 13px; font-weight: 600; color: #4a5568; text-align: center; cursor: pointer; border-radius: 6px; transition: all 0.15s; }
    .nav-item.active { color: #0f172a; background: white; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .content { flex: 1; overflow: hidden; display: flex; flex-direction: column; min-height: 0; }
    .view-form { display: flex; flex-direction: column; flex: 1; min-height: 0; overflow: hidden; }
    .view-form-body { flex: 1; overflow-y: auto; padding: 4px 20px; display: flex; flex-direction: column; gap: 6px; }
    .view-form-footer { flex-shrink: 0; padding: 0 20px 8px; }
    textarea { width: 100%; height: 120px; padding: 12px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 14px; resize: none; font-family: inherit; background: white; color: #1f2937; }
    .sender-input { width: 100%; padding: 10px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 13px; font-family: inherit; background: white; color: #1f2937; }

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
    .detail-header { padding: 14px 0; border-bottom: 1px solid #f3f4f6; }
    .detail-header-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; padding: 0 20px; }
    .detail-sender { font-size: 12px; color: #6b7280; font-weight: 500; }
    .detail-content { font-size: 13px; color: #1f2937; line-height: 1.5; margin: 0; white-space: pre-wrap; max-height: 97.5px; overflow-y: auto; padding: 0 20px; }

    .chat-messages { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 16px; padding: 16px 20px; }
    .msg-wrapper { display: flex; flex-direction: column; max-width: 90%; gap: 6px; }
    .msg-wrapper.agency { align-self: flex-start; align-items: flex-start; }
    .msg-wrapper.client { align-self: flex-end; align-items: flex-end; }
    .message { padding: 10px 16px; border-radius: 16px; font-size: 13px; line-height: 1.625; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
    .message.agency { background: #f3f4f6; color: #374151; border-top-left-radius: 0; border: 1px solid rgba(229, 231, 235, 0.5); }
    .message.client { background: #209CEE; color: white; border-top-right-radius: 0; }
    .msg-meta { font-size: 10px; color: #9ca3af; padding: 0 4px; display: flex; gap: 8px; align-items: center; }
    .chat-input { display: flex; gap: 8px; border-top: 1px solid #f3f4f6; padding: 12px 20px; }
    .chat-input input { flex: 1; padding: 10px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 13px; font-family: inherit; background: white; color: #1f2937; }
    .chat-no-replies { padding: 30px 20px; text-align: center; color: #9ca3af; font-size: 12px; }

    .btn { background: #209CEE; color: white; border: none; padding: 10px 16px; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 14px; font-family: inherit; }
    .btn:disabled { opacity: 0.6; cursor: not-allowed; }
    .btn-sm { padding: 8px 12px; font-size: 12px; }
    .success-view { display: none; text-align: center; padding: 40px 20px; }
    .view-email-prompt { display: none; flex-direction: column; align-items: center; justify-content: center; padding: 32px 24px; text-align: center; flex: 1; }
    .view-email-prompt p { font-size: 14px; color: #6b7280; margin: 0 0 20px; line-height: 1.5; }
    .view-email-prompt .email-prompt-input { width: 100%; padding: 10px 14px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 14px; font-family: inherit; outline: none; transition: border-color 0.15s; box-sizing: border-box; background: #fff; color: #1f2937; }
    .view-email-prompt .email-prompt-input:focus { border-color: #6366f1; box-shadow: 0 0 0 2px rgba(99,102,241,0.1); }
    .view-email-prompt .email-prompt-error { color: #b91c1c; font-size: 12px; margin-top: 8px; min-height: 18px; }
    .view-email-prompt .btn { margin-top: 12px; width: 100%; }
    .branding { padding: 10px; text-align: center; font-size: 11px; color: #9ca3af; background: #f9fafb; border-top: 1px solid #f3f4f6; }
    .branding a { color: #209CEE; text-decoration: none; }
    .close-btn { position: absolute; top: 16px; right: 16px; background: rgba(255,255,255,0.1); border: none; border-radius: 50%; width: 28px; height: 28px; color: white; cursor: pointer; display: flex; align-items: center; justify-content: center; }

    /* Custom Checkbox */
    .checkbox-wrapper { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; margin-top: 4px; }
    .checkbox-input {
      appearance: none; -webkit-appearance: none; margin: 0;
      width: 16px; height: 16px; border: 1px solid #d1d5db; border-radius: 4px;
      background-color: white; cursor: pointer; position: relative;
      display: inline-flex; align-items: center; justify-content: center;
      transition: all 0.2s; box-shadow: none; outline: none; padding: 0;
    }
    .checkbox-input:checked {
      background-color: #209CEE; border-color: #209CEE;
    }
    .checkbox-input:checked::after {
      content: ''; position: absolute; width: 4px; height: 8px;
      border: solid white; border-width: 0 2px 2px 0;
      transform: rotate(45deg); margin-top: -2px;
    }
    .checkbox-label { font-size: 13px; color: #4a5568; cursor: pointer; user-select: none; margin: 0; padding: 0; line-height: 1.4; }

    /* Attachments */
    .attachments-bar { display: flex; gap: 8px; align-items: center; }
    .attach-btn { background: #f3f4f6; color: #4a5568; border: 1px solid #d1d5db; border-radius: 8px; padding: 8px 12px; font-size: 12px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 6px; flex: 1; justify-content: center; font-family: inherit; }
    .attach-btn:hover { background: #e5e7eb; }
    .attach-previews { display: flex; flex-wrap: wrap; gap: 8px; }
    .attach-preview { position: relative; width: 64px; height: 64px; border-radius: 8px; border: 1px solid #e5e7eb; overflow: hidden; background: #f9fafb; display: flex; align-items: center; justify-content: center; }
    .attach-preview img { width: 100%; height: 100%; object-fit: cover; }
    .attach-preview .file-icon { font-size: 10px; color: #6b7280; text-align: center; padding: 4px; word-break: break-all; line-height: 1.2; }
    .attach-preview .remove-attach { position: absolute; top: 2px; right: 2px; background: rgba(0,0,0,0.5); color: white; border: none; border-radius: 50%; width: 18px; height: 18px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 10px; line-height: 1; }
    .attach-preview .remove-attach:hover { background: rgba(0,0,0,0.7); }
    .upload-progress { font-size: 11px; color: #6b7280; margin-bottom: 8px; }
    .reply-attach-previews { display: flex; flex-wrap: wrap; gap: 6px; padding: 0 20px; }
    .reply-attach-previews:not(:empty) { padding-bottom: 8px; }
    .reply-attach-preview { position: relative; width: 48px; height: 48px; border-radius: 6px; border: 1px solid #e5e7eb; overflow: hidden; background: #f9fafb; display: flex; align-items: center; justify-content: center; }
    .reply-attach-preview img { width: 100%; height: 100%; object-fit: cover; }
    .reply-attach-preview .file-icon { font-size: 9px; color: #6b7280; text-align: center; padding: 2px; word-break: break-all; }
    .reply-attach-preview .remove-attach { position: absolute; top: 1px; right: 1px; background: rgba(0,0,0,0.5); color: white; border: none; border-radius: 50%; width: 16px; height: 16px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 9px; }
    .msg-attachments { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
    .msg-attachment { display: block; width: 80px; height: 60px; border-radius: 6px; overflow: hidden; border: 1px solid rgba(0,0,0,0.1); }
    .msg-attachment img { width: 100%; height: 100%; object-fit: cover; }
    .msg-attachment-file { display: flex; align-items: center; gap: 4px; font-size: 11px; color: inherit; opacity: 0.8; text-decoration: underline; margin-top: 4px; }

    /* Mobile responsive */
    @media (max-width: 480px) {
      :host { bottom: 12px; right: 12px; }
      .trigger-btn { width: 64px; height: 64px; border-radius: 14px; }
      .trigger-btn .top-text { font-size: 6px; margin-bottom: 2px; }
      .trigger-btn .bottom-text { font-size: 9px; }
      .popup {
        position: fixed; bottom: 0; right: 0; left: 0; top: 0;
        width: 100%; max-width: 100%; height: 100%; max-height: 100%;
        border-radius: 0;
      }
      .popup.compact, .popup.tall { height: 100%; }
    }
  `;
  shadow.appendChild(style);

  const wrapper = document.createElement('div');
  wrapper.innerHTML = `
    <button class="trigger-btn">
      ${isVibeVaults ? '<div class="top-text">VibeVaults</div>' : ''}
      <div class="bottom-text">Feedback</div>
      <div class="badge"></div>
    </button>
    <div class="popup compact">
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
          <div class="view-form-body">
            <div class="attachments-bar">
              <button type="button" class="attach-btn" id="vv-capture-btn">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                Screenshot
              </button>
              <button type="button" class="attach-btn" id="vv-attach-btn">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>
                Attach Files
              </button>
              <input type="file" id="vv-file-input" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv" style="display:none;" />
            </div>
            <div class="attach-previews" id="vv-attach-previews"></div>
            <div class="upload-progress" id="vv-upload-progress" style="display:none;"></div>
            <textarea id="vv-textarea" placeholder="Describe your issue..."></textarea>
            <div class="checkbox-wrapper">
              <input type="checkbox" id="vv-notify-replies" class="checkbox-input" ${notifyRepliesSetting ? 'checked' : ''} />
              <label for="vv-notify-replies" class="checkbox-label">Notify me when someone replies</label>
            </div>
          </div>
          <div class="view-form-footer">
            <div id="vv-submit-error" style="display:none; color: #b91c1c; font-size: 13px; margin-bottom: 8px; padding: 10px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px;"></div>
            <button class="btn" id="vv-submit" style="width: 100%;">Send Feedback</button>
          </div>
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
        <div class="view-email-prompt" id="vv-email-prompt">
          <p>Enter your email to get started</p>
          <input type="email" class="email-prompt-input" id="vv-email-input" placeholder="you@example.com" />
          <div class="email-prompt-error" id="vv-email-error"></div>
          <button class="btn" id="vv-email-verify">Continue</button>
        </div>
        <div class="success-view" id="vv-success">
          <div style="width:40px;height:40px;background:#ecfdf5;color:#10b981;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 12px"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg></div>
          <p style="font-weight:700;color:#1f2937;margin:0">Sent!</p><p style="font-size:14px;color:#6b7280;margin:8px 0 0">We'll chat soon.</p>
        </div>
      </div>
      <div class="branding">Powered by <a href="https://vibe-vaults.com" target="_blank">VibeVaults</a></div>
    </div>
  `;
  shadow.appendChild(wrapper);

  // If user needs email verification, show the prompt view by default
  if (needsEmailVerification) {
    wrapper.querySelector('.view-form').style.display = 'none';
    wrapper.querySelector('.nav').style.display = 'none';
    wrapper.querySelector('#vv-email-prompt').style.display = 'flex';
  }

  // Fetch project setting context asynchronously
  const fetchUrl = `${API_BASE}?key=${apiKey}${clientEmail ? '&sender=' + encodeURIComponent(clientEmail) : ''}`;
  fetch(fetchUrl)
    .then(r => r.json())
    .then(data => {
      if (data.notifyReplies !== undefined) {
        notifyRepliesSetting = data.notifyReplies;
        localStorage.setItem(prefsKey, data.notifyReplies.toString());
        const checkbox = wrapper.querySelector('#vv-notify-replies');
        if (checkbox) checkbox.checked = notifyRepliesSetting;
      }
    })
    .catch(() => { });

  // --- View switching ---
  const switchView = (v) => {
    wrapper.querySelectorAll('.nav-item').forEach(i => i.classList.toggle('active', i.dataset.view === v));
    wrapper.querySelector('.view-form').style.display = v === 'form' ? 'flex' : 'none';
    wrapper.querySelector('.view-feedbacks').style.display = v === 'feedbacks' ? 'flex' : 'none';
    wrapper.querySelector('.view-detail').style.display = v === 'detail' ? 'flex' : 'none';
    wrapper.querySelector('#vv-success').style.display = v === 'success' ? 'block' : 'none';
    wrapper.querySelector('#vv-email-prompt').style.display = v === 'email-prompt' ? 'flex' : 'none';
    // Hide nav when showing email prompt
    wrapper.querySelector('.nav').style.display = v === 'email-prompt' ? 'none' : 'flex';
    // Compact popup for form/success views, taller for detail conversation, default for feedbacks list
    const popup = wrapper.querySelector('.popup');
    popup.classList.toggle('compact', v === 'form' || v === 'success' || v === 'email-prompt');
    popup.classList.toggle('tall', v === 'detail');
    if (v === 'feedbacks') { fetchAllFeedbacks(); startListPolling(); } else { stopListPolling(); }
    if (v === 'detail') { startStream(); } else { stopStream(); stopPolling(); }
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
    // Only show loading spinner if list is empty (first load), not on poll refreshes
    if (!listEl.querySelector('.feedback-item')) {
      listEl.innerHTML = '<div class="feedbacks-loading">Loading feedbacks...</div>';
    }
    try {
      const res = await fetch(`${API_FEEDBACKS}?key=${apiKey}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        listEl.innerHTML = `<div class="feedbacks-loading">${err.error || 'Failed to load feedbacks.'}</div>`;
        return;
      }
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

    // Render detail header with feedback-level attachments
    const headerEl = wrapper.querySelector('#vv-detail-header');
    if (feedback) {
      const feedbackAttachmentsHtml = feedback.attachments && feedback.attachments.length > 0
        ? `<div class="msg-attachments" style="margin-top:10px; padding:0 20px;">${feedback.attachments.map(a => {
          const isImage = a.mime_type && a.mime_type.startsWith('image/');
          if (isImage) {
            return `<a class="msg-attachment" href="${a.file_url}" target="_blank" rel="noopener"><img src="${a.file_url}" alt="${escapeHtml(a.file_name)}" loading="lazy"></a>`;
          }
          return `<a class="msg-attachment-file" href="${a.file_url}" target="_blank" rel="noopener">${escapeHtml(a.file_name)}</a>`;
        }).join('')}</div>`
        : '';
      headerEl.innerHTML = `
        <div class="detail-header-top">
          <span class="feedback-status ${getStatusClass(feedback.status)}">${feedback.status || 'open'}</span>
          <span class="detail-sender">${escapeHtml(feedback.sender)}</span>
        </div>
        <p class="detail-content">${escapeHtml(feedback.content)}</p>
        ${feedbackAttachmentsHtml}
      `;
    }

    // Render reply section (email prompt if no email stored, or chat input)
    renderReplySection();

    // Switch to detail view and fetch replies
    wrapper.querySelector('.view-feedbacks').style.display = 'none';
    wrapper.querySelector('.view-detail').style.display = 'flex';
    wrapper.querySelector('.popup').classList.add('tall');
    // Highlight feedbacks tab in nav
    wrapper.querySelectorAll('.nav-item').forEach(i => i.classList.toggle('active', i.dataset.view === 'feedbacks'));
    fetchReplies();
    startStream();
  };

  const renderReplySection = () => {
    const section = wrapper.querySelector('#vv-reply-section');
    replyAttachments = [];
    if (clientEmail) {
      section.innerHTML = `
        <div class="reply-attach-previews" id="vv-reply-attach-previews"></div>
        <div class="chat-input" style="border-top: none; padding: 0;">
          <button type="button" id="vv-reply-capture-btn" style="background: none; border: 1px solid #d1d5db; border-radius: 8px; padding: 8px; cursor: pointer; display: flex; align-items: center; color: #6b7280;" title="Screenshot">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
          </button>
          <button type="button" id="vv-reply-attach-btn" style="background: none; border: 1px solid #d1d5db; border-radius: 8px; padding: 8px; cursor: pointer; display: flex; align-items: center; color: #6b7280;" title="Attach files">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>
          </button>
          <input type="file" id="vv-reply-file-input" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv" style="display:none;" />
          <input type="text" id="vv-reply-text" placeholder="Type a reply...">
          <button class="btn btn-sm" id="vv-send-reply">Send</button>
        </div>
        <div id="vv-reply-error" style="display:none; color: #b91c1c; font-size: 12px; margin-top: 8px;"></div>
      <style>#vv-reply-section { border-top: 1px solid #f3f4f6; padding: 8px 20px; }</style>
      `;
      section.querySelector('#vv-send-reply').onclick = sendReply;
      section.querySelector('#vv-reply-text').onkeydown = (e) => {
        section.querySelector('#vv-reply-error').style.display = 'none';
        if (e.key === 'Enter') sendReply();
      };
      // Reply screenshot capture
      section.querySelector('#vv-reply-capture-btn').onclick = () => captureScreenshotAndElement('reply');
      // Reply file attachment
      const replyFileInput = section.querySelector('#vv-reply-file-input');
      section.querySelector('#vv-reply-attach-btn').onclick = () => replyFileInput.click();
      replyFileInput.onchange = () => {
        const newFiles = validateFiles(Array.from(replyFileInput.files));
        const totalAllowed = MAX_FILES - replyAttachments.length;
        if (newFiles.length > totalAllowed) {
          alert('Maximum ' + MAX_FILES + ' files allowed.');
          replyAttachments.push(...newFiles.slice(0, totalAllowed));
        } else {
          replyAttachments.push(...newFiles);
        }
        refreshReplyPreviews();
        replyFileInput.value = '';
      };
    } else {
      section.innerHTML = `
        <div style="padding: 16px; text-align: center; font-size: 12px; color: #6b7280; background: #f9fafb; border-top: 1px solid #f3f4f6;">
          You must be invited via a VibeVaults tracking link to reply.
        </div>
      `;
    }
  };

  const goBackToList = () => {
    selectedFeedbackId = null;
    stopStream();
    stopPolling();
    wrapper.querySelector('.view-detail').style.display = 'none';
    wrapper.querySelector('.view-feedbacks').style.display = 'flex';
    wrapper.querySelector('.popup').classList.remove('tall');
    fetchAllFeedbacks(); // Refresh list
    startListPolling();
  };

  // --- Replies ---
  const renderReplyAttachments = (attachments) => {
    if (!attachments || attachments.length === 0) return '';
    const items = attachments.map(a => {
      const isImage = a.mime_type && a.mime_type.startsWith('image/');
      if (isImage) {
        return `<a class="msg-attachment" href="${a.file_url}" target="_blank" rel="noopener"><img src="${a.file_url}" alt="${escapeHtml(a.file_name)}" loading="lazy"></a>`;
      }
      return `<a class="msg-attachment-file" href="${a.file_url}" target="_blank" rel="noopener">${escapeHtml(a.file_name)}</a>`;
    }).join('');
    return `<div class="msg-attachments">${items}</div>`;
  };

  const renderReplyBubble = (r) => `
    <div class="msg-wrapper ${r.author_role}" data-reply-id="${r.id || ''}">
      <div class="msg-meta ${r.author_role}">
        <span style="font-weight:700; text-transform:uppercase; letter-spacing:-0.5px;">${r.author_role === 'agency' ? escapeHtml(r.author_name || 'Support') : escapeHtml(r.author_name || 'Client')}</span>
        <span style="color:#d1d5db;">•</span>
        <span>${new Date(r.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
      </div>
      ${r.content ? `<div class="message ${r.author_role}">${escapeHtml(r.content)}</div>` : ''}
      ${renderReplyAttachments(r.attachments)}
    </div>
  `;


  const fetchReplies = async () => {
    if (!selectedFeedbackId) return;
    try {
      const res = await fetch(`${API_REPLY}?feedbackId=${selectedFeedbackId}&key=${apiKey}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const chatEl = wrapper.querySelector('#vv-chat');
        if (chatEl) chatEl.innerHTML = `<div class="chat-no-replies">${err.error || 'Could not load replies.'}</div>`;
        return;
      }
      const data = await res.json();
      const chatEl = wrapper.querySelector('#vv-chat');
      if (data.replies && data.replies.length > 0) {
        chatEl.innerHTML = data.replies.map(renderReplyBubble).join('');
        chatEl.scrollTop = chatEl.scrollHeight;
      } else {
        chatEl.innerHTML = '<div class="chat-no-replies">No replies yet. Start the conversation!</div>';
      }
    } catch (e) {
      console.error('[VibeVaults] Failed to fetch replies:', e);
      const chatEl = wrapper.querySelector('#vv-chat');
      if (chatEl) chatEl.innerHTML = '<div class="chat-no-replies">Could not load replies. Retrying…</div>';
    }
  };

  // --- SSE Realtime (primary) with polling fallback ---
  const startStream = () => {
    stopStream();
    if (!selectedFeedbackId) return;

    if (sseSupported) {
      const url = `${API_STREAM}?feedbackId=${selectedFeedbackId}&key=${apiKey}`;
      eventSource = new EventSource(url);

      eventSource.addEventListener('new_reply', () => {
        // Refetch all replies to get complete data including attachments
        fetchReplies();
      });

      eventSource.addEventListener('new_attachment', () => {
        // Refetch replies to pick up newly uploaded attachments
        fetchReplies();
      });

      eventSource.addEventListener('status_update', (e) => {
        try {
          const { status } = JSON.parse(e.data);
          // Update status in the detail header
          const detailStatus = wrapper.querySelector('.detail-header .feedback-status');
          if (detailStatus) {
            detailStatus.className = 'feedback-status ' + getStatusClass(status);
            detailStatus.textContent = status || 'open';
          }
          // Update cached feedback so going back to list reflects the change
          const cached = cachedFeedbacks.find(f => f.id === selectedFeedbackId);
          if (cached) cached.status = status;
        } catch (err) { console.error('[VibeVaults] Failed to parse status update:', err); }
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

  const startListPolling = () => { stopListPolling(); listPollInterval = setInterval(fetchAllFeedbacks, 10000); };
  const stopListPolling = () => { if (listPollInterval) clearInterval(listPollInterval); listPollInterval = null; };

  const stopAll = () => { stopStream(); stopPolling(); stopListPolling(); };

  // --- Send feedback ---
  const sendFeedback = async () => {
    const text = wrapper.querySelector('#vv-textarea').value.trim();
    const btn = wrapper.querySelector('#vv-submit');
    const submitErrorMsg = wrapper.querySelector('#vv-submit-error');
    if (!text) {
      submitErrorMsg.textContent = 'Please describe your issue.';
      submitErrorMsg.style.display = 'block';
      return;
    }
    submitErrorMsg.style.display = 'none';

    if (!clientEmail) {
      alert("Missing identity: Please use the VibeVaults invite link provided by your agency to leave feedback.");
      return;
    }

    btn.disabled = true;
    btn.disabled = true;
    try {
      const metadata = getMetadata();
      if (domSelector) metadata.dom_selector = domSelector;

      const notifyRepliesCheckbox = wrapper.querySelector('#vv-notify-replies');
      const notifyReplies = notifyRepliesCheckbox ? notifyRepliesCheckbox.checked : true;
      localStorage.setItem(prefsKey, notifyReplies.toString());

      // Show upload progress if there are attachments
      const progressEl = wrapper.querySelector('#vv-upload-progress');
      if (pendingAttachments.length > 0) {
        progressEl.textContent = `Uploading ${pendingAttachments.length} file(s)...`;
        progressEl.style.display = 'block';
      }

      const res = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey, content: text, sender: clientEmail, metadata, notifyReplies })
      });
      const data = await res.json();
      if (data.success && data.feedback_id) {
        // Upload attachments linked to the new feedback
        if (pendingAttachments.length > 0) {
          try {
            await uploadFiles(pendingAttachments, data.feedback_id, null);
          } catch (uploadErr) {
            console.error('[VibeVaults] Attachment upload failed:', uploadErr);
            // Feedback was created, but attachments failed — don't block success
          }
        }

        // Reset form
        wrapper.querySelector('#vv-textarea').value = '';
        pendingAttachments = [];
        wrapper.querySelector('#vv-attach-previews').innerHTML = '';
        if (progressEl) progressEl.style.display = 'none';
        domSelector = null;
        updatePopupHeight();

        switchView('success');
      } else {
        submitErrorMsg.innerText = data.error || 'Error sending feedback.';
        submitErrorMsg.style.display = 'block';
        updatePopupHeight();
        if (progressEl) progressEl.style.display = 'none';
      }
    } catch (e) {
      submitErrorMsg.innerText = 'Network error. Please try again.';
      submitErrorMsg.style.display = 'block';
      updatePopupHeight();
      const progressEl = wrapper.querySelector('#vv-upload-progress');
      if (progressEl) progressEl.style.display = 'none';
    } finally { btn.disabled = false; }
  };

  // --- Inspector Mode ---
  const captureScreenshotAndElement = (target = 'form') => {
    wrapper.querySelector('.popup').classList.remove('open');
    wrapper.querySelector('.badge').style.display = 'block';

    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100vw';
    overlay.style.height = '100vh';
    overlay.style.zIndex = '999998';
    overlay.style.cursor = 'crosshair';

    const highlightBox = document.createElement('div');
    highlightBox.style.position = 'absolute';
    highlightBox.style.border = '2px solid #209CEE';
    highlightBox.style.background = 'rgba(32, 156, 238, 0.1)';
    highlightBox.style.pointerEvents = 'none';
    highlightBox.style.transition = 'all 0.1s ease-out';
    highlightBox.style.zIndex = '999999';
    overlay.appendChild(highlightBox);
    document.body.appendChild(overlay);

    const banner = document.createElement('div');
    banner.innerHTML = `
      <div style="background: #1f2937; color: white; padding: 12px 20px; font-family: sans-serif; font-size: 14px; font-weight: 500; border-radius: 8px; display: flex; align-items: center; gap: 16px; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1);">
        <span>Hover over an element and click to capture</span>
        <button id="vv-cancel-capture" style="background: rgba(255,255,255,0.1); border: none; color: white; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 12px;">Cancel</button>
      </div>
    `;
    banner.style.position = 'fixed';
    banner.style.top = '20px';
    banner.style.left = '50%';
    banner.style.transform = 'translateX(-50%)';
    banner.style.zIndex = '999999';
    document.body.appendChild(banner);

    let currentTarget = null;

    const handleMouseMove = (e) => {
      overlay.style.pointerEvents = 'none';
      const target = document.elementFromPoint(e.clientX, e.clientY);
      overlay.style.pointerEvents = 'auto';

      if (!target || target === document.body || target === document.documentElement) return;
      if (target.closest('#vibe-vaults-widget-host') || target.closest('[id^="vv-"]')) return;

      currentTarget = target;
      const rect = target.getBoundingClientRect();
      highlightBox.style.top = (rect.top + window.scrollY) + 'px';
      highlightBox.style.left = (rect.left + window.scrollX) + 'px';
      highlightBox.style.width = rect.width + 'px';
      highlightBox.style.height = rect.height + 'px';
    };

    const cleanup = () => {
      overlay.remove();
      banner.remove();
      wrapper.querySelector('.popup').classList.add('open');
      wrapper.querySelector('.badge').style.display = 'none';
      document.removeEventListener('keydown', handleKeyDown);
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') cleanup();
    };

    document.addEventListener('keydown', handleKeyDown);
    overlay.addEventListener('mousemove', handleMouseMove);
    overlay.addEventListener('click', async (e) => {
      e.preventDefault(); e.stopPropagation();
      banner.remove();
      overlay.removeEventListener('mousemove', handleMouseMove);

      if (currentTarget) {
        if (currentTarget.id) domSelector = '#' + currentTarget.id;
        else if (currentTarget.className && typeof currentTarget.className === 'string') domSelector = '.' + currentTarget.className.split(' ').filter(Boolean).join('.');
        else domSelector = currentTarget.tagName.toLowerCase();
      }

      const capBtn = target === 'reply'
        ? wrapper.querySelector('#vv-reply-capture-btn')
        : wrapper.querySelector('#vv-capture-btn');
      const originalText = capBtn ? capBtn.innerHTML : '';
      if (capBtn) { capBtn.innerHTML = 'Capturing...'; capBtn.disabled = true; }

      const finishCapture = async (dataUrl) => {
        const res = await fetch(dataUrl);
        const blob = await res.blob();
        const screenshotFile = new File([blob], 'screenshot.jpg', { type: 'image/jpeg' });

        if (target === 'reply') {
          replyAttachments = replyAttachments.filter(f => f.name !== 'screenshot.jpg');
          if (replyAttachments.length >= MAX_FILES) {
            alert('Maximum ' + MAX_FILES + ' files allowed.');
            cleanup();
            if (capBtn) { capBtn.innerHTML = originalText; capBtn.disabled = false; }
            return;
          }
          replyAttachments.unshift(screenshotFile);
          refreshReplyPreviews();
        } else {
          pendingAttachments = pendingAttachments.filter(f => f.name !== 'screenshot.jpg');
          if (pendingAttachments.length >= MAX_FILES) {
            alert('Maximum ' + MAX_FILES + ' files allowed.');
            cleanup();
            if (capBtn) { capBtn.innerHTML = originalText; capBtn.disabled = false; }
            return;
          }
          pendingAttachments.unshift(screenshotFile);
          refreshFeedbackPreviews();
        }
        cleanup();
        if (capBtn) { capBtn.innerHTML = originalText; capBtn.disabled = false; }
      };

      const captureOptions = {
        quality: 0.6,
        backgroundColor: '#ffffff',
        width: window.innerWidth,
        height: window.innerHeight,
        style: {
          transform: `translate(${-window.scrollX}px, ${-window.scrollY}px)`,
          overflow: 'hidden'
        },
        filter: (node) => {
          // exclude the widget host from screenshot
          return node.id !== 'vibe-vaults-widget-host';
        }
      };

      if (!window.htmlToImage) {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/html-to-image@1.11.11/dist/html-to-image.js';
        script.onload = () => window.htmlToImage.toJpeg(document.body, captureOptions).then(finishCapture);
        document.head.appendChild(script);
      } else {
        window.htmlToImage.toJpeg(document.body, captureOptions).then(finishCapture);
      }
    });

    banner.querySelector('#vv-cancel-capture').onclick = (e) => { e.preventDefault(); e.stopPropagation(); cleanup(); };
  };

  // --- Send reply ---
  const sendReply = async () => {
    const textEl = wrapper.querySelector('#vv-reply-text');
    const errEl = wrapper.querySelector('#vv-reply-error');
    if (!textEl) return;
    const text = textEl.value.trim();
    if ((!text && replyAttachments.length === 0) || !selectedFeedbackId || !clientEmail) return;
    const btn = wrapper.querySelector('#vv-send-reply');
    btn.disabled = true;
    if (errEl) errEl.style.display = 'none';

    try {
      const res = await fetch(API_REPLY, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedbackId: selectedFeedbackId, content: text || '', apiKey, senderEmail: clientEmail, hasAttachments: replyAttachments.length > 0 })
      });
      if (res.ok) {
        const replyData = await res.json();
        // Upload reply attachments if any
        if (replyAttachments.length > 0) {
          try {
            await uploadFiles(replyAttachments, selectedFeedbackId, replyData.replyId || null);
          } catch (uploadErr) {
            console.error('[VibeVaults] Reply attachment upload failed:', uploadErr);
          }
        }
        textEl.value = '';
        replyAttachments = [];
        const replyPreviewsEl = wrapper.querySelector('#vv-reply-attach-previews');
        if (replyPreviewsEl) replyPreviewsEl.innerHTML = '';
        fetchReplies();
      } else {
        const err = await res.json();
        if (errEl) {
          errEl.innerText = err.error || 'Failed to send reply.';
          errEl.style.display = 'block';
        }
      }
    } catch (e) {
      if (errEl) {
        errEl.innerText = 'Network error. Please try again.';
        errEl.style.display = 'block';
      }
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

  let savedBodyOverflow = '';
  const isMobile = () => window.innerWidth <= 480;
  const lockScroll = () => {
    if (isMobile()) {
      savedBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
  };
  const unlockScroll = () => {
    document.body.style.overflow = savedBodyOverflow;
  };

  triggerBtn.onclick = () => {
    isOpen = !isOpen;
    wrapper.querySelector('.popup').classList.toggle('open', isOpen);
    if (isOpen) {
      lockScroll();
      wrapper.querySelector('.badge').style.display = 'none';
      if (needsEmailVerification) {
        switchView('email-prompt');
      }
    } else {
      unlockScroll();
      stopAll();
    }
  };
  wrapper.querySelector('.close-btn').onclick = () => triggerBtn.onclick();
  wrapper.querySelector('#vv-submit').onclick = sendFeedback;
  wrapper.querySelector('#vv-capture-btn').onclick = captureScreenshotAndElement;

  // File attachment button
  const fileInput = wrapper.querySelector('#vv-file-input');
  wrapper.querySelector('#vv-attach-btn').onclick = () => fileInput.click();
  fileInput.onchange = () => {
    const newFiles = validateFiles(Array.from(fileInput.files));
    const totalAllowed = MAX_FILES - pendingAttachments.length;
    if (newFiles.length > totalAllowed) {
      alert('Maximum ' + MAX_FILES + ' files allowed. You can add ' + totalAllowed + ' more.');
      pendingAttachments.push(...newFiles.slice(0, totalAllowed));
    } else {
      pendingAttachments.push(...newFiles);
    }
    refreshFeedbackPreviews();
    fileInput.value = '';
  };
  wrapper.querySelector('#vv-back-btn').onclick = goBackToList;
  wrapper.querySelectorAll('.nav-item').forEach(i => i.onclick = () => {
    if (needsEmailVerification) return; // Block navigation until email is verified
    if (i.dataset.view === 'feedbacks' && selectedFeedbackId) {
      // If user is in detail view and clicks "Feedbacks" tab, go back to list
      goBackToList();
    }
    switchView(i.dataset.view);
  });

  const notifyCheckbox = wrapper.querySelector('#vv-notify-replies');
  if (notifyCheckbox) {
    notifyCheckbox.addEventListener('change', (e) => {
      localStorage.setItem(prefsKey, e.target.checked.toString());
      notifyRepliesSetting = e.target.checked;
    });
  }

  // --- Email verification prompt ---
  const verifyEmailBtn = wrapper.querySelector('#vv-email-verify');
  const emailInput = wrapper.querySelector('#vv-email-input');
  const emailError = wrapper.querySelector('#vv-email-error');

  const handleEmailVerify = async () => {
    const email = emailInput.value.trim().toLowerCase();
    emailError.textContent = '';

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      emailError.textContent = 'Please enter a valid email address.';
      return;
    }

    verifyEmailBtn.disabled = true;
    verifyEmailBtn.textContent = 'Verifying...';

    try {
      const res = await fetch(`${API_VERIFY}?key=${apiKey}&email=${encodeURIComponent(email)}`);
      const data = await res.json();

      if (data.authorized) {
        clientEmail = email;
        localStorage.setItem(emailKey, clientEmail);
        needsEmailVerification = false;
        switchView('form');
      } else {
        emailError.textContent = 'This email does not have access. Please contact the site owner.';
      }
    } catch (e) {
      emailError.textContent = 'Network error. Please try again.';
    } finally {
      verifyEmailBtn.disabled = false;
      verifyEmailBtn.textContent = 'Continue';
    }
  };

  verifyEmailBtn.onclick = handleEmailVerify;
  emailInput.onkeydown = (e) => {
    emailError.textContent = '';
    if (e.key === 'Enter') handleEmailVerify();
  };
})();
