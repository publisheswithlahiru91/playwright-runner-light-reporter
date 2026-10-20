import { ReportRenderContext, StepData, TestData } from './types';
import {
    collectScreenshotTimeline,
    featureAggregateStatus,
    groupByFeature,
    groupByRequirement,
    groupByTestCase,
    scenarioDisplayName,
    scenarioStatus,
} from './bddReportModel';
import {
    getCucumberChartScript,
    getCucumberChartScriptTag,
    getCucumberChromeStyles,
    renderCucumberChromeFromContext,
} from './cucumberReportChrome';
import {
    getReportThemeToggleScript,
    getReportThemeToggleStyles,
    renderReportThemeToggle,
} from './reportThemeToggle';
import { getAdvancedThemeVariables, getHtmlThemeAttribute } from './reportThemes';

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
    if (minutes > 0) return `${minutes}m ${remainingSeconds}s`;
    return `${seconds}s`;
}

function linkFromTemplate(template: string, id: string): string {
    return template.replace(/\{id\}/g, encodeURIComponent(id));
}

function formatTimelineTime(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const millis = Math.floor((ms % 1000) / 10);
    return `${minutes}:${String(seconds).padStart(2, '0')}.${String(millis).padStart(2, '0')}`;
}

function renderScenarioSteps(steps: StepData[]): string {
    const flat: StepData[] = [];
    const walk = (items: StepData[]) => {
        for (const step of items) {
            if (step.category === 'test.step') flat.push(step);
            if (step.children?.length) walk(step.children);
        }
    };
    walk(steps);
    if (!flat.length) {
        return '<tr><td colspan="3" class="ct-muted">No steps</td></tr>';
    }
    return flat
        .map(
            (step, index) => `
        <tr class="ct-step ${step.status}">
            <td>${index + 1}</td>
            <td>${step.status === 'passed' ? '✓' : step.status === 'failed' ? '✗' : '○'}</td>
            <td>
                ${escapeHtml(step.title)}
                ${step.screenshot ? `<a class="ct-step-shot" href="${escapeHtml(step.screenshot)}" target="_blank" rel="noopener">screenshot</a>` : ''}
            </td>
        </tr>`,
        )
        .join('');
}

function renderScenarioCard(test: TestData, jiraTpl: string, testTpl: string): string {
    const status = scenarioStatus(test);
    const label = scenarioDisplayName(test);
    const reqLinks = (test.requirements || [])
        .map(
            (id) =>
                `<a href="${escapeHtml(linkFromTemplate(jiraTpl, id))}" target="_blank" rel="noopener">REQ_${escapeHtml(id)}</a>`,
        )
        .join(' ');
    const testLinks = (test.testCaseIds || [])
        .map(
            (id) =>
                `<a href="${escapeHtml(linkFromTemplate(testTpl, id))}" target="_blank" rel="noopener">TEST_${escapeHtml(id)}</a>`,
        )
        .join(' ');
    return `
    <article class="ct-scenario ${status}">
        <header class="ct-scenario-head">
            <span class="ct-pill ${status}">${status}</span>
            <h4>${escapeHtml(label)}</h4>
            <span class="ct-duration">${formatDuration(test.duration)}</span>
        </header>
        <div class="ct-scenario-meta">
            <span class="ct-meta-label">Feature</span> ${escapeHtml(test.feature || '—')}
            ${reqLinks ? `<span class="ct-meta-label">Story</span> ${reqLinks}` : ''}
            ${testLinks ? `<span class="ct-meta-label">Case</span> ${testLinks}` : ''}
        </div>
        <table class="ct-step-table">
            <thead><tr><th>#</th><th></th><th>Step</th></tr></thead>
            <tbody>${renderScenarioSteps(test.steps)}</tbody>
        </table>
        ${test.error ? `<pre class="ct-error">${escapeHtml(test.error)}</pre>` : ''}
    </article>`;
}

function renderFeatureBlocks(tests: TestData[], jiraTpl: string, testTpl: string): string {
    const features = groupByFeature(tests);
    return [...features.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([name, scenarios]) => {
            const status = featureAggregateStatus(scenarios);
            const cards = scenarios.map((t) => renderScenarioCard(t, jiraTpl, testTpl)).join('');
            return `
            <section class="ct-feature ${status}">
                <button type="button" class="ct-feature-head" onclick="this.parentElement.classList.toggle('open')">
                    <span class="ct-chevron">▶</span>
                    <strong>${escapeHtml(name)}</strong>
                    <span class="ct-pill ${status}">${status}</span>
                    <span class="ct-count">${scenarios.length} scenario(s)</span>
                </button>
                <div class="ct-feature-body">${cards}</div>
            </section>`;
        })
        .join('');
}

