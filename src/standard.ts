import TddLmReporter from './tddLmReporter';

/** Standard report: Playwright-style drill-down UI (nested steps, traces, filters). */
class StandardLightReporter extends TddLmReporter {
    constructor(options: ConstructorParameters<typeof TddLmReporter>[0] = {}) {
        super({ ...options, mode: 'standard' });
    }
}

export default StandardLightReporter;
export { StandardLightReporter };
