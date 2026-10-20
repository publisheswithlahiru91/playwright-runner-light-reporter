import { ReportRenderContext, StepData, TestData } from './types';
import {
    getAdvancedDarkComponentOverrides,
    getAdvancedThemeVariables,
    getHtmlThemeAttribute,
} from './reportThemes';

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes > 0) {
        return `${minutes}m ${remainingSeconds}s`;
    }
    return `${seconds}s`;
}

function formatTime(date: Date): string {
    return date.toLocaleString('en-US', {
        month: 'short',
        day: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
    });
}

function linkFromTemplate(template: string, id: string): string {
    return template.replace(/\{id\}/g, encodeURIComponent(id));
}

function collectSearchText(test: TestData): string {
    return [
        test.feature || '',
        test.title,
        test.fullTitle,
        ...test.tags,
        ...(test.requirements || []).map((r) => `REQ_${r}`),
        ...(test.testCaseIds || []).map((t) => `TEST_${t}`),
    ]
        .join(' ')
        .toLowerCase();
}

function renderScenarioSteps(steps: StepData[]): string {
    const flat: StepData[] = [];
    const walk = (items: StepData[]) => {
        for (const step of items) {
            if (step.category === 'test.step') {
                flat.push(step);
            }
            if (step.children?.length) {
                walk(step.children);
            }
        }
    };
    walk(steps);
    if (!flat.length) {
        return '<li class="bdd-step muted">No scenario steps recorded</li>';
    }
    return flat
        .map(
            (step) =>
                `<li class="bdd-step ${step.status}"><span class="bdd-step-status">${step.status === 'passed' ? '✓' : step.status === 'failed' ? '✗' : '○'}</span>${escapeHtml(step.title)}</li>`,
        )
        .join('');
}

function groupByFeature(tests: TestData[]): Map<string, TestData[]> {
    const map = new Map<string, TestData[]>();
    for (const test of tests) {
        const feature = test.feature || 'Uncategorized';
        if (!map.has(feature)) {
            map.set(feature, []);
        }
        map.get(feature)!.push(test);
    }
    return map;
}

function collectRequirementTiles(tests: TestData[]): { id: string; count: number }[] {
    const counts = new Map<string, number>();
    for (const test of tests) {
        for (const id of test.requirements || []) {
            counts.set(id, (counts.get(id) || 0) + 1);
        }
    }
    return [...counts.entries()]
        .map(([id, count]) => ({ id, count }))
        .sort((a, b) => a.id.localeCompare(b.id));
}

function collectTestCaseTiles(tests: TestData[]): { id: string; count: number }[] {
    const counts = new Map<string, number>();
    for (const test of tests) {
        for (const id of test.testCaseIds || []) {
            counts.set(id, (counts.get(id) || 0) + 1);
        }
    }
    return [...counts.entries()]
        .map(([id, count]) => ({ id, count }))
        .sort((a, b) => a.id.localeCompare(b.id));
}

