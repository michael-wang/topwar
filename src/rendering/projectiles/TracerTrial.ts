import { ART } from '../../art/ArtDirection';
import type { TracerStyle } from './DefenseTracer';
export type TracerTrial = 'A' | 'B' | 'C';
export const tracerTrials: Record<TracerTrial, TracerStyle> = {
  A: { ...ART.defenseTracer, core: '#fff4d7', outline: '#203548', corePixels: 3.2, outlinePixels: 1.4,
    lengthPixels: 18, maxCoreWidth: .3, maxOutlineWidth: .15, maxLength: 1.8, coreLengthRatio: .88, tailOpacity: .85 },
  B: { ...ART.defenseTracer, core: '#fff9e8', outline: '#ff881a', headInk: '#fff7d9', corePixels: 2.5,
    outlinePixels: 3.2, lengthPixels: 27, maxCoreWidth: .26, maxOutlineWidth: .3, maxLength: 2.6,
    coreLengthRatio: .55, headLengthRatio: .12, noseLengthRatio: .08, tailOpacity: .72 },
  C: { ...ART.defenseTracer, core: '#819ca8', outline: '#192a37', headInk: '#fff9e8', corePixels: 4.8,
    outlinePixels: 1.5, lengthPixels: 10, maxCoreWidth: .45, maxOutlineWidth: .16, maxLength: 1,
    coreLengthRatio: .92, headLengthRatio: .03, noseLengthRatio: .28, tailOpacity: 1 },
};
