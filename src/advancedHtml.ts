import { ReportRenderContext, StepData, TestData } from './types';
import { getTraceCliCommand } from './traceViewerAssets';
import {
    getCucumberChartScript,
    getCucumberChartScriptTag,
    getCucumberChromeStyles,
    renderCucumberChromeFromContext,
} from './cucumberReportChrome';
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
    return `${remainingSeconds}s`;
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

function formatVideoTime(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const milliseconds = Math.floor((ms % 1000) / 10);
    return `${minutes}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(2, '0')}`;
}

function categoryLabel(category: string): string {
    switch (category) {
        case 'test.step':
            return 'Step';
        case 'pw:api':
            return 'API';
        case 'expect':
            return 'Expect';
        case 'fixture':
            return 'Fixture';
        case 'hook':
            return 'Hook';
        case 'test.attach':
            return 'Attach';
        default:
            return category;
    }
}

function getTestFilterTags(test: TestData): string {
    return [
        ...test.tags,
        test.title,
        test.fullTitle,
        ...test.describePath,
    ].join(' ').toLowerCase();
}

function getNormalizedStatus(test: TestData): 'passed' | 'failed' | 'skipped' {
    if (test.status === 'passed') {
        return 'passed';
    }
    if (test.status === 'skipped') {
        return 'skipped';
    }
    return 'failed';
}

function renderStepTreeHtml(steps: StepData[], depth = 0, hasVideo = false): string {
    return steps.map((step) => {
        const hasChildren = !!step.children?.length;
        const hasDetails = !!(step.error || step.screenshot || step.consoleLogs?.length || step.stackTrace);
        const expandable = hasChildren || hasDetails;
        const stepDomId = `${step.id}-${depth}`;

        let html = `
            <div class="pw-step" data-step-title="${escapeHtml(step.title.toLowerCase())}">
                <div class="pw-step-row ${expandable ? 'expandable' : ''} ${step.status}" ${expandable ? `onclick="togglePwStep('${stepDomId}')"` : ''}>
                    <span class="pw-step-expander">${expandable ? '▶' : ''}</span>
                    <span class="pw-step-status ${step.status}">${step.status === 'passed' ? '✓' : step.status === 'failed' ? '✗' : '○'}</span>
                    <span class="pw-step-category">${escapeHtml(categoryLabel(step.category))}</span>
                    <span class="pw-step-title">${escapeHtml(step.title)}</span>
                    <span class="pw-step-duration">${formatDuration(step.duration)}</span>
                </div>`;

        if (expandable) {
            html += `<div class="pw-step-body" id="${stepDomId}" style="display:none;">`;
            html += `
                <div class="pw-step-meta">
                    <span>Started: ${escapeHtml(step.startTime || 'N/A')}</span>
                    <span>Duration: ${formatDuration(step.duration)}</span>
                    ${hasVideo ? `<span>Video: ${formatVideoTime(step.videoStartTime || 0)} - ${formatVideoTime(step.videoEndTime || 0)}</span>` : ''}
                </div>`;

            if (step.consoleLogs?.length) {
                html += `<div class="pw-step-console"><div class="pw-step-console-title">Console</div>`;
                for (const log of step.consoleLogs) {
                    html += `<div class="pw-console-line">${escapeHtml(log)}</div>`;
                }
                html += `</div>`;
            }

            if (step.screenshot) {
                html += `
                    <div class="pw-step-screenshot">
                        <a href="${step.screenshot}" target="_blank">
                            <img src="${step.screenshot}" alt="Step screenshot" />
                        </a>
                    </div>`;
            }

            if (step.error) {
                html += `<div class="pw-step-error">${escapeHtml(step.error)}</div>`;
            }

            if (step.stackTrace) {
                html += `<pre class="pw-step-stack">${escapeHtml(step.stackTrace)}</pre>`;
            }

            if (hasChildren) {
                html += `<div class="pw-step-children">${renderStepTreeHtml(step.children!, depth + 1, hasVideo)}</div>`;
            }

            html += `</div>`;
        }

        html += `</div>`;
        return html;
    }).join('');
}

