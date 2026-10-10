// Retained entries exercise the human UI. Removed scenarios are installed only
// by the browser test, using the same test-only fixtures as Vitest. No app hook.
export async function selectDevFixture(page, role) {
  if (['late', 'crate3', 'crate8', 'naval'].includes(role)) {
    if (!await page.locator('.tuning-panel').evaluate(panel => panel.open))
      await page.locator('.tuning-panel > summary').click();
    await page.locator(`.dev-review-controls [data-role="${role}"]`).click();
    return;
  }
  await page.evaluate(async role => {
    const { createDevReviewFixture } = await import('/tests/helpers/ReviewFixtures.ts');
    const { shellReviewLaunches } = await import('/tests/helpers/ShellReview.ts');
    const a = window.__testApp;
    if (!a) throw Error('QA requires the test-side main.ts exposure');
    if (!a.__qaCreateSimulation) {
      a.__qaCreateSimulation = a.createSimulation.bind(a);
      a.createSimulation = () => {
        const role = a.devReviewFixture;
        if (!role || ['late', 'crate3', 'crate8', 'naval'].includes(role)) return a.__qaCreateSimulation();
        const c = a.config, t = a.runtimeTuning;
        const options = { seed: 17, level: a.level, startSquad: c.player.startSquad,
          startRocketCount: c.player.startRocketCount, collisionDiagnostics: a.perf?.counters,
          catharsis: { trackHalfWidth: c.track.halfWidth, balance: { ...c.catharsis,
            enemyVisualScale: t.enemyVisualScale, groupSize: t.groupSize ?? c.catharsis.groupSize,
            gruntSpeed: t.gruntSpeed, heavyHp: t.heavyHp, heavySpeed: t.heavySpeed, heavyChance: t.heavyChance } },
          tiers: { ...c.tiers, enemyHigherTierPowerMultiplier: t.enemyHigherTierPowerMultiplier,
            rifleHigherTierPowerMultiplier: t.rifleHigherTierPowerMultiplier },
          rewardRowsPerReward: t.rewardRowsPerReward, bossHpScale: t.bossHpScale };
        const simulation = createDevReviewFixture(options, t.fireRate, role);
        if (role === 'shell') {
          const step = simulation.step.bind(simulation);
          simulation.step = (dt, input, tuning) => step(dt,
            { ...input, artilleryLaunches: shellReviewLaunches(simulation.getFrameState()) }, tuning);
        }
        return simulation;
      };
    }
    a.devReviewFixture = role;
    a.devReview.setSelected(role);
    a.tuningPanel.close();
    a.retry();
  }, role);
}
