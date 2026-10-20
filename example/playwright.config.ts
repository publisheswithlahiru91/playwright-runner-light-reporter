import { defineConfig } from '@playwright/test';

const isListMode = process.argv.includes('--list');

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  retries: 0,
  reporter: isListMode
    ? [['list']]
    : [
        ['list'],
        [
          'playwright-light-reporter/standard',
          {
            outputDir: 'playwright-report-standard',
            reportTitle: 'Standard Report Demo',
            liveRefreshSeconds: 0,
          },
        ],
        [
          'playwright-light-reporter/bdd',
          {
            outputDir: 'playwright-report-bdd',
            reportTitle: 'BDD Report Demo',
            jiraIssueUrlTemplate: 'https://example.atlassian.net/browse/{id}',
            testCaseUrlTemplate: 'https://example.xray.com/test/{id}',
            liveRefreshSeconds: 0,
          },
        ],
      ],
  use: {
    trace: 'on',
    screenshot: 'on',
    video: 'on',
  },
});
