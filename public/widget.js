(function () {
  // Capture script reference synchronously (only available during inline execution)
  const scriptTag = document.currentScript;

  function init() {
    // Dynamically determine API base from script source (works for local & prod)
    const scriptUrl = new URL(scriptTag.src);
    let origin = scriptUrl.origin;

    // If loaded from apex domain, force canonical www to avoid CORS preflight redirects
    if (origin === 'https://vibe-vaults.com') {
      origin = 'https://www.vibe-vaults.com';
    }

    const API_BASE = `${origin}/api/widget`;
    const API_REPLY = `${origin}/api/widget/reply`;
    const API_FEEDBACK = `${origin}/api/widget/feedback`;
    const API_STREAM = `${origin}/api/widget/stream`;
    const API_UPLOAD = `${origin}/api/widget/upload`;
    const API_UPLOAD_CONFIRM = `${origin}/api/widget/upload/confirm`;
    const API_IDENTITY_EXCHANGE = `${origin}/api/widget/identity/exchange`;
    const API_ERRORS = `${origin}/api/widget/errors`;
    const API_CAPTURE_INFO = `${origin}/api/widget/capture-info`;

    const apiKey = scriptTag ? scriptTag.getAttribute('data-key') : null;

    if (!apiKey) {
      console.warn('VibeVaults: Missing data-key attribute on script tag.');
      return;
    }

    const isVibeVaults = apiKey === 'e3917e214418009aea8b7a2712cb0059';

    // --- State Management ---
    // Auth model: per-device opaque token issued by /api/widget/identity/exchange
    // when the visitor lands on the host site with `?vv_invite=<workspace_invites.id>`.
    // The token is stored in first-party localStorage on this origin and sent as a
    // Bearer header on every widget API call. Anonymous visitors (no token) get no
    // widget UI at all.
    let isOpen = false;
    const tokenKey = `vv_token_${apiKey}`;
    const emailKey = `vv_email_${apiKey}`; // cached only for "self vs other" message styling
    const prefsKey = `vv_prefs_${apiKey}`;

    // Pin is a one-shot action rather than a mode: arming it places exactly one
    // pin and then disarms, so the customer's site stays clickable the rest of
    // the time. Collapsing the widget is what hides the pins.
    let pinArmed = false;
    let listOpen = false;
    // Review-link pause: reads stay open, writes are blocked server-side; the
    // widget mirrors that so reviewers see why nothing can be submitted.
    let reviewPaused = false;

    let widgetToken = localStorage.getItem(tokenKey) || '';
    let clientEmail = localStorage.getItem(emailKey) || '';
    let notifyRepliesSetting = localStorage.getItem(prefsKey) !== 'false';

    // Three bootstrap URL params, all stripped before render so they don't leak
    // via referrer/share:
    //   * vv_invite : workspace_invites.id — exchanged for a token by the server
    //                (client-invitee flow)
    //   * vv_token  : raw widget token — planted directly into localStorage
    //                (owner/member self-issued flow from the dashboard)
    //   * vv_review : projects.review_token — permanent shareable review link;
    //                the visitor self-identifies (name + email) before the
    //                exchange, no per-person invite exists
    const urlParams = new URLSearchParams(window.location.search);
    const inviteToken = urlParams.get('vv_invite');
    const directToken = urlParams.get('vv_token');
    const reviewToken = urlParams.get('vv_review');
    if (inviteToken || directToken || reviewToken) {
      urlParams.delete('vv_invite');
      urlParams.delete('vv_token');
      urlParams.delete('vv_review');
      const newParams = urlParams.toString();
      const cleanUrl = window.location.pathname + (newParams ? '?' + newParams : '') + window.location.hash;
      window.history.replaceState({}, '', cleanUrl);
    }
    if (directToken) {
      widgetToken = directToken;
      localStorage.setItem(tokenKey, widgetToken);
    }

    const authHeaders = () => widgetToken ? { 'Authorization': `Bearer ${widgetToken}` } : {};

    const clearWidgetIdentity = () => {
      widgetToken = '';
      clientEmail = '';
      localStorage.removeItem(tokenKey);
      localStorage.removeItem(emailKey);
    };

    let selectedFeedbackId = null;
    let cachedFeedback = [];
    let pollInterval = null;
    let listPollInterval = null;
    let eventSource = null;
    let sseSupported = typeof EventSource !== 'undefined';
    let replyAttachments = []; // Files queued for upload with reply
    let pinAttachments = []; // Files queued for upload with a pinned report
    let pendingAnchor = null; // Anchor for the pin currently being composed
    let pinTrackingFrame = null;

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

    // --- Failed-request capture ---
    // Network failures are the most common cause of "I clicked it and nothing
    // happened" bug reports, and they never reach console.* — the browser writes
    // them straight to DevTools. We patch fetch/XHR so they land in the same
    // buffer the console logs use.
    //
    // Privacy: only origin + pathname is recorded. Query strings are dropped
    // wholesale because they routinely carry access tokens, password-reset
    // tokens, and email addresses belonging to the host site's end users — data
    // we have no business storing. Email-shaped path segments are redacted for
    // the same reason. Documented for customers at /docs/widget-data.
    const MAX_NETWORK_LOGS = 15;
    const EMAIL_SEGMENT = /^[^@\s/]+@[^@\s/]+\.[^@\s/]+$/;
    const NETWORK_ERROR_REASON = 'network error (blocked, offline, CORS, or DNS)';
    const seenNetworkFailures = new Set();

    const sanitizeRequestUrl = (raw) => {
      const u = new URL(raw, window.location.href);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
      // Never record our own traffic — widget noise is useless in a bug report,
      // and a blocked telemetry call is not the customer's problem.
      if (u.origin === origin && u.pathname.startsWith('/api/widget')) return null;
      const path = u.pathname
        .split('/')
        .map((seg) => (EMAIL_SEGMENT.test(seg) ? '[redacted]' : seg.length > 64 ? seg.slice(0, 64) + '...' : seg))
        .join('/');
      return `${u.origin}${path}`.slice(0, 300);
    };

    const recordNetworkFailure = (method, rawUrl, outcome) => {
      try {
        if (seenNetworkFailures.size >= MAX_NETWORK_LOGS) return;
        const url = sanitizeRequestUrl(rawUrl);
        if (!url) return;
        // One entry per distinct failure per session, so a retry loop can't
        // evict every console log from the buffer.
        const key = `${method} ${url} failed: ${outcome}`;
        if (seenNetworkFailures.has(key)) return;
        seenNetworkFailures.add(key);
        logs.push({ type: 'network', time: new Date().toLocaleTimeString(), content: key });
        if (logs.length > MAX_LOGS) logs.shift();
      } catch (e) { /* never break a host page request over a log line */ }
    };

    // Guarded so a page embedding widget.js twice doesn't double-wrap fetch.
    if (!window.__vvNetworkPatched) {
      window.__vvNetworkPatched = true;

      if (window.fetch) {
        const originalFetch = window.fetch;
        window.fetch = function (...args) {
          let method = 'GET';
          let rawUrl = '';
          try {
            const [input, opts] = args;
            rawUrl = typeof input === 'string' ? input : (input && input.url) ? input.url : String(input || '');
            method = String((opts && opts.method) || (input && input.method) || 'GET').toUpperCase();
          } catch (e) { /* fall through with defaults */ }
          return originalFetch.apply(this, args).then(
            (res) => {
              if (!res.ok) recordNetworkFailure(method, rawUrl, `${res.status} ${res.statusText || ''}`.trim());
              return res;
            },
            (err) => {
              recordNetworkFailure(method, rawUrl, NETWORK_ERROR_REASON);
              throw err;
            }
          );
        };
      }

      const XHR = window.XMLHttpRequest;
      if (XHR && XHR.prototype) {
        const originalOpen = XHR.prototype.open;
        const originalSend = XHR.prototype.send;
        XHR.prototype.open = function (method, url, ...rest) {
          try {
            this.__vvMethod = String(method || 'GET').toUpperCase();
            this.__vvUrl = url;
          } catch (e) { /* frozen instance — skip capture, never block the request */ }
          return originalOpen.call(this, method, url, ...rest);
        };
        XHR.prototype.send = function (...args) {
          try {
            const method = this.__vvMethod || 'GET';
            const url = this.__vvUrl || '';
            this.addEventListener('load', () => {
              if (this.status >= 400) recordNetworkFailure(method, url, `${this.status} ${this.statusText || ''}`.trim());
            });
            this.addEventListener('error', () => recordNetworkFailure(method, url, NETWORK_ERROR_REASON));
            this.addEventListener('timeout', () => recordNetworkFailure(method, url, 'timeout'));
          } catch (e) { /* capture is best-effort */ }
          return originalSend.apply(this, args);
        };
      }
    }

    const getMetadata = () => ({
      url: window.location.href,
      userAgent: navigator.userAgent,
      screen: `${window.innerWidth}x${window.innerHeight}`,
      viewport: `${document.documentElement.clientWidth}x${document.documentElement.clientHeight}`,
      language: navigator.language,
      logs: logs
    });

    // --- Error Reporter (sends widget errors to Supabase via /api/widget/errors) ---
    const reportedErrors = new Set();
    const reportError = (message, stack) => {
      // Deduplicate identical errors within the same page session
      const key = message + (stack || '');
      if (reportedErrors.has(key)) return;
      reportedErrors.add(key);
      try {
        const payload = JSON.stringify({
          apiKey,
          message: String(message).slice(0, 2000),
          stack: stack ? String(stack).slice(0, 5000) : null,
          url: window.location.href,
          userAgent: navigator.userAgent,
          metadata: { screen: `${window.innerWidth}x${window.innerHeight}` }
        });
        // Use sendBeacon for reliability (fires even on page unload), fallback to fetch
        if (navigator.sendBeacon) {
          navigator.sendBeacon(API_ERRORS, new Blob([payload], { type: 'application/json' }));
        } else {
          fetch(API_ERRORS, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload }).catch(() => { });
        }
      } catch (e) { /* silently fail — error reporting must never break the widget */ }
    };

    // Capture unhandled errors and promise rejections from the widget
    window.addEventListener('error', (e) => {
      if (e.filename && e.filename.includes('widget.js')) {
        reportError(e.message, e.error?.stack);
      }
    });
    window.addEventListener('unhandledrejection', (e) => {
      const msg = e.reason?.message || String(e.reason);
      const stack = e.reason?.stack;
      reportError(msg, stack);
    });

    // --- File Upload Helpers ---
    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/plain', 'text/csv'];
    const MAX_FILE_SIZE = 10 * 1024 * 1024;
    const MAX_FILES = 10;

    const uploadFiles = async (files, feedbackId, replyId) => {
      if (files.length === 0) return { attachments: [] };

      // Step 1: Request presigned upload URLs (small JSON, no file bytes)
      const fileMeta = files.map(f => ({ name: f.name, size: f.size, type: f.type }));
      const urlRes = await fetch(API_UPLOAD, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ apiKey, files: fileMeta }),
      });
      if (!urlRes.ok) {
        const err = await urlRes.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to prepare upload');
      }
      const { projectId, uploads } = await urlRes.json();

      // Step 2: Upload each file directly to Supabase Storage via presigned URL
      const completedFiles = [];
      for (let i = 0; i < uploads.length; i++) {
        const upload = uploads[i];
        const file = files[i];
        const storageRes = await fetch(upload.signedUrl, {
          method: 'PUT',
          headers: { 'Content-Type': upload.mimeType },
          body: file,
        });
        if (!storageRes.ok) {
          throw new Error(`Failed to upload "${upload.fileName}"`);
        }
        completedFiles.push({
          fileId: upload.fileId,
          path: upload.path,
          fileName: upload.fileName,
          size: file.size,
          mimeType: upload.mimeType,
        });
      }

      // Step 3: Confirm uploads and create DB records
      const confirmRes = await fetch(API_UPLOAD_CONFIRM, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ apiKey, projectId, feedbackId, replyId, files: completedFiles }),
      });
      if (!confirmRes.ok) {
        const err = await confirmRes.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to confirm upload');
      }
      return await confirmRes.json();
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

    const showWidgetToast = (msg) => {
      let toast = wrapper.querySelector('.vv-toast');
      if (toast) toast.remove();
      toast = document.createElement('div');
      toast.className = 'vv-toast';
      toast.textContent = msg;
      // The composer is often the only thing open (the panel is hidden during
      // pin mode), so a toast parented to the panel would be invisible.
      const composerEl = wrapper.querySelector('#vv-composer');
      const target = composerEl && composerEl.classList.contains('open')
        ? composerEl
        : wrapper.querySelector('.popup');
      target.appendChild(toast);
      setTimeout(() => { toast.style.opacity = '0'; }, 4500);
      setTimeout(() => { toast.remove(); }, 5000);
    };

    const validateFiles = (fileList) => {
      const valid = [];
      const errors = [];
      for (const file of fileList) {
        if (file.size > MAX_FILE_SIZE) { errors.push(`"${file.name}" exceeds the 10MB limit.`); continue; }
        if (!ALLOWED_TYPES.includes(file.type)) { errors.push(`"${file.name}" has an unsupported file type.`); continue; }
        valid.push(file);
      }
      if (errors.length > 0) showWidgetToast(errors.join(' '));
      return valid;
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
    /* The host spans the whole viewport so the pin composer and pin markers can
       sit at arbitrary coordinates instead of being trapped in the corner. It
       must therefore be inert: the host never intercepts clicks on the
       customer's page, and each interactive child opts back in explicitly. */
    :host {
      position: fixed; inset: 0; z-index: 999999;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #1f2937;
      pointer-events: none !important;
    }
    * { box-sizing: border-box; }

    /* Makes the entire widget tree transparent to hit-testing for the duration
       of an elementFromPoint probe, so a pin resolves to the customer's element
       rather than to our own overlay. */
    .vv-probing, .vv-probing * { pointer-events: none !important; }

    /* Row layout, not column: the panel is also anchored bottom-right, and a
       toolbar stacked above the trigger renders behind it. */
    .launcher { position: fixed; bottom: 20px; right: 20px; pointer-events: auto; display: flex; flex-direction: row; align-items: flex-end; gap: 10px; }
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
      position: fixed; bottom: 120px; right: 20px; pointer-events: auto;
      width: 380px; max-width: calc(100vw - 40px); height: 520px; max-height: calc(100vh - 140px);
      background: white; border-radius: 16px; display: none; flex-direction: column; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1);
      border: 1px solid #e5e7eb; overflow: hidden; animation: slideUp 0.3s ease-out; transition: height 0.15s ease;
      overscroll-behavior: contain;
    }
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
    .nav-item {
      flex: 1; padding: 8px 12px; font-size: 13px; font-weight: 600; color: #4a5568;
      cursor: pointer; border-radius: 6px; transition: all 0.15s;
      display: flex; align-items: center; justify-content: center; gap: 6px;
      background: transparent; border: none; font-family: inherit;
    }
    .nav-item:hover { color: #0f172a; background: rgba(255,255,255,0.6); }
    .nav-item.active { color: #0f172a; background: white; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    #vv-action-pin.active { background: #209CEE; color: white; box-shadow: none; }

    /* The list is a toggle, so the panel is only as tall as the action bar
       until someone asks for it. */
    .popup:not(.list-open) { height: auto; }
    .popup:not(.list-open) .content { display: none; }
    /* The widget's own chrome is in the way of the page it is asking the user
       to click, and once the pin lands the composer can sit anywhere on screen
       including directly over the panel. So it stays hidden for the whole
       flow, not just while armed. The pins remain: they are context for where
       the new one should go. */
    .chrome-hidden .launcher, .chrome-hidden .popup { display: none !important; }
    .content { flex: 1; overflow: hidden; display: flex; flex-direction: column; min-height: 0; }
    textarea { width: 100%; height: 120px; padding: 12px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 14px; resize: none; font-family: inherit; background: white; color: #1f2937; }
    .sender-input { width: 100%; padding: 10px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 13px; font-family: inherit; background: white; color: #1f2937; }

    /* Feedback list */
    .view-feedback { display: none; flex-direction: column; height: 100%; }
    .feedback-list { flex: 1; overflow-y: auto; overscroll-behavior: contain; }
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
    .feedback-empty { padding: 40px 20px; text-align: center; color: #9ca3af; }
    .feedback-empty-icon { width: 40px; height: 40px; background: #f3f4f6; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 12px; }
    .feedback-loading { padding: 40px 20px; text-align: center; color: #9ca3af; font-size: 13px; }

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

    .chat-messages { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 16px; padding: 16px 20px; overscroll-behavior: contain; }
    .msg-wrapper { display: flex; flex-direction: column; max-width: 90%; gap: 6px; }
    .msg-wrapper.other { align-self: flex-start; align-items: flex-start; }
    .msg-wrapper.self { align-self: flex-end; align-items: flex-end; }
    .message { padding: 10px 16px; border-radius: 16px; font-size: 13px; line-height: 1.625; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
    .message.other { background: #f3f4f6; color: #374151; border-top-left-radius: 0; border: 1px solid rgba(229, 231, 235, 0.5); }
    .message.self { background: #209CEE; color: white; border-top-right-radius: 0; }
    .msg-meta { font-size: 10px; color: #9ca3af; padding: 0 4px; display: flex; gap: 8px; align-items: center; }
    .chat-input { display: flex; gap: 8px; border-top: 1px solid #f3f4f6; padding: 12px 20px; align-items: center; }
    .chat-input input { flex: 1 1 0; min-width: 0; padding: 10px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 13px; font-family: inherit; background: white; color: #1f2937; }
    .chat-input > button { flex-shrink: 0; }
    .chat-no-replies { padding: 30px 20px; text-align: center; color: #9ca3af; font-size: 12px; }

    .btn { background: #209CEE; color: white; border: none; padding: 10px 16px; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 14px; font-family: inherit; }
    .btn:disabled { opacity: 0.6; cursor: not-allowed; }
    .btn-sm { padding: 8px 12px; font-size: 12px; }
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
    .attach-btn { background: #f3f4f6; color: #4a5568; border: 1px solid #d1d5db; border-radius: 8px; padding: 8px 12px; font-size: 12px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 6px; flex: 1; justify-content: center; font-family: inherit; }
    .attach-btn:hover { background: #e5e7eb; }
    .attach-previews { display: flex; flex-wrap: wrap; gap: 8px; }
    .attach-preview { position: relative; width: 64px; height: 64px; border-radius: 8px; border: 1px solid #e5e7eb; overflow: hidden; background: #f9fafb; display: flex; align-items: center; justify-content: center; }
    .attach-preview img { width: 100%; height: 100%; object-fit: cover; }
    .attach-preview .file-icon { font-size: 10px; color: #6b7280; text-align: center; padding: 4px; word-break: break-all; line-height: 1.2; }
    .attach-preview .remove-attach { position: absolute; top: 2px; right: 2px; background: rgba(0,0,0,0.5); color: white; border: none; border-radius: 50%; width: 18px; height: 18px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 10px; line-height: 1; }
    .attach-preview .remove-attach:hover { background: rgba(0,0,0,0.7); }
    .attach-preview.shimmer, .reply-attach-preview.shimmer {
      background: linear-gradient(90deg, #f3f4f6 25%, #e5e7eb 50%, #f3f4f6 75%);
      background-size: 200% 100%;
      animation: shimmer 1.2s infinite;
    }
    .shimmer-label { font-size: 9px; color: #9ca3af; font-weight: 600; text-align: center; }
    @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
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

    /* Toast notification */
    .vv-toast {
      position: absolute; bottom: 48px; left: 16px; right: 16px; background: #1f2937; color: white;
      font-size: 12px; line-height: 1.4; padding: 10px 14px; border-radius: 8px; z-index: 10;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15); transition: opacity 0.3s; opacity: 1;
    }

    /* --- Pin layer ---------------------------------------------------------
       Inert container; individual markers opt back into pointer events. */
    /* Explicit stacking: the pin overlay catches page clicks, so the markers
       have to sit above it or a pin could never be opened. */
    .capture-overlay { z-index: 1; }
    .capture-highlight { z-index: 1; }
    .pin-layer { position: fixed; inset: 0; pointer-events: none; z-index: 2; }
    .capture-crosshair { z-index: 3; }
    .composer { z-index: 4; }
    .popup { z-index: 5; }
    .launcher { z-index: 5; }
    .pin-marker {
      position: fixed; width: 28px; height: 28px; pointer-events: auto; cursor: pointer;
      background: #209CEE; border: 2px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3);
      border-radius: 50% 50% 50% 2px; transform: rotate(-45deg);
      display: flex; align-items: center; justify-content: center;
      transition: transform 0.12s ease-out;
    }
    /* Deliberately not a scale(): the marker is rotated about its centre, so
       scaling would move the tip off the exact point it is marking. */
    .pin-marker:hover { filter: brightness(1.12); box-shadow: 0 4px 10px rgba(0,0,0,0.4); }
    .pin-marker span {
      transform: rotate(45deg); color: white; font-size: 11px; font-weight: 800;
      line-height: 1; user-select: none;
    }
    /* The anchor element is gone, so the pin is drawn from stored document
       coordinates and may no longer sit where it was placed. */
    .pin-marker.approximate { background: #94a3b8; border-style: dashed; }
    .pin-marker.pending { background: #f59e0b; }
    .pin-marker.cluster { background: #0f172a; }
    .pin-marker.cluster span { font-size: 10px; }

    /* --- Pin composer ------------------------------------------------------ */
    .composer {
      position: fixed; width: 320px; max-width: calc(100vw - 24px);
      background: white; border: 1px solid #e5e7eb; border-radius: 14px;
      box-shadow: 0 20px 25px -5px rgba(0,0,0,0.18); overflow: hidden;
      display: none; flex-direction: column; pointer-events: auto;
      animation: slideUp 0.16s ease-out;
    }
    .composer.open { display: flex; }
    .composer-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 10px 12px; background: #209CEE; color: white;
    }
    .composer-title { font-size: 12px; font-weight: 700; display: flex; align-items: center; gap: 6px; }
    .composer-target {
      font-size: 10px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      color: #94a3b8; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .composer-close {
      background: rgba(255,255,255,0.15); border: none; border-radius: 50%; width: 22px; height: 22px;
      color: white; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .composer-body { padding: 10px 12px; display: flex; flex-direction: column; gap: 8px; }
    .composer-body textarea { height: 84px; font-size: 13px; }
    .composer-actions { display: flex; align-items: center; gap: 6px; }
    .composer-actions .attach-btn { padding: 6px 8px; font-size: 11px; }
    .composer-footer { display: flex; gap: 6px; align-items: center; }
    .composer-footer .btn { flex: 1; padding: 8px 12px; font-size: 13px; }

    /* --- Pin capture overlay ----------------------------------------------- */
    .capture-overlay { position: fixed; inset: 0; pointer-events: auto; cursor: crosshair; }
    .capture-highlight {
      position: fixed; border: 2px solid #209CEE; background: rgba(32, 156, 238, 0.08);
      pointer-events: none; transition: all 0.1s ease-out;
    }
    .capture-banner {
      position: fixed; top: 20px; left: 50%; transform: translateX(-50%); pointer-events: auto;
      background: #1f2937; color: white; padding: 12px 20px; font-size: 14px; font-weight: 500;
      border-radius: 8px; display: flex; align-items: center; gap: 16px;
      box-shadow: 0 10px 15px -3px rgba(0,0,0,0.2);
    }
    .capture-banner button {
      background: rgba(255,255,255,0.12); border: none; color: white; padding: 6px 12px;
      border-radius: 6px; cursor: pointer; font-size: 12px; font-family: inherit;
    }
    .capture-crosshair {
      position: fixed; width: 14px; height: 14px; margin: -7px 0 0 -7px; border-radius: 50%;
      border: 2px solid #209CEE; background: rgba(32,156,238,0.25); pointer-events: none;
    }

    /* --- Review-link identity gate ----------------------------------------- */
    .review-gate {
      position: fixed; inset: 0; z-index: 6; display: none;
      align-items: center; justify-content: center;
      background: rgba(15, 23, 42, 0.45); pointer-events: auto;
    }
    .review-gate.open { display: flex; }
    .review-gate-card {
      background: white; border-radius: 16px; width: 360px; max-width: calc(100vw - 32px);
      box-shadow: 0 25px 50px -12px rgba(0,0,0,0.35); overflow: hidden;
      animation: slideUp 0.16s ease-out;
    }
    .review-gate-header { background: #209CEE; color: white; padding: 16px 20px; }
    .review-gate-header h3 { margin: 0; font-size: 16px; font-weight: 700; }
    .review-gate-header p { margin: 4px 0 0; font-size: 12px; opacity: 0.9; }
    .review-gate-body { padding: 16px 20px 20px; display: flex; flex-direction: column; gap: 10px; }
    .review-gate-body label { font-size: 12px; font-weight: 600; color: #374151; }
    .review-gate-body input {
      width: 100%; border: 1px solid #d1d5db; border-radius: 8px; padding: 9px 12px;
      font-size: 13px; font-family: inherit; outline: none; box-sizing: border-box;
    }
    .review-gate-body input:focus { border-color: #209CEE; box-shadow: 0 0 0 3px rgba(32,156,238,0.15); }
    .review-gate-error { color: #dc2626; font-size: 12px; display: none; }
    .review-gate-hint { color: #6b7280; font-size: 11px; margin: 0; }

    /* --- Review-paused state ------------------------------------------------ */
    .paused-note {
      display: none; align-items: flex-start; gap: 8px;
      background: #fffbeb; border-bottom: 1px solid #fde68a; color: #92400e;
      font-size: 12px; line-height: 1.45; padding: 10px 16px;
    }
    .review-paused .paused-note { display: flex; }
    .review-paused #vv-action-pin { opacity: 0.45; cursor: not-allowed; }

    /* Mobile responsive */
    @media (max-width: 480px) {
      .launcher { bottom: 12px; right: 12px; }
      .popup { bottom: 112px; right: 12px; }
      .composer { width: calc(100vw - 24px); }
      .trigger-btn { width: 64px; height: 64px; border-radius: 14px; padding: 6px; overflow: hidden; }
      .trigger-btn .top-text { font-size: 5.5px; margin-bottom: 2px; letter-spacing: 0.2px; }
      .trigger-btn .bottom-text { font-size: 8px; letter-spacing: 0.2px; }
    }
  `;
    shadow.appendChild(style);

    const wrapper = document.createElement('div');
    wrapper.innerHTML = `
    <div class="launcher">
      <button class="trigger-btn">
        ${isVibeVaults ? '<div class="top-text">VibeVaults</div>' : ''}
        <div class="bottom-text">Feedback</div>
        <div class="badge"></div>
      </button>
    </div>
    <div class="popup">
      <div class="header">
        <h3>Feedback</h3><p>Pin anything on this page</p>
        <button class="close-btn" aria-label="Minimize"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg></button>
      </div>
      <div class="paused-note" id="vv-paused-note">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;margin-top:1px;"><circle cx="12" cy="12" r="10"></circle><line x1="10" y1="15" x2="10" y2="9"></line><line x1="14" y1="15" x2="14" y2="9"></line></svg>
        <span>Feedback is paused by the project team. You can still browse existing feedback.</span>
      </div>
      <div class="nav">
        <button type="button" class="nav-item" id="vv-action-pin" title="Click the page to place a pin">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-6-5.686-6-10a6 6 0 1 1 12 0c0 4.314-6 10-6 10z"></path><circle cx="12" cy="11" r="2"></circle></svg>
          Pin
        </button>
        <button type="button" class="nav-item" id="vv-action-list" title="Show or hide the feedback list">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
          Feedback
        </button>
      </div>
      <div class="content">
        <div class="view-feedback">
          <div class="feedback-list" id="vv-feedback-list">
            <div class="feedback-loading">Loading feedback...</div>
          </div>
        </div>
        <div class="view-detail">
          <button class="back-btn" id="vv-back-btn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
            All Feedback
          </button>
          <div class="detail-header" id="vv-detail-header"></div>
          <div class="chat-messages" id="vv-chat"></div>
          <div id="vv-reply-section"></div>
        </div>
      </div>
      <div class="branding">Powered by <a href="https://vibe-vaults.com" target="_blank">VibeVaults</a></div>
    </div>
    <div class="review-gate" id="vv-review-gate">
      <div class="review-gate-card">
        <div class="review-gate-header">
          <h3>Leave feedback on this site</h3>
          <p>Tell us who you are so the team knows who the feedback is from.</p>
        </div>
        <div class="review-gate-body">
          <label for="vv-review-name">Your name</label>
          <input type="text" id="vv-review-name" maxlength="100" placeholder="Jane Doe" autocomplete="name" />
          <label for="vv-review-email">Your email</label>
          <input type="email" id="vv-review-email" maxlength="254" placeholder="jane@example.com" autocomplete="email" />
          <div class="review-gate-error" id="vv-review-error"></div>
          <button type="button" class="btn" id="vv-review-start">Start reviewing</button>
          <p class="review-gate-hint">Used only to label your feedback and send you reply notifications.</p>
        </div>
      </div>
    </div>
    <div class="pin-layer" id="vv-pin-layer"></div>
    <div class="composer" id="vv-composer">
      <div class="composer-header">
        <div class="composer-title">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-6-5.686-6-10a6 6 0 1 1 12 0c0 4.314-6 10-6 10z"></path><circle cx="12" cy="11" r="2"></circle></svg>
          <span>Pinned here</span>
        </div>
        <button type="button" class="composer-close" id="vv-composer-close" aria-label="Discard pin">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>
      <div class="composer-body">
        <div class="composer-target" id="vv-composer-target"></div>
        <textarea id="vv-composer-text" placeholder="What's wrong here?"></textarea>
        <div class="attach-previews" id="vv-composer-previews"></div>
        <div class="upload-progress" id="vv-composer-progress" style="display:none;"></div>
        <div class="composer-actions">
          <button type="button" class="attach-btn" id="vv-composer-attach-btn">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>
            Attach
          </button>
          <input type="file" id="vv-composer-file-input" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv" style="display:none;" />
        </div>
        <div class="checkbox-wrapper">
          <input type="checkbox" id="vv-notify-replies" class="checkbox-input" ${notifyRepliesSetting ? 'checked' : ''} />
          <label for="vv-notify-replies" class="checkbox-label">Notify me of replies</label>
        </div>
        <div class="composer-footer">
          <button type="button" class="btn" id="vv-composer-submit">Send feedback</button>
        </div>
      </div>
    </div>
  `;
    shadow.appendChild(wrapper);

    // Anonymous visitors never see the widget — only show the trigger button
    // once we have a valid identity token (either already in storage, or one
    // we obtain by exchanging an `?vv_invite=` param for a per-device token).
    const setWidgetVisible = (visible) => {
      host.style.display = visible ? '' : 'none';
    };
    setWidgetVisible(false);

    // --- Pin anchoring -------------------------------------------------------
    // Main responsibility: convert a click position into an anchor that still
    // resolves after the page has been scrolled, restyled, re-deployed or
    // viewed at a different width, and convert it back again for rendering.
    //
    // A raw x/y coordinate is not durable: it is meaningless at another scroll
    // offset and actively wrong at another viewport width. So the anchor is
    // element-relative — the element under the click, plus the click expressed
    // as a percentage inside that element's box. Document coordinates are kept
    // only as a last-resort fallback for when the element no longer exists.
    //
    // Sensitive dependencies: the stored shape is written into
    // `feedbacks.metadata.anchor` and read back by the dashboard and by the pin
    // layer. Treat it as append-only; existing pins carry the old shape forever.

    // Framework-generated ids churn on every render, so anchoring to them would
    // orphan the pin on the next deploy. Kept as three explicit tests rather
    // than one alternation, because `^(a|b)|c` anchors only the first branch
    // and would silently match a hex run anywhere in an otherwise fine id.
    const UNSTABLE_ID_PREFIX = /^(radix-|headlessui-|mui-|ember\d|react-aria)/i;
    const REACT_USE_ID = /^[:\u00ab][a-z0-9]+[:\u00bb]$/i;
    const HASH_LIKE_ID = /(^|[-_])[0-9a-f]{8,}([-_]|$)/i;
    const isUnstableId = (id) => UNSTABLE_ID_PREFIX.test(id) || REACT_USE_ID.test(id) || HASH_LIKE_ID.test(id);
    const STABLE_ATTRS = ['data-testid', 'data-test', 'data-cy', 'data-qa', 'data-id'];
    const MAX_SELECTOR_DEPTH = 8;

    const cssEscape = (v) => (window.CSS && CSS.escape) ? CSS.escape(String(v)) : String(v).replace(/["\\\]]/g, '\\$&');

    const isUniqueSelector = (sel) => {
      try { return document.querySelectorAll(sel).length === 1; } catch (_) { return false; }
    };

    // Returns { selector, kind }. `kind` records how much to trust it:
    // 'id' and 'attr' are author-controlled and survive restyles; 'structural'
    // is a verified-unique DOM path; 'ambiguous' matched more than one node and
    // renders as an approximate pin.
    const buildSelector = (el) => {
      if (!el || el.nodeType !== 1) return null;

      if (el.id && !isUnstableId(el.id)) {
        const sel = '#' + cssEscape(el.id);
        if (isUniqueSelector(sel)) return { selector: sel, kind: 'id' };
      }

      for (let i = 0; i < STABLE_ATTRS.length; i++) {
        const attr = STABLE_ATTRS[i];
        const val = el.getAttribute && el.getAttribute(attr);
        if (val) {
          const sel = '[' + attr + '="' + cssEscape(val) + '"]';
          if (isUniqueSelector(sel)) return { selector: sel, kind: 'attr' };
        }
      }

      // Structural path. Deliberately NOT a class chain, which is what the old
      // element-tagging code produced: utility-class frameworks rewrite class
      // strings on any restyle, so a `.flex.items-center.gap-2` anchor is dead
      // the first time someone adjusts the spacing it was flagging.
      const parts = [];
      let node = el;
      let depth = 0;
      while (node && node.nodeType === 1 && node !== document.documentElement && depth < MAX_SELECTOR_DEPTH) {
        if (node.id && !isUnstableId(node.id)) {
          parts.unshift('#' + cssEscape(node.id));
          break;
        }
        const tag = node.tagName.toLowerCase();
        const parent = node.parentElement;
        if (!parent) { parts.unshift(tag); break; }
        const sameTag = Array.prototype.filter.call(parent.children, (c) => c.tagName === node.tagName);
        parts.unshift(sameTag.length > 1 ? tag + ':nth-of-type(' + (sameTag.indexOf(node) + 1) + ')' : tag);
        node = parent;
        depth++;
      }
      if (!parts.length) return null;
      const selector = parts.join(' > ');
      return { selector, kind: isUniqueSelector(selector) ? 'structural' : 'ambiguous' };
    };

    // elementFromPoint must resolve to the customer's page, never to our own
    // overlay. Setting pointer-events on the host alone is not enough, because
    // children that opt back in stay hit-testable, so the whole shadow tree is
    // made inert for the duration of the probe.
    const elementUnderPoint = (x, y) => {
      wrapper.classList.add('vv-probing');
      const el = document.elementFromPoint(x, y);
      wrapper.classList.remove('vv-probing');
      if (!el || el === document.body || el === document.documentElement) return null;
      if (el.closest && el.closest('#vibe-vaults-widget-host')) return null;
      return el;
    };

    // A click on empty space hit-tests to whatever full-width layout wrapper
    // contains it. Storing a percentage across that wrapper is wrong for
    // anything the wrapper does not scale with: a left-aligned button stays at
    // x=340 while 8.8%-of-viewport slides from 340 to 169 as the window
    // narrows, dragging the pin away from what it was marking. So a click that
    // is not inside a content-sized element gets re-anchored to the nearest one
    // and stored as a pixel delta instead.
    const CONTAINER_W_RATIO = 0.6;
    const NEAR_THRESHOLD = 240;
    const MAX_SCAN = 600;

    const isLayoutContainer = (rect) => rect.width > window.innerWidth * CONTAINER_W_RATIO;

    // 0 when the point is inside the rect, otherwise the gap to its nearest edge.
    const rectDistance = (r, x, y) => {
      const dx = x < r.left ? r.left - x : (x > r.right ? x - r.right : 0);
      const dy = y < r.top ? r.top - y : (y > r.bottom ? y - r.bottom : 0);
      return Math.sqrt(dx * dx + dy * dy);
    };

    const nearestContentElement = (scope, x, y) => {
      let best = null;
      let bestDist = Infinity;
      let scanned = 0;
      const walker = document.createTreeWalker(scope, NodeFilter.SHOW_ELEMENT);
      let node = walker.nextNode();
      while (node && scanned < MAX_SCAN) {
        scanned++;
        if (!(node.closest && node.closest('#vibe-vaults-widget-host'))) {
          const r = node.getBoundingClientRect();
          if (r.width > 0 && r.height > 0 && !isLayoutContainer(r)) {
            const d = rectDistance(r, x, y);
            if (d < bestDist) { bestDist = d; best = node; }
          }
        }
        node = walker.nextNode();
      }
      return { best, bestDist };
    };

    const pickAnchorElement = (hit, x, y) => {
      if (!hit) return null;
      // Content-sized element under the cursor: anchor to it directly.
      if (!isLayoutContainer(hit.getBoundingClientRect())) return hit;

      let found = nearestContentElement(hit, x, y);
      if (!found.best || found.bestDist > NEAR_THRESHOLD) {
        // Nothing useful inside the container, so widen the search once to pick
        // up siblings sitting either side of the gap that was clicked.
        if (hit.parentElement) {
          const wider = nearestContentElement(hit.parentElement, x, y);
          if (wider.best && wider.bestDist < found.bestDist) found = wider;
        }
      }
      return (found.best && found.bestDist <= NEAR_THRESHOLD) ? found.best : hit;
    };

    // Offsets are stored per axis, relative to whichever edge the click fell
    // outside of. Measuring everything from the top-left instead would work for
    // a click left of an element but break for one to its right: the stored
    // delta spans the element's whole width, so the pin slides as that width
    // shrinks. Anchoring to the near edge keeps the gap itself constant, which
    // is the thing being reported when someone flags spacing.
    const axisOffset = (v, start, end) => {
      if (v < start) return { ref: 'start', d: Math.round(v - start) };
      if (v > end) return { ref: 'end', d: Math.round(v - end) };
      const size = end - start;
      return { ref: 'pct', d: size > 0 ? Number(((v - start) / size).toFixed(4)) : 0.5 };
    };

    const axisResolve = (o, start, end) => {
      if (!o) return start;
      if (o.ref === 'start') return start + o.d;
      if (o.ref === 'end') return end + o.d;
      return start + (end - start) * o.d;
    };

    const resolveAnchor = (clientX, clientY) => {
      const anchor = {
        fallback: {
          docX: Math.round(clientX + window.scrollX),
          docY: Math.round(clientY + window.scrollY),
          viewportW: window.innerWidth,
          docW: document.documentElement.scrollWidth,
        },
        viewportW: window.innerWidth,
        viewportH: window.innerHeight,
        dpr: window.devicePixelRatio || 1,
      };

      const hit = elementUnderPoint(clientX, clientY);
      const el = pickAnchorElement(hit, clientX, clientY);
      if (!el) return anchor;

      // The region the user pointed at, kept separate from the anchor: this is
      // what gets shown back to them, while the anchor is what keeps the pin in
      // place across layout changes.
      if (hit) {
        const hitBuilt = buildSelector(hit);
        if (hitBuilt) anchor.hitSelector = hitBuilt.selector;
        anchor.hitTag = hit.tagName.toLowerCase();
      }
      const rect = el.getBoundingClientRect();
      if (!rect.width || !rect.height) return anchor;
      const built = buildSelector(el);
      if (!built) return anchor;

      anchor.selector = built.selector;
      anchor.selectorKind = built.kind;
      anchor.offset = {
        x: axisOffset(clientX, rect.left, rect.right),
        y: axisOffset(clientY, rect.top, rect.bottom),
      };
      anchor.elementRect = { w: Math.round(rect.width), h: Math.round(rect.height) };
      anchor.elementTag = el.tagName.toLowerCase();
      return anchor;
    };

    // Inverse of resolveAnchor: turn a stored anchor back into viewport
    // coordinates for the layout as it exists right now. `state` is 'anchored'
    // when the element was found and 'approximate' when we fell back to stored
    // document coordinates, which the pin layer renders differently so nobody
    // trusts a marker that may have drifted.
    const resolvePinPosition = (anchor) => {
      if (!anchor) return null;
      if (anchor.selector && anchor.offset) {
        let el = null;
        try { el = document.querySelector(anchor.selector); } catch (_) { el = null; }
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            return {
              x: axisResolve(anchor.offset.x, rect.left, rect.right),
              y: axisResolve(anchor.offset.y, rect.top, rect.bottom),
              state: anchor.selectorKind === 'ambiguous' ? 'approximate' : 'anchored',
            };
          }
        }
      }
      const fb = anchor.fallback;
      if (!fb) return null;
      return { x: fb.docX - window.scrollX, y: fb.docY - window.scrollY, state: 'approximate' };
    };

    // Pins belong to a page, not to a URL. Query strings and hashes are ignored
    // so that arriving with a ?utm= or ?ref= param cannot orphan every pin on
    // the page. Trailing slashes are normalised for the same reason.
    const pagePathKey = (rawUrl) => {
      try {
        const u = new URL(rawUrl, window.location.href);
        return u.origin + (u.pathname.replace(/\/+$/, '') || '/');
      } catch (_) { return null; }
    };
    const currentPageKey = () => pagePathKey(window.location.href);

    // Fetch widget config (project meta + notification prefs + branding flag)
    // for the authenticated identity. 401 means the token has been revoked
    // or never existed — clear local state and stay hidden.
    const loadConfig = () => {
      return fetch(`${API_BASE}?key=${apiKey}`, { headers: authHeaders() })
        .then(r => r.json().then(data => ({ ok: r.ok, status: r.status, data })))
        .then(({ ok, status, data }) => {
          if (!ok) {
            if (status === 401) {
              clearWidgetIdentity();
              setWidgetVisible(false);
            }
            return false;
          }
          if (data.identity?.email) {
            clientEmail = data.identity.email;
            localStorage.setItem(emailKey, clientEmail);
          }
          if (data.notifyReplies !== undefined) {
            notifyRepliesSetting = data.notifyReplies;
            localStorage.setItem(prefsKey, data.notifyReplies.toString());
            const checkbox = wrapper.querySelector('#vv-notify-replies');
            if (checkbox) checkbox.checked = notifyRepliesSetting;
          }
          if (data.showBranding === false) {
            const brandingEl = wrapper.querySelector('.branding');
            if (brandingEl) brandingEl.style.display = 'none';
          }
          setReviewPaused(data.reviewPaused === true);
          setWidgetVisible(true);
          return true;
        })
        .catch(() => false);
    };

    // Mirrors the server-side pause for review-link identities: pin placement
    // is refused, the reply input becomes a note, and a banner explains why.
    // Reads stay open so paused reviewers can still browse existing threads.
    const setReviewPaused = (paused) => {
      if (reviewPaused === paused) return;
      reviewPaused = paused;
      wrapper.classList.toggle('review-paused', paused);
      if (paused) disarmPin();
      // Re-render the reply input if a thread is open so the paused note
      // appears (or disappears) without reopening the thread.
      if (selectedFeedbackId) renderReplySection();
    };

    // --- Review-link identity gate -----------------------------------------
    // A `?vv_review=` visitor has no invite, so they self-identify (name +
    // email) before the exchange. Shown only when there is no working token
    // already on this device — a returning reviewer skips it entirely.
    const reviewGate = wrapper.querySelector('#vv-review-gate');

    const showReviewGate = () => {
      setWidgetVisible(true);
      reviewGate.classList.add('open');
      setTimeout(() => { const el = reviewGate.querySelector('#vv-review-name'); if (el) el.focus(); }, 0);
    };

    const hideReviewGate = () => reviewGate.classList.remove('open');

    const showReviewGateError = (msg) => {
      const errEl = reviewGate.querySelector('#vv-review-error');
      errEl.textContent = msg;
      errEl.style.display = 'block';
    };

    const submitReviewGate = async () => {
      const name = reviewGate.querySelector('#vv-review-name').value.trim();
      const email = reviewGate.querySelector('#vv-review-email').value.trim();
      if (!name) { showReviewGateError('Please enter your name.'); return; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showReviewGateError('Please enter a valid email.'); return; }

      const btn = reviewGate.querySelector('#vv-review-start');
      btn.disabled = true;
      try {
        const res = await fetch(API_IDENTITY_EXCHANGE, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ apiKey, reviewToken, email, name }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.token) {
          showReviewGateError(data.error || 'Could not start the review. Please try again.');
          return;
        }
        widgetToken = data.token;
        localStorage.setItem(tokenKey, widgetToken);
        if (data.email) {
          clientEmail = data.email;
          localStorage.setItem(emailKey, clientEmail);
        }
        hideReviewGate();
        const ok = await loadConfig();
        // Auto-open so the first thing a reviewer sees is the pin bar, not a
        // launcher they have to discover.
        if (ok) setWidgetOpen(true);
      } catch (_) {
        showReviewGateError('Network error. Please try again.');
      } finally {
        btn.disabled = false;
      }
    };

    reviewGate.querySelector('#vv-review-start').onclick = submitReviewGate;
    reviewGate.querySelectorAll('input').forEach((el) => {
      el.onkeydown = (e) => { if (e.key === 'Enter') submitReviewGate(); };
    });
    // Backdrop click dismisses: the gate must never hold the customer's site
    // hostage. Reopening the review link brings it back.
    reviewGate.onclick = (e) => {
      if (e.target !== reviewGate) return;
      hideReviewGate();
      if (!widgetToken) setWidgetVisible(false);
    };

    // Bootstrap path: if the URL had `?vv_invite=...`, swap it for a long-lived
    // widget token, persist it on this origin, then load config. A `?vv_review=`
    // link falls back to the identity gate when no stored token works. Otherwise
    // just try config with whatever token is already in localStorage.
    const bootstrapIdentity = async () => {
      if (inviteToken) {
        try {
          const res = await fetch(API_IDENTITY_EXCHANGE, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ apiKey, inviteToken }),
          });
          if (res.ok) {
            const data = await res.json();
            if (data.token) {
              widgetToken = data.token;
              localStorage.setItem(tokenKey, widgetToken);
            }
            if (data.email) {
              clientEmail = data.email;
              localStorage.setItem(emailKey, clientEmail);
            }
          }
        } catch (_) { /* fall through to config fetch */ }
      }
      if (widgetToken) {
        const ok = await loadConfig();
        if (ok || !reviewToken) return;
      }
      if (reviewToken) showReviewGate();
    };

    bootstrapIdentity();

    // --- View switching ---
    const switchView = (v) => {
      wrapper.querySelector('.view-feedback').style.display = v === 'feedback' ? 'flex' : 'none';
      wrapper.querySelector('.view-detail').style.display = v === 'detail' ? 'flex' : 'none';
      wrapper.querySelector('.popup').classList.toggle('tall', v === 'detail');
      if (v === 'feedback') { fetchAllFeedback(); startListPolling(); } else { stopListPolling(); }
      if (v === 'detail') { startStream(); } else { stopStream(); stopPolling(); }
    };

    // Centralized 401-handler — used by every API call to react to a
    // revoked or expired token by clearing local state and self-hiding.
    const handleAuthRevocation = () => {
      clearWidgetIdentity();
      isOpen = false;
      stopAll();
      wrapper.querySelector('.popup').classList.remove('open');
      setWidgetVisible(false);
    };

    // --- Feedback list ---
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

    const fetchAllFeedback = async () => {
      const listEl = wrapper.querySelector('#vv-feedback-list');
      // Only show loading spinner if list is empty (first load), not on poll refreshes
      if (!listEl.querySelector('.feedback-item')) {
        listEl.innerHTML = '<div class="feedback-loading">Loading feedback...</div>';
      }
      try {
        const res = await fetch(`${API_FEEDBACK}?key=${apiKey}`, { headers: authHeaders() });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          if (res.status === 401 || res.status === 403) {
            handleAuthRevocation();
            return;
          }
          listEl.innerHTML = `<div class="feedback-loading">${err.error || 'Failed to load feedback.'}</div>`;
          return;
        }
        const data = await res.json();
        const server = Array.isArray(data.feedback) ? data.feedback : [];
        const serverIds = new Set(server.map((f) => f.id));

        // Keep locally-created items the server has not echoed back yet. A read
        // issued straight after the write can miss its own row, and dropping it
        // would make the pin the user just placed blink out and reappear.
        const pendingLocal = cachedFeedback.filter((f) => optimisticIds.has(f.id) && !serverIds.has(f.id));
        Array.from(optimisticIds).forEach((id) => { if (serverIds.has(id)) optimisticIds.delete(id); });

        const merged = pendingLocal.concat(server);
        cachedFeedback = merged;
        if (merged.length > 0) {
          renderFeedbackList(merged);
          rebuildLivePins();
        } else {
          rebuildLivePins();
          listEl.innerHTML = `
          <div class="feedback-empty">
            <div class="feedback-empty-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
            </div>
            <p style="font-weight:600;margin:0 0 4px;font-size:13px;color:#6b7280">No feedback yet</p>
            <p style="font-size:12px;margin:0">Click anywhere on the page to pin your first one.</p>
          </div>
        `;
        }
      } catch (e) {
        listEl.innerHTML = '<div class="feedback-loading">Failed to load feedback.</div>';
      }
    };

    const renderFeedbackList = (feedback) => {
      const listEl = wrapper.querySelector('#vv-feedback-list');
      const html = feedback.map(f => `
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

      if (listEl.innerHTML !== html) {
        listEl.innerHTML = html;
        listEl.querySelectorAll('.feedback-item').forEach(item => {
          item.onclick = () => openFeedbackDetail(item.dataset.id);
        });
      }
    };

    // --- Feedback detail / conversation ---
    const openFeedbackDetail = (feedbackId) => {
      selectedFeedbackId = feedbackId;
      const feedback = cachedFeedback.find(f => f.id === feedbackId);

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
      wrapper.querySelector('.view-feedback').style.display = 'none';
      wrapper.querySelector('.view-detail').style.display = 'flex';
      wrapper.querySelector('.popup').classList.add('tall');
      fetchReplies();
      startStream();
    };

    const renderReplySection = () => {
      const section = wrapper.querySelector('#vv-reply-section');
      replyAttachments = [];
      if (reviewPaused) {
        section.innerHTML = `
        <div style="padding: 10px 20px; font-size: 12px; color: #92400e; background: #fffbeb; border-top: 1px solid #fde68a;">
          Feedback is paused by the project team, so replies are disabled for now.
        </div>`;
        return;
      }
      // The widget is only mounted when the user has a valid token, so the
      // reply input is always available — there's no longer a "you must be
      // invited" branch since unidentified visitors never see this UI.
      {
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
      <style>#vv-reply-section { border-top: 1px solid #f3f4f6; padding: 8px 20px; }</style>
      `;
        section.querySelector('#vv-send-reply').onclick = sendReply;
        section.querySelector('#vv-reply-text').onkeydown = (e) => {
          if (e.key === 'Enter') sendReply();
        };
        // Reply screenshot capture
        section.querySelector('#vv-reply-capture-btn').onclick = () => captureReplyScreenshot();
        // Reply file attachment
        const replyFileInput = section.querySelector('#vv-reply-file-input');
        section.querySelector('#vv-reply-attach-btn').onclick = () => replyFileInput.click();
        replyFileInput.onchange = () => {
          const newFiles = validateFiles(Array.from(replyFileInput.files));
          if (replyAttachments.length + newFiles.length > MAX_FILES) {
            showWidgetToast('Maximum ' + MAX_FILES + ' files allowed.');
          } else {
            replyAttachments.push(...newFiles);
          }
          refreshReplyPreviews();
          replyFileInput.value = '';
        };
      }
    };

    const goBackToList = () => {
      selectedFeedbackId = null;
      stopStream();
      stopPolling();
      wrapper.querySelector('.view-detail').style.display = 'none';
      wrapper.querySelector('.view-feedback').style.display = 'flex';
      wrapper.querySelector('.popup').classList.remove('tall');
      fetchAllFeedback(); // Refresh list
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

    const renderReplyBubble = (r) => {
      const side = r.author_name === clientEmail ? 'self' : 'other';
      return `
    <div class="msg-wrapper ${side}" data-reply-id="${r.id || ''}">
      <div class="msg-meta ${side}">
        <span style="font-weight:700; text-transform:uppercase; letter-spacing:-0.5px;">${escapeHtml(r.author_name || 'Unknown')}</span>
        <span style="color:#d1d5db;">•</span>
        <span>${new Date(r.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
      </div>
      ${r.content ? `<div class="message ${side}">${escapeHtml(r.content)}</div>` : ''}
      ${renderReplyAttachments(r.attachments)}
    </div>
  `;
    };


    const fetchReplies = async () => {
      if (!selectedFeedbackId) return;
      try {
        const res = await fetch(`${API_REPLY}?feedbackId=${selectedFeedbackId}&key=${apiKey}`, { headers: authHeaders() });
        if (!res.ok) {
          if (res.status === 401 || res.status === 403) {
            handleAuthRevocation();
            return;
          }
          const err = await res.json().catch(() => ({}));
          const chatEl = wrapper.querySelector('#vv-chat');
          if (chatEl) chatEl.innerHTML = `<div class="chat-no-replies">${err.error || 'Could not load replies.'}</div>`;
          return;
        }
        const data = await res.json();
        const chatEl = wrapper.querySelector('#vv-chat');
        if (data.replies && data.replies.length > 0) {
          const html = data.replies.map(renderReplyBubble).join('');
          if (chatEl.innerHTML !== html) {
            chatEl.innerHTML = html;
            chatEl.scrollTop = chatEl.scrollHeight;
          }
        } else {
          const emptyHtml = '<div class="chat-no-replies">No replies yet. Start the conversation!</div>';
          if (chatEl.innerHTML !== emptyHtml) chatEl.innerHTML = emptyHtml;
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
        // EventSource cannot send custom headers, so the bearer token rides in
        // the URL for the SSE handshake only. The endpoint validates it the
        // same way as the Authorization header on every other widget request.
        const url = `${API_STREAM}?feedbackId=${selectedFeedbackId}&key=${apiKey}&token=${encodeURIComponent(widgetToken)}`;
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
            const cached = cachedFeedback.find(f => f.id === selectedFeedbackId);
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

    const startListPolling = () => { stopListPolling(); listPollInterval = setInterval(fetchAllFeedback, 10000); };
    const stopListPolling = () => { if (listPollInterval) clearInterval(listPollInterval); listPollInterval = null; };

    const stopAll = () => { stopStream(); stopPolling(); stopListPolling(); };

    // --- Send feedback ---
    // Shared submit path for the panel form and the pin composer. Keeping the
    // metadata assembly, upload sequencing and revocation handling in one place
    // means a pinned report and a plain report can never drift apart.
    //
    // Returns { revoked } | { error } | { feedbackId }.
    const submitFeedback = async ({ text, attachments, anchor, notifyReplies, progressEl }) => {
      const metadata = getMetadata();
      if (anchor) {
        metadata.anchor = anchor;
        metadata.page_key = currentPageKey();
        // The element under the pin is still the most useful thing to show a
        // developer, so the legacy field stays populated rather than being
        // replaced by the anchor.
        if (anchor.selector) metadata.dom_selector = anchor.selector;
      }

      localStorage.setItem(prefsKey, String(notifyReplies));

      if (attachments.length > 0 && progressEl) {
        progressEl.textContent = `Uploading ${attachments.length} file(s)...`;
        progressEl.style.display = 'block';
      }

      const res = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ apiKey, content: text, metadata, notifyReplies })
      });
      if (res.status === 401 || res.status === 403) {
        // A paused review link is a 403 too, but it must not be treated as a
        // revoked token — that would silently log the reviewer out.
        const err = await res.json().catch(() => ({}));
        if (err.code === 'review_paused') {
          setReviewPaused(true);
          return { error: err.error || 'Feedback is paused by the project team.' };
        }
        handleAuthRevocation();
        return { revoked: true };
      }
      const data = await res.json();
      if (!data.success || !data.feedback_id) {
        return { error: data.error || 'Error sending feedback.' };
      }

      if (attachments.length > 0) {
        try {
          await uploadFiles(attachments, data.feedback_id, null);
        } catch (uploadErr) {
          console.error('[VibeVaults] Attachment upload failed:', uploadErr);
          showWidgetToast(uploadErr.message || 'Attachment upload failed.');
        }
      }
      return { feedbackId: data.feedback_id };
    };

    // --- Screenshot shimmer placeholder ---
    const showCaptureShimmer = () => {
      const container = wrapper.querySelector('#vv-reply-attach-previews');
      if (!container) return;
      const cls = 'reply-attach-preview';
      const el = document.createElement('div');
      el.className = cls + ' shimmer';
      el.id = 'vv-capture-shimmer';
      el.innerHTML = '<span class="shimmer-label">Processing...</span>';
      container.prepend(el);
    };

    const removeCaptureShimmer = () => {
      const el = wrapper.querySelector('#vv-capture-shimmer');
      if (el) el.remove();
    };

    // --- Shared screenshot capture ------------------------------------------
    // Main responsibility: rasterize the current viewport, optionally annotate
    // it with an element highlight and/or a pin marker, and hand back a JPEG
    // data URL. Shared by the element-tagging path and the pin composer so the
    // snapdom setup, viewport crop and capture telemetry live in exactly one
    // place.
    //
    // Sensitive dependencies: snapdom (lazy-loaded from CDN on first use),
    // /api/widget/capture-info for telemetry, and the known Firefox + GPU
    // foreignObject rasterization bug documented at /docs/screenshots#firefox-bug.
    const captureViewport = ({ highlightRect = null, pinPoint = null } = {}) => {
      const captureOptions = {
        backgroundColor: '#ffffff',
        exclude: ['#vibe-vaults-widget-host'],
        excludeMode: 'remove',
        embedFonts: true,
        localFonts: true
      };

      // Telemetry: emits a beacon with browser + GPU info on every screenshot
      // attempt so we can size the impact of the known Firefox+GPU foreignObject
      // rasterization bug. Best-effort, never blocks capture, never throws.
      const captureStartedAt = Date.now();
      const sendCaptureTelemetry = (outcome) => {
        try {
          if (!apiKey) return;
          const ua = navigator.userAgent || '';
          const browser = /Firefox\//.test(ua) ? 'firefox'
            : /Edg\//.test(ua) ? 'edge'
            : /Chrome\//.test(ua) ? 'chrome'
            : /Safari\//.test(ua) ? 'safari'
            : 'other';
          let gpuVendor = null;
          let gpuRenderer = null;
          try {
            const probe = document.createElement('canvas');
            const gl = probe.getContext('webgl') || probe.getContext('experimental-webgl');
            if (gl) {
              const ext = gl.getExtension('WEBGL_debug_renderer_info');
              if (ext) {
                gpuVendor = gl.getParameter(ext.UNMASKED_VENDOR_WEBGL);
                gpuRenderer = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL);
              }
            }
          } catch (_) { /* WEBGL_debug_renderer_info is restricted in some browsers */ }
          const payload = JSON.stringify({
            apiKey,
            outcome,
            browser,
            userAgent: ua,
            url: location.href,
            gpuVendor,
            gpuRenderer,
            devicePixelRatio: window.devicePixelRatio,
            viewportWidth: window.innerWidth,
            viewportHeight: window.innerHeight,
            durationMs: Date.now() - captureStartedAt,
          });
          // Plain fetch, not navigator.sendBeacon: ad blockers drop third-party
          // beacon/ping requests by default, which spams the host site's console
          // with ERR_BLOCKED_BY_CLIENT. Blocked fetches are equally noisy, so the
          // endpoint is also named to avoid analytics-shaped filter matches.
          fetch(API_CAPTURE_INFO, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload, keepalive: true }).catch(() => {});
        } catch (_) { /* never break capture for telemetry */ }
      };

      // Teardrop marker drawn straight onto the canvas: the live pin lives in
      // the shadow DOM, which snapdom deliberately excludes from the capture.
      const drawPin = (ctx, x, y, scale) => {
        const r = 11 * scale;
        const cx = x * scale;
        const tipY = y * scale;
        const cy = tipY - r * 1.7;
        ctx.beginPath();
        ctx.moveTo(cx, tipY);
        ctx.lineTo(cx - r * 0.72, cy + r * 0.72);
        ctx.lineTo(cx + r * 0.72, cy + r * 0.72);
        ctx.closePath();
        ctx.fillStyle = '#209CEE';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fillStyle = '#209CEE';
        ctx.fill();
        ctx.lineWidth = 2 * scale;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();
      };

      return new Promise((resolve, reject) => {
        const fail = (err) => {
          sendCaptureTelemetry('error');
          reject(err instanceof Error ? err : new Error('Screenshot capture failed'));
        };

        const runCapture = () => {
          try {
            window.snapdom.toCanvas(document.body, captureOptions).then((fullCanvas) => {
              // Crop to visible viewport
              const scale = fullCanvas.width / document.body.scrollWidth;
              const vw = window.innerWidth;
              const vh = window.innerHeight;
              const cropped = document.createElement('canvas');
              cropped.width = Math.round(vw * scale);
              cropped.height = Math.round(vh * scale);
              const ctx = cropped.getContext('2d');
              ctx.drawImage(fullCanvas, Math.round(window.scrollX * scale), Math.round(window.scrollY * scale), Math.round(vw * scale), Math.round(vh * scale), 0, 0, cropped.width, cropped.height);

              // Annotations are viewport-relative, so they map directly onto the
              // cropped viewport image.
              if (highlightRect && highlightRect.width > 0 && highlightRect.height > 0) {
                ctx.fillStyle = 'rgba(32, 156, 238, 0.1)';
                ctx.fillRect(highlightRect.left * scale, highlightRect.top * scale, highlightRect.width * scale, highlightRect.height * scale);
                ctx.strokeStyle = '#209CEE';
                ctx.lineWidth = 2 * scale;
                ctx.strokeRect(highlightRect.left * scale, highlightRect.top * scale, highlightRect.width * scale, highlightRect.height * scale);
              }
              if (pinPoint) drawPin(ctx, pinPoint.x, pinPoint.y, scale);

              resolve(cropped.toDataURL('image/jpeg', 0.6));
              sendCaptureTelemetry('success');
            }).catch(fail);
          } catch (e) { fail(e); }
        };

        if (!window.snapdom) {
          const script = document.createElement('script');
          script.src = 'https://cdn.jsdelivr.net/npm/@zumer/snapdom@2.9.0/dist/snapdom.js';
          script.onload = runCapture;
          script.onerror = () => fail(new Error('snapdom failed to load'));
          document.head.appendChild(script);
        } else {
          runCapture();
        }
      });
    };

    // --- Element picker (reply screenshots only) ---
    // New feedback is always pinned now, so this survives purely for the
    // "screenshot something" button inside a reply thread.
    const captureReplyScreenshot = () => {
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
      highlightBox.style.position = 'fixed';
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
        highlightBox.style.top = rect.top + 'px';
        highlightBox.style.left = rect.left + 'px';
        highlightBox.style.width = rect.width + 'px';
        highlightBox.style.height = rect.height + 'px';
      };

      const handleScroll = () => {
        if (!currentTarget || !currentTarget.isConnected) return;
        const rect = currentTarget.getBoundingClientRect();
        highlightBox.style.top = rect.top + 'px';
        highlightBox.style.left = rect.left + 'px';
        highlightBox.style.width = rect.width + 'px';
        highlightBox.style.height = rect.height + 'px';
      };

      const cleanup = () => {
        overlay.remove();
        banner.remove();
        wrapper.querySelector('.popup').classList.add('open');
        wrapper.querySelector('.badge').style.display = 'none';
        document.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('scroll', handleScroll, true);
      };

      const handleKeyDown = (e) => {
        if (e.key === 'Escape') cleanup();
      };

      document.addEventListener('keydown', handleKeyDown);
      window.addEventListener('scroll', handleScroll, true);
      overlay.addEventListener('mousemove', handleMouseMove);
      overlay.addEventListener('click', async (e) => {
        e.preventDefault(); e.stopPropagation();

        // Snapshot rect before removing overlay — fixed-position highlight box
        // isn't captured reliably by snapdom, so we draw it on the canvas ourselves.
        const targetRect = currentTarget ? currentTarget.getBoundingClientRect() : null;

        // Remove overlay/banner up front so snapdom doesn't see them at all
        overlay.remove();
        banner.remove();
        overlay.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('scroll', handleScroll, true);

        const capBtn = wrapper.querySelector('#vv-reply-capture-btn');
        const originalText = capBtn ? capBtn.innerHTML : '';
        if (capBtn) { capBtn.innerHTML = 'Capturing...'; capBtn.disabled = true; }

        // Reopen popup and show shimmer placeholder so user sees progress while capturing
        wrapper.querySelector('.popup').classList.add('open');
        wrapper.querySelector('.badge').style.display = 'none';
        showCaptureShimmer();

        const finishCapture = async (dataUrl) => {
          removeCaptureShimmer();
          cleanup();
          const res = await fetch(dataUrl);
          const blob = await res.blob();
          const screenshotFile = new File([blob], 'screenshot.jpg', { type: 'image/jpeg' });

          replyAttachments = replyAttachments.filter(f => f.name !== 'screenshot.jpg');
          if (replyAttachments.length >= MAX_FILES) {
            showWidgetToast('Maximum ' + MAX_FILES + ' files allowed.');
            if (capBtn) { capBtn.innerHTML = originalText; capBtn.disabled = false; }
            return;
          }
          replyAttachments.unshift(screenshotFile);
          refreshReplyPreviews();
          if (capBtn) { capBtn.innerHTML = originalText; capBtn.disabled = false; }
        };

        // captureViewport owns the failure telemetry, so this only has to
        // unwind the UI back to a usable state.
        const onCaptureError = () => {
          removeCaptureShimmer();
          cleanup();
          if (capBtn) { capBtn.innerHTML = originalText; capBtn.disabled = false; }
          showWidgetToast('Screenshot capture failed. Please try again.');
        };

        captureViewport({ highlightRect: targetRect })
          .then(finishCapture)
          .catch(onCaptureError);
      });

      banner.querySelector('#vv-cancel-capture').onclick = (e) => { e.preventDefault(); e.stopPropagation(); cleanup(); };
    };

    // --- Pin mode + composer -------------------------------------------------
    // Main responsibility: let someone click any point on the page (including
    // the empty space between two elements, which element tagging cannot
    // express) and type their feedback in a dialog anchored to that point,
    // rather than in the corner of the screen.
    //
    // Sensitive dependencies: resolveAnchor/resolvePinPosition for durability,
    // captureViewport for the annotated screenshot, submitFeedback for the POST.

    const COMPOSER_GAP = 14;
    const PIN_W = 28;
    const PIN_H = 28;
    // The marker is a square rotated -45deg about its centre, so its visual tip
    // is the rotated bottom-left corner, which lands (h/2)*sqrt(2) below the
    // centre rather than at the box's bottom edge. Positioning by the box edge
    // leaves the pin sitting ~6px below whatever it is pointing at.
    const PIN_TIP_OFFSET = (PIN_H / 2) * (1 + Math.SQRT2);

    // An author-controlled selector (#id, [data-testid]) is readable and worth
    // showing verbatim. A generated structural path is not, so it collapses to
    // the tag name and lives in the tooltip instead.
    const readableTarget = (selector, kind, tag) => {
      if (!selector) return null;
      if (kind === 'id' || kind === 'attr') return selector;
      return '<' + (tag || 'element') + '>';
    };

    // When the pin sits in empty space, the region pointed at and the element
    // the pin is tied to are different things, and saying so is more honest
    // than silently reporting one of them.
    const anchorLabel = (anchor) => {
      if (!anchor || !anchor.selector) return 'free position on this page';
      const anchored = readableTarget(anchor.selector, anchor.selectorKind, anchor.elementTag);
      const hit = anchor.hitSelector
        ? readableTarget(anchor.hitSelector, null, anchor.hitTag)
        : null;
      // Naming both only helps when they read differently. Two anonymous divs
      // collapse to the same '<div>', and 'in <div> tied to <div>' is noise.
      if (hit && hit !== anchored) return 'in ' + hit + ' \u00b7 tied to ' + anchored;
      return 'on ' + (hit || anchored);
    };

    const refreshComposerPreviews = () => {
      renderAttachPreviews(pinAttachments, '#vv-composer-previews', (idx) => {
        pinAttachments.splice(idx, 1);
        refreshComposerPreviews();
      });
    };

    // The teardrop's point is at bottom-centre, so the marker box is offset to
    // put that point exactly on the anchored coordinate.
    const renderPendingPin = (x, y) => {
      const layer = wrapper.querySelector('#vv-pin-layer');
      let el = layer.querySelector('.pin-marker.pending');
      if (!el) {
        el = document.createElement('div');
        el.className = 'pin-marker pending';
        el.innerHTML = '<span>+</span>';
        layer.appendChild(el);
      }
      el.style.left = (x - PIN_W / 2) + 'px';
      el.style.top = (y - PIN_TIP_OFFSET) + 'px';
      return el;
    };

    const clearPendingPin = () => {
      const el = wrapper.querySelector('#vv-pin-layer .pin-marker.pending');
      if (el) el.remove();
    };

    // Opens toward the bottom-right of the pin, flipping to the other side when
    // that would overflow, then clamping so it can never render off-screen.
    const positionComposer = (x, y) => {
      const el = wrapper.querySelector('#vv-composer');
      const margin = 12;
      const w = el.offsetWidth || 320;
      const h = el.offsetHeight || 240;

      let left = x + COMPOSER_GAP;
      if (left + w > window.innerWidth - margin) left = x - w - COMPOSER_GAP;
      left = Math.max(margin, Math.min(left, window.innerWidth - w - margin));

      let top = y + COMPOSER_GAP;
      if (top + h > window.innerHeight - margin) top = y - h - COMPOSER_GAP;
      top = Math.max(margin, Math.min(top, window.innerHeight - h - margin));

      el.style.left = left + 'px';
      el.style.top = top + 'px';
    };

    // The composer changes height after it opens: the screenshot shimmer is
    // prepended, then swapped for a thumbnail, and attachments can be added.
    // Positioning once on open therefore leaves the submit button hanging off
    // the bottom of the screen for any pin placed low on the page. Observing
    // the box re-clamps it every time it grows. Repositioning only moves it, so
    // this cannot feed back into itself.
    let composerResizeObserver = null;
    const watchComposerSize = () => {
      if (composerResizeObserver || typeof ResizeObserver === 'undefined') return;
      composerResizeObserver = new ResizeObserver(() => repositionPendingPin());
      composerResizeObserver.observe(wrapper.querySelector('#vv-composer'));
    };
    const unwatchComposerSize = () => {
      if (!composerResizeObserver) return;
      composerResizeObserver.disconnect();
      composerResizeObserver = null;
    };

    // The pin is anchored to an element, so scrolling or a layout shift has to
    // move both the marker and the composer with it.
    const repositionPendingPin = () => {
      if (!pendingAnchor) return;
      const pos = resolvePinPosition(pendingAnchor);
      if (!pos) return;
      renderPendingPin(pos.x, pos.y);
      positionComposer(pos.x, pos.y);
    };

    // A single rAF-throttled loop drives both the pin being composed and every
    // saved pin, so a scroll does not schedule two independent passes.
    const syncPins = () => {
      repositionPendingPin();
      paintLivePins();
    };

    const onPinTrackingEvent = () => {
      if (!pinTrackingFrame) {
        pinTrackingFrame = requestAnimationFrame(() => {
          pinTrackingFrame = null;
          syncPins();
        });
      }
      // Trailing pass. The host page's own scroll handler runs alongside ours
      // and may collapse a sticky header or trigger a reveal animation *after*
      // we measured, moving every anchor. Without this the pins keep their
      // pre-shift positions until the next scroll event, which is why they
      // looked uniformly offset after scrolling up and snapped back on the
      // next scroll down.
      if (pinSettleTimer) clearTimeout(pinSettleTimer);
      pinSettleTimer = setTimeout(() => { pinSettleTimer = null; syncPins(); }, 200);
    };

    // Cheap fingerprint of where every pin currently resolves to, so the
    // reconcile pass can skip repainting when nothing actually moved.
    const pinSignature = () => livePins.map((p) => {
      const pos = positionOf(p);
      return pos ? p.id + ':' + Math.round(pos.x) + ',' + Math.round(pos.y) : p.id + ':-';
    }).join('|');

    // Lazy-loaded images, web-font swaps and scroll-triggered reveal animations
    // all move anchors without firing scroll or resize. The observer catches
    // anything that changes the document box; the interval is the backstop for
    // shifts inside a fixed-height section, which change nothing observable.
    const startPinLayoutWatch = () => {
      if (typeof ResizeObserver !== 'undefined' && !pinLayoutObserver) {
        pinLayoutObserver = new ResizeObserver(() => onPinTrackingEvent());
        pinLayoutObserver.observe(document.documentElement);
        if (document.body) pinLayoutObserver.observe(document.body);
      }
      if (!pinReconcileInterval) {
        pinReconcileInterval = setInterval(() => {
          repositionPendingPin();
          if (pinSignature() !== lastPinSignature) paintLivePins();
        }, 1000);
      }
    };

    const stopPinLayoutWatch = () => {
      if (pinLayoutObserver) { pinLayoutObserver.disconnect(); pinLayoutObserver = null; }
      if (pinReconcileInterval) { clearInterval(pinReconcileInterval); pinReconcileInterval = null; }
      if (pinSettleTimer) { clearTimeout(pinSettleTimer); pinSettleTimer = null; }
    };

    const closeComposer = () => {
      const el = wrapper.querySelector('#vv-composer');
      if (el) el.classList.remove('open');
      syncChromeVisibility();
      unwatchComposerSize();
      clearPendingPin();
      pendingAnchor = null;
      pinAttachments = [];
      const previews = wrapper.querySelector('#vv-composer-previews');
      if (previews) previews.innerHTML = '';
      const progress = wrapper.querySelector('#vv-composer-progress');
      if (progress) progress.style.display = 'none';
    };

    // The composer opens immediately and the screenshot arrives into it a moment
    // later, so the user can start typing while snapdom works. The live marker
    // lives in the shadow DOM, which snapdom excludes, so the pin is drawn onto
    // the canvas instead of being captured.
    const capturePinScreenshot = (x, y) => {
      const previews = wrapper.querySelector('#vv-composer-previews');
      const shim = document.createElement('div');
      shim.className = 'attach-preview shimmer';
      shim.id = 'vv-composer-shimmer';
      shim.innerHTML = '<span class="shimmer-label">Capturing...</span>';
      previews.prepend(shim);

      captureViewport({ pinPoint: { x, y } })
        .then(async (dataUrl) => {
          const blob = await (await fetch(dataUrl)).blob();
          pinAttachments = pinAttachments.filter(f => f.name !== 'screenshot.jpg');
          pinAttachments.unshift(new File([blob], 'screenshot.jpg', { type: 'image/jpeg' }));
        })
        .catch(() => {
          showWidgetToast('Screenshot capture failed, but your pin was kept.');
        })
        .finally(() => {
          const el = wrapper.querySelector('#vv-composer-shimmer');
          if (el) el.remove();
          refreshComposerPreviews();
        });
    };

    const openComposer = (anchor, x, y) => {
      disarmPin();
      pendingAnchor = anchor;
      pinAttachments = [];

      const composer = wrapper.querySelector('#vv-composer');
      composer.querySelector('#vv-composer-text').value = '';
      wrapper.querySelector('#vv-composer-previews').innerHTML = '';
      const targetEl = wrapper.querySelector('#vv-composer-target');
      targetEl.textContent = anchorLabel(anchor);
      targetEl.title = anchor.hitSelector && anchor.hitSelector !== anchor.selector
        ? 'Pinned in ' + anchor.hitSelector + '\nAnchored to ' + anchor.selector
        : (anchor.selector || '');

      renderPendingPin(x, y);
      composer.classList.add('open');
      syncChromeVisibility();
      positionComposer(x, y);
      watchComposerSize();
      composer.querySelector('#vv-composer-text').focus();
      capturePinScreenshot(x, y);
    };

    const sendPinnedFeedback = async () => {
      const textEl = wrapper.querySelector('#vv-composer-text');
      const text = textEl.value.trim();
      if (!text) {
        showWidgetToast('Please describe what is wrong here.');
        return;
      }
      const btn = wrapper.querySelector('#vv-composer-submit');
      const progressEl = wrapper.querySelector('#vv-composer-progress');
      const notifyCheckbox = wrapper.querySelector('#vv-notify-replies');
      btn.disabled = true;
      try {
        const result = await submitFeedback({
          text,
          attachments: pinAttachments,
          anchor: pendingAnchor,
          notifyReplies: notifyCheckbox ? notifyCheckbox.checked : notifyRepliesSetting,
          progressEl,
        });
        if (result.revoked) return;
        if (result.error) {
          showWidgetToast(result.error);
          if (progressEl) progressEl.style.display = 'none';
          return;
        }

        // Insert optimistically before closing: closeComposer() clears the
        // pending marker, and waiting for the next poll would make the pin the
        // user just placed vanish for up to ten seconds. The background refetch
        // then reconciles it with the server's own copy.
        const placedAnchor = pendingAnchor;
        if (placedAnchor && result.feedbackId) {
          cachedFeedback.unshift({
            id: result.feedbackId,
            content: text,
            sender: clientEmail || '',
            status: 'open',
            created_at: new Date().toISOString(),
            reply_count: 0,
            attachments: [],
            anchor: placedAnchor,
            page_key: currentPageKey(),
          });
          optimisticIds.add(result.feedbackId);
          renderFeedbackList(cachedFeedback);
        }
        closeComposer();
        rebuildLivePins();
        showWidgetToast('Feedback pinned. Thanks!');
        fetchAllFeedback();
      } catch (e) {
        showWidgetToast('Network error. Please try again.');
        if (progressEl) progressEl.style.display = 'none';
      } finally { btn.disabled = false; }
    };

    // --- Modes: Browse vs Feedback -------------------------------------------
    // Browse leaves the customer's site fully interactive and hides every pin.
    // Feedback mode shows the pins and arms placement, so a click on the page
    // drops a new one. The choice persists per project because a reviewer who
    // wants to click through the site should not re-pick it on every page.
    let pinOverlay = null;
    let livePins = [];
    let expandedCluster = null;
    let livePinFrame = null;
    let pinSettleTimer = null;
    let pinReconcileInterval = null;
    let pinLayoutObserver = null;
    let lastPinSignature = '';
    // Ids submitted from this device that the list endpoint may not return yet.
    const optimisticIds = new Set();

    const PIN_CLUSTER_RADIUS = 30;
    const CLUSTER_FAN_RADIUS = 34;

    // Pins belong to the page they were left on. Anything without an anchor
    // (reported from the dashboard, or before pinning existed) stays list-only.
    const pinnedFeedbackForPage = () => {
      const key = currentPageKey();
      return cachedFeedback
        .filter((f) => f.anchor && f.page_key === key)
        .slice()
        .reverse();
    };

    // Resolving a selector per pin per frame is too expensive on scroll, so the
    // element is cached and only re-queried when it drops out of the document.
    const anchorElementFor = (pin) => {
      if (pin.el && pin.el.isConnected) return pin.el;
      try { pin.el = document.querySelector(pin.anchor.selector); } catch (_) { pin.el = null; }
      return pin.el;
    };

    const positionOf = (pin) => {
      const el = anchorElementFor(pin);
      if (el) {
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          return {
            x: axisResolve(pin.anchor.offset && pin.anchor.offset.x, rect.left, rect.right),
            y: axisResolve(pin.anchor.offset && pin.anchor.offset.y, rect.top, rect.bottom),
            state: pin.anchor.selectorKind === 'ambiguous' ? 'approximate' : 'anchored',
          };
        }
      }
      const fb = pin.anchor.fallback;
      if (!fb) return null;
      return { x: fb.docX - window.scrollX, y: fb.docY - window.scrollY, state: 'approximate' };
    };

    const clusterPins = (placed) => {
      const clusters = [];
      placed.forEach((item) => {
        const near = clusters.find((c) => Math.abs(c.x - item.x) <= PIN_CLUSTER_RADIUS && Math.abs(c.y - item.y) <= PIN_CLUSTER_RADIUS);
        if (near) near.members.push(item);
        else clusters.push({ x: item.x, y: item.y, members: [item] });
      });
      return clusters;
    };

    const placeMarker = (el, x, y) => {
      el.style.left = (x - PIN_W / 2) + 'px';
      el.style.top = (y - PIN_TIP_OFFSET) + 'px';
    };

    const paintLivePins = () => {
      const layer = wrapper.querySelector('#vv-pin-layer');
      if (!layer) return;
      // The pending pin belongs to the composer, not the saved set.
      layer.querySelectorAll('.pin-marker:not(.pending)').forEach((n) => n.remove());
      lastPinSignature = isOpen ? pinSignature() : '';
      if (!isOpen) return;

      const placed = [];
      livePins.forEach((pin) => {
        const pos = positionOf(pin);
        if (!pos) return;
        // Off-screen pins are skipped rather than rendered outside the viewport.
        if (pos.x < -60 || pos.y < -60 || pos.x > window.innerWidth + 60 || pos.y > window.innerHeight + 60) return;
        placed.push({ pin, x: pos.x, y: pos.y, state: pos.state });
      });

      clusterPins(placed).forEach((cluster) => {
        const isExpanded = expandedCluster !== null && cluster.members.some((m) => m.pin.id === expandedCluster);
        if (cluster.members.length === 1 || isExpanded) {
          cluster.members.forEach((m, i) => {
            const el = document.createElement('div');
            el.className = 'pin-marker' + (m.state === 'approximate' ? ' approximate' : '');
            el.innerHTML = '<span>' + m.pin.number + '</span>';
            el.title = m.state === 'approximate'
              ? 'This pin\u2019s anchor is gone, so its position may have shifted'
              : m.pin.content.slice(0, 120);
            let x = m.x;
            let y = m.y;
            if (cluster.members.length > 1) {
              const angle = (-Math.PI / 2) + (i * 2 * Math.PI / cluster.members.length);
              x += Math.cos(angle) * CLUSTER_FAN_RADIUS;
              y += Math.sin(angle) * CLUSTER_FAN_RADIUS;
            }
            placeMarker(el, x, y);
            el.onclick = (e) => {
              e.preventDefault();
              e.stopPropagation();
              expandedCluster = null;
              isOpen = true;
              wrapper.querySelector('.popup').classList.add('open');
              setListOpen(true);
              openFeedbackDetail(m.pin.id);
            };
            layer.appendChild(el);
          });
          return;
        }

        const el = document.createElement('div');
        el.className = 'pin-marker cluster';
        el.innerHTML = '<span>' + cluster.members.length + '</span>';
        el.title = cluster.members.length + ' pins here. Click to fan them out.';
        placeMarker(el, cluster.x, cluster.y);
        el.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          expandedCluster = cluster.members[0].pin.id;
          paintLivePins();
        };
        layer.appendChild(el);
      });
    };

    const scheduleLivePinPaint = () => {
      if (livePinFrame) return;
      livePinFrame = requestAnimationFrame(() => { livePinFrame = null; paintLivePins(); });
    };

    // Rebuilt from the cached list after every fetch; numbering is by age so a
    // pin keeps its number as newer ones arrive.
    const rebuildLivePins = () => {
      const existing = new Map(livePins.map((p) => [p.id, p]));
      livePins = pinnedFeedbackForPage().map((f, i) => {
        const prev = existing.get(f.id);
        return { id: f.id, anchor: f.anchor, content: f.content || '', number: i + 1, el: prev ? prev.el : null };
      });
      paintLivePins();
    };

    const teardownPinOverlay = () => {
      if (!pinOverlay) return;
      pinOverlay.nodes.forEach((n) => n.remove());
      if (pinOverlay.frame) cancelAnimationFrame(pinOverlay.frame);
      document.removeEventListener('keydown', pinOverlay.onKeyDown);
      pinOverlay = null;
    };

    const buildPinOverlay = () => {
      if (pinOverlay) return;

      const overlay = document.createElement('div');
      overlay.className = 'capture-overlay';
      const highlight = document.createElement('div');
      highlight.className = 'capture-highlight';
      highlight.style.display = 'none';
      const crosshair = document.createElement('div');
      crosshair.className = 'capture-crosshair';
      crosshair.style.display = 'none';
      // The panel is hidden while placing, so the instruction and the way out
      // have to travel with the overlay.
      const banner = document.createElement('div');
      banner.className = 'capture-banner';
      banner.innerHTML = '<span>Click anywhere on the page to place your pin</span>'
        + '<button type="button" id="vv-pin-cancel">Cancel</button>';
      wrapper.appendChild(overlay);
      wrapper.appendChild(highlight);
      wrapper.appendChild(crosshair);
      wrapper.appendChild(banner);
      banner.querySelector('#vv-pin-cancel').addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        disarmPin();
      });

      const state = { nodes: [overlay, highlight, crosshair, banner], frame: null, last: null, onKeyDown: null };

      // The outline follows the element under the cursor, including a big empty
      // layout div, because that is the region being pointed at. The element the
      // pin is anchored to may differ; that is disclosed on the composer.
      const paintHighlight = () => {
        state.frame = null;
        if (!state.last) return;
        const el = elementUnderPoint(state.last.x, state.last.y);
        if (!el) { highlight.style.display = 'none'; return; }
        const r = el.getBoundingClientRect();
        highlight.style.display = '';
        highlight.style.left = r.left + 'px';
        highlight.style.top = r.top + 'px';
        highlight.style.width = r.width + 'px';
        highlight.style.height = r.height + 'px';
      };

      overlay.addEventListener('mousemove', (e) => {
        crosshair.style.display = '';
        crosshair.style.left = e.clientX + 'px';
        crosshair.style.top = e.clientY + 'px';
        state.last = { x: e.clientX, y: e.clientY };
        if (!state.frame) state.frame = requestAnimationFrame(paintHighlight);
      });
      overlay.addEventListener('mouseleave', () => {
        crosshair.style.display = 'none';
        highlight.style.display = 'none';
      });
      overlay.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        // A click on empty space collapses an expanded cluster rather than
        // dropping a pin, so getting out of a fan is not itself a new pin.
        if (expandedCluster !== null) { expandedCluster = null; paintLivePins(); return; }
        const x = e.clientX;
        const y = e.clientY;
        openComposer(resolveAnchor(x, y), x, y);
      });

      state.onKeyDown = (e) => {
        if (e.key !== 'Escape') return;
        if (expandedCluster !== null) { expandedCluster = null; paintLivePins(); return; }
        disarmPin();
      };
      document.addEventListener('keydown', state.onKeyDown);
      pinOverlay = state;
    };

    // Arming covers exactly one placement. The overlay swallows page clicks
    // while it is up, so leaving it armed would make the customer's own site
    // permanently unusable, which is why the composer disarms on open.
    // Hidden while placement is armed *and* while the composer is open, since a
    // pin dropped in the bottom-right corner puts the composer exactly where the
    // panel would reappear. Chrome returns once the feedback is sent or discarded.
    const syncChromeVisibility = () => {
      const composer = wrapper.querySelector('#vv-composer');
      const composing = !!composer && composer.classList.contains('open');
      wrapper.classList.toggle('chrome-hidden', pinArmed || composing);
    };

    const armPin = () => {
      if (pinArmed) return;
      pinArmed = true;
      wrapper.querySelector('#vv-action-pin').classList.add('active');
      syncChromeVisibility();
      buildPinOverlay();
      if (!cachedFeedback.length) fetchAllFeedback();
      rebuildLivePins();
    };

    const disarmPin = () => {
      if (!pinArmed) return;
      pinArmed = false;
      const btn = wrapper.querySelector('#vv-action-pin');
      if (btn) btn.classList.remove('active');
      syncChromeVisibility();
      teardownPinOverlay();
      expandedCluster = null;
      paintLivePins();
    };

    const setListOpen = (open) => {
      listOpen = open;
      const popupEl = wrapper.querySelector('.popup');
      popupEl.classList.toggle('list-open', open);
      wrapper.querySelector('#vv-action-list').classList.toggle('active', open);
      if (open) switchView(selectedFeedbackId ? 'detail' : 'feedback');
      else { stopAll(); popupEl.classList.remove('tall'); }
    };

    // --- Send reply ---
    const sendReply = async () => {
      const textEl = wrapper.querySelector('#vv-reply-text');
      if (!textEl) return;
      const text = textEl.value.trim();
      if ((!text && replyAttachments.length === 0) || !selectedFeedbackId || !widgetToken) return;
      const btn = wrapper.querySelector('#vv-send-reply');
      btn.disabled = true;

      try {
        const res = await fetch(API_REPLY, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify({ feedbackId: selectedFeedbackId, content: text || '', apiKey, hasAttachments: replyAttachments.length > 0 })
        });
        if (res.ok) {
          const replyData = await res.json();
          // Upload reply attachments if any
          if (replyAttachments.length > 0) {
            try {
              await uploadFiles(replyAttachments, selectedFeedbackId, replyData.replyId || null);
            } catch (uploadErr) {
              console.error('[VibeVaults] Reply attachment upload failed:', uploadErr);
              showWidgetToast(uploadErr.message || 'Attachment upload failed.');
            }
          }
          textEl.value = '';
          replyAttachments = [];
          const replyPreviewsEl = wrapper.querySelector('#vv-reply-attach-previews');
          if (replyPreviewsEl) replyPreviewsEl.innerHTML = '';
          fetchReplies();
        } else {
          const err = await res.json().catch(() => ({}));
          if (err.code === 'review_paused') {
            setReviewPaused(true);
            showWidgetToast(err.error || 'Feedback is paused by the project team.');
            return;
          }
          if (res.status === 401 || res.status === 403) {
            handleAuthRevocation();
            return;
          }
          showWidgetToast(err.error || 'Failed to send reply.');
        }
      } catch (e) {
        showWidgetToast('Network error. Please try again.');
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

    // Prevent background scroll-through on mobile: block touchmove on non-scrollable areas of the popup
    const popup = wrapper.querySelector('.popup');
    popup.addEventListener('touchmove', (e) => {
      let el = e.target;
      while (el && el !== popup) {
        if (el.scrollHeight > el.clientHeight) {
          const style = getComputedStyle(el);
          if (style.overflowY === 'auto' || style.overflowY === 'scroll') return;
        }
        el = el.parentElement;
      }
      e.preventDefault();
    }, { passive: false });

    // Opening shows the action bar and the saved pins; the feedback list is a
    // separate toggle so the panel stays small until it is actually wanted.
    // Collapsing is what hides the pins and hands the site back.
    const setWidgetOpen = (open) => {
      isOpen = open;
      popup.classList.toggle('open', open);
      if (open) {
        wrapper.querySelector('.badge').style.display = 'none';
        if (!cachedFeedback.length) fetchAllFeedback();
        rebuildLivePins();
        startPinLayoutWatch();
      } else {
        stopPinLayoutWatch();
        disarmPin();
        setListOpen(false);
        closeComposer();
        stopAll();
        expandedCluster = null;
        paintLivePins();
      }
    };

    triggerBtn.onclick = () => setWidgetOpen(!isOpen);
    wrapper.querySelector('.close-btn').onclick = () => setWidgetOpen(false);

    // Deliberately no close-on-outside-click. The pins are the point of having
    // the widget open, and dismissing the whole thing because someone clicked
    // their own page would make them disappear constantly.

    wrapper.querySelector('#vv-action-pin').onclick = (e) => {
      e.stopPropagation();
      if (reviewPaused) {
        showWidgetToast('Feedback is paused by the project team.');
        return;
      }
      if (pinArmed) disarmPin(); else armPin();
    };
    wrapper.querySelector('#vv-action-list').onclick = (e) => {
      e.stopPropagation();
      if (listOpen && selectedFeedbackId) goBackToList();
      setListOpen(!listOpen);
    };

    // --- Pin composer ---
    wrapper.querySelector('#vv-composer-close').onclick = (e) => {
      e.preventDefault();
      closeComposer();
    };
    wrapper.querySelector('#vv-composer-submit').onclick = sendPinnedFeedback;
    const composerFileInput = wrapper.querySelector('#vv-composer-file-input');
    wrapper.querySelector('#vv-composer-attach-btn').onclick = () => composerFileInput.click();
    composerFileInput.onchange = () => {
      const newFiles = validateFiles(Array.from(composerFileInput.files));
      if (pinAttachments.length + newFiles.length > MAX_FILES) {
        showWidgetToast('Maximum ' + MAX_FILES + ' files allowed.');
      } else {
        pinAttachments.push(...newFiles);
      }
      refreshComposerPreviews();
      composerFileInput.value = '';
    };
    wrapper.querySelector('#vv-composer-text').onkeydown = (e) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); sendPinnedFeedback(); }
      if (e.key === 'Escape') { e.preventDefault(); closeComposer(); }
    };

    // Registered once rather than per composer session: both the pin being
    // composed and every saved pin need to follow the page as it moves.
    window.addEventListener('scroll', onPinTrackingEvent, true);
    window.addEventListener('resize', onPinTrackingEvent);

    wrapper.querySelector('#vv-back-btn').onclick = goBackToList;

    const notifyCheckbox = wrapper.querySelector('#vv-notify-replies');
    if (notifyCheckbox) {
      notifyCheckbox.addEventListener('change', (e) => {
        localStorage.setItem(prefsKey, e.target.checked.toString());
        notifyRepliesSetting = e.target.checked;
      });
    }

  } // end init()

  // Ensure document.body exists before mounting the widget DOM
  if (document.body) {
    init();
  } else {
    document.addEventListener('DOMContentLoaded', init);
  }
})();
