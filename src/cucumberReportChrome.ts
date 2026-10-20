import { ReportRenderContext, StepData, TestData } from './types';

export interface CountBucket {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
}

export interface CucumberOverviewStats {
    features: CountBucket;
    scenarios: CountBucket;
    steps: CountBucket;
}

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function countStepsInTests(tests: TestData[]): CountBucket {
    const bucket: CountBucket = { total: 0, passed: 0, failed: 0, skipped: 0 };
    const walk = (steps: StepData[]) => {
        for (const step of steps) {
            if (step.category === 'test.step') {
                bucket.total++;
                if (step.status === 'passed') bucket.passed++;
                else if (step.status === 'failed') bucket.failed++;
                else bucket.skipped++;
            }
            if (step.children?.length) walk(step.children);
        }
    };
    for (const test of tests) walk(test.steps);
    return bucket;
}

function normalizeScenarioStatus(test: TestData): 'passed' | 'failed' | 'skipped' {
    if (test.status === 'passed') return 'passed';
    if (test.status === 'skipped') return 'skipped';
    return 'failed';
}

export function computeCucumberOverview(testResults: TestData[]): CucumberOverviewStats {
    const scenarios: CountBucket = { total: 0, passed: 0, failed: 0, skipped: 0 };
    for (const test of testResults) {
        scenarios.total++;
        const status = normalizeScenarioStatus(test);
        scenarios[status]++;
    }

    const featureMap = new Map<string, TestData[]>();
    for (const test of testResults) {
        const key = test.feature || 'Uncategorized';
        if (!featureMap.has(key)) featureMap.set(key, []);
        featureMap.get(key)!.push(test);
    }

    const features: CountBucket = { total: 0, passed: 0, failed: 0, skipped: 0 };
    for (const [, tests] of featureMap) {
        features.total++;
        const hasFailed = tests.some((t) => normalizeScenarioStatus(t) === 'failed');
        const allSkipped = tests.every((t) => normalizeScenarioStatus(t) === 'skipped');
        if (hasFailed) features.failed++;
        else if (allSkipped) features.skipped++;
        else features.passed++;
    }

    const steps = countStepsInTests(testResults);
    return { features, scenarios, steps };
}

function renderPanel(name: string, icon: string, bucket: CountBucket): string {
    return `
    <div class="mc-panel">
        <div class="mc-panel-head">
            <span class="mc-panel-icon">${icon}</span>
            <span class="mc-panel-title">${escapeHtml(name)}</span>
            <span class="mc-panel-total">${bucket.total}</span>
        </div>
        <div class="mc-panel-body">
            <div class="mc-metric passed"><span>Passed</span><strong>${bucket.passed}</strong></div>
            <div class="mc-metric failed"><span>Failed</span><strong>${bucket.failed}</strong></div>
            <div class="mc-metric skipped"><span>Skipped</span><strong>${bucket.skipped}</strong></div>
        </div>
    </div>`;
}

export function renderCucumberHeader(
    title: string,
    subtitle: string,
    badges: { label: string; value: string }[],
): string {
    const badgeHtml = badges
        .map(
            (b) =>
                `<div class="mc-badge"><span class="mc-badge-label">${escapeHtml(b.label)}</span><span class="mc-badge-value">${escapeHtml(b.value)}</span></div>`,
        )
        .join('');
    return `
    <header class="mc-header">
        <div class="mc-header-inner">
            <div class="mc-header-brand">
                <div class="mc-logo" aria-hidden="true">◆</div>
                <div>
                    <h1>${escapeHtml(title)}</h1>
                    <p>${escapeHtml(subtitle)}</p>
                </div>
            </div>
            <div class="mc-header-badges">${badgeHtml}</div>
        </div>
    </header>`;
}

export function renderOverviewPanels(stats: CucumberOverviewStats): string {
    return `
    <section class="mc-overview">
        ${renderPanel('Features', '◎', stats.features)}
        ${renderPanel('Scenarios', '▣', stats.scenarios)}
        ${renderPanel('Steps', '☰', stats.steps)}
    </section>`;
}

