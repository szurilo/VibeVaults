(function () {
  const SCRIPT_ID = 'clog-script';
  const API_BASE = 'http://localhost:3000/api/widget'; // TODO: Change for prod

  // Get API Key from script attribute
  const scriptTag = document.currentScript || document.getElementById(SCRIPT_ID);
  const apiKey = scriptTag ? scriptTag.getAttribute('data-key') : null;

  if (!apiKey) {
    console.warn('Clog: Missing data-key attribute on script tag.');
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
      z-index: 9999;
      font-family: -apple-system, system-ui, sans-serif;
    }
    .trigger-btn {
      width: 50px;
      height: 50px;
      border-radius: 50%;
      background: #4f46e5;
      color: white;
      border: none;
      box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.2s;
    }
    .trigger-btn:hover {
      transform: scale(1.05);
    }
    .popup {
      position: absolute;
      bottom: 60px;
      right: 0;
      width: 320px;
      height: auto;
      min-height: 250px;
      background: white;
      border-radius: 12px;
      box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04);
      display: none;
      flex-direction: column;
      overflow: hidden;
      border: 1px solid #e5e7eb;
    }
    .popup.open {
      display: flex;
    }
    .header {
      padding: 16px;
      background: #f9fafb;
      border-bottom: 1px solid #e5e7eb;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .header h3 {
      margin: 0;
      font-size: 16px;
      color: #111827;
    }
    .content {
      flex: 1;
      padding: 16px;
    }
    .feedback-form {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    textarea {
      width: 100%;
      height: 120px;
      padding: 8px;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      font-family: inherit;
      resize: none;
      box-sizing: border-box;
    }
    button.submit-btn {
      background: #4f46e5;
      color: white;
      border: none;
      padding: 8px;
      border-radius: 6px;
      cursor: pointer;
      font-weight: 500;
    }
  `;
  shadow.appendChild(style);

  // UI Structure
  const wrapper = document.createElement('div');
  wrapper.innerHTML = `
    <button class="trigger-btn">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
      </svg>
    </button>
    <div class="popup">
      <div class="header">
        <h3>Send Feedback</h3>
        <button id="close-btn" style="background:none;border:none;cursor:pointer;font-size:18px">×</button>
      </div>
      <div class="content">
         <div class="feedback-form">
            <p style="font-size:14px;color:#4b5563;margin-top:0">Have a suggestion or found a bug? Let us know!</p>
            <textarea placeholder="I wish this app could..."></textarea>
            <button class="submit-btn">Send Feedback</button>
         </div>
      </div>
    </div>
  `;
  shadow.appendChild(wrapper);

  // State
  let isOpen = false;

  // Elements
  const popup = wrapper.querySelector('.popup');
  const triggerBtn = wrapper.querySelector('.trigger-btn');
  const closeBtn = wrapper.querySelector('#close-btn');
  const textarea = wrapper.querySelector('textarea');
  const submitBtn = wrapper.querySelector('.submit-btn');

  // Actions
  const toggleOpen = () => {
    isOpen = !isOpen;
    if (isOpen) {
      popup.classList.add('open');
      // Focus textarea on open
      setTimeout(() => textarea.focus(), 100);
    } else {
      popup.classList.remove('open');
    }
  };

  const sendFeedback = async () => {
    const text = textarea.value;
    if (!text) return;

    submitBtn.textContent = 'Sending...';
    try {
      await fetch(API_BASE, {
        method: 'POST',
        body: JSON.stringify({
          apiKey,
          content: text,
          type: 'Feature'
        })
      });
      alert('Thanks for your feedback!');
      textarea.value = '';
      toggleOpen();
    } catch (e) {
      alert('Error sending feedback');
    } finally {
      submitBtn.textContent = 'Send Feedback';
    }
  };

  // Listeners
  triggerBtn.onclick = toggleOpen;
  closeBtn.onclick = toggleOpen;
  submitBtn.onclick = sendFeedback;

})();
