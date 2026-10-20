import * as fs from 'fs';
import * as path from 'path';
import { TestCase, TestResult } from '@playwright/test/reporter';
import { StepData } from './types';

export interface ProcessedAttachments {
    screenshots: { name: string; path: string }[];
    stepScreenshots: Map<string, string>;
    video?: string;
    trace?: string;
    testKind: 'ui' | 'api';
}

function ensureDir(dir: string): void {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

function safeFileToken(value: string): string {
    return value.replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 80);
}

function isScreenshotAttachment(attachment: TestResult['attachments'][number]): boolean {
    if (!attachment.contentType?.startsWith('image/')) {
        return false;
    }
    const name = (attachment.name || '').toLowerCase();
    return name.includes('screenshot') || attachment.contentType === 'image/png' || attachment.contentType === 'image/jpeg';
}

function isTraceAttachment(attachment: TestResult['attachments'][number]): boolean {
    if (attachment.name === 'trace') {
        return true;
    }
    const name = (attachment.name || '').toLowerCase();
    return name.includes('trace') && (attachment.contentType === 'application/zip' || !!attachment.path?.endsWith('.zip'));
}

function isVideoAttachment(attachment: TestResult['attachments'][number]): boolean {
    if (!attachment.contentType?.startsWith('video/') || !attachment.path) {
        return false;
    }
    // Prefer main test page recording; skip auxiliary page videos (e.g. axe finishRun blank page).
    if (/[\\/]video\.webm$/i.test(attachment.path)) {
        return true;
    }
    return attachment.name?.toLowerCase() === 'video' || attachment.name?.toLowerCase().includes('video');
}

function copyAttachment(
    attachment: TestResult['attachments'][number],
    destPath: string,
): boolean {
    ensureDir(path.dirname(destPath));
    try {
        if (attachment.path) {
            fs.copyFileSync(attachment.path, destPath);
            return true;
        }
        if (attachment.body) {
            fs.writeFileSync(destPath, attachment.body);
            return true;
        }
    } catch {
        console.warn(`Failed to save attachment: ${attachment.name || attachment.contentType}`);
    }
    return false;
}

export function processTestAttachments(
    test: TestCase,
    result: TestResult,
    outputDir: string,
    testId: string,
): ProcessedAttachments {
    const screenshots: { name: string; path: string }[] = [];
    const stepScreenshots: Map<string, string> = new Map();
    let videoPath: string | undefined;
    let tracePath: string | undefined;
    const fileToken = safeFileToken(testId);

    for (const attachment of result.attachments) {
        if (isScreenshotAttachment(attachment)) {
            const ext = attachment.contentType === 'image/jpeg' ? 'jpg' : 'png';
            const screenshotName = `screenshot_${fileToken}_${screenshots.length + 1}.${ext}`;
            const destPath = path.join(outputDir, 'screenshots', screenshotName);
            if (copyAttachment(attachment, destPath)) {
                const relativePath = `screenshots/${screenshotName}`;
                screenshots.push({
                    name: attachment.name || `Screenshot ${screenshots.length + 1}`,
                    path: relativePath,
                });
                if (attachment.name) {
                    stepScreenshots.set(attachment.name, relativePath);
                }
            }
            continue;
        }

        if (isVideoAttachment(attachment)) {
            const videoName = `video_${fileToken}.webm`;
            const destPath = path.join(outputDir, 'videos', videoName);
            if (copyAttachment(attachment, destPath)) {
                videoPath = `videos/${videoName}`;
            }
            continue;
        }

        if (isTraceAttachment(attachment)) {
            const traceName = `trace_${fileToken}.zip`;
            const destPath = path.join(outputDir, 'traces', traceName);
            if (copyAttachment(attachment, destPath)) {
                tracePath = `traces/${traceName}`;
            }
        }
    }

    let isUi = false;
    let parent: any = test.parent;
    while (parent) {
        const project = parent.project();
        if (project) {
            const use = project.use || {};
            const name = (project.name || '').toLowerCase();
            if (
                use.browserName ||
                use.defaultBrowserType ||
                (use as any).device ||
                use.viewport ||
                name.includes('chromium') ||
                name.includes('firefox') ||
                name.includes('webkit') ||
                name.includes('chrome') ||
                name.includes('safari') ||
                name.includes('edge') ||
                name.includes('mobile') ||
                name.includes('ui')
            ) {
                isUi = true;
            }
            break;
        }
        parent = parent.parent;
    }

    const hasUiStep = (steps: TestResult['steps']): boolean => {
        for (const step of steps) {
            const title = (step.title || '').toLowerCase();
            if (step.category === 'fixture' && (title.includes('page') || title.includes('browser') || title.includes('context'))) {
                return true;
            }
            if (title.startsWith('page.') || title.startsWith('locator.') || title.startsWith('frame.')) {
                return true;
            }
            if (step.steps && hasUiStep(step.steps)) {
                return true;
            }
        }
        return false;
    };

    if (!isUi && result.steps) {
        isUi = hasUiStep(result.steps);
    }

    if (videoPath || tracePath || screenshots.length > 0) {
        isUi = true;
    }

    return {
        screenshots,
        stepScreenshots,
        video: videoPath,
        trace: tracePath,
        testKind: isUi ? 'ui' : 'api',
    };
}

export function associateScreenshotsWithSteps(
    testSteps: StepData[],
    stepScreenshots: Map<string, string>,
): void {
    for (const step of testSteps) {
        for (const [name, screenshotPath] of stepScreenshots) {
            const nameLower = name.toLowerCase();
            const titleLower = step.title.toLowerCase();

            const stepIndexPattern = `step-${step.stepIndex}-`;
            if (nameLower.startsWith(stepIndexPattern)) {
                step.screenshot = screenshotPath;
                break;
            }

            const stepNumPattern1 = `step_${(step.stepIndex || 0) + 1}_`;
            const stepNumPattern2 = `step ${(step.stepIndex || 0) + 1}`;
            if (nameLower.includes(stepNumPattern1) || nameLower.includes(stepNumPattern2)) {
                step.screenshot = screenshotPath;
                break;
            }

            const cleanedName = nameLower.replace(/step[-_]?\d+[-_:]?/i, '').trim();
            if (cleanedName && (titleLower.includes(cleanedName) || cleanedName.includes(titleLower.substring(0, 20)))) {
                step.screenshot = screenshotPath;
                break;
            }
        }
    }
}

export function rebuildStepScreenshotMap(
    testSteps: StepData[],
): Map<string, string> {
    const map = new Map<string, string>();
    const visit = (steps: StepData[]): void => {
        for (const step of steps) {
            if (step.screenshot) {
                map.set(step.title, step.screenshot);
            }
            if (step.children?.length) {
                visit(step.children);
            }
        }
    };
    visit(testSteps);
    return map;
}