function renderTestDetailHtml(test: TestData, author: string): string {
    const statusClass = getNormalizedStatus(test);
    const statusText = test.status === 'timedOut' ? 'Timed Out' : test.status.charAt(0).toUpperCase() + test.status.slice(1);

    let html = `
        <div class="detail-header">
            <div>
                <div class="detail-breadcrumb">${escapeHtml(test.fullTitle)}</div>
                <h2 class="detail-title">${escapeHtml(test.title)}</h2>
            </div>
            <span class="status-badge ${statusClass}">${statusText}</span>
        </div>
        <div class="detail-meta-grid">
            <div><strong>File</strong><span>${escapeHtml(test.location)}</span></div>
            <div><strong>Duration</strong><span>${formatDuration(test.duration)}</span></div>
            <div><strong>Author</strong><span>${escapeHtml(author)}</span></div>
            <div><strong>Tags</strong><span>${test.tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join(' ') || '—'}</span></div>
        </div>`;

    if (test.error) {
        html += `
            <section class="detail-section">
                <h3>Errors</h3>
                <div class="error-box">
                    <pre>${escapeHtml(test.error)}</pre>
                    ${test.errorStack ? `<details><summary>Call Stack</summary><pre>${escapeHtml(test.errorStack)}</pre></details>` : ''}
                </div>
            </section>`;
    }

    if (test.steps.length > 0) {
        html += `
            <section class="detail-section">
                <div class="section-heading">
                    <h3>Test Steps</h3>
                    <input type="search" class="step-filter" placeholder="Filter steps..." oninput="filterSteps(this.value)" />
                </div>
                <div class="pw-step-tree" id="step-tree">${renderStepTreeHtml(test.steps, 0, !!test.video)}</div>
            </section>`;
    }

    if (test.screenshots.length > 0) {
        html += `<section class="detail-section"><h3>Screenshots</h3><div class="artifact-grid">`;
        for (const screenshot of test.screenshots) {
            html += `
                <a class="artifact-card" href="${screenshot.path}" target="_blank">
                    <img src="${screenshot.path}" alt="${escapeHtml(screenshot.name)}" />
                    <span>${escapeHtml(screenshot.name)}</span>
                </a>`;
        }
        html += `</div></section>`;
    }

    if (test.video) {
        html += `
            <section class="detail-section">
                <h3>Video</h3>
                <video controls class="detail-video" src="${test.video}"></video>
                <a href="${test.video}" target="_blank">Open video</a>
            </section>`;
    }

    if (test.trace) {
        const traceCli = getTraceCliCommand(test.trace);
        html += `
            <section class="detail-section">
                <h3>Trace</h3>
                <div class="trace-actions">
                    <a class="btn btn-primary" href="${test.trace}" download>Download Trace</a>
                    <button class="btn btn-secondary" type="button" onclick="openTrace(event, '${test.trace}')">Open in Trace Viewer</button>
                    <button class="btn btn-secondary" type="button" onclick="copyTraceCommand(${JSON.stringify(traceCli)})">Copy CLI Command</button>
                </div>
                <p class="trace-hint">This report is fully static. Open traces locally with <code>${escapeHtml(traceCli)}</code>.</p>
            </section>`;
    }

    return html;
}

function groupTestsByFile(tests: TestData[]): Map<string, TestData[]> {
    const groups = new Map<string, TestData[]>();
    for (const test of tests) {
        const fileKey = test.file;
        if (!groups.has(fileKey)) {
            groups.set(fileKey, []);
        }
        groups.get(fileKey)!.push(test);
    }
    return groups;
}