function renderSubTabs(
    prefix: string,
    ids: string[],
    panelsHtml: string[],
    defaultId: string,
): string {
    const tabButtons = ids
        .map(
            (id, i) =>
                `<button type="button" class="ct-subtab ${id === defaultId || (i === 0 && !defaultId) ? 'active' : ''}" data-subtab="${escapeHtml(prefix)}-${escapeHtml(id)}" onclick="activateSubTab('${escapeHtml(prefix)}','${escapeHtml(id)}')">${escapeHtml(id)}</button>`,
        )
        .join('');
    const panels = ids
        .map(
            (id, i) =>
                `<div id="${escapeHtml(prefix)}-${escapeHtml(id)}" class="ct-subpanel ${i === 0 ? 'active' : ''}">${panelsHtml[i]}</div>`,
        )
        .join('');
    return `<div class="ct-subtabs" data-prefix="${escapeHtml(prefix)}">${tabButtons}</div><div class="ct-subpanels">${panels}</div>`;
}

function renderScreenshotTimeline(frames: ReturnType<typeof collectScreenshotTimeline>): string {
    if (!frames.length) {
        return '<p class="ct-muted">No screenshots captured for this run.</p>';
    }
    return `
    <div class="ct-timeline">
        <div class="ct-timeline-track">
            ${frames
                .map(
                    (f) => `
                <div class="ct-frame">
                    <div class="ct-frame-time">T+${formatTimelineTime(f.timeMs)}</div>
                    <a href="${escapeHtml(f.path)}" target="_blank" rel="noopener" class="ct-frame-thumb">
                        <img src="${escapeHtml(f.path)}" alt="${escapeHtml(f.label)}" loading="lazy" />
                    </a>
                    <div class="ct-frame-caption">
                        <strong>${escapeHtml(f.scenarioLabel)}</strong>
                        <span>${escapeHtml(f.feature)} · ${escapeHtml(f.label)}</span>
                    </div>
                </div>`,
                )
                .join('')}
        </div>
    </div>`;
}

