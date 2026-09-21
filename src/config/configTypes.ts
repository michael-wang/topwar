export type { GameConfig } from './configSchema';

export type DeepPartial<T> = T extends object
  ? { [Key in keyof T]?: DeepPartial<T[Key]> }
  : T;
