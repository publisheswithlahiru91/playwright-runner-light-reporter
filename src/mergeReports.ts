import * as fs from 'fs';
import * as path from 'path';
import { copyBlobArtifacts, mergeReportBlobs, readReportBlobs } from './reportBlob';
import { ReportRenderContext, TddLmReporterOptions } from './types';
import { finalizeReportFromContext } from './tddLmReporter';
export interface MergeReportsOptions extends TddLmReporterOptions {
    /** Directory containing one or more blob-report folders or JSON files. */
    inputDir: string;
    /** Final merged report output directory. Defaults to reporter outputDir. */
    outputDir?: string;
}

function resolveOptions(options: MergeReportsOptions): Required<Pick<MergeReportsOptions, 'outputDir'>> & TddLmReporterOptions {
    return {
        ...options,
        outputDir: options.outputDir ?? 'playwright-lm-report',
    };
}

export function mergeReports(options: MergeReportsOptions): ReportRenderContext {
    const resolved = resolveOptions(options);
    const outputDir = path.resolve(resolved.outputDir || 'playwright-lm-report');
    const inputDir = path.resolve(options.inputDir);

    fs.mkdirSync(outputDir, { recursive: true });

    const blobs = readReportBlobs(inputDir);
    const context = mergeReportBlobs(blobs);
    context.options = {
        ...context.options,
        ...resolved,
        mode: resolved.mode ?? context.options.mode,
        outputDir: path.basename(outputDir),
        liveRefreshSeconds: 0,
    };

    for (const blob of blobs) {
        if (blob.blobFileDir) {
            copyBlobArtifacts(blob.blobFileDir, outputDir);
            copyBlobArtifacts(path.dirname(blob.blobFileDir), outputDir);
        }
        const blobRoot = path.dirname(path.join(inputDir, blob.options.outputDir || ''));
        const candidateRoots = [
            path.join(inputDir, blob.options.outputDir || ''),
            path.join(inputDir, '..', blob.options.outputDir || ''),
            path.dirname(inputDir),
            inputDir,
        ];
        for (const root of candidateRoots) {
            copyBlobArtifacts(root, outputDir);
        }
        copyBlobArtifacts(blobRoot, outputDir);
        copyBlobArtifacts(path.join(inputDir, blob.options.outputDir || 'playwright-lm-report'), outputDir);
    }

    copyBlobArtifacts(inputDir, outputDir);

    context.options.outputDir = outputDir;
    finalizeReportFromContext(context, outputDir);
    return context;
}
