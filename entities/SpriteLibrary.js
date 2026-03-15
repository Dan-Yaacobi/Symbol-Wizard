import { visualTheme } from '../data/VisualTheme.js';

export const palette = {
  floorFg: visualTheme.colors.floorFg,
  floorBg: visualTheme.colors.floorBg,
  wallFg: visualTheme.colors.wallFg,
  wallBg: visualTheme.colors.wallBg,
  player: visualTheme.colors.playerPrimary,
  playerAccent: visualTheme.colors.playerAccent,
  magicBlue: visualTheme.colors.projectileArcane,
  slime: visualTheme.colors.slime,
  skeleton: visualTheme.colors.skeleton,
  npc: '#b6cbff',
  villager: '#ffd5e4',
  merchant: '#9fdfff',
  guard: '#ffe2a8',
  gold: visualTheme.colors.gold,
};

export const sprites = {
  player: {
    idle: [
      [
        '   *   ',
        '  /^\\  ',
        ' <###> ',
        ' /###\\ ',
        '  /|\\  ',
        '  / \\  ',
        ' /   \\ ',
      ],
      [
        '   *   ',
        '  /^\\  ',
        ' <###> ',
        ' /###\\ ',
        '  /|\\  ',
        ' /  \\  ',
        '  / \\  ',
      ],
    ],
    walk: [
      {
        art: [
          '   *   ',
          '  /^\\  ',
          ' <###> ',
          ' /###\\ ',
          '  /|\\  ',
          ' / /\\  ',
          '/_/  \\ ',
        ],
        offsetY: 0,
      },
      {
        art: [
          '   *   ',
          '  /^\\  ',
          ' <###> ',
          ' /###\\ ',
          '  /|\\  ',
          '  /|\\  ',
          ' / / \\ ',
        ],
        offsetY: 0,
      },
      {
        art: [
          '   *   ',
          '  /^\\  ',
          ' <###> ',
          ' /###\\ ',
          '  /|\\  ',
          '  /\\ \\ ',
          ' /  \\_\\',
        ],
        offsetY: 0,
      },
      {
        art: [
          '   *   ',
          '  /^\\  ',
          ' <###> ',
          ' /###\\ ',
          '  /|\\  ',
          '  /|\\  ',
          ' / \\ \\ ',
        ],
        offsetY: 0,
      },
    ],
    cast: [
      { art: ['   *   ', '  /^\\  ', ' <###> ', ' /###\\ ', ' _/|\\_ ', '  / \\  ', ' /   \\ '], offsetY: 0 },
      { art: ['   +   ', '  /^\\  ', ' <#*#> ', ' /###\\ ', ' _/|\\_ ', '  / \\  ', ' /   \\ '], offsetY: 0 },
      { art: ['   *   ', '  /^\\  ', ' <###> ', ' /###\\ ', '  /|\\  ', '  / \\  ', ' /   \\ '], offsetY: 0 },
    ],
  },
  slime: {
    idle: [
      [
        '       ',
        '  ~~~  ',
        ' ~%%%~ ',
        '  ~~~  ',
        '       ',
        '       ',
        '       ',
      ],
      [
        '       ',
        ' ~~~~~ ',
        ' ~%%%~ ',
        ' ~~~~~ ',
        '       ',
        '       ',
        '       ',
      ],
    ],
    walk: [
      [
        '       ',
        '  ~~~  ',
        ' ~%%%~ ',
        '  ~~~  ',
        '       ',
        '       ',
        '       ',
      ],
      [
        '       ',
        ' ~~~~~ ',
        ' ~%%%~ ',
        '  ~~~  ',
        '       ',
        '       ',
        '       ',
      ],
      [
        '       ',
        '  ~~~  ',
        ' ~%%%~ ',
        ' ~~~~~ ',
        '       ',
        '       ',
        '       ',
      ],
    ],
    attack: [
      [
        '       ',
        ' ~!~!~ ',
        ' !%%%! ',
        '  ~~~  ',
        '       ',
        '       ',
        '       ',
      ],
      [
        '       ',
        ' !!~!! ',
        ' !%%%! ',
        ' ~!~!~ ',
        '       ',
        '       ',
        '       ',
      ],
    ],
  },
  skeleton: {
    idle: [
      [
        '       ',
        '  \\o/  ',
        ' --#-- ',
        '  / \\  ',
        '       ',
        '       ',
        '       ',
      ],
      [
        '       ',
        '  \\o/  ',
        ' --#-- ',
        '  /|\\  ',
        '       ',
        '       ',
        '       ',
      ],
    ],
    walk: [
      [
        '       ',
        '  \\o/  ',
        ' --#-- ',
        '  / \\  ',
        '       ',
        '       ',
        '       ',
      ],
      [
        '       ',
        '  \\o/  ',
        ' --#-- ',
        '  /|\\  ',
        '       ',
        '       ',
        '       ',
      ],
      [
        '       ',
        '  \\o/  ',
        ' --#-- ',
        '  \\ /  ',
        '       ',
        '       ',
        '       ',
      ],
    ],
    attack: [
      [
        '   !   ',
        '  \\o/! ',
        ' --#-- ',
        '  / \\  ',
        '       ',
        '       ',
        '       ',
      ],
      [
        '   !   ',
        ' !\\o/  ',
        ' --#-! ',
        '  / \\  ',
        '       ',
        '       ',
        '       ',
      ],
    ],
  },
  npc: [
    '   ^   ',
    '  /o\\  ',
    ' <###> ',
    '  /#\\  ',
    ' /___\\ ',
    '  | |  ',
    '       ',
  ],
  'npc-villager': {
    idle: [[
      '   o   ',
      '  /|\\  ',
      ' <###> ',
      '  /#\\  ',
      ' /___\\ ',
      '  / \\  ',
      '       ',
    ]],
    walk: [[
      '   o   ',
      '  /|\\  ',
      ' <###> ',
      '  /#\\  ',
      ' /___\\ ',
      ' / | \\ ',
      '       ',
    ]],
  },
  'npc-merchant': {
    idle: [[
      '   $   ',
      '  /|\\  ',
      ' <###> ',
      '  /#\\  ',
      ' /___\\ ',
      '  / \\  ',
      '       ',
    ]],
    walk: [[
      '   $   ',
      '  /|\\  ',
      ' <###> ',
      '  /#\\  ',
      ' /___\\ ',
      ' / | \\ ',
      '       ',
    ]],
  },
  'npc-guard': {
    idle: [[
      '   !   ',
      '  /|\\  ',
      ' <###> ',
      '  /#\\  ',
      ' /_#_\\ ',
      '  / \\  ',
      '       ',
    ]],
    walk: [[
      '   !   ',
      '  /|\\  ',
      ' <###> ',
      '  /#\\  ',
      ' /_#_\\ ',
      ' / | \\ ',
      '       ',
    ]],
  },
  'house-red': [
    ' RRRRRRR ',
    '/RRRRRRR\\',
    '|[] _ []|',
    '|   |   |',
    '|___|___|',
  ],
  'house-blue': [
    ' BBBBBBB ',
    '/BBBBBBB\\',
    '|[] _ []|',
    '|   |   |',
    '|___|___|',
  ],
  'house-brown': [
    ' HHHHHHH ',
    '/HHHHHHH\\',
    '|[] _ []|',
    '|   |   |',
    '|___|___|',
  ],
  'house-red-chimney': [
    'R RRRRRR ',
    '|/RRRRRR\\',
    '||[] _ []|',
    '|   |   |',
    '|___|___|',
  ],
  'house-blue-chimney': [
    'B BBBBBB ',
    '|/BBBBBB\\',
    '||[] _ []|',
    '|   |   |',
    '|___|___|',
  ],
  fence: [
    '       ',
    '       ',
    ' ||||| ',
    ' ||||| ',
    '       ',
    '       ',
    '       ',
  ],
  barrel: [
    '       ',
    '  ___  ',
    ' /===\\ ',
    ' |===| ',
    ' \\___/ ',
    '       ',
    '       ',
  ],
  crate: [
    '       ',
    ' +---+ ',
    ' |x x| ',
    ' | x | ',
    ' +---+ ',
    '       ',
    '       ',
  ],
  vase: [
    '       ',
    '   _   ',
    '  / \\  ',
    '  \\_/  ',
    '   |   ',
    '       ',
    '       ',
  ],
  'barrel-break-1': ['  * *  ', ' *===* ', ' *===* ', '  ***  '],
  'barrel-break-2': [' *   * ', '*  *  *', ' *   * '],
  'crate-break-1': [' + + + ', ' x x x ', ' + + + '],
  'crate-break-2': ['  x x  ', ' x   x ', '  x x  '],
  'vase-break-1': ['  /_/  ', '  \\_\\  ', '   .   '],
  'vase-break-2': ['  . .  ', ' .   . ', '  . .  '],
  'tree-bright': [
    '  @@@  ',
    ' @@@@@ ',
    '@@@@@@@',
    '  |||  ',
    '   |   ',
    '       ',
    '       ',
  ],
  'tree-dark': [
    '  &&&  ',
    ' &&&&& ',
    '&&&&&&&',
    '  |||  ',
    '   |   ',
    '       ',
    '       ',
  ],
  bush: [
    '       ',
    '  %%%  ',
    ' %%%%% ',
    '  %%%  ',
    '       ',
    '       ',
    '       ',
  ],
  stone: [
    '       ',
    '       ',
    '  oo   ',
    ' oooo  ',
    '       ',
    '       ',
    '       ',
  ],
  'flower-red': ['       ', '   *   ', '   |   ', '       ', '       ', '       ', '       '],
  'flower-yellow': ['       ', '   +   ', '   |   ', '       ', '       ', '       ', '       '],
  'flower-blue': ['       ', '   o   ', '   |   ', '       ', '       ', '       ', '       '],
  'grass-patch': ['       ', '       ', '  """  ', '  """  ', '       ', '       ', '       '],
};

