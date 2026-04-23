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
    {
      name: 'no-tauri-from-config-domain',
      severity: 'error',
      comment:
        'Pure norbert-config domain modules must not import @tauri-apps/* ' +
        'packages. IO/effect dependencies belong in adapters; the domain ' +
        'remains framework-free per architecture §4 (Core Principle 11).',
      from: { path: '^src/plugins/norbert-config/domain' },
      to: { path: '^@tauri-apps/' },
    },
    {
      name: 'no-react-from-config-domain',
      severity: 'error',
      comment:
        'Pure norbert-config domain modules must not import react or ' +
        'react-dom. Rendering concerns live exclusively in views; the domain ' +
        'remains framework-free per architecture §4 (Core Principle 11).',
      from: { path: '^src/plugins/norbert-config/domain' },
      to: { path: '^(react|react-dom)$' },
    },
    {
      name: 'no-views-from-config-domain',
      severity: 'error',
      comment:
        'Pure norbert-config domain modules must not import from the views ' +
        'layer. Dependency direction is views -> domain (never the inverse) ' +
        'per architecture §4 (Core Principle 11).',
      from: { path: '^src/plugins/norbert-config/domain' },
      to: { path: '^src/plugins/norbert-config/views/' },
    },
    {
      name: 'detection-strategies-isolated',
      severity: 'error',
      comment:
        'Detection strategies may import only from the detection module ' +
        'itself (types, sibling strategies via the pipeline composer, the ' +
        'remark plugin glue), unist-util-visit, and the registry+resolver ' +
        'types. Architecture §4 rule 4. The architecture spec wording lists ' +
        'types + visit + registry; resolver is added because strategies use ' +
        'resolve() to classify outcomes (architecture §6.2).',
      from: { path: '^src/plugins/norbert-config/domain/references/detection/' },
      to: {
        pathNot: [
          '^src/plugins/norbert-config/domain/references/detection/',
          '^src/plugins/norbert-config/domain/references/registry',
          '^src/plugins/norbert-config/domain/references/resolver',
          '^node_modules/unist-util-visit',
          '^node_modules/unist',
          '^node_modules/@types/unist',
        ],
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
