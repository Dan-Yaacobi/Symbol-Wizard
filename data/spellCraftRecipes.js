import { visualTheme } from './VisualTheme.js';

const projectileSprite = [
  [
    ' ===> ',
    '====> ',
    ' ===> ',
  ],
  [
    ' >==> ',
    '>>==> ',
    ' >==> ',
  ],
];

function colorForElement(element) {
  switch (element) {
    case 'fire': return '#ff9f66';
    case 'frost': return '#bfe8ff';
    case 'lightning': return '#ffe76a';
    case 'poison': return '#8ed96f';
    case 'arcane':
    default:
      return visualTheme.colors.projectileArcane;
  }
}

function buildProfileModifiers(modifiers) {
  return Object.freeze(modifiers);
}

function ingredient(itemId, amount) {
  return Object.freeze({ itemId, amount });
}

export const SPELL_CRAFT_PROFILES = Object.freeze({
  fast: {
    id: 'fast',
    name: 'Fast',
    summary: 'Quick release with high velocity and lighter impact.',
    modifiers: buildProfileModifiers({
      damage: 0.88,
      speed: 1.25,
      cooldown: 0.84,
      manaCost: 0.95,
      duration: 0.9,
      radius: 0.92,
      width: 0.92,
      range: 0.96,
    }),
  },
  heavy: {
    id: 'heavy',
    name: 'Heavy',
    summary: 'Higher impact, but slower and more demanding to cast.',
    modifiers: buildProfileModifiers({
      damage: 1.28,
      speed: 0.82,
      cooldown: 1.18,
      manaCost: 1.14,
      duration: 1.08,
      radius: 1.12,
      width: 1.08,
      range: 0.96,
    }),
  },
  efficient: {
    id: 'efficient',
    name: 'Efficient',
    summary: 'Balanced output tuned for cheaper, cleaner repeat casts.',
    modifiers: buildProfileModifiers({
      damage: 0.96,
      speed: 1,
      cooldown: 0.88,
      manaCost: 0.82,
      duration: 1.04,
      radius: 1,
      width: 1,
      range: 1.04,
    }),
  },
});

