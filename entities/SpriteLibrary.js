import { visualPalette, visualTheme } from '../data/VisualTheme.js';
import { getSpriteAsset as getLoadedSpriteAsset, registerSpriteAsset, getSpriteAnimation as getLoadedSpriteAnimation, getSpriteFrame as getLoadedSpriteFrame, getAnimationFrameCount } from '../data/SpriteAssetLoader.js';
import { normalizeSpriteAsset, normalizeSpriteFrame, isOccupiedSpriteCell } from '../data/SpriteAssetSchema.js';

export const palette = {
  floorFg: visualPalette.ground.floorFg,
  floorBg: visualPalette.ground.floorBg,
  wallFg: visualPalette.stone.wallFg,
  wallBg: visualPalette.stone.wallBg,
  player: visualPalette.player.primary,
  playerAccent: visualPalette.player.accent,
  magicBlue: visualTheme.colors.projectileArcane,
  slime: visualPalette.enemy.slime,
  skeleton: visualPalette.enemy.skeleton,
  npc: '#b6cbff',
  villager: '#ffd5e4',
  merchant: '#9fdfff',
  guard: '#ffe2a8',
  gold: visualPalette.gold.coin,
};

export const sprites = {
  player: {
    // Player sprites are authored as fixed 5x5 ASCII matrices so every animation
    // frame shares an identical footprint and world anchor.
    idle: [
      {
        art: [
          '  ^  ',
          '(/@\\)',
          '<###>',
          ' /|\\ ',
          ' / \\ ',
        ],
        offsetY: 0,
      },
    ],
    walk: [
      {
        art: [
          '  ^  ',
          '(/@\\)',
          '<###>',
          ' /|\\ ',
          '/   \\',
        ],
        offsetY: 0,
      },
      {
        art: [
          '  ^  ',
          '(/@\\)',
          '<###>',
          ' </\\ ',
          ' \\ / ',
        ],
        offsetY: 0,
      },
      {
        art: [
          '  ^  ',
          '(/@\\)',
          '<###>',
          ' /\\> ',
          '/   \\',
        ],
        offsetY: 0,
      },
      {
        art: [
          '  ^  ',
          '(/@\\)',
          '<###>',
          ' /|\\ ',
          ' / \\ ',
        ],
        offsetY: 0,
      },
    ],
    cast: [
      {
        art: [
          '  *  ',
          '(/@\\)',
          '<###>',
          ' <|> ',
          ' / \\ ',
        ],
        offsetY: 0,
      },
      {
        art: [
          ' *** ',
          '(/@\\)',
          '<#*#>',
          ' /|\\ ',
          ' / \\ ',
        ],
        offsetY: 0,
      },
      {
        art: [
          '  +  ',
          '(/@\\)',
          '<###>',
          ' <|> ',
          ' / \\ ',
        ],
        offsetY: 0,
      },
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
  spider: {
    idle: [[
      '       ',
      '       ',
      ' xx xx ',
      'x(###)x',
      ' <x x> ',
      'x     x',
      '       ',
    ]],
    walk: [[
      '       ',
      '       ',
      ' xx xx ',
      'x(###)x',
      ' x< >x ',
      'x     x',
      '       ',
    ]],
    attack: [[
      '       ',
      '  ! !  ',
      ' xx xx ',
      'x(#!#)x',
      ' x< >x ',
      'x  !  x',
      '       ',
    ]],
  },
  wasp: {
    idle: [[
      '       ',
      '  <^>  ',
      ' ((#)) ',
      ' -###- ',
      '  <v>  ',
      '       ',
      '       ',
    ]],
    walk: [[
      '       ',
      '  ~^~  ',
      ' ((#)) ',
      ' -###- ',
      '  <v>  ',
      '       ',
      '       ',
    ]],
    attack: [[
      '       ',
      '  !^!  ',
      ' ((#)) ',
      ' -#!#- ',
      '  <v>  ',
      '   !   ',
      '       ',
    ]],
  },
  swarm_bug: {
    idle: [[
      '       ',
      '       ',
      '       ',
      '   o   ',
      '  <#>  ',
      '       ',
      '       ',
    ]],
    walk: [[
      '       ',
      '       ',
      '       ',
      '   o   ',
      '  <#>  ',
      '       ',
      '       ',
    ]],
    attack: [[
      '       ',
      '       ',
      '   !   ',
      '   o   ',
      '  <#>  ',
      '       ',
      '       ',
    ]],
  },
  forest_beetle: {
    idle: [[
      '       ',
      '  ___  ',
      ' <###> ',
      '|#####|',
      ' <___> ',
      ' < | > ',
      '       ',
    ]],
    walk: [[
      '       ',
      '  ___  ',
      ' <###> ',
      '|#####|',
      ' <___> ',
      ' < | > ',
      '       ',
    ]],
    attack: [[
      '       ',
      '  _!_  ',
      ' <#!#> ',
      '|#####|',
      ' <___> ',
      ' < | > ',
      '       ',
    ]],
  },
  forest_mantis: {
    idle: [[
      '   ^   ',
      '  <#>  ',
      ' <###> ',
      '  |#|  ',
      ' < | > ',
      '   |   ',
      '  < >  ',
    ]],
    walk: [[
      '   ^   ',
      '  <#>  ',
      ' <###> ',
      '  |#|  ',
      ' < | > ',
      '   |   ',
      '  < >  ',
    ]],
    attack: [[
      '   !   ',
      '  <#>  ',
      ' <<#>> ',
      '  |#|  ',
      ' < | > ',
      '   |   ',
      '  < >  ',
    ]],
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

export function convertLegacyFrameToSpriteFrame(frame) {
  if (!frame) return null;
  if (Array.isArray(frame)) {
    const height = frame.length;
    const width = frame[0]?.length ?? 0;
    return normalizeSpriteFrame({
      width,
      height,
      offsetY: 0,
      cells: frame.map((row) => [...row].map((ch) => ({ ch, fg: null, bg: null }))),
    });
  }
  if (Array.isArray(frame.art)) {
    const height = frame.art.length;
    const width = frame.art[0]?.length ?? 0;
    return normalizeSpriteFrame({
      width,
      height,
      offsetY: frame.offsetY ?? 0,
      cells: frame.art.map((row) => [...row].map((ch) => ({ ch, fg: null, bg: null }))),
    });
  }
  if (Array.isArray(frame.cells)) return normalizeSpriteFrame(frame);
  return null;
}

export function convertLegacySpriteEntryToAsset(spriteId, spriteEntry) {
  if (!spriteEntry) return null;
  if (Array.isArray(spriteEntry)) {
    return normalizeSpriteAsset({
      id: spriteId,
      anchor: { x: Math.floor((spriteEntry[0]?.length ?? 1) / 2), y: 3 },
      animations: { idle: [convertLegacyFrameToSpriteFrame(spriteEntry)] },
      meta: { source: 'legacy' },
    });
  }

  const animations = {};
  for (const [animationName, frames] of Object.entries(spriteEntry)) {
    if (!Array.isArray(frames)) continue;
    animations[animationName] = frames.map((frame) => convertLegacyFrameToSpriteFrame(frame)).filter(Boolean);
  }
  const idleFrame = animations.idle?.[0] ?? Object.values(animations)[0]?.[0] ?? convertLegacyFrameToSpriteFrame([[ ' ' ]]);
  return normalizeSpriteAsset({
    id: spriteId,
    anchor: { x: Math.floor((idleFrame?.width ?? 1) / 2), y: 3 },
    animations,
    meta: { source: 'legacy' },
  });
}

export function resolveSpriteId(spriteLike) {
  if (!spriteLike) return null;
  if (typeof spriteLike === 'string') return spriteLike;
  return spriteLike.spriteId ?? spriteLike.spriteKey ?? null;
}

export function getSpriteAsset(spriteId) {
  const resolvedSpriteId = resolveSpriteId(spriteId);
  if (!resolvedSpriteId) return null;
  const loaded = getLoadedSpriteAsset(resolvedSpriteId);
  if (loaded) return loaded;
  const legacy = convertLegacySpriteEntryToAsset(resolvedSpriteId, sprites[resolvedSpriteId]);
  if (!legacy) return null;
  registerSpriteAsset(legacy);
  return getLoadedSpriteAsset(resolvedSpriteId) ?? legacy;
}

export function getSpriteAnimationFrames(spriteLike, animationState = 'idle') {
  const spriteId = resolveSpriteId(spriteLike);
  getSpriteAsset(spriteId);
  return getLoadedSpriteAnimation(spriteId, animationState) ?? [];
}

export function getSpriteFrame(spriteLike, animationState = 'idle', frameIndex = 0) {
  const spriteId = resolveSpriteId(spriteLike);
  getSpriteAsset(spriteId);
  const frame = getLoadedSpriteFrame(spriteId, animationState, frameIndex);
  return frame ? normalizeSpriteFrame(frame) : null;
}

export function getSpriteAnimationFrameCount(spriteLike, animationState = 'idle') {
  const spriteId = resolveSpriteId(spriteLike);
  getSpriteAsset(spriteId);
  return getAnimationFrameCount(spriteId, animationState);
}

export function getSpriteCollisionOffsets(spriteOrFrame) {
  const frame = spriteOrFrame?.cells ? normalizeSpriteFrame(spriteOrFrame) : convertLegacyFrameToSpriteFrame(spriteOrFrame);
  if (!frame?.cells?.length) return [];

  const halfWidth = Math.floor(frame.width / 2);
  const anchorY = -3 + (frame.offsetY ?? 0);
  const offsets = [];

  for (let sy = 0; sy < frame.height; sy += 1) {
    for (let sx = 0; sx < frame.width; sx += 1) {
      if (!isOccupiedSpriteCell(frame.cells[sy]?.[sx])) continue;
      offsets.push({ x: sx - halfWidth, y: sy + anchorY });
    }
  }

  return offsets;
}
