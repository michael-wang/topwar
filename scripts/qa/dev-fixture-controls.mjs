// Only the four playtest scenarios use visible buttons. Regression presets are
// installed by the intercepted test response, never by a public game endpoint.
export async function selectDevFixture(page, role) {
  if (['naval', 'boss-intro', 'victory', 'air-support'].includes(role)) {
    if (!await page.locator('.tuning-panel').evaluate(panel => panel.open))
      await page.locator('.tuning-panel > summary').click();
    await page.locator(`.dev-review-controls [data-role="${role}"]`).click();
    return;
  }
  await page.evaluate(async role => {
    const { createDevReviewFixture: createActive } = await import('/src/app/DevReviewFixtures.ts');
    const { createDevReviewFixture: createHistorical } = await import('/tests/helpers/ReviewFixtures.ts');
    const { shellReviewLaunches } = await import('/tests/helpers/ShellReview.ts');
    const a = window.__testApp;
    if (!a) throw Error('QA requires the test-side main.ts exposure');
    if (!a.__qaCreateSimulation) {
      a.__qaCreateSimulation = a.createSimulation.bind(a);
      a.createSimulation = () => {
        const role = a.devReviewFixture;
        if (!role || ['naval', 'boss-intro', 'victory', 'air-support'].includes(role)) return a.__qaCreateSimulation();
        const c = a.config, t = a.runtimeTuning;
        const options = { seed: 17, level: a.level, startSquad: c.player.startSquad,
          startRocketCount: c.player.startRocketCount, collisionDiagnostics: a.perf?.counters,
          catharsis: { trackHalfWidth: c.track.halfWidth, balance: { ...c.catharsis,
            enemyVisualScale: t.enemyVisualScale, groupSize: t.groupSize ?? c.catharsis.groupSize,
            gruntSpeed: t.gruntSpeed, heavyHp: t.heavyHp, heavySpeed: t.heavySpeed, heavyChance: t.heavyChance } },
          tiers: c.tiers };
        const active = /^(late|crate3|crate8|mg(6|7|8|9|10)|survival(7|8|9|10)-(baseline|experimental|staged|ahead)|barrage(8|9|10)-(on|off)|boss-(phase1|phase2|phase3|finish))$/.test(role);
        const simulation = (active ? createActive : createHistorical)(options, t.fireRate, role === 'late6' ? 'late' : role);
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
