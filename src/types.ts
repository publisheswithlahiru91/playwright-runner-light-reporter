import { FullConfig } from '@playwright/test/reporter';

export type ReporterMode = 'standard' | 'bdd' | 'legacy-table';

export type ReportTheme = 'light' | 'dark';

export interface TddLmReporterOptions {
    /** Report mode. Prefer package exports `./standard` or `./bdd`. */
    mode?: ReporterMode;
    /** Jira issue URL template; `{id}` is replaced with the story key from `REQ_<id>` tags. */
    jiraIssueUrlTemplate?: string;
    /** Test management URL template; `{id}` is replaced with the id from `TEST_<id>` tags. */
    testCaseUrlTemplate?: string;
    /** When true (or when Playwright sharding is active), write blob JSON instead of final HTML. */
    blobOnly?: boolean;
    /** Directory for HTML reports and assets. Default: `playwright-lm-report` */
    outputDir?: string;
    /** Main report title shown in the HTML header. */
    reportTitle?: string;
    /** Subtitle shown under the main title. */
    reportSubtitle?: string;
    /** Environment variable used for the environment badge. Default: `TEST_ENV` */
    environmentVariable?: string;
    /** Fallback environment label when the env var is unset. Default: `DEV` */
    defaultEnvironment?: string;
    /** Environment variable used for the author column. Default: `TEST_AUTHOR` */
    authorVariable?: string;
    /** Default author when the env var is unset. Default: `QA` */
    defaultAuthor?: string;
    /** Auto-refresh interval in seconds during live runs. Set to `0` to disable. Default: `5` */
    liveRefreshSeconds?: number;
    /** Folder for historical analytics JSON consumed by historical-analytics-dashboard. Default: `.analytics` */
    analyticsDir?: string;
    /** Report color theme. Default: `light` */
    theme?: ReportTheme;
    /** BDD feature name from spec file stem (`spec-file`) or top `test.describe` title (`describe`). Default: `spec-file` */
    bddFeatureSource?: 'spec-file' | 'describe';
}

export interface ResolvedReporterOptions extends Required<TddLmReporterOptions> {}

export interface StepData {
    id: string;
    title: string;
    category: string;
    duration: number;
    status: 'passed' | 'failed' | 'skipped';
    screenshot?: string;
    error?: string;
    stackTrace?: string;
    startTime: string;
    consoleLogs?: string[];
    stepIndex?: number;
    videoStartTime?: number;
    videoEndTime?: number;
    children?: StepData[];
}

export interface TestData {
    id: string;
    title: string;
    fullTitle: string;
    file: string;
    describePath: string[];
    location: string;
    duration: number;
    status: 'passed' | 'failed' | 'skipped' | 'timedOut';
    retry: number;
    screenshots: { name: string; path: string }[];
    steps: StepData[];
    video?: string;
    trace?: string;
    error?: string;
    errorStack?: string;
    tags: string[];
    /** BDD feature name (spec file or `@feature` / `feature` annotation). */
    feature?: string;
    /** Parsed from `REQ_<Jira-key>` in title, tags, or annotations. */
    requirements?: string[];
    /** Parsed from `TEST_<case-id>` in title, tags, or annotations. */
    testCaseIds?: string[];
    /** UI browser tests vs API-only tests without screenshots, traces, or videos. */
    testKind?: 'ui' | 'api';
}

export interface SuiteStats {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    flaky: number;
}

export interface ReportRenderContext {
    options: ResolvedReporterOptions;
    config: FullConfig;
    testResults: TestData[];
    suiteStats: SuiteStats;
    startTime: Date;
    endTime: Date;
    runId: string;
    environment: string;
    author: string;
    browserName: string;
    platform: string;
    liveRefreshSeconds: number;
}