export function renderAdvancedHtml(context: ReportRenderContext): string {
    const totalDuration = context.endTime.getTime() - context.startTime.getTime();
    const chrome = renderCucumberChromeFromContext(context, 'Standard report');
    const groupedTests = groupTestsByFile(context.testResults);

    const sidebarHtml = Array.from(groupedTests.entries()).map(([file, tests]) => {
        const fileLabel = file.split(/[\\/]/).pop() || file;
        const items = tests.map((test) => {
            const statusClass = getNormalizedStatus(test);
            return `
                <button type="button"
                    class="sidebar-test ${statusClass}"
                    data-test-id="${test.id}"
                    data-status="${statusClass}"
                    data-tags="${escapeHtml(getTestFilterTags(test))}"
                    onclick="selectTest('${test.id}')">
                    <span class="sidebar-test-status"></span>
                    <span class="sidebar-test-title">${escapeHtml(test.title)}</span>
                    <span class="sidebar-test-duration">${formatDuration(test.duration)}</span>
                </button>`;
        }).join('');

        return `
            <div class="sidebar-file" data-file="${escapeHtml(fileLabel.toLowerCase())}">
                <div class="sidebar-file-title">${escapeHtml(fileLabel)}</div>
                ${items}
            </div>`;
    }).join('');

    const detailTemplates = context.testResults.map((test) => `
        <template id="detail-template-${test.id}">
            ${renderTestDetailHtml(test, context.author)}
        </template>`).join('');

    const reportJson = JSON.stringify({
        tests: context.testResults.map((test) => ({
            id: test.id,
            title: test.title,
            status: getNormalizedStatus(test),
            tags: getTestFilterTags(test),
            file: test.file,
        })),
        defaultTestId: context.testResults.find((test) => test.status === 'failed' || test.status === 'timedOut')?.id
            || context.testResults[0]?.id
            || null,
    });

    const refreshMeta = context.liveRefreshSeconds > 0
        ? `<meta http-equiv="refresh" content="${context.liveRefreshSeconds}">`
        : '';

    return `<!DOCTYPE html>
<html lang="en" ${getHtmlThemeAttribute(context.options.theme)}>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    ${refreshMeta}
    <title>🎭 ${escapeHtml(context.options.reportTitle)}</title>
    <style>${getCucumberChromeStyles()}${getAdvancedStyles()}</style>
    ${getCucumberChartScriptTag()}
</head>
<body class="mc-report">
    ${chrome.header}
    ${chrome.overview}
    ${chrome.charts}

    <section class="dashboard-row mc-content-shell">
        <aside class="duration-chip">
            <span>Duration</span>
            <strong>${formatDuration(totalDuration)}</strong>
        </aside>

        <aside class="filters-panel">
            <div class="filters-title">Filters</div>
            <div class="filters-row">
                <div class="filter-group">
                    <strong>Status</strong>
                    <div class="filter-options">
                        <label><input type="checkbox" class="status-filter" value="all" checked onchange="filterByStatus(this)"><span>All</span></label>
                        <label><input type="checkbox" class="status-filter" value="passed" onchange="filterByStatus(this)"><span>Passed</span></label>
                        <label><input type="checkbox" class="status-filter" value="failed" onchange="filterByStatus(this)"><span>Failed</span></label>
                        <label><input type="checkbox" class="status-filter" value="skipped" onchange="filterByStatus(this)"><span>Skipped</span></label>
                    </div>
                </div>
                <div class="filter-group">
                    <strong>Suite</strong>
                    <div class="filter-options">
                        <label><input type="checkbox" class="group-filter" value="all" checked onchange="filterByGroup(this)"><span>All</span></label>
                        <label><input type="checkbox" class="group-filter" value="smoke" onchange="filterByGroup(this)"><span>Smoke</span></label>
                        <label><input type="checkbox" class="group-filter" value="regression" onchange="filterByGroup(this)"><span>Regression</span></label>
                        <label><input type="checkbox" class="group-filter" value="functional" onchange="filterByGroup(this)"><span>Functional</span></label>
                    </div>
                </div>
            </div>
        </aside>
    </section>

    <section class="meta-section mc-content-shell">
        <div class="meta-item">
            <span class="meta-label">Environment</span>
            <span class="env-badge">🌐 ${escapeHtml(context.environment.toUpperCase())}</span>
        </div>
        <div class="meta-item">
            <span class="meta-label">Browser</span>
            <span class="browser-badge">🌍 ${escapeHtml(context.browserName)}</span>
        </div>
        <div class="meta-item">
            <span class="meta-label">Platform</span>
            <span class="meta-value">${escapeHtml(context.platform)}</span>
        </div>
        <div class="meta-item">
            <span class="meta-label">Run ID</span>
            <span class="meta-value run-id">${escapeHtml(context.runId)}</span>
        </div>
        <div class="meta-item">
            <span class="meta-label">Started</span>
            <span class="meta-value">${formatTime(context.startTime)}</span>
        </div>
    </section>

    <div class="app-layout">
        <aside class="sidebar">
            <div class="sidebar-toolbar">
                <input type="search" id="test-search" placeholder="Search tests..." oninput="applySidebarFilters()" />
            </div>
            <div class="sidebar-content" id="sidebar-content">
                ${sidebarHtml || '<div class="empty-state">No tests yet</div>'}
            </div>
        </aside>
        <main class="detail-pane" id="detail-pane">
            <div class="empty-state">
                <h2>Select a test</h2>
                <p>Choose a scenario from the left to drill into steps, attachments, and traces.</p>
            </div>
        </main>
    </div>

    ${detailTemplates}

    <footer class="report-footer">
        <p>Advanced Automation Report | Fully static HTML — no server required</p>
    </footer>

    <script>
        const reportData = ${reportJson};
        ${getAdvancedScripts()}
        ${getCucumberChartScript()}
    </script>
</body>
</html>`;
}

