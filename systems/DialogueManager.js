function createFallbackNode() {
  return {
    text: '...The villager seems distracted right now.',
    responses: [{ text: 'Leave', nextNode: null }],
  };
}

function normalizeResponse(response, index, nodeId) {
  if (!response || typeof response.text !== 'string') {
    console.warn(`[DialogueManager] Invalid response in node "${nodeId}" at index ${index}.`);
    return null;
  }

  return {
    text: response.text,
    nextNode: response.nextNode ?? response.next ?? null,
    action: typeof response.action === 'function' ? response.action : null,
  };
}

function normalizeNode(node, nodeId) {
  if (!node || typeof node !== 'object') {
    console.warn(`[DialogueManager] Missing or invalid node "${nodeId}".`);
    return createFallbackNode();
  }

  const responses = Array.isArray(node.responses ?? node.options)
    ? (node.responses ?? node.options)
      .map((response, index) => normalizeResponse(response, index, nodeId))
      .filter(Boolean)
    : [];

  if (!responses.length) {
    responses.push({ text: 'Leave', nextNode: null, action: null });
  }

  return {
    speaker: node.speaker ?? 'Townfolk',
    text: node.text ?? node.line ?? '',
    responses,
  };
}

function normalizeDialogueTree(tree) {
  const normalized = {};
  for (const [nodeId, node] of Object.entries(tree ?? {})) {
    normalized[nodeId] = normalizeNode(node, nodeId);
  }

  if (!normalized.start) {
    console.warn('[DialogueManager] Dialogue tree has no "start" node. Injecting fallback start node.');
    normalized.start = createFallbackNode();
  }

  return normalized;
}

function buildNpcDialogue(npc, baseTree) {
  const base = normalizeDialogueTree(baseTree);
  const intro = npc?.dialogue ?? 'Good to see you, traveler.';

  return {
    ...base,
    start: {
      ...base.start,
      speaker: npc?.name ?? base.start.speaker,
      text: intro,
      responses: base.start.responses,
    },
  };
}

export class DialogueManager {
  static DEBUG = false;

  constructor({ chatBox, npcs, player, input, baseDialogueTree }) {
    this.chatBox = chatBox;
    this.npcs = npcs;
    this.player = player;
    this.input = input;
    this.baseDialogueTree = baseDialogueTree;

    this.currentDialogue = null;
    this.currentNode = null;
    this.activeNpc = null;
    this.activeInteractable = null;
    this.isOpen = false;
    this.interactLatch = false;
    this.responseLatch = false;
    this.transitionLocked = false;

    this.chatBox.bindResponseHandler((responseIndex) => this.handleResponse(responseIndex));
  }

  log(...args) {
    if (!DialogueManager.DEBUG) return;
    console.info('[DialogueManager]', ...args);
  }

  findNearestNpc() {
    let nearestNpc = null;
    let nearestDistance = Number.POSITIVE_INFINITY;

    for (const npc of this.npcs) {
      const distance = Math.hypot(this.player.x - npc.x, this.player.y - npc.y);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestNpc = npc;
      }
    }

