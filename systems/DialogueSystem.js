export const dialogueTree = {
  start: {
    speaker: 'Townfolk',
    line: 'Welcome, traveler. Sunmeadow is peaceful today. What do you seek?',
    options: [
      { text: 'Tell me about this town.', next: 'who' },
      { text: 'Where do the roads lead?', next: 'hint' },
    ],
  },
  who: {
    speaker: 'Townfolk',
    line: 'Craftspeople, guards, and merchants live here. We all keep the crossroads alive.',
    options: [{ text: 'Back', next: 'start' }],
  },
  hint: {
    speaker: 'Townfolk',
    line: 'North road enters the forest. East path descends to old ruins. West leads to outskirts farms.',
    options: [{ text: 'Back', next: 'start' }],
  },
};
