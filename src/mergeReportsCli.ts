#!/usr/bin/env node
import { mergeReports } from './mergeReports';

function printHelp(): void {
    console.log(`Usage: playwright-runner-lm-reporter-merge <blob-report-dir> [options]

Merge Playwright LM Reporter blob reports from sharded or multi-machine runs.

Options:
  --output-dir <dir>   Final merged report directory (default: playwright-lm-report)
  --mode <mode>        Report mode: standard, bdd, or legacy-table (default: from blob)
  --help               Show this help message

Examples:
  npx playwright-runner-lm-reporter-merge playwright-lm-report/blob-report
  npx playwright-runner-lm-reporter-merge ./shard-artifacts --output-dir playwright-lm-report
`);
}

function parseArgs(argv: string[]): { inputDir?: string; outputDir?: string; mode?: 'standard' | 'bdd' | 'legacy-table'; help?: boolean } {
    const parsed: { inputDir?: string; outputDir?: string; mode?: 'standard' | 'bdd' | 'legacy-table'; help?: boolean } = {};
    const positional: string[] = [];

    for (let index = 0; index < argv.length; index++) {
        const arg = argv[index];
        if (arg === '--help' || arg === '-h') {
            parsed.help = true;
            continue;
        }
        if (arg === '--output-dir') {
            parsed.outputDir = argv[++index];
            continue;
        }
        if (arg === '--mode') {
            const mode = argv[++index];
            if (mode !== 'standard' && mode !== 'bdd' && mode !== 'legacy-table') {
                throw new Error(`Invalid mode: ${mode}. Expected standard, bdd, or legacy-table.`);
            }
            parsed.mode = mode;
            continue;
        }
        positional.push(arg);
    }

    parsed.inputDir = positional[0];
    return parsed;
}

function main(): void {
    try {
        const args = parseArgs(process.argv.slice(2));
        if (args.help || !args.inputDir) {
            printHelp();
            process.exit(args.help ? 0 : 1);
        }

        mergeReports({
            inputDir: args.inputDir,
            outputDir: args.outputDir,
            mode: args.mode,
        });
    } catch (error) {
        console.error(error instanceof Error ? error.message : error);
        process.exit(1);
    }
}

main();
