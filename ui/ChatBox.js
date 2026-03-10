export class ChatBox {
  constructor() {
    this.speakerEl = document.getElementById('chatSpeaker');
    this.lineEl = document.getElementById('chatLine');
    this.optionsEl = document.getElementById('chatOptions');

    this.lastSpeaker = '';
    this.lastLine = '';
    this.lastOptionsKey = '';
  }

  setMessage(speaker, line, options = []) {
    if (speaker !== this.lastSpeaker) {
      this.speakerEl.textContent = speaker;
      this.lastSpeaker = speaker;
    }

    if (line !== this.lastLine) {
      this.lineEl.textContent = line;
      this.lastLine = line;
    }

    const optionsKey = options.map((opt) => opt.text).join('|');
    if (optionsKey === this.lastOptionsKey) return;

    this.lastOptionsKey = optionsKey;
    this.optionsEl.innerHTML = '';
    options.forEach((opt, i) => {
      const li = document.createElement('li');
      li.textContent = `${i + 1}. ${opt.text}`;
      this.optionsEl.appendChild(li);
    });
  }
}