export const SPELL_CRAFT_RECIPES = Object.freeze([
  {
    id: 'fire_bolt',
    name: 'Fire Bolt',
    behavior: 'projectile',
    targeting: 'cursor',
    icon: '*',
    validElements: ['fire'],
    ingredients: [
      ingredient('fire_core', 1),
      ingredient('essence', 4),
      ingredient('ember_dust', 6),
    ],
    craftingSummary: 'A direct pyromancy bolt that always scorches on impact.',
    guaranteedEffects: {
      fire: [{ type: 'status', label: 'Burn', statusType: 'burn', duration: 2.4 }],
    },
    statRanges: {
      damage: [9, 14],
      speed: [54, 74],
      ttl: [0.75, 1.05],
      cooldown: [0.32, 0.55],
      manaCost: [7, 10],
      size: [1, 1.35],
    },
    weightedProfiles: { fast: 4, heavy: 3, efficient: 3 },
    effectPool: {
      rollCountWeights: { 0: 2, 1: 6, 2: 2 },
      common: [
        { type: 'explode', label: 'Explosion', weight: 4, radius: 2.4, damageMultiplier: 0.72 },
        { type: 'knockback', label: 'Knockback', weight: 3, force: 1.3 },
      ],
      uncommon: [
        { type: 'pierce', label: 'Pierce', weight: 3, count: 2 },
        { type: 'trail', label: 'Cinder Trail', weight: 2, radius: 1.1, duration: 0.65, damageMultiplier: 0.34, color: '#ff9f66' },
      ],
      rare: [
        { type: 'split', label: 'Split', weight: 2, count: 2, maxDepth: 1, spreadDegrees: 26 },
      ],
    },
    visuals: {
      color: colorForElement('fire'),
      hitParticleColor: '#ffd1a8',
      spriteFrames: projectileSprite,
    },
  },
  {
    id: 'frost_beam',
    name: 'Frost Beam',
    behavior: 'beam',
    targeting: 'cursor',
    icon: '|',
    validElements: ['frost'],
    ingredients: [
      ingredient('frost_core', 1),
      ingredient('essence', 5),
      ingredient('stone', 10),
    ],
    craftingSummary: 'A freezing line attack that always slows whatever it touches.',
    guaranteedEffects: {
      frost: [{ type: 'status', label: 'Slow', statusType: 'slow', duration: 2.8 }],
    },
    statRanges: {
      damage: [5, 9],
      range: [14, 18],
      width: [1.5, 2.4],
      duration: [0.25, 0.42],
      cooldown: [0.55, 0.95],
      manaCost: [8, 12],
    },
    weightedProfiles: { fast: 3, heavy: 2, efficient: 5 },
    effectPool: {
      rollCountWeights: { 0: 3, 1: 6, 2: 1 },
      common: [
        { type: 'knockback', label: 'Backwash', weight: 3, force: 1.1 },
        { type: 'bounce', label: 'Refraction', weight: 2, count: 1 },
      ],
      uncommon: [
        { type: 'chain', label: 'Cold Arc', weight: 2, count: 1, radius: 4.2, damageMultiplier: 0.65, color: '#bfe8ff' },
      ],
      rare: [
        { type: 'trail', label: 'Frozen Wake', weight: 1, radius: 1.4, duration: 0.8, damageMultiplier: 0.28, color: '#dff6ff' },
      ],
    },
    visuals: {
      color: colorForElement('frost'),
      hitParticleColor: '#dff6ff',
    },
  },
  {
    id: 'lightning_chain',
    name: 'Lightning Chain',
    behavior: 'chain',
    targeting: 'cursor',
    icon: 'ϟ',
    validElements: ['lightning'],
    ingredients: [
      ingredient('lightning_core', 1),
      ingredient('essence', 6),
      ingredient('storm_shard', 4),
    ],
    craftingSummary: 'A chaining discharge that always shocks the struck target.',
    guaranteedEffects: {
      lightning: [{ type: 'status', label: 'Shock', statusType: 'shock', duration: 1.4 }],
    },
    statRanges: {
      damage: [6, 10],
      chainCount: [2, 4],
      chainRange: [4.5, 6.5],
      cooldown: [0.55, 0.9],
      manaCost: [9, 13],
      range: [12, 16],
    },
    weightedProfiles: { fast: 5, heavy: 3, efficient: 2 },
    effectPool: {
      rollCountWeights: { 0: 4, 1: 5, 2: 1 },
      common: [
        { type: 'knockback', label: 'Static Kick', weight: 3, force: 1.2 },
        { type: 'explode', label: 'Static Burst', weight: 2, radius: 2.1, damageMultiplier: 0.5, color: '#ffe76a' },
      ],
      uncommon: [
        { type: 'trail', label: 'Ion Wake', weight: 2, radius: 1.2, duration: 0.7, damageMultiplier: 0.24, color: '#fff5a8' },
      ],
      rare: [],
    },
    visuals: {
      color: colorForElement('lightning'),
      hitParticleColor: '#fff5a8',
    },
  },
  {
    id: 'poison_zone',
    name: 'Poison Zone',
    behavior: 'zone',
    targeting: 'cursor',
    icon: 'o',
    validElements: ['poison'],
    ingredients: [
      ingredient('poison_gland', 1),
      ingredient('essence', 4),
      ingredient('moss', 8),
    ],
    craftingSummary: 'A toxic field that always poisons enemies caught inside.',
    guaranteedEffects: {
      poison: [{ type: 'status', label: 'Poison', statusType: 'poison', duration: 3.2 }],
    },
    statRanges: {
      damage: [2, 4],
      radius: [2.6, 4.2],
      duration: [1.6, 3.1],
      tickInterval: [0.22, 0.38],
      cooldown: [0.95, 1.55],
      manaCost: [9, 13],
    },
    weightedProfiles: { fast: 2, heavy: 4, efficient: 4 },
    effectPool: {
      rollCountWeights: { 0: 2, 1: 6, 2: 2 },
      common: [
        { type: 'knockback', label: 'Noxious Push', weight: 2, force: 1 },
        { type: 'trail', label: 'Lingering Fumes', weight: 3, radius: 1.5, duration: 0.85, damageMultiplier: 0.26, color: '#7fdf77' },
      ],
      uncommon: [
        { type: 'explode', label: 'Volatile Burst', weight: 2, radius: 2.2, damageMultiplier: 0.65, color: '#9be36d' },
      ],
      rare: [
        { type: 'zone_on_hit', label: 'Toxic Echo', weight: 1, radius: 2.3, duration: 1.2, tickInterval: 0.28, damage: 1, color: '#96dd87' },
      ],
    },
    visuals: {
      color: colorForElement('poison'),
      hitParticleColor: '#b8f29a',
    },
  },
  {
    id: 'fire_aura',
    name: 'Fire Aura',
    behavior: 'aura',
    targeting: 'self',
    icon: '#',
    validElements: ['fire'],
    ingredients: [
      ingredient('fire_core', 1),
      ingredient('essence', 6),
      ingredient('ember_dust', 8),
    ],
    craftingSummary: 'A self-centered blaze that always burns anything lingering too close.',
    guaranteedEffects: {
      fire: [{ type: 'status', label: 'Burn', statusType: 'burn', duration: 2.4 }],
    },
    statRanges: {
      damage: [4, 7],
      radius: [4.5, 6.2],
      duration: [0.35, 0.7],
      tickInterval: [0.12, 0.2],
      cooldown: [1.8, 2.7],
      manaCost: [12, 17],
    },
    weightedProfiles: { fast: 2, heavy: 4, efficient: 4 },
    effectPool: {
      rollCountWeights: { 0: 4, 1: 5, 2: 1 },
      common: [
        { type: 'knockback', label: 'Heat Push', weight: 2, force: 1.1 },
        { type: 'trail', label: 'Ash Ring', weight: 3, radius: 1.2, duration: 0.6, damageMultiplier: 0.22, color: '#ffb37a' },
      ],
      uncommon: [
        { type: 'explode', label: 'Flare Pop', weight: 2, radius: 2.4, damageMultiplier: 0.58, color: '#ffc28c' },
      ],
      rare: [],
    },
    visuals: {
      color: colorForElement('fire'),
      hitParticleColor: '#ffd3a8',
    },
  },
  {
    id: 'frost_orbit',
    name: 'Frost Orbit',
    behavior: 'orbit',
    targeting: 'self',
    icon: '◌',
    validElements: ['frost'],
    ingredients: [
      ingredient('frost_core', 1),
      ingredient('essence', 6),
      ingredient('crystal_dust', 4),
    ],
    craftingSummary: 'A ring of cold motes that circles the caster and slows on contact.',
    guaranteedEffects: {
      frost: [{ type: 'status', label: 'Slow', statusType: 'slow', duration: 2.8 }],
    },
    statRanges: {
      damage: [3, 6],
      radius: [2.3, 3.6],
      speed: [2.2, 3.8],
      duration: [1.8, 3.1],
      count: [2, 4],
      hitRadius: [0.75, 1.1],
      cooldown: [1.5, 2.4],
      manaCost: [11, 15],
    },
    weightedProfiles: { fast: 3, heavy: 2, efficient: 5 },
    effectPool: {
      rollCountWeights: { 0: 5, 1: 4, 2: 1 },
      common: [
        { type: 'knockback', label: 'Cold Push', weight: 2, force: 0.9 },
      ],
      uncommon: [
        { type: 'trail', label: 'Rime Wake', weight: 2, radius: 1.1, duration: 0.7, damageMultiplier: 0.2, color: '#dff6ff' },
      ],
      rare: [],
    },
    visuals: {
      color: colorForElement('frost'),
      hitParticleColor: '#dff6ff',
    },
  },
  {
    id: 'arcane_nova',
    name: 'Arcane Nova',
    behavior: 'nova',
    targeting: 'self',
    icon: '✹',
    validElements: ['arcane'],
    ingredients: [
      ingredient('arcane_shard', 1),
      ingredient('essence', 7),
      ingredient('crystal_dust', 5),
    ],
    craftingSummary: 'A sudden arcane pulse that erupts from the caster in every direction.',
    guaranteedEffects: {
      arcane: [{ type: 'identity', label: 'Unstable Arcana', statusType: null, duration: 0 }],
    },
    statRanges: {
      damage: [6, 10],
      radius: [3.5, 5.2],
      duration: [0.25, 0.45],
      tickInterval: [0.1, 0.16],
      cooldown: [1.2, 2],
      manaCost: [10, 14],
    },
    weightedProfiles: { fast: 4, heavy: 3, efficient: 3 },
    effectPool: {
      rollCountWeights: { 0: 3, 1: 5, 2: 2 },
      common: [
        { type: 'knockback', label: 'Arc Pulse', weight: 4, force: 1.4 },
      ],
      uncommon: [
        { type: 'explode', label: 'Arc Burst', weight: 2, radius: 2.6, damageMultiplier: 0.6, color: '#b395ff' },
        { type: 'trail', label: 'Aether Wake', weight: 2, radius: 1.2, duration: 0.75, damageMultiplier: 0.24, color: '#bca7ff' },
      ],
      rare: [],
    },
    visuals: {
      color: colorForElement('arcane'),
      hitParticleColor: '#d5c2ff',
    },
  },
  {
    id: 'arcane_orb',
    name: 'Arcane Orb',
    behavior: 'projectile',
    targeting: 'cursor',
    icon: '✦',
    validElements: ['arcane'],
    ingredients: [
      ingredient('arcane_shard', 1),
      ingredient('essence', 7),
      ingredient('crystal_dust', 5),
    ],
    craftingSummary: 'A stable orb of raw magic that always carries unstable arcane force.',
    guaranteedEffects: {
      arcane: [{ type: 'identity', label: 'Unstable Arcana', statusType: null, duration: 0 }],
    },
    statRanges: {
      damage: [8, 13],
      speed: [42, 58],
      ttl: [0.95, 1.3],
      cooldown: [0.5, 0.9],
      manaCost: [8, 12],
      size: [1.15, 1.55],
    },
    weightedProfiles: { fast: 2, heavy: 4, efficient: 4 },
    effectPool: {
      rollCountWeights: { 0: 1, 1: 6, 2: 3 },
      common: [
        { type: 'pierce', label: 'Phase Pierce', weight: 3, count: 2 },
        { type: 'knockback', label: 'Arcane Pulse', weight: 2, force: 1.4 },
      ],
      uncommon: [
        { type: 'explode', label: 'Arc Burst', weight: 3, radius: 2.7, damageMultiplier: 0.78, color: '#b395ff' },
        { type: 'trail', label: 'Aether Wake', weight: 2, radius: 1.2, duration: 0.75, damageMultiplier: 0.32, color: '#bca7ff' },
      ],
      rare: [
        { type: 'split', label: 'Fracture', weight: 2, count: 3, maxDepth: 1, spreadDegrees: 28 },
      ],
    },
    visuals: {
      color: colorForElement('arcane'),
      hitParticleColor: '#d5c2ff',
      spriteFrames: projectileSprite,
    },
  },
]);

export const SPELL_CRAFT_RECIPE_MAP = Object.freeze(Object.fromEntries(SPELL_CRAFT_RECIPES.map((recipe) => [recipe.id, recipe])));

export function getSpellCraftRecipe(recipeId) {
  return SPELL_CRAFT_RECIPE_MAP[recipeId] ?? null;
}

export function getRecipeGuaranteedEffects(recipe, element) {
  if (!recipe) return [];
  const effects = recipe.guaranteedEffects?.[element] ?? recipe.guaranteedEffects?.default ?? [];
  return effects.map((effect) => ({ ...effect }));
}
