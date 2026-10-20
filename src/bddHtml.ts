import { ReportRenderContext, StepData, TestData } from './types';
import {
    getCucumberChartScript,
    getCucumberChartScriptTag,
    getCucumberChromeStyles,
    renderCucumberChromeFromContext,
} from './cucumberReportChrome';
import { getHtmlThemeAttribute } from './reportThemes';

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
        return '<tr><td colspan="2" class="bdd-muted">No scenario steps recorded</td></tr>';
    }
    return flat
        .map(
            (step, index) => `
            <tr class="bdd-step-row ${step.status}">
                <td class="bdd-step-num">${index + 1}</td>
                <td>
                    <span class="bdd-step-icon">${step.status === 'passed' ? '✓' : step.status === 'failed' ? '✗' : '○'}</span>
                    ${escapeHtml(step.title)}
                </td>
            </tr>`,
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

function featureStatus(scenarios: TestData[]): 'passed' | 'failed' | 'skipped' {
    if (scenarios.some((s) => s.status !== 'passed' && s.status !== 'skipped')) return 'failed';
    if (scenarios.every((s) => s.status === 'skipped')) return 'skipped';
    return 'passed';
}

export function renderBddHtml(context: ReportRenderContext): string {
    const { options, testResults } = context;
    const chrome = renderCucumberChromeFromContext(context, 'BDD report');

    const features = groupByFeature(testResults);
    const reqTiles = collectRequirementTiles(testResults);
    const testTiles = collectTestCaseTiles(testResults);

    const featureSections = [...features.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([featureName, scenarios]) => {
            const status = featureStatus(scenarios);
            const scenarioRows = scenarios
                .map((test) => {
                    const scenarioStatus =
                        test.status === 'passed' ? 'passed' : test.status === 'skipped' ? 'skipped' : 'failed';
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
                    <div class="bdd-scenario ${scenarioStatus}" data-search="${escapeHtml(collectSearchText(test))}">
                        <div class="bdd-scenario-head">
                            <span class="bdd-status-pill ${scenarioStatus}">${scenarioStatus}</span>
                            <h3>${escapeHtml(test.title)}</h3>
                            <span class="bdd-duration">${formatDuration(test.duration)}</span>
                        </div>
                        <div class="bdd-scenario-links">${reqLinks} ${testLinks}
                            ${test.tags.map((t) => `<span class="bdd-tag">${escapeHtml(t)}</span>`).join(' ')}
                        </div>
                        <table class="bdd-step-table">
                            <thead><tr><th>#</th><th>Step</th></tr></thead>
                            <tbody>${renderScenarioSteps(test.steps)}</tbody>
                        </table>
                        ${test.error ? `<pre class="bdd-error">${escapeHtml(test.error)}</pre>` : ''}
                    </div>`;
                })
                .join('');
            return `
            <section class="bdd-feature-panel ${status}" data-feature="${escapeHtml(featureName.toLowerCase())}">
                <button type="button" class="bdd-feature-bar" onclick="toggleBddFeature(this)">
                    <span class="bdd-feature-chevron">▶</span>
                    <span class="bdd-feature-name">Feature: ${escapeHtml(featureName)}</span>
                    <span class="bdd-feature-meta">${scenarios.length} scenarios · <span class="bdd-status-pill ${status}">${status}</span></span>
                </button>
                <div class="bdd-feature-content">${scenarioRows}</div>
            </section>`;
        })
        .join('');

    const reqTileHtml = reqTiles
        .map(
            (tile) =>
                `<a class="bdd-ext-tile req" href="${escapeHtml(linkFromTemplate(options.jiraIssueUrlTemplate, tile.id))}" target="_blank" rel="noopener" onclick="filterByTile(event, 'req_${escapeHtml(tile.id.toLowerCase())}')"><span>REQ_${escapeHtml(tile.id)}</span><strong>${tile.count}</strong></a>`,
        )
        .join('');

    const testTileHtml = testTiles
        .map(
            (tile) =>
                `<a class="bdd-ext-tile test" href="${escapeHtml(linkFromTemplate(options.testCaseUrlTemplate, tile.id))}" target="_blank" rel="noopener" onclick="filterByTile(event, 'test_${escapeHtml(tile.id.toLowerCase())}')"><span>TEST_${escapeHtml(tile.id)}</span><strong>${tile.count}</strong></a>`,
        )
        .join('');

    return `<!DOCTYPE html>
<html lang="en" ${getHtmlThemeAttribute(options.theme)}>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(options.reportTitle)} — BDD</title>
    <style>
        ${getCucumberChromeStyles()}
        ${getBddStyles()}
    </style>
    ${getCucumberChartScriptTag()}
</head>
<body class="mc-report">
    ${chrome.header}
    ${chrome.overview}
    ${chrome.charts}

    ${reqTiles.length || testTiles.length ? `
    <section class="mc-content-shell bdd-ext-tiles">
        ${reqTiles.length ? `<div class="bdd-ext-group"><h4>Requirements</h4><div class="bdd-ext-row">${reqTileHtml}</div></div>` : ''}
        ${testTiles.length ? `<div class="bdd-ext-group"><h4>Test cases</h4><div class="bdd-ext-row">${testTileHtml}</div></div>` : ''}
    </section>` : ''}

    <section class="mc-content-shell bdd-toolbar">
        <label for="bdd-filter">Filter features / scenarios</label>
        <input id="bdd-filter" type="search" placeholder="Tag, REQ_, TEST_, feature name..." oninput="applyBddFilter(this.value)" />
        <button type="button" class="bdd-btn" onclick="applyBddFilter('')">Clear</button>
    </section>

    <main class="mc-content-shell bdd-features" id="bdd-main">
        ${featureSections || '<p class="bdd-muted">No scenarios recorded.</p>'}
    </main>

    <script>
        function toggleBddFeature(btn) {
            btn.closest('.bdd-feature-panel').classList.toggle('open');
        }
        document.querySelectorAll('.bdd-feature-panel').forEach((el, i) => { if (i < 4) el.classList.add('open'); });
        function applyBddFilter(query) {
            const q = (query || '').trim().toLowerCase();
            document.querySelectorAll('.bdd-scenario').forEach((el) => {
                const text = el.getAttribute('data-search') || '';
                el.classList.toggle('bdd-hidden', q && !text.includes(q));
            });
            document.querySelectorAll('.bdd-feature-panel').forEach((feature) => {
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
        ${getCucumberChartScript()}
    </script>
</body>
</html>`;
}

function getBddStyles(): string {
    return `
        .bdd-ext-tiles { padding-top: 8px; }
        .bdd-ext-group h4 { margin: 0 0 8px; font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.07em; color: var(--mc-muted); }
        .bdd-ext-row { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 14px; }
        .bdd-ext-tile {
            display: flex; flex-direction: column; min-width: 120px; padding: 10px 12px;
            border-radius: 6px; text-decoration: none; color: var(--mc-text);
            background: var(--mc-card-bg); border: 1px solid var(--mc-border);
            box-shadow: 0 1px 4px rgba(0,0,0,0.06);
        }
        .bdd-ext-tile.req { border-top: 3px solid #1e88e5; }
        .bdd-ext-tile.test { border-top: 3px solid #8e24aa; }
        .bdd-ext-tile span { font-size: 0.72rem; color: var(--mc-muted); }
        .bdd-ext-tile strong { font-size: 1.2rem; margin-top: 4px; }
        .bdd-toolbar { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; padding-bottom: 8px; }
        .bdd-toolbar label { font-size: 0.8rem; font-weight: 600; color: var(--mc-muted); }
        .bdd-toolbar input {
            flex: 1; min-width: 220px; padding: 10px 12px; border-radius: 6px;
            border: 1px solid var(--mc-border); font-size: 0.95rem;
        }
        .bdd-btn {
            padding: 10px 16px; border-radius: 6px; border: 0;
            background: var(--mc-teal); color: #fff; font-weight: 600; cursor: pointer;
        }
        .bdd-features { padding-bottom: 40px; }
        .bdd-feature-panel {
            margin-bottom: 14px; border-radius: 6px; overflow: hidden;
            border: 1px solid var(--mc-border); box-shadow: 0 2px 6px rgba(0,0,0,0.06);
            background: var(--mc-card-bg);
        }
        .bdd-feature-bar {
            width: 100%; border: 0; cursor: pointer; text-align: left;
            display: flex; align-items: center; gap: 10px; padding: 12px 16px;
            background: linear-gradient(90deg, #2e7d32 0%, #388e3c 55%, #43a047 100%);
            color: #fff; font: inherit;
        }
        .bdd-feature-panel.failed .bdd-feature-bar {
            background: linear-gradient(90deg, #b71c1c 0%, #c62828 55%, #d32f2f 100%);
        }
        .bdd-feature-panel.skipped .bdd-feature-bar {
            background: linear-gradient(90deg, #e65100 0%, #ef6c00 55%, #f57c00 100%);
        }
        .bdd-feature-name { flex: 1; font-weight: 700; font-size: 0.95rem; }
        .bdd-feature-meta { font-size: 0.8rem; opacity: 0.95; }
        .bdd-feature-chevron { transition: transform 0.2s; }
        .bdd-feature-panel.open .bdd-feature-chevron { transform: rotate(90deg); }
        .bdd-feature-content { display: none; padding: 12px 16px 16px; background: #fafafa; }
        .bdd-feature-panel.open .bdd-feature-content { display: block; }
        .bdd-scenario {
            margin-top: 12px; padding: 12px; border-radius: 6px;
            background: #fff; border: 1px solid #e0e0e0;
        }
        .bdd-scenario.failed { border-left: 4px solid var(--mc-failed); }
        .bdd-scenario.passed { border-left: 4px solid var(--mc-passed); }
        .bdd-scenario.skipped { border-left: 4px solid var(--mc-skipped); }
        .bdd-scenario-head { display: flex; align-items: center; gap: 10px; }
        .bdd-scenario-head h3 { margin: 0; flex: 1; font-size: 0.95rem; }
        .bdd-duration { font-size: 0.8rem; color: var(--mc-muted); }
        .bdd-scenario-links { margin: 8px 0; font-size: 0.8rem; }
        .bdd-link { margin-right: 8px; color: #1565c0; text-decoration: none; font-weight: 600; }
        .bdd-tag {
            display: inline-block; margin-right: 4px; padding: 2px 6px; border-radius: 4px;
            background: #eceff1; font-size: 0.75rem;
        }
        .bdd-status-pill {
            display: inline-block; padding: 2px 8px; border-radius: 999px;
            font-size: 0.68rem; text-transform: uppercase; font-weight: 700; letter-spacing: 0.04em;
            background: #e8f5e9; color: #2e7d32;
        }
        .bdd-status-pill.failed { background: #ffebee; color: #c62828; }
        .bdd-status-pill.skipped { background: #fff3e0; color: #e65100; }
        .bdd-step-table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 0.85rem; }
        .bdd-step-table th { text-align: left; padding: 6px 8px; background: #f5f5f5; border-bottom: 1px solid #e0e0e0; }
        .bdd-step-table td { padding: 6px 8px; border-bottom: 1px solid #f0f0f0; }
        .bdd-step-num { width: 36px; color: var(--mc-muted); }
        .bdd-step-row.failed td { color: var(--mc-failed); }
        .bdd-step-icon { margin-right: 6px; font-weight: 700; }
        .bdd-error {
            margin-top: 8px; padding: 8px; border-radius: 4px;
            background: #ffebee; color: #b71c1c; font-size: 0.78rem; overflow-x: auto;
        }
        .bdd-muted { color: var(--mc-muted); }
        .bdd-hidden { display: none !important; }
    `;
}
