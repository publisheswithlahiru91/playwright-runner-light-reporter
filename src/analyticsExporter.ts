import * as fs from 'fs';
import * as path from 'path';
import { ReportRenderContext, TestData } from './types';

export interface AnalyticsRunRequest {
    id: string;
    name: string;
    method: 'TEST';
    url: string;
    statusCode: number;
    responseTimeMs: number;
    assertions: Array<{ name: string; passed: boolean; errorMessage?: string }>;
    tags: string[];
    status: string;
    file: string;
}

export interface AnalyticsRunRecord {
    runId: string;
    tool: 'playwright';
    sourceName: string;
    timestamp: string;
    status: 'Success' | 'Failure' | 'Warning';
    summary: {
        totalRequests: number;
        passedAssertions: number;
        failedAssertions: number;
        avgResponseTimeMs: number;
    };
    requests: AnalyticsRunRequest[];
    projectName?: string;
    frameworkName?: string;
    applicationType?: 'UI' | 'API' | 'Mixed';
    methodology?: string;
    metadata?: Record<string, unknown>;
}

function mapTestStatus(test: TestData): number {
    if (test.status === 'passed') {
        return 200;
    }
    if (test.status === 'skipped') {
        return 204;
    }
    return 500;
}

function mapRunStatus(stats: ReportRenderContext['suiteStats']): AnalyticsRunRecord['status'] {
    if (stats.failed > 0) {
        return 'Failure';
    }
    if (stats.skipped > 0) {
        return 'Warning';
    }
    return 'Success';
}

function buildRunRecord(context: ReportRenderContext, reportHtmlFile: string): AnalyticsRunRecord {
    const avgDuration = context.testResults.length > 0
        ? Math.round(context.testResults.reduce((sum, test) => sum + test.duration, 0) / context.testResults.length)
        : 0;

    const uiTests = context.testResults.filter((test) => test.testKind !== 'api').length;
    const apiTests = context.testResults.filter((test) => test.testKind === 'api').length;
    const applicationType: AnalyticsRunRecord['applicationType'] =
        uiTests > 0 && apiTests > 0 ? 'Mixed' : apiTests > 0 ? 'API' : 'UI';

    return {
        runId: context.runId,
        tool: 'playwright',
        sourceName: context.options.reportTitle,
        timestamp: context.startTime.toISOString(),
        status: mapRunStatus(context.suiteStats),
        summary: {
            totalRequests: context.suiteStats.total,
            passedAssertions: context.suiteStats.passed,
            failedAssertions: context.suiteStats.failed,
            avgResponseTimeMs: avgDuration,
        },
        requests: context.testResults.map((test, index) => ({
            id: test.id,
            name: test.fullTitle,
            method: 'TEST',
            url: test.location,
            statusCode: mapTestStatus(test),
            responseTimeMs: Math.round(test.duration),
            assertions: [{
                name: test.title,
                passed: test.status === 'passed',
                errorMessage: test.error,
            }],
            tags: test.tags,
            status: test.status,
            file: test.file,
        })),
        frameworkName: 'playwright',
        applicationType,
        methodology: 'TDD',
        metadata: {
            reportHtml: reportHtmlFile,
            reportSubtitle: context.options.reportSubtitle,
            environment: context.environment,
            browser: context.browserName,
            platform: context.platform,
            author: context.author,
            passRate: context.suiteStats.total > 0
                ? Number(((context.suiteStats.passed / context.suiteStats.total) * 100).toFixed(1))
                : 0,
            skipped: context.suiteStats.skipped,
            durationMs: context.endTime.getTime() - context.startTime.getTime(),
            mode: context.options.mode,
        },
    };
}

function readHistory(historyFile: string): AnalyticsRunRecord[] {
    if (!fs.existsSync(historyFile)) {
        return [];
    }

    try {
        const parsed = JSON.parse(fs.readFileSync(historyFile, 'utf-8'));
        return Array.isArray(parsed) ? parsed : Array.isArray(parsed.history) ? parsed.history : [];
    } catch {
        return [];
    }
}

export function writeAnalyticsArtifacts(
    context: ReportRenderContext,
    reportDir: string,
    reportHtmlFile: string,
    analyticsDir = '.analytics',
): string {
    const resolvedAnalyticsDir = path.isAbsolute(analyticsDir)
        ? analyticsDir
        : path.join(process.cwd(), analyticsDir);
    const runsDir = path.join(resolvedAnalyticsDir, 'runs');
    fs.mkdirSync(runsDir, { recursive: true });

    const runRecord = buildRunRecord(context, path.relative(process.cwd(), reportHtmlFile).replace(/\\/g, '/'));
    const runFileName = `run_${context.runId}.json`;
    const runFilePath = path.join(runsDir, runFileName);
    fs.writeFileSync(runFilePath, JSON.stringify(runRecord, null, 2));

    const historyFile = path.join(resolvedAnalyticsDir, 'history.json');
    const history = readHistory(historyFile).filter((entry) => entry.runId !== context.runId);
    history.unshift(runRecord);
    fs.writeFileSync(historyFile, JSON.stringify(history, null, 2));

    const manifest = {
        latestRunId: context.runId,
        latestRunFile: path.relative(resolvedAnalyticsDir, runFilePath).replace(/\\/g, '/'),
        latestReportHtml: runRecord.metadata?.reportHtml,
        updatedAt: new Date().toISOString(),
        totalRuns: history.length,
    };
    fs.writeFileSync(path.join(resolvedAnalyticsDir, 'latest.json'), JSON.stringify(manifest, null, 2));

    const analyticsCopyDir = path.join(reportDir, '.analytics');
    fs.mkdirSync(analyticsCopyDir, { recursive: true });
    fs.copyFileSync(runFilePath, path.join(analyticsCopyDir, runFileName));
    fs.copyFileSync(historyFile, path.join(analyticsCopyDir, 'history.json'));
    fs.copyFileSync(path.join(resolvedAnalyticsDir, 'latest.json'), path.join(analyticsCopyDir, 'latest.json'));

    return resolvedAnalyticsDir;
}
