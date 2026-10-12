import data from '../../public/game-data/game.json';
import { GameConfigSchema } from '../../src/config/configSchema';
export default GameConfigSchema.parse(data);