export function renderChartsRow(stats: CucumberOverviewStats): string {
    const scenarioJson = JSON.stringify([stats.scenarios.passed, stats.scenarios.failed, stats.scenarios.skipped]);
    const stepsJson = JSON.stringify([stats.steps.passed, stats.steps.failed, stats.steps.skipped]);
    return `
    <section class="mc-charts">
        <div class="mc-chart-card">
            <h3>Scenarios</h3>
            <div class="mc-chart-wrap"><canvas id="mc-scenario-chart" width="220" height="220"></canvas></div>
            <div class="mc-chart-legend">
                <span class="passed">Passed ${stats.scenarios.passed}</span>
                <span class="failed">Failed ${stats.scenarios.failed}</span>
                <span class="skipped">Skipped ${stats.scenarios.skipped}</span>
            </div>
        </div>
        <div class="mc-chart-card">
            <h3>Steps</h3>
            <div class="mc-chart-wrap"><canvas id="mc-step-chart" width="220" height="220"></canvas></div>
            <div class="mc-chart-legend">
                <span class="passed">Passed ${stats.steps.passed}</span>
                <span class="failed">Failed ${stats.steps.failed}</span>
                <span class="skipped">Skipped ${stats.steps.skipped}</span>
            </div>
        </div>
        <script type="application/json" id="mc-scenario-data">${scenarioJson}</script>
        <script type="application/json" id="mc-step-data">${stepsJson}</script>
    </section>`;
}

export function renderCucumberChromeFromContext(context: ReportRenderContext, subtitleSuffix: string): {
    header: string;
    overview: string;
    charts: string;
    stats: CucumberOverviewStats;
} {
    const stats = computeCucumberOverview(context.testResults);
    const passRate =
        context.suiteStats.total > 0
            ? `${((context.suiteStats.passed / context.suiteStats.total) * 100).toFixed(1)}%`
            : '0%';
    const header = renderCucumberHeader(
        context.options.reportTitle,
        `${context.options.reportSubtitle} · ${subtitleSuffix}`,
        [
            { label: 'Environment', value: context.environment },
            { label: 'Author', value: context.author },
            { label: 'Pass rate', value: passRate },
            { label: 'Run ID', value: context.runId },
        ],
    );
    return {
        header,
        overview: renderOverviewPanels(stats),
        charts: renderChartsRow(stats),
        stats,
    };
}

