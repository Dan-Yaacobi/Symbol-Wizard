export class SkillTreeWindow {
  constructor({ root, abilitySystem, player }) {
    this.root = root;
    this.abilitySystem = abilitySystem;
    this.player = player;
    this.selectedAbilityId = null;

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

  createDetailsPanel(ability) {
    const panel = document.createElement('aside');
    panel.className = 'skill-detail-panel';

    if (!ability) {
      panel.innerHTML = '<h4>Skill Details</h4><p>Hover or select a skill to see its description, level, upgrade effect, and cost.</p>';
      return panel;
    }

    const currentLevel = this.abilitySystem.getUpgradeLevel(ability.id);
    const nextUpgrade = ability.upgrades[currentLevel - 1];

    panel.innerHTML = `
      <h4>${ability.name}</h4>
      <p>${ability.description}</p>
      <p><strong>Current level:</strong> ${currentLevel}</p>
      <p><strong>Next upgrade effect:</strong> ${nextUpgrade ? nextUpgrade.effect : 'Max level reached'}</p>
      <p><strong>Gold cost:</strong> ${nextUpgrade ? `${nextUpgrade.cost}g` : 'N/A'}</p>
    `;

    return panel;
  }

  render() {
    const abilities = this.abilitySystem.getAbilities();

    if (!this.selectedAbilityId || !abilities.some((ability) => ability.id === this.selectedAbilityId)) {
      this.selectedAbilityId = abilities[0]?.id ?? null;
    }

    this.el.innerHTML = `<header><h3>Skill Tree</h3><p>Gold: ${this.player.gold}</p></header>`;

    const layout = document.createElement('div');
    layout.className = 'skill-tree-layout';

    const detailsAbility = abilities.find((ability) => ability.id === this.selectedAbilityId) ?? null;
    layout.appendChild(this.createDetailsPanel(detailsAbility));

    const grid = document.createElement('div');
    grid.className = 'skill-tree-grid';

    for (const ability of abilities) {
      const currentLevel = this.abilitySystem.getUpgradeLevel(ability.id);
      const nextUpgrade = ability.upgrades[currentLevel - 1];

      const card = document.createElement('article');
      card.className = 'skill-card';
      if (ability.id === this.selectedAbilityId) card.classList.add('selected');

      card.innerHTML = `
        <h4>${ability.name}</h4>
        <p>${ability.description}</p>
        <p class="meta">Current Level: ${currentLevel}</p>
        <p class="meta">Upgrade Effect: ${nextUpgrade ? nextUpgrade.effect : 'Max level reached'}</p>
        <p class="meta">Upgrade Cost: ${nextUpgrade ? `${nextUpgrade.cost}g` : 'N/A'}</p>
      `;

      card.addEventListener('mouseenter', () => {
        this.selectedAbilityId = ability.id;
        this.render();
      });

      card.addEventListener('click', () => {
        this.selectedAbilityId = ability.id;
        this.render();
      });

      const list = document.createElement('ol');
      list.className = 'upgrade-list';
      for (const node of ability.upgrades) {
        const li = document.createElement('li');
        const unlocked = node.level <= currentLevel;
        li.textContent = `Lv ${node.level}: ${node.name} — ${node.effect} (${node.cost}g)`;
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
          this.selectedAbilityId = ability.id;
          this.abilitySystem.upgradeAbility(ability.id);
          this.render();
        });
      }

      card.appendChild(button);
      grid.appendChild(card);
    }

    layout.appendChild(grid);
    this.el.appendChild(layout);
  }
}
