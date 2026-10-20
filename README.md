# playwright-light-reporter

HTML reporters for [Playwright](https://playwright.dev/) with two complementary views:

- **Standard** — drill-down layout with nested `test.step()` trees, traces, screenshots, and hash-based test selection (the advanced-style UI from the internal LM reporter lineage).
- **BDD** — single-page feature → scenario → step grouping, tag filtering, and dashboard tiles for `REQ_<Jira-key>` and `TEST_<TMS-case-id>` with configurable link templates.

Designed for `playwright.config.ts` `reporter` arrays and CI artifacts (static HTML, Jenkins-friendly paths).

## Installation

```bash
npm install --save-dev playwright-light-reporter @playwright/test
```

## Quick start

```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  reporter: [
    ['list'],
    ['playwright-light-reporter/standard', { outputDir: 'playwright-report-standard' }],
    ['playwright-light-reporter/bdd', { outputDir: 'playwright-report-bdd' }],
  ],
  use: {
    trace: 'on',
    screenshot: 'on',
    video: 'on',
  },
});
```

Use either reporter alone or both in the same run (separate `outputDir` folders).

## BDD conventions

| Concept | Source |
|--------|--------|
| **Feature** | Spec stem by default, or top `test.describe` title when `bddFeatureSource: 'describe'`, or `{ type: 'feature', description: '...' }` annotation |
| **Scenario** | `TEST_<case-id>` when present (ChainTest / Cucumber style), plus test title |
| **Steps** | `test.step(...)` entries |
| **Jira story** | `REQ_PROJ-123` in title, tags, or annotations |
| **Test case** | `TEST_TC-456` in title, tags, or annotations |

### Link templates

```typescript
['playwright-light-reporter/bdd', {
  outputDir: 'playwright-report-bdd',
  bddFeatureSource: 'spec-file', // or 'describe' to use the outer test.describe title
  jiraIssueUrlTemplate: 'https://your-company.atlassian.net/browse/{id}',
  testCaseUrlTemplate: 'https://your-xray.example.com/secure/XrayTestDetail.jspa?testId={id}',
}],
```

## Configuration (shared)

| Option | Default | Description |
|--------|---------|-------------|
| `outputDir` | `playwright-lm-report` | Report output folder |
| `reportTitle` | `Standard Automation Report` | Header title |
| `reportSubtitle` | `Playwright Test Automation` | Subtitle |
| `environmentVariable` | `TEST_ENV` | Env var for environment badge |
| `defaultEnvironment` | `DEV` | Fallback environment |
| `authorVariable` | `TEST_AUTHOR` | Env var for author |
| `defaultAuthor` | `QA` | Fallback author |
| `liveRefreshSeconds` | `5` (local) / `0` (CI) | Live HTML refresh interval |
| `analyticsDir` | `.analytics` | Historical JSON for dashboards |
| `theme` | `light` | Default appearance: `light` or `dark`. Reports include a **Light/Dark** toggle (top-right); the choice is saved in the browser. |
| `bddFeatureSource` | `spec-file` | BDD feature name from spec file stem or outer `describe` block (`describe`) |

## Merging sharded runs

```bash
npx playwright-light-reporter-merge --input-dir ./blob-reports --output-dir ./playwright-lm-report --mode standard
```

## Related resources

- [Cucumber Reports (Jenkins)](https://plugins.jenkins.io/cucumber-reports/)
- [Allure Jenkins Plugin](https://plugins.jenkins.io/allure-jenkins-plugin/)
- [Allure environments](https://allurereport.org/docs/environments/)

## License

MIT