export function renderBddHtml(context: ReportRenderContext): string {
    const { options, testResults, suiteStats, startTime, endTime, environment, author } = context;
    const themeVars =
        options.theme === 'dark' ? getAdvancedThemeVariables() : getAdvancedThemeVariables();
    const darkOverrides = options.theme === 'dark' ? getAdvancedDarkComponentOverrides() : '';

    const features = groupByFeature(testResults);
    const reqTiles = collectRequirementTiles(testResults);
    const testTiles = collectTestCaseTiles(testResults);
    const passRate =
        suiteStats.total > 0
            ? ((suiteStats.passed / suiteStats.total) * 100).toFixed(1)
            : '0';

    const featureSections = [...features.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([featureName, scenarios]) => {
            const scenarioHtml = scenarios
                .map((test) => {
                    const status = test.status === 'passed' ? 'passed' : test.status === 'skipped' ? 'skipped' : 'failed';
                    const reqLinks = (test.requirements || [])
                        .map(
                            (id) =>
                                `<a class="bdd-link" href="${escapeHtml(linkFromTemplate(options.jiraIssueUrlTemplate, id))}" target="_blank" rel="noopener">REQ_${escapeHtml(id)}</a>`,
                        )
                        .join(' ');
                    const testLinks = (test.testCaseIds || [])
                        .map(
                            (id) =>
                                `<a class="bdd-link" href="${escapeHtml(linkFromTemplate(options.testCaseUrlTemplate, id))}" target="_blank" rel="noopener">TEST_${escapeHtml(id)}</a>`,
                        )
                        .join(' ');
                    return `
                    <article class="bdd-scenario ${status}" data-search="${escapeHtml(collectSearchText(test))}">
                        <header class="bdd-scenario-header">
                            <span class="bdd-scenario-status ${status}">${status === 'passed' ? '✓' : status === 'skipped' ? '○' : '✗'}</span>
                            <h3 class="bdd-scenario-title">${escapeHtml(test.title)}</h3>
                            <span class="bdd-scenario-duration">${formatDuration(test.duration)}</span>
                        </header>
                        <div class="bdd-scenario-meta">
                            ${reqLinks || ''} ${testLinks || ''}
                            ${test.tags.map((t) => `<span class="bdd-tag">${escapeHtml(t)}</span>`).join(' ')}
                        </div>
                        <ol class="bdd-steps">${renderScenarioSteps(test.steps)}</ol>
                        ${test.error ? `<pre class="bdd-error">${escapeHtml(test.error)}</pre>` : ''}
                    </article>`;
                })
                .join('');
            return `
            <section class="bdd-feature" data-feature="${escapeHtml(featureName.toLowerCase())}">
                <button type="button" class="bdd-feature-toggle" onclick="toggleFeature(this)">
                    <span class="bdd-feature-chevron">▶</span>
                    <h2>${escapeHtml(featureName)}</h2>
                    <span class="bdd-feature-count">${scenarios.length} scenario(s)</span>
                </button>
                <div class="bdd-feature-body">${scenarioHtml}</div>
            </section>`;
        })
        .join('');

    const reqTileHtml = reqTiles
        .map(
            (tile) =>
                `<a class="bdd-tile req" href="${escapeHtml(linkFromTemplate(options.jiraIssueUrlTemplate, tile.id))}" target="_blank" rel="noopener" data-filter="req_${escapeHtml(tile.id.toLowerCase())}" onclick="filterByTile(event, 'req_${escapeHtml(tile.id.toLowerCase())}')"><span class="bdd-tile-label">REQ_${escapeHtml(tile.id)}</span><span class="bdd-tile-value">${tile.count}</span></a>`,
        )
        .join('');

    const testTileHtml = testTiles
        .map(
            (tile) =>
                `<a class="bdd-tile test" href="${escapeHtml(linkFromTemplate(options.testCaseUrlTemplate, tile.id))}" target="_blank" rel="noopener" data-filter="test_${escapeHtml(tile.id.toLowerCase())}" onclick="filterByTile(event, 'test_${escapeHtml(tile.id.toLowerCase())}')"><span class="bdd-tile-label">TEST_${escapeHtml(tile.id)}</span><span class="bdd-tile-value">${tile.count}</span></a>`,
        )
        .join('');

    return `<!DOCTYPE html>
<html lang="en" ${getHtmlThemeAttribute(options.theme)}>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(options.reportTitle)} — BDD</title>
    <style>
        ${themeVars}
        ${darkOverrides}
        body { margin: 0; font-family: system-ui, -apple-system, Segoe UI, sans-serif; background: var(--color-canvas-subtle); color: var(--color-fg-default); }
        .bdd-header { padding: 1.5rem 2rem; background: var(--color-canvas-default); border-bottom: 1px solid var(--color-border-default); }
        .bdd-header h1 { margin: 0 0 0.25rem; font-size: 1.5rem; }
        .bdd-subtitle { margin: 0; color: var(--color-fg-muted); }
        .bdd-meta { display: flex; flex-wrap: wrap; gap: 1rem; margin-top: 1rem; font-size: 0.875rem; color: var(--color-fg-muted); }
        .bdd-dashboard { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 0.75rem; padding: 1rem 2rem; }
        .bdd-stat { background: var(--color-canvas-default); border: 1px solid var(--color-border-default); border-radius: 8px; padding: 0.75rem; text-align: center; }
        .bdd-stat strong { display: block; font-size: 1.25rem; }
        .bdd-tiles { padding: 0 2rem 1rem; display: flex; flex-wrap: wrap; gap: 0.5rem; }
        .bdd-tiles h3 { width: 100%; margin: 0.5rem 0; font-size: 0.9rem; color: var(--color-fg-muted); }
        .bdd-tile { display: inline-flex; flex-direction: column; min-width: 110px; padding: 0.5rem 0.75rem; border-radius: 8px; text-decoration: none; color: inherit; border: 1px solid var(--color-border-default); background: var(--color-canvas-default); }
        .bdd-tile.req { border-left: 4px solid #2563eb; }
        .bdd-tile.test { border-left: 4px solid #7c3aed; }
        .bdd-tile-label { font-size: 0.75rem; color: var(--color-fg-muted); }
        .bdd-tile-value { font-size: 1.1rem; font-weight: 600; }
        .bdd-toolbar { padding: 0 2rem 1rem; display: flex; gap: 0.75rem; align-items: center; flex-wrap: wrap; }
        .bdd-toolbar input { flex: 1; min-width: 200px; padding: 0.5rem 0.75rem; border-radius: 6px; border: 1px solid var(--color-border-default); }
        .bdd-main { padding: 0 2rem 2rem; }
        .bdd-feature { margin-bottom: 0.75rem; border: 1px solid var(--color-border-default); border-radius: 8px; overflow: hidden; background: var(--color-canvas-default); }
        .bdd-feature-toggle { width: 100%; display: flex; align-items: center; gap: 0.5rem; padding: 0.75rem 1rem; border: 0; background: transparent; cursor: pointer; text-align: left; color: inherit; font: inherit; }
        .bdd-feature-toggle h2 { margin: 0; flex: 1; font-size: 1rem; }
        .bdd-feature-count { font-size: 0.8rem; color: var(--color-fg-muted); }
        .bdd-feature-body { display: none; padding: 0 1rem 1rem; border-top: 1px solid var(--color-border-default); }
        .bdd-feature.open .bdd-feature-body { display: block; }
        .bdd-feature.open .bdd-feature-chevron { transform: rotate(90deg); }
        .bdd-scenario { margin-top: 0.75rem; padding: 0.75rem; border-radius: 6px; border: 1px solid var(--color-border-default); }
        .bdd-scenario.failed { border-left: 4px solid #dc2626; }
        .bdd-scenario.passed { border-left: 4px solid #16a34a; }
        .bdd-scenario.skipped { border-left: 4px solid #ca8a04; }
        .bdd-scenario-header { display: flex; align-items: center; gap: 0.5rem; }
        .bdd-scenario-title { margin: 0; flex: 1; font-size: 0.95rem; }
        .bdd-scenario-meta { margin: 0.5rem 0; font-size: 0.8rem; }
        .bdd-tag { display: inline-block; margin-right: 0.25rem; padding: 0.1rem 0.35rem; border-radius: 4px; background: var(--color-canvas-subtle); }
        .bdd-link { margin-right: 0.5rem; color: #2563eb; text-decoration: none; }
        .bdd-steps { margin: 0.5rem 0 0; padding-left: 1.25rem; }
        .bdd-step { margin: 0.25rem 0; }
        .bdd-step.failed { color: #dc2626; }
        .bdd-error { background: #fef2f2; color: #991b1b; padding: 0.5rem; border-radius: 4px; font-size: 0.8rem; overflow-x: auto; }
        .bdd-hidden { display: none !important; }
    </style>
</head>
<body>
    <header class="bdd-header">
        <h1>${escapeHtml(options.reportTitle)}</h1>
        <p class="bdd-subtitle">${escapeHtml(options.reportSubtitle)} — BDD view</p>
        <div class="bdd-meta">
            <span>Environment: <strong>${escapeHtml(environment)}</strong></span>
            <span>Author: <strong>${escapeHtml(author)}</strong></span>
            <span>Run: ${formatTime(startTime)} → ${formatTime(endTime)}</span>
            <span>Pass rate: <strong>${passRate}%</strong></span>
        </div>
    </header>
    <div class="bdd-dashboard">
        <div class="bdd-stat"><strong>${suiteStats.total}</strong>Total</div>
        <div class="bdd-stat"><strong>${suiteStats.passed}</strong>Passed</div>
        <div class="bdd-stat"><strong>${suiteStats.failed}</strong>Failed</div>
        <div class="bdd-stat"><strong>${suiteStats.skipped}</strong>Skipped</div>
    </div>
    ${reqTiles.length ? `<div class="bdd-tiles"><h3>Requirements (Jira)</h3>${reqTileHtml}</div>` : ''}
    ${testTiles.length ? `<div class="bdd-tiles"><h3>Test cases (Xray / TMS)</h3>${testTileHtml}</div>` : ''}
    <div class="bdd-toolbar">
        <label for="bdd-filter">Filter by tag, feature, REQ_, or TEST_</label>
        <input id="bdd-filter" type="search" placeholder="e.g. @smoke REQ_PROJ-1 TEST_TC-42" oninput="applyBddFilter(this.value)" />
        <button type="button" onclick="applyBddFilter('')">Clear</button>
    </div>
    <main class="bdd-main" id="bdd-main">
        ${featureSections || '<p>No scenarios recorded.</p>'}
    </main>
    <script>
        function toggleFeature(btn) {
            btn.closest('.bdd-feature').classList.toggle('open');
        }
        document.querySelectorAll('.bdd-feature').forEach((el, i) => { if (i < 3) el.classList.add('open'); });
        function applyBddFilter(query) {
            const q = (query || '').trim().toLowerCase();
            document.querySelectorAll('.bdd-scenario').forEach((el) => {
                const text = el.getAttribute('data-search') || '';
                el.classList.toggle('bdd-hidden', q && !text.includes(q));
            });
            document.querySelectorAll('.bdd-feature').forEach((feature) => {
                const visible = feature.querySelectorAll('.bdd-scenario:not(.bdd-hidden)').length;
                feature.classList.toggle('bdd-hidden', q && visible === 0);
            });
        }
        function filterByTile(event, token) {
            event.preventDefault();
            const input = document.getElementById('bdd-filter');
            input.value = token;
            applyBddFilter(token);
        }
    </script>
</body>
</html>`;
}
