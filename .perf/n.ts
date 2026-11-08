import { TANK_MAX_WHEELS } from '../src/data/artLayout';
import { RENDER } from '../src/data/render';
import { FX_LAYERS, FX_SPRITE_KEYS } from '../src/data/fx';
console.log('wheels', TANK_MAX_WHEELS, 'pips', RENDER.unit.pips, 'planesMax', (RENDER as any).planes.max, 'flameMax', (RENDER as any).flame.max, 'fxLayers', FX_LAYERS.length, 'fxSprites', FX_SPRITE_KEYS.length, 'speechMax', (RENDER as any).speech.max);
