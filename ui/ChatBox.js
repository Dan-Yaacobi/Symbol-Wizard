export class ChatBox {
  constructor() {
    this.rootEl = document.getElementById('chatBox');
    this.speakerEl = document.getElementById('chatSpeaker');
    this.lineEl = document.getElementById('chatLine');
    this.optionsEl = document.getElementById('chatOptions');

    this.lastSpeaker = '';
    this.lastLine = '';
    this.currentOptionCount = 0;
    this.onResponseSelect = null;

    this.handleOptionClick = this.handleOptionClick.bind(this);
    this.optionsEl.addEventListener('click', this.handleOptionClick);
  }

  bindResponseHandler(handler) {
    this.onResponseSelect = handler;
  }

  handleOptionClick(event) {
    const button = event.target.closest('button[data-response-index]');
    if (!button || button.disabled || this.rootEl.dataset.dialogueOpen !== 'true') return;

    const responseIndex = Number(button.dataset.responseIndex);
    if (!Number.isInteger(responseIndex) || !this.onResponseSelect) return;

    this.onResponseSelect(responseIndex);
  }

  setDialogueOpen(isOpen) {
    this.rootEl.dataset.dialogueOpen = isOpen ? 'true' : 'false';
  }

  setOptionsDisabled(disabled) {
    const buttons = this.optionsEl.querySelectorAll('button[data-response-index]');
    buttons.forEach((button) => {
      button.disabled = disabled;
      button.setAttribute('aria-disabled', disabled ? 'true' : 'false');
    });
  }

  clearOptions() {
    this.optionsEl.innerHTML = '';
    this.currentOptionCount = 0;
    this.lastLine = '';
    this.lastSpeaker = '';
  }

  setMessage(speaker, line, options = [], { disableOptions = false } = {}) {
    if (speaker !== this.lastSpeaker) {
      this.speakerEl.textContent = speaker;
      this.lastSpeaker = speaker;
    }

    if (line !== this.lastLine) {
      this.lineEl.textContent = line;
      this.lastLine = line;
    }

    this.optionsEl.innerHTML = '';
    this.currentOptionCount = options.length;

    options.forEach((opt, i) => {
      const li = document.createElement('li');
      li.className = 'chat-option-item';

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'chat-option-button';
      button.dataset.responseIndex = String(i);
      button.disabled = disableOptions;
      button.innerHTML = `<span class="chat-option-hotkey">${i + 1}.</span> <span>${opt.text}</span>`;
      li.appendChild(button);
      this.optionsEl.appendChild(li);
    });
  }
}
