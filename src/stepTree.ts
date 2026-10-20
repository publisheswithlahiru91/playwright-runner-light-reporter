import { TestStep } from '@playwright/test/reporter';
import { StepData } from './types';

const REPORT_STEP_CATEGORIES = new Set([
    'test.step',
    'pw:api',
    'expect',
    'fixture',
    'hook',
    'test.attach',
]);

export function buildStepTree(steps: TestStep[], testStartTime: number, counter = { value: 0 }): StepData[] {
    return steps
        .filter((step) => REPORT_STEP_CATEGORIES.has(step.category))
        .map((step) => {
            const stepStartTime = new Date(step.startTime).getTime();
            const stepIndex = counter.value++;
            const status: StepData['status'] = step.error
                ? 'failed'
                : step.duration === -1
                  ? 'skipped'
                  : 'passed';

            const children = buildStepTree(step.steps, testStartTime, counter);
            const node: StepData = {
                id: `step-${stepIndex}`,
                title: step.title,
                category: step.category,
                duration: step.duration >= 0 ? step.duration : 0,
                status,
                startTime: new Date(step.startTime).toLocaleTimeString(),
                error: step.error?.message,
                stackTrace: step.error?.stack,
                consoleLogs: [],
                stepIndex,
                videoStartTime: Math.max(0, stepStartTime - testStartTime),
                videoEndTime: Math.max(0, stepStartTime - testStartTime + Math.max(step.duration || 0, 0)),
            };

            if (children.length > 0) {
                node.children = children;
            }

            return node;
        });
}

export function flattenSteps(steps: StepData[]): StepData[] {
    const flat: StepData[] = [];
    for (const step of steps) {
        flat.push(step);
        if (step.children?.length) {
            flat.push(...flattenSteps(step.children));
        }
    }
    return flat;
}

export function countSteps(steps: StepData[]): number {
    return steps.reduce((total, step) => total + 1 + (step.children ? countSteps(step.children) : 0), 0);
}
