import { StepData, TestData } from './types';

export type BddFeatureSource = 'spec-file' | 'describe';

export interface ScreenshotFrame {
    order: number;
    path: string;
    label: string;
    feature: string;
    scenarioLabel: string;
    reqIds: string[];
    testCaseIds: string[];
    stepTitle?: string;
    timeMs: number;
}

export function scenarioDisplayName(test: TestData): string {
    const primary = test.testCaseIds?.[0];
    if (primary) {
        const base = `TEST_${primary}`;
        const title = test.title.replace(/\bTEST_[A-Za-z0-9][A-Za-z0-9_-]*/g, '').trim();
        return title ? `${base} — ${title}` : base;
    }
    return test.title;
}

export function groupByFeature(tests: TestData[]): Map<string, TestData[]> {
    const map = new Map<string, TestData[]>();
    for (const test of tests) {
        const feature = test.feature || 'Uncategorized';
        if (!map.has(feature)) map.set(feature, []);
        map.get(feature)!.push(test);
    }
    return map;
}

export function groupByRequirement(tests: TestData[]): Map<string, TestData[]> {
    const map = new Map<string, TestData[]>();
    for (const test of tests) {
        const reqs = test.requirements?.length ? test.requirements : ['Unlinked'];
        for (const req of reqs) {
            if (!map.has(req)) map.set(req, []);
            map.get(req)!.push(test);
        }
    }
    return map;
}

export function groupByTestCase(tests: TestData[]): Map<string, TestData[]> {
    const map = new Map<string, TestData[]>();
    for (const test of tests) {
        const cases = test.testCaseIds?.length ? test.testCaseIds : ['Unlinked'];
        for (const id of cases) {
            if (!map.has(id)) map.set(id, []);
            map.get(id)!.push(test);
        }
    }
    return map;
}

export function scenarioStatus(test: TestData): 'passed' | 'failed' | 'skipped' {
    if (test.status === 'passed') return 'passed';
    if (test.status === 'skipped') return 'skipped';
    return 'failed';
}

export function featureAggregateStatus(scenarios: TestData[]): 'passed' | 'failed' | 'skipped' {
    if (scenarios.some((s) => scenarioStatus(s) === 'failed')) return 'failed';
    if (scenarios.every((s) => scenarioStatus(s) === 'skipped')) return 'skipped';
    return 'passed';
}

function flattenSteps(steps: StepData[]): StepData[] {
    const out: StepData[] = [];
    const walk = (items: StepData[]) => {
        for (const step of items) {
            if (step.category === 'test.step') out.push(step);
            if (step.children?.length) walk(step.children);
        }
    };
    walk(steps);
    return out;
}

export function collectScreenshotTimeline(tests: TestData[]): ScreenshotFrame[] {
    const frames: ScreenshotFrame[] = [];
    let order = 0;
    for (const test of tests) {
        const scenarioLabel = scenarioDisplayName(test);
        const feature = test.feature || 'Uncategorized';
        const flatSteps = flattenSteps(test.steps);
        for (const step of flatSteps) {
            if (!step.screenshot) continue;
            order++;
            frames.push({
                order,
                path: step.screenshot,
                label: step.title,
                feature,
                scenarioLabel,
                reqIds: test.requirements || [],
                testCaseIds: test.testCaseIds || [],
                stepTitle: step.title,
                timeMs: step.videoStartTime ?? order * 1000,
            });
        }
        for (const shot of test.screenshots) {
            order++;
            frames.push({
                order,
                path: shot.path,
                label: shot.name,
                feature,
                scenarioLabel,
                reqIds: test.requirements || [],
                testCaseIds: test.testCaseIds || [],
                timeMs: order * 1000,
            });
        }
    }
    return frames.sort((a, b) => a.timeMs - b.timeMs || a.order - b.order);
}
