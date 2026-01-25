(function () {
  const scriptTag = document.currentScript;

  // Dynamically determine API base from script source (works for local & prod)
  const scriptUrl = new URL(scriptTag.src);
  const API_BASE = `${scriptUrl.origin}/api/widget`;

  const apiKey = scriptTag ? scriptTag.getAttribute('data-key') : null;

  if (!apiKey) {
    console.warn('VibeVaults: Missing data-key attribute on script tag.');
    return;
  }

  // Create Host Element for Shadow DOM
  const host = document.createElement('div');
  const shadow = host.attachShadow({ mode: 'open' });
  document.body.appendChild(host);

  // Styles
  const style = document.createElement('style');
  style.textContent = `
    :host {
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 999999;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      box-sizing: border-box;
    }
    * { box-sizing: border-box; }
    
    .trigger-btn {
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: linear-gradient(135deg, #209CEE 0%, #1a8ad4 100%);
      color: white;
      border: none;
      box-shadow: 0 4px 12px rgba(32, 156, 238, 0.4);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .trigger-btn:hover {
      transform: scale(1.05) translateY(-2px);
      box-shadow: 0 6px 16px rgba(32, 156, 238, 0.5);
    }
    .trigger-btn:active {
      transform: scale(0.95);
    }
    .popup {
      position: absolute;
      bottom: 72px;
      right: 0;
      width: 360px;
      max-width: calc(100vw - 40px);
      max-height: calc(100vh - 110px);
      background: white;
      border-radius: 16px;
      box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04);
      display: none;
      flex-direction: column;
      overflow: hidden;
      border: 1px solid #e5e7eb;
      animation: slideUp 0.3s ease-out;
    }
    @keyframes slideUp {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .popup.open {
      display: flex;
    }
    .header {
      padding: 16px 20px;
      background: #ffffff;
      border-bottom: 1px solid #f3f4f6;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .header h3 {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
      color: #111827;
    }
    .close-btn {
      background: #f3f4f6;
      border: none;
      border-radius: 50%;
      width: 28px;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      color: #6b7280;
      transition: all 0.2s;
    }
    .close-btn:hover {
      background: #e5e7eb;
      color: #111827;
    }
    .content {
      flex: 1;
      padding: 20px;
      overflow-y: auto;
      scrollbar-width: thin;
      scrollbar-color: #e5e7eb transparent;
    }
    .content::-webkit-scrollbar {
      width: 6px;
    }
    .content::-webkit-scrollbar-track {
      background: transparent;
    }
    .content::-webkit-scrollbar-thumb {
      background-color: #e5e7eb;
      border-radius: 10px;
    }
    .feedback-form {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .form-label {
      font-size: 14px;
      color: #4b5563;
      line-height: 1.5;
    }
    textarea {
      width: 100%;
      height: 140px;
      padding: 12px;
      border: 1px solid #d1d5db;
      border-radius: 8px;
      font-family: inherit;
      font-size: 14px;
      resize: none;
      transition: border-color 0.2s, ring 0.2s;
    }
    textarea:focus {
      outline: none;
      border-color: #209CEE;
      box-shadow: 0 0 0 3px rgba(32, 156, 238, 0.1);
    }
    .submit-btn {
      background: #209CEE;
      color: white;
      border: none;
      padding: 12px;
      border-radius: 8px;
      cursor: pointer;
      font-weight: 600;
      font-size: 15px;
      transition: background 0.2s;
    }
    .submit-btn:hover {
      background: #1a8ad4;
    }
    .submit-btn:disabled {
      opacity: 0.7;
      cursor: not-allowed;
    }
    .branding {
      padding: 12px;
      text-align: center;
      font-size: 12px;
      color: #9ca3af;
      background: #f9fafb;
      border-top: 1px solid #f3f4f6;
    }
    .branding a {
      color: #209CEE;
      text-decoration: none;
      font-weight: 500;
    }
    .success-view {
      display: none;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: 40px 20px;
      gap: 12px;
    }
    .success-view.active {
      display: flex;
    }
    .success-icon {
      width: 56px;
      height: 56px;
      background: #ecfdf5;
      color: #10b981;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 8px;
    }
    @media (max-width: 640px) {
      :host {
        bottom: 16px;
        right: 16px;
      }
      .popup {
        position: fixed;
        bottom: 88px;
        left: 16px;
        right: 16px;
        width: auto;
        max-width: none;
        max-height: calc(100vh - 120px);
      }
    }
  `;
  shadow.appendChild(style);

  // UI Structure
  const wrapper = document.createElement('div');
  wrapper.innerHTML = `
    <button class="trigger-btn" aria-label="Open feedback widget">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
      </svg>
    </button>
    <div class="popup">
      <div class="header">
        <h3>Send Feedback</h3>
        <button class="close-btn" aria-label="Close">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      <div class="content">
          <div class="feedback-form">
            <p class="form-label">Have a suggestion or found a bug? We'd love to hear from you!</p>
            <textarea placeholder="Tell us what's on your mind..."></textarea>
            <button class="submit-btn" type="button">Send Feedback</button>
          </div>
          <div class="success-view">
            <div class="success-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </div>
            <p style="font-weight:700;font-size:20px;color:#111827;margin:0">Message sent!</p>
            <p style="font-size:15px;color:#6b7280;margin:0">Thank you for helping us improve.</p>
          </div>
      </div>
      <div class="branding">
        Powered by <a href="https://vibe-vaults.com" target="_blank" rel="noopener">VibeVaults</a>
      </div>
    </div>
  `;
  shadow.appendChild(wrapper);

  // State
  let isOpen = false;

  // Elements
  const popup = wrapper.querySelector('.popup');
  const triggerBtn = wrapper.querySelector('.trigger-btn');
  const closeBtn = wrapper.querySelector('.close-btn');
  const form = wrapper.querySelector('.feedback-form');
  const successView = wrapper.querySelector('.success-view');
  const textarea = wrapper.querySelector('textarea');
  const submitBtn = wrapper.querySelector('.submit-btn');

  // Actions
  const toggleOpen = () => {
    isOpen = !isOpen;
    if (isOpen) {
      popup.classList.add('open');
      // Reset view to form
      form.style.display = 'flex';
      successView.classList.remove('active');
      setTimeout(() => textarea.focus(), 100);
    } else {
      popup.classList.remove('open');
    }
  };

  const sendFeedback = async () => {
    const text = textarea.value.trim();
    if (!text) return;

    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Sending...';
    submitBtn.disabled = true;

    try {
      const response = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey,
          content: text,
          type: 'Feature'
        })
      });

      if (!response.ok) throw new Error('Failed to send');

      // Transition to success view
      form.style.display = 'none';
      successView.classList.add('active');
      textarea.value = '';

      // Auto-close after 5 seconds
      setTimeout(() => {
        if (isOpen && successView.classList.contains('active')) {
          toggleOpen();
        }
      }, 5000);

    } catch (e) {
      console.error('VibeVaults: Error sending feedback', e);
      alert('Error sending feedback. Please try again.');
    } finally {
      submitBtn.textContent = originalText;
      submitBtn.disabled = false;
    }
  };

  // Listeners
  triggerBtn.onclick = toggleOpen;
  closeBtn.onclick = toggleOpen;
  submitBtn.onclick = sendFeedback;

  // Handle Escape key
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen) {
      toggleOpen();
    }
  });

})();