function getAdvancedStyles(): string {
    return `
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
        ${getAdvancedThemeVariables()}
        ${getAdvancedDarkComponentOverrides()}
        * { box-sizing: border-box; }
        body {
            margin: 0;
            font-family: Inter, Segoe UI, sans-serif;
        }
        .dashboard-row {
            display: grid;
            grid-template-columns: 160px 1fr;
            gap: 20px;
            padding-top: 8px;
            align-items: stretch;
        }
        .duration-chip {
            border-radius: 6px;
            padding: 18px 16px;
            box-shadow: var(--shadow);
            border: 1px solid var(--border);
            background: var(--panel);
            text-align: center;
            border-top: 4px solid var(--mc-teal, #236b6b);
        }
        .duration-chip span {
            display: block;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.06em;
            color: var(--muted);
            font-weight: 600;
        }
        .duration-chip strong {
            display: block;
            margin-top: 8px;
            font-size: 1.35rem;
            color: var(--text);
        }
        .filters-panel {
            border-radius: 16px;
            padding: 18px;
            box-shadow: var(--shadow);
            border: 1px solid var(--border);
        }
        .filters-title {
            font-size: 13px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.06em;
            color: var(--muted);
            margin-bottom: 14px;
        }
        .filters-row {
            display: flex;
            flex-wrap: wrap;
            gap: 16px;
        }
        .filter-group {
            flex: 1 1 0;
            min-width: 0;
        }
        .filter-group strong {
            display: block;
            font-size: 11px;
            color: var(--muted);
            margin-bottom: 8px;
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }
        .filter-options {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
        }
        .filter-group label {
            display: inline-flex;
            align-items: center;
            gap: 5px;
            padding: 5px 9px;
            border-radius: 8px;
            cursor: pointer;
            font-size: 12px;
            font-weight: 500;
            border: 1px solid transparent;
            white-space: nowrap;
        }
        .filter-group label:hover { border-color: #bbf7d0; }
        .filter-group input[type="checkbox"] { accent-color: var(--primary); }
        .meta-section {
            display: flex;
            flex-wrap: wrap;
            gap: 18px;
            margin: 20px 28px 0;
            padding: 18px 22px;
            border-radius: 16px;
            box-shadow: var(--shadow);
            border: 1px solid var(--border);
        }
        .meta-item { display: flex; align-items: center; gap: 10px; }
        .meta-label {
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.06em;
            color: var(--muted);
            font-weight: 700;
        }
        .meta-value { font-weight: 600; color: var(--text); }
        .run-id { font-family: "JetBrains Mono", monospace; font-size: 12px; }
        .env-badge, .browser-badge {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 7px 14px;
            border-radius: 999px;
            font-size: 12px;
            font-weight: 700;
            text-transform: uppercase;
        }
        .env-badge {
            background: linear-gradient(135deg, var(--primary-light) 0%, var(--primary) 100%);
            color: white;
        }
        .browser-badge {
            background: #f1f5f9;
            color: var(--text);
            border: 1px solid var(--border);
        }
        .app-layout {
            display: grid;
            grid-template-columns: 360px 1fr;
            gap: 0;
            min-height: calc(100vh - 420px);
            margin-top: 20px;
        }
        .sidebar {
            border-top: 1px solid var(--border);
            border-right: 1px solid var(--border);
            display: flex;
            flex-direction: column;
        }
        .sidebar-toolbar {
            padding: 16px;
            border-bottom: 1px solid var(--border);
        }
        .sidebar-toolbar input, .step-filter {
            width: 100%;
            padding: 10px 12px;
            border: 1px solid var(--border);
            border-radius: 10px;
            font-size: 14px;
        }
        .sidebar-content { overflow: auto; padding: 8px; }
        .sidebar-file { margin-bottom: 16px; }
        .sidebar-file-title {
            padding: 8px 12px;
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0.04em;
            color: var(--muted);
            font-weight: 700;
        }
        .sidebar-test {
            width: 100%;
            display: grid;
            grid-template-columns: 12px 1fr auto;
            gap: 10px;
            align-items: center;
            padding: 12px;
            border: none;
            background: transparent;
            text-align: left;
            border-radius: 10px;
            cursor: pointer;
        }
        .sidebar-test:hover, .sidebar-test.active { background: var(--primary-bg); }
        .sidebar-test-status {
            width: 10px;
            height: 10px;
            border-radius: 50%;
            background: var(--skipped);
        }
        .sidebar-test.passed .sidebar-test-status { background: var(--passed); }
        .sidebar-test.failed .sidebar-test-status { background: var(--failed); }
        .sidebar-test-title { font-size: 14px; font-weight: 600; }
        .sidebar-test-duration { font-size: 12px; color: var(--muted); }
        .detail-pane {
            border-top: 1px solid var(--border);
            padding: 24px 28px;
            overflow: auto;
        }
        .empty-state { color: var(--muted); padding: 48px 12px; }
        .detail-header {
            display: flex;
            justify-content: space-between;
            gap: 16px;
            align-items: flex-start;
            margin-bottom: 20px;
        }
        .detail-breadcrumb { color: var(--muted); font-size: 13px; margin-bottom: 8px; }
        .detail-title { margin: 0; font-size: 24px; }
        .status-badge {
            padding: 8px 14px;
            border-radius: 999px;
            font-size: 12px;
            font-weight: 700;
            text-transform: uppercase;
        }
        .status-badge.passed { background: #dcfce7; color: var(--passed); }
        .status-badge.failed { background: #fee2e2; color: var(--failed); }
        .status-badge.skipped { background: #e2e8f0; color: var(--skipped); }
        .detail-meta-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
            gap: 12px;
            margin-bottom: 24px;
        }
        .detail-meta-grid div {
            border: 1px solid var(--border);
            border-radius: 10px;
            padding: 12px;
        }
        .detail-meta-grid strong {
            display: block;
            font-size: 11px;
            text-transform: uppercase;
            color: var(--muted);
            margin-bottom: 6px;
        }
        .detail-section {
            margin-bottom: 28px;
            padding-top: 8px;
            border-top: 1px solid var(--border);
        }
        .detail-section h3 { margin: 0 0 14px; }
        .section-heading {
            display: flex;
            justify-content: space-between;
            gap: 12px;
            align-items: center;
            margin-bottom: 14px;
        }
        .section-heading h3 { margin: 0; }
        .pw-step-tree { border: 1px solid var(--border); border-radius: 12px; overflow: hidden; }
        .pw-step { border-bottom: 1px solid var(--border); }
        .pw-step:last-child { border-bottom: none; }
        .pw-step-row {
            display: grid;
            grid-template-columns: 18px 18px 72px 1fr auto;
            gap: 10px;
            align-items: center;
            padding: 12px 14px;
        }
        .pw-step-row.expandable { cursor: pointer; }
        .pw-step-row.failed { background: #fef2f2; }
        .pw-step-status.passed { color: var(--passed); }
        .pw-step-status.failed { color: var(--failed); }
        .pw-step-category {
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            color: var(--muted);
        }
        .pw-step-title { font-size: 14px; font-weight: 500; }
        .pw-step-duration { font-size: 12px; color: var(--muted); font-family: monospace; }
        .pw-step-body { padding: 0 16px 16px 56px; }
        .pw-step-meta {
            display: flex;
            flex-wrap: wrap;
            gap: 16px;
            font-size: 12px;
            color: var(--muted);
            margin-bottom: 12px;
        }
        .pw-step-console, .pw-step-error, .pw-step-stack, .pw-step-screenshot { margin-top: 12px; }
        .pw-step-console-title { font-weight: 700; margin-bottom: 8px; }
        .pw-console-line, .pw-step-stack, .error-box pre {
            font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
            font-size: 12px;
            white-space: pre-wrap;
            word-break: break-word;
        }
        .pw-step-console, .error-box pre, .pw-step-stack {
            background: #0f172a;
            color: #cbd5e1;
            padding: 12px;
            border-radius: 8px;
        }
        .pw-step-error {
            background: #fee2e2;
            color: #991b1b;
            padding: 12px;
            border-radius: 8px;
        }
        .pw-step-screenshot img, .detail-video, .artifact-card img {
            max-width: 100%;
            border-radius: 10px;
            border: 1px solid var(--border);
        }
        .artifact-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
            gap: 16px;
        }
        .artifact-card {
            display: block;
            text-decoration: none;
            color: inherit;
            border: 1px solid var(--border);
            border-radius: 12px;
            overflow: hidden;
        }
        .artifact-card span {
            display: block;
            padding: 10px 12px;
            font-size: 13px;
        }
        .trace-actions { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 10px; }
        .btn {
            border: none;
            border-radius: 8px;
            padding: 10px 14px;
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
            text-decoration: none;
            display: inline-flex;
            align-items: center;
        }
        .btn-primary { background: var(--primary); color: #fff; }
        .btn-secondary { background: #e2e8f0; color: var(--text); }
        .trace-hint { color: var(--muted); font-size: 13px; }
        .tag {
            display: inline-block;
            margin-right: 4px;
            padding: 2px 8px;
            border-radius: 999px;
            background: var(--primary-bg);
            color: var(--primary);
            font-size: 11px;
            font-weight: 700;
        }
        .report-footer {
            padding: 18px 28px;
            color: var(--muted);
            font-size: 13px;
        }
        @media (max-width: 1100px) {
            .dashboard-row { grid-template-columns: 1fr; }
            .stats-dashboard { grid-template-columns: repeat(2, minmax(120px, 1fr)); }
        }
        @media (max-width: 960px) {
            .app-layout { grid-template-columns: 1fr; }
            .sidebar { border-right: none; max-height: 320px; }
        }
    `;
}

