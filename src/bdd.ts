import TddLmReporter from './tddLmReporter';

/** BDD report: features, scenarios, steps, REQ_/TEST_ dashboard tiles. */
class BddLightReporter extends TddLmReporter {
    constructor(options: ConstructorParameters<typeof TddLmReporter>[0] = {}) {
        super({ ...options, mode: 'bdd' });
    }
}

export default BddLightReporter;
export { BddLightReporter };