export function renderBddHtml(context: ReportRenderContext): string {
    const { options, testResults } = context;
    const chrome = renderCucumberChromeFromContext(context, 'BDD · Chain-style view');
    const jiraTpl = options.jiraIssueUrlTemplate;
    const testTpl = options.testCaseUrlTemplate;
    const timeline = collectScreenshotTimeline(testResults);

    const reqGroups = groupByRequirement(testResults);
    const reqIds = [...reqGroups.keys()].sort((a, b) => a.localeCompare(b));
    const reqPanels = reqIds.map((id) => {
        const label = id === 'Unlinked' ? 'Unlinked requirements' : `REQ_${id}`;
        return `<div class="ct-req-banner"><a href="${id === 'Unlinked' ? '#' : escapeHtml(linkFromTemplate(jiraTpl, id))}" target="_blank" rel="noopener">${escapeHtml(label)}</a></div>${renderFeatureBlocks(reqGroups.get(id)!, jiraTpl, testTpl)}`;
    });

    const caseGroups = groupByTestCase(testResults);
    const caseIds = [...caseGroups.keys()].sort((a, b) => a.localeCompare(b));
    const casePanels = caseIds.map((id) => {
        const tests = caseGroups.get(id)!;
        const label = id === 'Unlinked' ? 'Unlinked test cases' : `TEST_${id}`;
        const header = `<div class="ct-req-banner test"><a href="${id === 'Unlinked' ? '#' : escapeHtml(linkFromTemplate(testTpl, id))}" target="_blank" rel="noopener">${escapeHtml(label)}</a></div>`;
        return `${header}${tests.map((t) => renderScenarioCard(t, jiraTpl, testTpl)).join('')}`;
    });

    const featuresTab = renderFeatureBlocks(testResults, jiraTpl, testTpl);
    const requirementsTab =
        reqIds.length > 0
            ? renderSubTabs('req', reqIds.map((id) => (id === 'Unlinked' ? 'unlinked' : id)), reqPanels, reqIds[0] === 'Unlinked' ? 'unlinked' : reqIds[0])
            : '<p class="ct-muted">No REQ_&lt;story-id&gt; tags found. Add them to titles or tags.</p>';
    const testCasesTab =
        caseIds.length > 0
            ? renderSubTabs(
                  'test',
                  caseIds.map((id) => (id === 'Unlinked' ? 'unlinked' : id)),
                  casePanels,
                  caseIds[0] === 'Unlinked' ? 'unlinked' : caseIds[0],
              )
            : '<p class="ct-muted">No TEST_&lt;case-id&gt; tags found.</p>';

    return `<!DOCTYPE html>
<html lang="en" ${getHtmlThemeAttribute(options.theme)}>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(options.reportTitle)} — BDD</title>
    <style>
        ${getAdvancedThemeVariables()}
        ${getCucumberChromeStyles()}
        ${getChainBddStyles()}
        ${getReportThemeToggleStyles()}
    </style>
    ${getCucumberChartScriptTag()}
</head>
<body class="mc-report ct-report">
    ${renderReportThemeToggle()}
    ${chrome.header}

    <nav class="ct-main-tabs mc-content-shell">
        <button type="button" class="ct-main-tab active" data-tab="dashboard" onclick="switchMainTab('dashboard')">Dashboard</button>
        <button type="button" class="ct-main-tab" data-tab="features" onclick="switchMainTab('features')">Features</button>
        <button type="button" class="ct-main-tab" data-tab="requirements" onclick="switchMainTab('requirements')">Requirements (REQ)</button>
        <button type="button" class="ct-main-tab" data-tab="testcases" onclick="switchMainTab('testcases')">Test cases (TEST)</button>
        <button type="button" class="ct-main-tab" data-tab="timeline" onclick="switchMainTab('timeline')">Screenshot timeline</button>
    </nav>

    <section id="ct-panel-dashboard" class="ct-panel active">
        ${chrome.overview}
        ${chrome.charts}
        <div class="mc-content-shell ct-hint">
            <p>Use <strong>Requirements</strong> for story-centric (REQ_) grouping, <strong>Test cases</strong> for TEST_ scenarios, and <strong>Screenshot timeline</strong> for step capture playback order.</p>
        </div>
    </section>

    <section id="ct-panel-features" class="ct-panel mc-content-shell">${featuresTab}</section>
    <section id="ct-panel-requirements" class="ct-panel mc-content-shell">${requirementsTab}</section>
    <section id="ct-panel-testcases" class="ct-panel mc-content-shell">${testCasesTab}</section>
    <section id="ct-panel-timeline" class="ct-panel mc-content-shell">${renderScreenshotTimeline(timeline)}</section>

    <script>
        function switchMainTab(name) {
            document.querySelectorAll('.ct-main-tab').forEach((btn) => {
                btn.classList.toggle('active', btn.getAttribute('data-tab') === name);
            });
            document.querySelectorAll('.ct-panel').forEach((panel) => {
                panel.classList.toggle('active', panel.id === 'ct-panel-' + name);
            });
        }
        function activateSubTab(prefix, id) {
            const safeId = prefix + '-' + id;
            document.querySelectorAll('.ct-subtab').forEach((btn) => {
                if (btn.getAttribute('data-subtab')?.startsWith(prefix + '-')) {
                    btn.classList.toggle('active', btn.getAttribute('data-subtab') === safeId);
                }
            });
            document.querySelectorAll('.ct-subpanel').forEach((panel) => {
                if (panel.id.startsWith(prefix + '-')) {
                    panel.classList.toggle('active', panel.id === safeId);
                }
            });
        }
        document.querySelectorAll('.ct-feature').forEach((el, i) => { if (i < 3) el.classList.add('open'); });
        ${getCucumberChartScript()}
        ${getReportThemeToggleScript(options.theme)}
    </script>
</body>
</html>`;
}