function getAdvancedScripts(): string {
    return `
        function selectTest(testId, pushHash = true) {
            const template = document.getElementById('detail-template-' + testId);
            const pane = document.getElementById('detail-pane');
            if (!template || !pane) return;

            document.querySelectorAll('.sidebar-test').forEach((button) => {
                button.classList.toggle('active', button.getAttribute('data-test-id') === testId);
            });

            pane.innerHTML = template.innerHTML;
            if (pushHash) {
                history.replaceState(null, '', '#?testId=' + encodeURIComponent(testId));
            }
        }

        function filterByStatus(checkbox) {
            const allCheckbox = document.querySelector('.status-filter[value="all"]');
            if (checkbox.value === 'all') {
                if (checkbox.checked) {
                    document.querySelectorAll('.status-filter:not([value="all"])').forEach((item) => {
                        item.checked = false;
                    });
                }
            } else if (checkbox.checked && allCheckbox) {
                allCheckbox.checked = false;
                const anyChecked = document.querySelectorAll('.status-filter:not([value="all"]):checked').length > 0;
                if (!anyChecked && allCheckbox) {
                    allCheckbox.checked = true;
                }
            }
            if (!checkbox.checked && checkbox.value !== 'all') {
                const anyChecked = document.querySelectorAll('.status-filter:not([value="all"]):checked').length > 0;
                if (!anyChecked && allCheckbox) {
                    allCheckbox.checked = true;
                }
            }
            applySidebarFilters();
        }

        function filterByGroup(checkbox) {
            const allCheckbox = document.querySelector('.group-filter[value="all"]');
            if (checkbox.value === 'all') {
                if (checkbox.checked) {
                    document.querySelectorAll('.group-filter:not([value="all"])').forEach((item) => {
                        item.checked = false;
                    });
                }
            } else if (checkbox.checked && allCheckbox) {
                allCheckbox.checked = false;
            }
            if (!checkbox.checked && checkbox.value !== 'all') {
                const anyChecked = document.querySelectorAll('.group-filter:not([value="all"]):checked').length > 0;
                if (!anyChecked && allCheckbox) {
                    allCheckbox.checked = true;
                }
            }
            applySidebarFilters();
        }

        function applySidebarFilters() {
            const searchQuery = document.getElementById('test-search')?.value.trim().toLowerCase() || '';
            const statusAll = document.querySelector('.status-filter[value="all"]')?.checked;
            const groupAll = document.querySelector('.group-filter[value="all"]')?.checked;
            const statusFilters = Array.from(document.querySelectorAll('.status-filter:not([value="all"]):checked')).map((item) => item.value);
            const groupFilters = Array.from(document.querySelectorAll('.group-filter:not([value="all"]):checked')).map((item) => item.value);

            document.querySelectorAll('.sidebar-test').forEach((button) => {
                const title = button.querySelector('.sidebar-test-title')?.textContent?.toLowerCase() || '';
                const tags = button.getAttribute('data-tags') || '';
                const status = button.getAttribute('data-status') || '';

                const searchMatch = !searchQuery || title.includes(searchQuery) || tags.includes(searchQuery);
                const statusMatch = statusAll || statusFilters.includes(status);
                const groupMatch = groupAll || groupFilters.some((filterValue) => tags.includes(filterValue));

                button.style.display = searchMatch && statusMatch && groupMatch ? '' : 'none';
            });

            document.querySelectorAll('.sidebar-file').forEach((fileGroup) => {
                const visibleTests = fileGroup.querySelectorAll('.sidebar-test:not([style*="display: none"])').length
                    || fileGroup.querySelectorAll('.sidebar-test').length && Array.from(fileGroup.querySelectorAll('.sidebar-test')).some((button) => button.style.display !== 'none');
                fileGroup.style.display = visibleTests ? '' : 'none';
            });
        }

        function filterSteps(query) {
            const normalized = query.trim().toLowerCase();
            document.querySelectorAll('.pw-step').forEach((step) => {
                const title = step.getAttribute('data-step-title') || '';
                step.style.display = !normalized || title.includes(normalized) ? '' : 'none';
            });
        }

        function togglePwStep(stepId) {
            const body = document.getElementById(stepId);
            if (!body) return;
            body.style.display = body.style.display === 'none' ? 'block' : 'none';
        }

        function openTrace(e, tracePath) {
            e.preventDefault();
            e.stopPropagation();
            if (window.location.protocol === 'file:') {
                alert("CORS Restriction:\\nSince the report is opened via the file:// protocol, browser security policies prevent the online trace viewer from loading the local trace file directly.\\n\\nTo view this trace:\\n1. Download the trace file.\\n2. Open https://trace.playwright.dev in your browser.\\n3. Drag and drop the downloaded trace file into the page.");
            } else {
                const traceUrl = new URL(tracePath, window.location.href).href;
                window.open('https://trace.playwright.dev/?trace=' + encodeURIComponent(traceUrl), '_blank');
            }
        }

        function copyTraceCommand(command) {
            navigator.clipboard.writeText(command).catch(() => {});
        }

        function readTestIdFromHash() {
            const hash = window.location.hash.replace(/^#/, '');
            if (!hash) return null;
            const params = new URLSearchParams(hash.startsWith('?') ? hash.slice(1) : hash);
            return params.get('testId');
        }

        document.addEventListener('DOMContentLoaded', () => {
            const hashTestId = readTestIdFromHash();
            const initialTestId = hashTestId || reportData.defaultTestId;
            if (initialTestId) {
                selectTest(initialTestId, false);
            }
            applySidebarFilters();
        });

        window.addEventListener('hashchange', () => {
            const hashTestId = readTestIdFromHash();
            if (hashTestId) {
                selectTest(hashTestId, false);
            }
        });
    `;
}
