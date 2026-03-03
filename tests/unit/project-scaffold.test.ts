/**
 * Acceptance test: Project scaffold and architecture boundary enforcement.
 *
 * Verifies:
 * 1. All 7 packages exist with correct structure
 * 2. Core package has zero runtime dependencies
 * 3. TypeScript project references enforce dependency matrix
 * 4. Dashboard has no @norbert/* runtime dependencies
 * 5. No circular dependencies in the package graph
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '../..');
const PACKAGES_DIR = path.join(ROOT, 'packages');

const EXPECTED_PACKAGES = [
  'core',
  'config',
  'storage',
  'server',
  'cli',
  'dashboard',
  'hooks',
] as const;

// Dependency matrix: package -> allowed @norbert/* runtime dependencies
const DEPENDENCY_MATRIX: Record<string, readonly string[]> = {
  core: [],
  config: [],
  storage: ['@norbert/core'],
  server: ['@norbert/core', '@norbert/config', '@norbert/storage'],
  cli: ['@norbert/core', '@norbert/config', '@norbert/storage', '@norbert/hooks'],
  dashboard: [],
  hooks: ['@norbert/config'],
};

function readPackageJson(packageName: string): Record<string, unknown> {
  const pkgPath = path.join(PACKAGES_DIR, packageName, 'package.json');
  return JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
}

function readTsconfig(packageName: string): Record<string, unknown> {
  const tsconfigPath = path.join(PACKAGES_DIR, packageName, 'tsconfig.json');
  return JSON.parse(fs.readFileSync(tsconfigPath, 'utf-8'));
}

describe('Project scaffold', () => {
  describe('all 7 packages exist', () => {
    for (const pkg of EXPECTED_PACKAGES) {
      it(`packages/${pkg} exists with package.json and tsconfig.json`, () => {
        const pkgDir = path.join(PACKAGES_DIR, pkg);
        expect(fs.existsSync(pkgDir)).toBe(true);
        expect(fs.existsSync(path.join(pkgDir, 'package.json'))).toBe(true);
        expect(fs.existsSync(path.join(pkgDir, 'tsconfig.json'))).toBe(true);
      });

      it(`packages/${pkg} has src/index.ts`, () => {
        const indexPath = path.join(PACKAGES_DIR, pkg, 'src', 'index.ts');
        expect(fs.existsSync(indexPath)).toBe(true);
      });
    }
  });

  describe('core package has zero runtime dependencies', () => {
    it('has no "dependencies" field or an empty one in package.json', () => {
      const pkg = readPackageJson('core');
      const deps = pkg.dependencies as Record<string, string> | undefined;
      expect(deps === undefined || Object.keys(deps).length === 0).toBe(true);
    });

    it('does not import from other @norbert packages in source files', () => {
      const srcDir = path.join(PACKAGES_DIR, 'core', 'src');
      const tsFiles = findTsFiles(srcDir);
      // Check that no import/export statements reference @norbert/* packages
      const importPattern = /(?:import|from)\s+['"]@norbert\//;
      for (const file of tsFiles) {
        const content = fs.readFileSync(file, 'utf-8');
        expect(content).not.toMatch(importPattern);
      }
    });
  });

  describe('dependency matrix enforced via package.json', () => {
    for (const [pkg, allowedDeps] of Object.entries(DEPENDENCY_MATRIX)) {
      it(`${pkg} only depends on allowed @norbert/* packages: [${allowedDeps.join(', ')}]`, () => {
        const pkgJson = readPackageJson(pkg);
        const deps = pkgJson.dependencies as Record<string, string> | undefined;
        const norbertDeps = deps
          ? Object.keys(deps).filter((d) => d.startsWith('@norbert/'))
          : [];
        for (const dep of norbertDeps) {
          expect(allowedDeps).toContain(dep);
        }
      });
    }
  });

  describe('TypeScript project references match dependency matrix', () => {
    for (const [pkg, allowedDeps] of Object.entries(DEPENDENCY_MATRIX)) {
      it(`${pkg}/tsconfig.json references match allowed dependencies`, () => {
        const tsconfig = readTsconfig(pkg);
        const refs = (tsconfig.references as Array<{ path: string }>) ?? [];
        const refPackages = refs.map((r) => {
          const refDir = path.basename(r.path);
          return `@norbert/${refDir}`;
        });
        for (const ref of refPackages) {
          expect(allowedDeps).toContain(ref);
        }
        // All allowed deps should have a reference
        for (const dep of allowedDeps) {
          const depName = dep.replace('@norbert/', '');
          expect(refPackages).toContain(dep);
        }
      });
    }
  });

  describe('all domain types are readonly (immutable)', () => {
    it('core type definitions use readonly modifiers', () => {
      const typesDir = path.join(PACKAGES_DIR, 'core', 'src');
      const tsFiles = findTsFiles(typesDir);
      // At least one .ts file should exist with type definitions
      expect(tsFiles.length).toBeGreaterThan(0);

      for (const file of tsFiles) {
        const content = fs.readFileSync(file, 'utf-8');
        // Skip test files and index re-exports
        if (file.endsWith('.test.ts') || content.trim().length < 50) continue;

        // Check that interface/type properties use 'readonly'
        // Match property declarations in interfaces/types that are NOT readonly
        const interfaceBlocks = content.match(
          /(?:interface|type)\s+\w+.*?\{[^}]+\}/gs
        );
        if (interfaceBlocks) {
          for (const block of interfaceBlocks) {
            // Extract property lines (not method signatures)
            const propLines = block
              .split('\n')
              .filter((line) => line.match(/^\s+\w+[\?]?\s*:/));
            for (const line of propLines) {
              expect(line.trim()).toMatch(/^readonly\s/);
            }
          }
        }
      }
    });
  });
});

function findTsFiles(dir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findTsFiles(fullPath));
    } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
      results.push(fullPath);
    }
  }
  return results;
}
