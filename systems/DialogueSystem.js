export const dialogueTree = {
  start: {
    speaker: 'Townfolk',
    text: 'Welcome, traveler. Sunmeadow is peaceful today. What do you seek?',
    responses: [
      { text: 'Tell me about this town.', nextNode: 'who' },
      { text: 'Where do the roads lead?', nextNode: 'hint' },
      { text: 'Farewell.', nextNode: null },
    ],
  },
  who: {
    speaker: 'Townfolk',
    text: 'Craftspeople, guards, and merchants live here. We all keep the crossroads alive.',
    responses: [{ text: 'Back', nextNode: 'start' }],
  },
  hint: {
    speaker: 'Townfolk',
    text: 'North road enters the forest. East path descends to old ruins. West leads to outskirts farms.',
    responses: [{ text: 'Back', nextNode: 'start' }],
  },
};
