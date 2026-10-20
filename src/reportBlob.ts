import * as fs from 'fs';
import * as path from 'path';
import { ReportRenderContext, ResolvedReporterOptions, SuiteStats, TestData } from './types';

export const REPORT_BLOB_VERSION = 1;

export interface ReportBlobShard {
    current: number;
    total: number;
}

export interface ReportBlob {
    version: typeof REPORT_BLOB_VERSION;
    mode: ResolvedReporterOptions['mode'];
    options: ResolvedReporterOptions;
    runId: string;
    shard?: ReportBlobShard;
    startTime: string;
    endTime: string;
    suiteStats: SuiteStats;
    testResults: TestData[];
    environment: string;
    author: string;
    browserName: string;
    platform: string;
    workers: number;
    blobFileDir?: string;
}

export function getBlobReportDir(outputDir: string): string {
    return path.join(outputDir, 'blob-report');
}

export function getBlobFileName(shard?: ReportBlobShard): string {
    if (shard) {
        return `report-${shard.current}-of-${shard.total}.json`;
    }
    return 'report.json';
}

export function writeReportBlob(
    context: ReportRenderContext,
    outputDir: string,
    shard?: ReportBlobShard,
): string {
    const blobDir = getBlobReportDir(outputDir);
    fs.mkdirSync(blobDir, { recursive: true });

    const blob: ReportBlob = {
        version: REPORT_BLOB_VERSION,
        mode: context.options.mode,
        options: context.options,
        runId: context.runId,
        shard,
        startTime: context.startTime.toISOString(),
        endTime: context.endTime.toISOString(),
        suiteStats: context.suiteStats,
        testResults: context.testResults,
        environment: context.environment,
        author: context.author,
        browserName: context.browserName,
        platform: context.platform,
        workers: context.config.workers || 1,
    };

    const blobPath = path.join(blobDir, getBlobFileName(shard));
    fs.writeFileSync(blobPath, JSON.stringify(blob, null, 2));
    return blobPath;
}

export function readReportBlobs(inputDir: string): ReportBlob[] {
    const resolvedDir = path.resolve(inputDir);
    if (!fs.existsSync(resolvedDir)) {
        throw new Error(`Blob report directory not found: ${resolvedDir}`);
    }

    const blobFiles: string[] = [];
    const visit = (dir: string): void => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                visit(fullPath);
                continue;
            }
            if (entry.isFile() && entry.name.endsWith('.json') && entry.name.startsWith('report')) {
                blobFiles.push(fullPath);
            }
        }
    };
    visit(resolvedDir);

    if (blobFiles.length === 0) {
        throw new Error(`No blob report JSON files found under: ${resolvedDir}`);
    }

    return blobFiles
        .map((filePath) => {
            const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as ReportBlob;
            if (parsed.version !== REPORT_BLOB_VERSION) {
                throw new Error(`Unsupported blob report version in ${filePath}`);
            }
            parsed.blobFileDir = path.dirname(filePath);
            return parsed;
        })
        .sort((left, right) => {
            const leftShard = left.shard?.current ?? 0;
            const rightShard = right.shard?.current ?? 0;
            return leftShard - rightShard;
        });
}

export function mergeReportBlobs(blobs: ReportBlob[]): ReportRenderContext {
    if (blobs.length === 0) {
        throw new Error('At least one blob report is required to merge.');
    }

    const base = blobs[0];
    const mergedStats: SuiteStats = { total: 0, passed: 0, failed: 0, skipped: 0, flaky: 0 };
    const mergedTests: TestData[] = [];
    let earliestStart = new Date(base.startTime);
    let latestEnd = new Date(base.endTime);

    for (const blob of blobs) {
        mergedStats.total += blob.suiteStats.total;
        mergedStats.passed += blob.suiteStats.passed;
        mergedStats.failed += blob.suiteStats.failed;
        mergedStats.skipped += blob.suiteStats.skipped;
        mergedStats.flaky += blob.suiteStats.flaky;
        mergedTests.push(...blob.testResults);

        const start = new Date(blob.startTime);
        const end = new Date(blob.endTime);
        if (start < earliestStart) {
            earliestStart = start;
        }
        if (end > latestEnd) {
            latestEnd = end;
        }
    }

    mergedTests.sort((left, right) => left.fullTitle.localeCompare(right.fullTitle));

    const shardSuffix = blobs.some((blob) => blob.shard)
        ? `_merged_${blobs.length}shards`
        : '';
    const runId = `${base.runId}${shardSuffix}`;

    return {
        options: base.options,
        config: {
            ...({} as ReportRenderContext['config']),
            workers: blobs.reduce((sum, blob) => sum + blob.workers, 0),
            projects: [{ name: base.browserName } as any],
            shard: base.shard ? { current: 1, total: 1 } : null,
        },
        testResults: mergedTests,
        suiteStats: mergedStats,
        startTime: earliestStart,
        endTime: latestEnd,
        runId,
        environment: base.environment,
        author: base.author,
        browserName: base.browserName,
        platform: base.platform,
        liveRefreshSeconds: 0,
    };
}

export function copyBlobArtifacts(sourceRoot: string, outputDir: string): void {
    const copyIfExists = (relativeDir: string): void => {
        const sourceDir = path.join(sourceRoot, relativeDir);
        if (!fs.existsSync(sourceDir)) {
            return;
        }
        const targetDir = path.join(outputDir, relativeDir);
        fs.mkdirSync(targetDir, { recursive: true });
        for (const file of fs.readdirSync(sourceDir)) {
            const from = path.join(sourceDir, file);
            const to = path.join(targetDir, file);
            if (fs.statSync(from).isFile() && !fs.existsSync(to)) {
                fs.copyFileSync(from, to);
            }
        }
    };

    copyIfExists('screenshots');
    copyIfExists('videos');
    copyIfExists('traces');
}
