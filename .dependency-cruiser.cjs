/**
 * dependency-cruiser configuration for Norbert.
 *
 * Current scope: enforce functional-paradigm purity boundary around the v2
 * Performance Monitor phosphor domain (per DESIGN D9 / US-PM-007 amended AC
 * and docs/feature/norbert-performance-monitor/design/v2-phosphor-architecture.md §7).
 *
 * Additional architectural rules can be layered in later; this file is the
 * single source of boundary truth for `npm run lint:boundaries`.
 */
module.exports = {
  forbidden: [
    {
      name: 'no-effects-in-phosphor-domain',
      severity: 'error',
      comment:
        'Pure phosphor domain modules must not import React, adapters, views, ' +
        'global browser effects (window/document/requestAnimationFrame), or the ' +
        'oscilloscope module. Enforces US-PM-007 behavioral coexistence and the ' +
        'functional-paradigm rule that effects live only at adapter/view seams.',
      from: { path: '^src/plugins/norbert-usage/domain/phosphor' },
      to: {
        path:
          '^(react|src/plugins/norbert-usage/adapters|src/plugins/norbert-usage/views|window|document|src/plugins/norbert-usage/domain/oscilloscope)',
      },
    },
  ],
  options: {
    doNotFollow: {
      path: 'node_modules',
    },
    tsConfig: {
      fileName: 'tsconfig.json',
    },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
      mainFields: ['module', 'main', 'types', 'typings'],
    },
  },
};