    return { npc: nearestNpc, distance: nearestDistance };
  }

  openDialogue(npc, interactable = null) {
    this.activeNpc = npc;
    this.currentDialogue = buildNpcDialogue(npc, this.baseDialogueTree);
    this.activeInteractable = interactable;
    this.currentNode = 'start';
    this.isOpen = true;
    this.transitionLocked = false;
    this.setNpcEngagedState(true);
    this.log('openDialogue', { npc: npc?.name, node: this.currentNode });
    this.renderNode(this.currentNode);
  }

  closeDialogue() {
    this.log('closeDialogue', { npc: this.activeNpc?.name, node: this.currentNode });
    this.chatBox.clearOptions();
    this.isOpen = false;
    this.currentDialogue = null;
    this.currentNode = null;
    this.transitionLocked = false;
    this.setNpcEngagedState(false);
    this.activeNpc = null;
    this.activeInteractable = null;
  }

  setNpcEngagedState(isEngaged) {
    if (!this.activeNpc) return;
    this.activeNpc.dialogueEngaged = isEngaged;
    if (!isEngaged) {
      this.activeNpc.dialoguePulse = 0;
      return;
    }

    this.activeNpc.dialoguePulse = 0.22;
  }

  renderNode(nodeId) {
    if (!this.currentDialogue) return;
    const node = this.currentDialogue[nodeId];

    if (!node) {
      console.warn(`[DialogueManager] Missing dialogue node "${nodeId}". Closing dialogue.`);
      this.closeDialogue();
      return;
    }

    this.currentNode = nodeId;
    const speaker = node.speaker?.replace('Gate Wizard', this.activeNpc?.name ?? 'Townfolk') ?? 'Townfolk';
    const text = node.text
      .replace('dungeon', 'town')
      .replace('threshold', 'crossroads');

    this.chatBox.setDialogueOpen(true);
    this.chatBox.setMessage(speaker, text, node.responses, { disableOptions: false });
    this.log('renderNode', { nodeId, responses: node.responses.length });
  }

  handleResponse(responseIndex) {
    if (!this.isOpen || this.transitionLocked || !this.currentDialogue || !this.currentNode) return;

    const node = this.currentDialogue[this.currentNode];
    if (!node) {
      console.warn('[DialogueManager] Current node missing while selecting response.', this.currentNode);
      this.closeDialogue();
      return;
    }

    const response = node.responses[responseIndex];
    if (!response) {
      console.warn(`[DialogueManager] Invalid response index ${responseIndex} for node "${this.currentNode}".`);
      return;
    }

    this.transitionLocked = true;
    this.chatBox.setOptionsDisabled(true);
    this.activeNpc.dialoguePulse = 0.14;
    this.log('handleResponse', { from: this.currentNode, response: response.text, to: response.nextNode });

    if (response.action) {
      try {
        response.action({ npc: this.activeNpc, player: this.player });
      } catch (error) {
        console.warn('[DialogueManager] Response action failed.', error);
      }
    }

    Promise.resolve().then(() => {
      if (!this.isOpen) return;

      if (!response.nextNode) {
        this.closeDialogue();
        return;
      }

      if (!this.currentDialogue[response.nextNode]) {
        console.warn(`[DialogueManager] nextNode "${response.nextNode}" does not exist.`);
        this.closeDialogue();
        return;
      }

      this.transitionLocked = false;
      this.renderNode(response.nextNode);
    });
  }


  getPromptNpc() {
    const { npc: nearestNpc, distance } = this.findNearestNpc();
    return nearestNpc && distance <= nearestNpc.interactRadius ? nearestNpc : null;
  }

  handleInteractionPrompt(nearNpc) {
    const exitText = 'North Exit → Forest | East Exit → Dungeon | West Exit → Outskirts';
    const prompt = nearNpc
      ? `Press E to talk to ${nearNpc.name}. ${exitText}`
      : `Welcome to Sunmeadow Town. ${exitText}`;

    this.chatBox.setDialogueOpen(false);
    this.chatBox.setMessage('Town Crier', prompt, []);
  }

  update(dt) {
    if (this.activeNpc?.dialoguePulse > 0) {
      this.activeNpc.dialoguePulse = Math.max(0, this.activeNpc.dialoguePulse - dt);
    }

    const nearNpc = this.getPromptNpc();

    if (!this.isOpen) {
      this.handleInteractionPrompt(nearNpc);
      return;
    }

    const anyNumberPressed = Array.from({ length: 9 }, (_, index) => this.input.isDown(String(index + 1))).some(Boolean);
    if (anyNumberPressed && !this.responseLatch) {
      const pressedIndex = Array.from({ length: 9 }, (_, index) => this.input.isDown(String(index + 1)) ? index : -1).find((value) => value >= 0);
      if (pressedIndex >= 0) this.handleResponse(pressedIndex);
    }
    this.responseLatch = anyNumberPressed;
  }
}
