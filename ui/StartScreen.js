export class StartScreen {
  constructor({ onStart } = {}) {
    this.onStart = typeof onStart === 'function' ? onStart : () => {};
    this.root = document.createElement('section');
    this.root.className = 'start-screen';
    this.root.innerHTML = `
      <div class="start-screen__panel">
        <h1>Symbol Wizard</h1>
        <p id="startScreenProgress">Preparing world...</p>
        <button id="startGameButton" type="button">Start Game</button>
      </div>
    `;
    this.progressLabel = this.root.querySelector('#startScreenProgress');
    this.startButton = this.root.querySelector('#startGameButton');
    this.startButton?.addEventListener('click', () => this.onStart());
  }

  mount(parent = document.body) {
    if (!this.root.isConnected) parent.appendChild(this.root);
  }

  unmount() {
    if (this.root.isConnected) this.root.remove();
  }

  setProgress(text) {
    if (this.progressLabel) this.progressLabel.textContent = text;
  }

  setReady(ready) {
    if (this.startButton) this.startButton.disabled = !ready;
  }
}