export function getSpriteFrame(spriteKey, animationState = 'idle', frameIndex = 0) {
  const spriteEntry = sprites[spriteKey];
  if (!spriteEntry) return null;
  if (Array.isArray(spriteEntry)) return { art: spriteEntry, offsetY: 0 };

  const stateFrames = spriteEntry[animationState] ?? spriteEntry.idle;
  if (!stateFrames || stateFrames.length === 0) return null;

  const safeFrameIndex = Math.abs(Math.floor(frameIndex)) % stateFrames.length;
  const frame = stateFrames[safeFrameIndex];
  if (Array.isArray(frame)) return { art: frame, offsetY: 0 };
  return frame;
}

export function getSpriteCollisionOffsets(sprite) {
  if (!sprite?.art?.length) return [];

  const width = sprite.art[0]?.length ?? 0;
  const halfWidth = Math.floor(width / 2);
  const anchorY = -3 + (sprite.offsetY ?? 0);
  const offsets = [];

  for (let sy = 0; sy < sprite.art.length; sy += 1) {
    const row = sprite.art[sy] ?? '';
    for (let sx = 0; sx < row.length; sx += 1) {
      if (row[sx] === ' ') continue;
      offsets.push({
        x: sx - halfWidth,
        y: sy + anchorY,
      });
    }
  }

  return offsets;
}
