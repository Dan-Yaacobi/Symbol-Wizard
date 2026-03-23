export class ChatBox {
  constructor() {
    this.rootEl = null;
    this.speakerEl = null;
    this.lineEl = null;
    this.optionsEl = null;
    this.closeButtonEl = null;

    this.lastSpeaker = '';
    this.lastLine = '';
    this.currentOptionCount = 0;
    this.responseHandler = null;
    this.closeHandler = null;

    this.resolveElements();
    this.rootEl?.classList.add('hidden');
    this.rootEl?.setAttribute('aria-hidden', 'true');
    this.closeButtonEl?.addEventListener('click', () => {
      this.closeHandler?.();
      this.hide();
    });
  }

  resolveElements() {
    this.rootEl ??= document.getElementById('chatBox');
    this.speakerEl ??= document.getElementById('chatSpeaker');
    this.lineEl ??= document.getElementById('chatLine');
    this.optionsEl ??= document.getElementById('chatOptions');
    this.closeButtonEl ??= document.getElementById('chatCloseButton');
  }

  bindResponseHandler(handler) {
    this.responseHandler = handler;
  }

  bindCloseHandler(handler) {
    this.closeHandler = handler;
  }

  show() {
    this.resolveElements();
    this.rootEl?.classList.remove('hidden');
    this.rootEl?.setAttribute('aria-hidden', 'false');
  }

  hide() {
    this.resolveElements();
    if (this.rootEl) this.rootEl.dataset.dialogueOpen = 'false';
    this.rootEl?.classList.add('hidden');
    this.rootEl?.setAttribute('aria-hidden', 'true');
  }

  setDialogueOpen(isOpen) {
    this.resolveElements();
    if (!this.rootEl) return;
    this.rootEl.dataset.dialogueOpen = isOpen ? 'true' : 'false';
    this.show();
  }

  setOptionsDisabled(disabled) {
    this.resolveElements();
    const buttons = this.optionsEl?.querySelectorAll('button[data-response-index]') ?? [];
    buttons.forEach((button) => {
      button.disabled = disabled;
      button.setAttribute('aria-disabled', disabled ? 'true' : 'false');
    });
  }

  clearOptions() {
    this.resolveElements();
    if (!this.optionsEl) return;
    this.optionsEl.innerHTML = '';
    this.currentOptionCount = 0;
    this.lastLine = '';
    this.lastSpeaker = '';
  }

  setMessage(speaker, line, options = [], { disableOptions = false, visible = true } = {}) {
    this.resolveElements();
    if (!this.rootEl || !this.speakerEl || !this.lineEl || !this.optionsEl) return;

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
      button.onclick = () => {
        if (button.disabled || this.rootEl.dataset.dialogueOpen !== 'true') return;
        this.responseHandler?.(i);
      };
      li.appendChild(button);
      this.optionsEl.appendChild(li);
    });

    if (visible) this.show();
    else this.hide();
  }
}