function getChainBddStyles(): string {
    return `
        .ct-report { background: var(--mc-page-bg, #eceff1); }
        .ct-main-tabs {
            display: flex; flex-wrap: wrap; gap: 6px;
            padding-top: 16px; padding-bottom: 8px;
            border-bottom: 2px solid var(--mc-border, #cfd8dc);
        }
        .ct-main-tab {
            padding: 10px 16px; border: 0; border-radius: 6px 6px 0 0;
            background: transparent; color: var(--mc-muted, #607d8b);
            font-weight: 700; font-size: 0.82rem; cursor: pointer;
            border-bottom: 3px solid transparent; margin-bottom: -2px;
        }
        .ct-main-tab.active {
            color: var(--mc-teal-dark, #1a4f4f);
            background: var(--mc-card-bg, #fff);
            border-bottom-color: var(--mc-teal, #236b6b);
        }
        .ct-panel { display: none; padding-bottom: 36px; }
        .ct-panel.active { display: block; }
        .ct-hint p { margin: 12px 0 0; font-size: 0.88rem; color: var(--mc-muted); }
        .ct-subtabs {
            display: flex; flex-wrap: wrap; gap: 6px; margin: 12px 0 16px;
            padding-bottom: 8px; border-bottom: 1px solid var(--mc-border);
        }
        .ct-subtab {
            padding: 6px 12px; border-radius: 999px; border: 1px solid var(--mc-border);
            background: var(--mc-card-bg); cursor: pointer; font-size: 0.78rem; font-weight: 600;
        }
        .ct-subtab.active { background: var(--mc-teal); color: #fff; border-color: var(--mc-teal); }
        .ct-subpanel { display: none; }
        .ct-subpanel.active { display: block; }
        .ct-req-banner {
            margin: 8px 0 12px; padding: 10px 14px; border-radius: 6px;
            background: linear-gradient(90deg, #1565c0, #1976d2); color: #fff; font-weight: 700;
        }
        .ct-req-banner.test { background: linear-gradient(90deg, #6a1b9a, #8e24aa); }
        .ct-req-banner a { color: #fff; text-decoration: none; }
        .ct-feature {
            margin-bottom: 12px; border: 1px solid var(--mc-border); border-radius: 6px;
            background: var(--mc-card-bg); overflow: hidden;
        }
        .ct-feature-head {
            width: 100%; display: flex; align-items: center; gap: 10px;
            padding: 12px 14px; border: 0; background: #f5f7f8; cursor: pointer; text-align: left; font: inherit;
        }
        .ct-feature.failed .ct-feature-head { border-left: 4px solid var(--mc-failed); }
        .ct-feature.passed .ct-feature-head { border-left: 4px solid var(--mc-passed); }
        .ct-feature.open .ct-chevron { transform: rotate(90deg); }
        .ct-chevron { transition: transform 0.2s; color: var(--mc-muted); }
        .ct-feature-body { display: none; padding: 8px 14px 14px; }
        .ct-feature.open .ct-feature-body { display: block; }
        .ct-count { margin-left: auto; font-size: 0.78rem; color: var(--mc-muted); }
        .ct-scenario {
            margin-top: 10px; padding: 12px; border-radius: 6px;
            border: 1px solid #e0e0e0; background: #fff;
        }
        .ct-scenario.failed { border-left: 4px solid var(--mc-failed); }
        .ct-scenario.passed { border-left: 4px solid var(--mc-passed); }
        .ct-scenario-head { display: flex; align-items: center; gap: 8px; }
        .ct-scenario-head h4 { margin: 0; flex: 1; font-size: 0.92rem; }
        .ct-duration { font-size: 0.75rem; color: var(--mc-muted); }
        .ct-scenario-meta { margin: 8px 0; font-size: 0.78rem; color: var(--mc-muted); }
        .ct-scenario-meta a { color: #1565c0; font-weight: 600; text-decoration: none; margin-right: 8px; }
        .ct-meta-label { font-weight: 700; margin-right: 4px; margin-left: 8px; }
        .ct-meta-label:first-child { margin-left: 0; }
        .ct-pill {
            display: inline-block; padding: 2px 8px; border-radius: 999px;
            font-size: 0.65rem; text-transform: uppercase; font-weight: 700;
            background: #e8f5e9; color: #2e7d32;
        }
        .ct-pill.failed { background: #ffebee; color: #c62828; }
        .ct-pill.skipped { background: #fff3e0; color: #e65100; }
        .ct-step-table { width: 100%; border-collapse: collapse; font-size: 0.82rem; margin-top: 6px; }
        .ct-step-table th { text-align: left; padding: 6px; background: #f5f5f5; border-bottom: 1px solid #e0e0e0; }
        .ct-step-table td { padding: 6px; border-bottom: 1px solid #f0f0f0; vertical-align: top; }
        .ct-step.failed td { color: var(--mc-failed); }
        .ct-step-shot { margin-left: 8px; font-size: 0.72rem; }
        .ct-error { margin-top: 8px; padding: 8px; border-radius: 4px; background: #ffebee; color: #b71c1c; font-size: 0.75rem; overflow-x: auto; }
        .ct-muted { color: var(--mc-muted); }
        .ct-timeline { overflow-x: auto; padding-bottom: 12px; }
        .ct-timeline-track {
            display: flex; gap: 16px; align-items: flex-start;
            min-height: 220px; padding: 12px 4px;
        }
        .ct-frame {
            flex: 0 0 200px; border: 1px solid var(--mc-border); border-radius: 8px;
            background: var(--mc-card-bg); box-shadow: 0 2px 8px rgba(0,0,0,0.06);
        }
        .ct-frame-time {
            padding: 6px 10px; font-size: 0.72rem; font-weight: 700;
            background: var(--mc-teal-dark, #1a4f4f); color: #fff; border-radius: 8px 8px 0 0;
        }
        .ct-frame-thumb { display: block; height: 120px; overflow: hidden; }
        .ct-frame-thumb img { width: 100%; height: 100%; object-fit: cover; }
        .ct-frame-caption { padding: 8px 10px; font-size: 0.72rem; }
        .ct-frame-caption strong { display: block; margin-bottom: 4px; font-size: 0.78rem; }
        [data-theme="dark"] .ct-scenario,
        [data-theme="dark"] .ct-frame { background: var(--panel); border-color: var(--border); }
        [data-theme="dark"] .ct-feature-head { background: var(--panel-muted); }
        [data-theme="dark"] .ct-step-table th { background: var(--panel-muted); }
        [data-theme="dark"] .ct-main-tab.active { background: var(--panel); color: var(--text); }
    `;
}
