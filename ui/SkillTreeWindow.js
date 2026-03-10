export class SkillTreeWindow {
  constructor({ root, abilitySystem, player }) {
    this.root = root;
    this.abilitySystem = abilitySystem;
    this.player = player;

    this.el = document.createElement('section');
    this.el.className = 'skill-tree-window hidden';
    this.root.appendChild(this.el);

    window.addEventListener('keydown', (event) => {
      if (event.key.toLowerCase() === 'k') this.toggle();
    });

    this.render();
  }

  toggle() {
    this.el.classList.toggle('hidden');
    this.render();
  }

  render() {
    const abilities = this.abilitySystem.getAbilities();
    this.el.innerHTML = `<header><h3>SkillTreeWindow</h3><p>Gold: ${this.player.gold}</p></header>`;

    const grid = document.createElement('div');
    grid.className = 'skill-tree-grid';

    for (const ability of abilities) {
      const currentLevel = this.abilitySystem.getUpgradeLevel(ability.id);
      const nextUpgrade = ability.upgrades[currentLevel - 1];

      const card = document.createElement('article');
      card.className = 'skill-card';
      card.innerHTML = `
        <h4>${ability.name} <small>(Lv ${currentLevel})</small></h4>
        <p>${ability.description}</p>
        <p class="meta">${ability.theme} • ${ability.category}</p>
      `;

      const list = document.createElement('ol');
      list.className = 'upgrade-list';
      for (const node of ability.upgrades) {
        const li = document.createElement('li');
        const unlocked = node.level <= currentLevel;
        li.textContent = `Lv ${node.level}: ${node.name} (${node.cost}g)`;
        li.className = unlocked ? 'unlocked' : '';
        list.appendChild(li);
      }
      card.appendChild(list);

      const button = document.createElement('button');
      button.type = 'button';

      if (!nextUpgrade) {
        button.textContent = 'Maxed';
        button.disabled = true;
      } else {
        button.textContent = `Unlock ${nextUpgrade.name} (${nextUpgrade.cost}g)`;
        button.disabled = this.player.gold < nextUpgrade.cost;
        button.addEventListener('click', () => {
          this.abilitySystem.upgradeAbility(ability.id);
          this.render();
        });
      }

      card.appendChild(button);
      grid.appendChild(card);
    }

    this.el.appendChild(grid);
  }
}
