export const palette = {
  floorFg: '#475162',
  floorBg: '#0b1016',
  wallFg: '#8a9099',
  wallBg: '#1d232d',
  player: '#c784ff',
  playerAccent: '#ffd76b',
  magicBlue: '#66aaff',
  slime: '#5bd46d',
  skeleton: '#d7d7db',
  npc: '#9a89ff',
  gold: '#e6c95a',
};

export const sprites = {
  player: {
    idle: [
      [
        '   ^   ',
        '  /#\\  ',
        ' <###> ',
        '  /#\\  ',
        ' /   \\ ',
        '  | |  ',
        '  / \\  ',
      ],
      [
        '   ^   ',
        '  /#\\  ',
        ' <###> ',
        '  /#\\  ',
        ' / \\ \\ ',
        '  | |  ',
        '  / \\  ',
      ],
    ],
    walk: [
      {
        // Contact: left foot plants forward while right leg pushes off.
        art: [
          '   ^   ',
          '  /#\\  ',
          ' <###> ',
          '  \\#/  ',
          ' /   \\ ',
          '/ | | \\',
          '/  /  \\',
        ],
        offsetY: 0,
      },
      {
        // Passing: weight shifts down a pixel, rear leg travels through.
        art: [
          '   ^   ',
          '  /#\\  ',
          ' <###> ',
          '  \\#/  ',
          ' /   \\ ',
          '  | |  ',
          '  / \\  ',
        ],
        offsetY: 1,
      },
      {
        // Opposite contact: right foot plants forward, left leg extends back.
        art: [
          '   ^   ',
          '  /#\\  ',
          ' <###> ',
          '  /#\\  ',
          ' /   \\ ',
          '\\ | | /',
          '\\  \\  /',
        ],
        offsetY: 0,
      },
      {
        art: [
          '   ^   ',
          '  /#\\  ',
          ' <###> ',
          '  /#\\  ',
          ' /   \\ ',
          '\\ | | /',
          ' \\   / ',
        ],
        offsetY: 0,
      },
      {
        art: [
          '   ^   ',
          '  /#\\  ',
          ' <###> ',
          '  /#\\  ',
          ' /   \\ ',
          '  | |  ',
          '  / \\  ',
        ],
        offsetY: 1,
      },
      {
        art: [
          '   ^   ',
          '  /#\\  ',
          ' <###> ',
          '  \\#/  ',
          ' /   \\ ',
          '/ | | \\',
          ' /   \\ ',
        ],
        offsetY: 0,
      },
    ],
  },
  slime: [
    '       ',
    '  ~~~  ',
    ' ~%%%~ ',
    '  ~~~  ',
    '       ',
    '       ',
    '       ',
  ],
  skeleton: [
    '       ',
    '  \\o/  ',
    ' --#-- ',
    '  / \\  ',
    '       ',
    '       ',
    '       ',
  ],
  npc: [
    '   ^   ',
    '  /?\\  ',
    ' <###> ',
    '  /#\\  ',
    ' /___\\ ',
    '  | |  ',
    '       ',
  ],
};
