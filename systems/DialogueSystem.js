export const dialogueTree = {
  start: {
    speaker: 'Gate Wizard',
    line: 'Welcome, wizard. The dungeon wakes. What do you seek?',
    options: [
      { text: 'Who are you?', next: 'who' },
      { text: 'Show me the dungeon.', next: 'hint' },
    ],
  },
  who: {
    speaker: 'Gate Wizard',
    line: 'I guard this threshold and count the gold of the fallen.',
    options: [{ text: 'Back', next: 'start' }],
  },
  hint: {
    speaker: 'Gate Wizard',
    line: 'Blue bolts strike true. Keep moving, kite the skeletons.',
    options: [{ text: 'Back', next: 'start' }],
  },
};
