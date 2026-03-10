export class ChatBox {
  constructor() {
    this.speakerEl = document.getElementById('chatSpeaker');
    this.lineEl = document.getElementById('chatLine');
    this.optionsEl = document.getElementById('chatOptions');
  }

  setMessage(speaker, line, options = []) {
    this.speakerEl.textContent = speaker;
    this.lineEl.textContent = line;
    this.optionsEl.innerHTML = '';
    options.forEach((opt, i) => {
      const li = document.createElement('li');
      li.textContent = `${i + 1}. ${opt.text}`;
      this.optionsEl.appendChild(li);
    });
  }
}