export function getCucumberChromeStyles(): string {
    return `
        @import url('https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@400;600;700&display=swap');
        :root {
            --mc-teal-dark: #1a4f4f;
            --mc-teal: #236b6b;
            --mc-teal-light: #2f8585;
            --mc-teal-accent: #3d9a9a;
            --mc-header-bg: linear-gradient(135deg, #1a4f4f 0%, #2a7575 42%, #1e6363 100%);
            --mc-page-bg: #eceff1;
            --mc-card-bg: #ffffff;
            --mc-border: #cfd8dc;
            --mc-text: #263238;
            --mc-muted: #607d8b;
            --mc-passed: #43a047;
            --mc-failed: #e53935;
            --mc-skipped: #fb8c00;
        }
        body.mc-report {
            margin: 0;
            font-family: 'Source Sans 3', 'Segoe UI', sans-serif;
            background: var(--mc-page-bg);
            color: var(--mc-text);
        }
        .mc-header {
            background: var(--mc-header-bg);
            color: #fff;
            box-shadow: 0 4px 18px rgba(26, 79, 79, 0.35);
            border-bottom: 4px solid #153f3f;
        }
        .mc-header-inner {
            max-width: 1400px;
            margin: 0 auto;
            padding: 22px 28px;
            display: flex;
            flex-wrap: wrap;
            gap: 20px;
            align-items: center;
            justify-content: space-between;
        }
        .mc-header-brand { display: flex; gap: 16px; align-items: center; }
        .mc-header-brand h1 { margin: 0; font-size: 1.65rem; font-weight: 700; letter-spacing: 0.02em; }
        .mc-header-brand p { margin: 6px 0 0; opacity: 0.9; font-size: 0.95rem; }
        .mc-logo {
            width: 48px; height: 48px; border-radius: 12px;
            background: rgba(255,255,255,0.14);
            display: flex; align-items: center; justify-content: center;
            font-size: 1.4rem; border: 1px solid rgba(255,255,255,0.25);
        }
        .mc-header-badges { display: flex; flex-wrap: wrap; gap: 10px; }
        .mc-badge {
            background: rgba(0,0,0,0.18);
            border: 1px solid rgba(255,255,255,0.2);
            border-radius: 8px;
            padding: 8px 12px;
            min-width: 100px;
        }
        .mc-badge-label { display: block; font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.08em; opacity: 0.85; }
        .mc-badge-value { display: block; font-size: 0.95rem; font-weight: 700; margin-top: 2px; }
        .mc-overview {
            max-width: 1400px;
            margin: 0 auto;
            padding: 22px 28px 0;
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 18px;
        }
        @media (max-width: 900px) {
            .mc-overview { grid-template-columns: 1fr; }
        }
        .mc-panel {
            background: var(--mc-card-bg);
            border-radius: 6px;
            box-shadow: 0 2px 8px rgba(38, 50, 56, 0.1);
            border: 1px solid var(--mc-border);
            overflow: hidden;
        }
        .mc-panel-head {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 14px 16px;
            background: linear-gradient(180deg, #fafafa 0%, #f0f4f5 100%);
            border-bottom: 1px solid var(--mc-border);
        }
        .mc-panel-icon { color: var(--mc-teal); font-size: 1.1rem; }
        .mc-panel-title { flex: 1; font-weight: 700; text-transform: uppercase; font-size: 0.8rem; letter-spacing: 0.06em; color: var(--mc-muted); }
        .mc-panel-total { font-size: 1.5rem; font-weight: 700; color: var(--mc-teal-dark); }
        .mc-panel-body { display: grid; grid-template-columns: repeat(3, 1fr); text-align: center; }
        .mc-metric { padding: 12px 8px; border-right: 1px solid #eceff1; }
        .mc-metric:last-child { border-right: 0; }
        .mc-metric span { display: block; font-size: 0.72rem; text-transform: uppercase; color: var(--mc-muted); letter-spacing: 0.05em; }
        .mc-metric strong { display: block; font-size: 1.35rem; margin-top: 4px; }
        .mc-metric.passed strong { color: var(--mc-passed); }
        .mc-metric.failed strong { color: var(--mc-failed); }
        .mc-metric.skipped strong { color: var(--mc-skipped); }
        .mc-charts {
            max-width: 1400px;
            margin: 0 auto;
            padding: 18px 28px 0;
            display: grid;
            grid-template-columns: repeat(2, minmax(260px, 1fr));
            gap: 18px;
        }
        @media (max-width: 700px) {
            .mc-charts { grid-template-columns: 1fr; }
        }
        .mc-chart-card {
            background: var(--mc-card-bg);
            border: 1px solid var(--mc-border);
            border-radius: 6px;
            box-shadow: 0 2px 8px rgba(38, 50, 56, 0.08);
            padding: 16px 20px 20px;
        }
        .mc-chart-card h3 {
            margin: 0 0 12px;
            font-size: 0.85rem;
            text-transform: uppercase;
            letter-spacing: 0.07em;
            color: var(--mc-teal-dark);
        }
        .mc-chart-wrap { max-width: 240px; margin: 0 auto; }
        .mc-chart-legend { display: flex; justify-content: center; gap: 14px; margin-top: 10px; font-size: 0.8rem; }
        .mc-chart-legend .passed { color: var(--mc-passed); font-weight: 600; }
        .mc-chart-legend .failed { color: var(--mc-failed); font-weight: 600; }
        .mc-chart-legend .skipped { color: var(--mc-skipped); font-weight: 600; }
        .mc-content-shell { max-width: 1400px; margin: 0 auto; padding: 18px 28px 32px; }
    `;
}

export function getCucumberChartScript(): string {
    return `
        (function initMcCharts() {
            if (!window.Chart) return;
            const colors = ['#43a047', '#e53935', '#fb8c00'];
            const labels = ['Passed', 'Failed', 'Skipped'];
            const common = {
                type: 'doughnut',
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: { legend: { display: false } },
                    cutout: '62%',
                },
            };
            const scenarioEl = document.getElementById('mc-scenario-chart');
            const stepEl = document.getElementById('mc-step-chart');
            const scenarioData = JSON.parse(document.getElementById('mc-scenario-data')?.textContent || '[0,0,0]');
            const stepData = JSON.parse(document.getElementById('mc-step-data')?.textContent || '[0,0,0]');
            if (scenarioEl) {
                new Chart(scenarioEl, { ...common, data: { labels, datasets: [{ data: scenarioData, backgroundColor: colors, borderWidth: 0 }] } });
            }
            if (stepEl) {
                new Chart(stepEl, { ...common, data: { labels, datasets: [{ data: stepData, backgroundColor: colors, borderWidth: 0 }] } });
            }
        })();
    `;
}

export function getCucumberChartScriptTag(): string {
    return `<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>`;
}
