// Used only by the diagnostic SSR loader. Application sources remain untouched.
export function diagnosticTransform() {
  const prefix = "import * as qa from '/scripts/qa/survivalDiagnosisHooks.ts';\n";
  const replace = (source, from, to) => {
    if (source.split(from).length !== 2) throw new Error(`QA hook anchor drift: ${from}`);
    return source.replace(from, to);
  };
  return { name: 'qa-only-survival-observation', enforce: 'pre', transform(source, id) {
    const path = id.split('?')[0].replaceAll('\\', '/');
    source = source.replaceAll('\r\n', '\n');
    if (path.endsWith('/simulation/enemies/defenseGroup.ts')) {
      source = replace(source, '  const members =', '  const qaFirstId = cursor.nextEnemyId;\n  const members =');
      source = replace(source, "    hp: member.archetype === 'heavy' ? balance.heavyHp : 1 });", "    hp: member.archetype === 'heavy' ? balance.heavyHp : 1 });\n  qa.admitted(enemies.filter(e => e.id >= qaFirstId), { row, cursor: cursor.nextRowIndex });");
    } else if (path.endsWith('/simulation/enemies/latePressure.ts')) {
      source = replace(source, '    z: playerZ + balance.defenseSpawnAheadDistance - balance.crowdDepthSpan, hp: balance.giant.hp });', '    z: playerZ + balance.defenseSpawnAheadDistance - balance.crowdDepthSpan, hp: balance.giant.hp });\n  qa.admitted([enemies[enemies.length - 1]], { cursor: cursor.nextRowIndex });');
    } else if (path.endsWith('/simulation/Simulation.ts')) {
      source = replace(source, '      progression = grantXp(progression, amount, catharsis.balance.progression);', '      const qaBefore = progression;\n      progression = grantXp(progression, amount, catharsis.balance.progression);\n      qa.reward(enemy, amount, qaBefore, progression);');
      source = replace(source, '    let defenseWaves = this.state.defenseWaves;', "    qa.phase(this.state.postCapSurvival?.startedAtSeconds != null ? 'survival-wave' : 'ordinary-wave');\n    let defenseWaves = this.state.defenseWaves;");
      source = replace(source, '    const enemyCollisionIndex = new EnemyCollisionIndex(enemies);', '    qa.positions(enemies);\n    const enemyCollisionIndex = new EnemyCollisionIndex(enemies);');
      source = replace(source, 'const damageEnemy = (enemy: EnemySimulationState, damageEnemyHp: number): number => {', "const damageEnemy = (enemy: EnemySimulationState, damageEnemyHp: number, qaCause = 'projectile'): number => {");
      source = replace(source, '      enemy.hp -= damageEnemyHp;', '      qa.hit(enemy, damageEnemyHp, qaCause);\n      enemy.hp -= damageEnemyHp;');
      source = replace(source, '        return awardKill(enemy);', '        const qaXp = awardKill(enemy);\n        qa.removed(enemy, qaCause);\n        return qaXp;');
      source = replace(source, 'damageEnemy(enemy, flight.damageEnemyHp);', "damageEnemy(enemy, flight.damageEnemyHp, 'grenade');");
      source = replace(source, '      if (contact) {\n        enemies.splice', "      if (contact) {\n        qa.removed(enemy, 'contact');\n        enemies.splice");
      source = replace(source, '      if (enemy.z <= defenseLineZ) {\n        enemies.splice', "      if (enemy.z <= defenseLineZ) {\n        qa.removed(enemy, 'leak');\n        enemies.splice");
      source = replace(source, '    if (giantEncounter && catharsis && enemyStream && squad.count > 0', "    qa.frame(progression, squad, nextZ);\n    qa.phase('giant-intro');\n    if (giantEncounter && catharsis && enemyStream && squad.count > 0");
      source = replace(source, '      admitDefenseGroup(enemies, enemyStream, row, this.enemyStreamDefinition.seed,', "      qa.phase('mg-release');\n      admitDefenseGroup(enemies, enemyStream, row, this.enemyStreamDefinition.seed,");
      source = replace(source, '    const carnival = advanceCarnival(', "    qa.phase('carnival');\n    const carnival = advanceCarnival(");
      source = replace(source, '    const postCapSurvival = survivalBlocked', "    qa.phase('survival-opportunity');\n    const postCapSurvival = survivalBlocked");
    } else return;
    return { code: prefix + source, map: null };
  }};
}
