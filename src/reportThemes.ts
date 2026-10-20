export type ReportTheme = 'light' | 'dark';

export function getHtmlThemeAttribute(theme: ReportTheme): string {
    return `data-theme="${theme}"`;
}

export function getAdvancedThemeVariables(): string {
    return `
        :root, [data-theme="light"] {
            --bg: #eef4f1;
            --panel: #ffffff;
            --panel-muted: #f8fafc;
            --border: #dbe3ef;
            --text: #1e293b;
            --muted: #64748b;
            --primary: #059669;
            --primary-light: #10b981;
            --primary-bg: #ecfdf5;
            --danger: #dc2626;
            --passed: #16a34a;
            --failed: #dc2626;
            --skipped: #64748b;
            --shadow: 0 10px 25px rgba(15, 23, 42, 0.08);
            --hero-gradient: linear-gradient(125deg, #1e293b 0%, #334155 38%, #475569 72%, #0f766e 100%);
            --page-gradient: linear-gradient(180deg, #f8fafc 0%, var(--bg) 100%);
            --code-bg: #0f172a;
            --code-text: #cbd5e1;
            --error-bg: #fee2e2;
            --error-text: #991b1b;
            --failed-row-bg: #fef2f2;
        }
        [data-theme="dark"] {
            --bg: #0b1220;
            --panel: #1e293b;
            --panel-muted: #111827;
            --border: #334155;
            --text: #f1f5f9;
            --muted: #94a3b8;
            --primary: #34d399;
            --primary-light: #6ee7b7;
            --primary-bg: #064e3b;
            --danger: #f87171;
            --passed: #4ade80;
            --failed: #f87171;
            --skipped: #94a3b8;
            --shadow: 0 10px 25px rgba(0, 0, 0, 0.35);
            --hero-gradient: linear-gradient(125deg, #020617 0%, #0f172a 40%, #1e293b 75%, #115e59 100%);
            --page-gradient: linear-gradient(180deg, #0f172a 0%, #0b1220 100%);
            --code-bg: #020617;
            --code-text: #cbd5e1;
            --error-bg: #450a0a;
            --error-text: #fecaca;
            --failed-row-bg: #3f1d1d;
        }
    `;
}

export function getStandardThemeVariables(): string {
    return `
        :root, [data-theme="light"] {
            --primary: #059669;
            --primary-light: #10b981;
            --primary-dark: #047857;
            --primary-bg: #ecfdf5;
            --accent: #0d9488;
            --success: #22c55e;
            --danger: #ef4444;
            --warning: #f59e0b;
            --info: #3b82f6;
            --dark: #1e293b;
            --gray-50: #f8fafc;
            --gray-100: #f1f5f9;
            --gray-200: #e2e8f0;
            --gray-300: #cbd5e1;
            --gray-400: #94a3b8;
            --gray-500: #64748b;
            --gray-600: #475569;
            --gray-700: #334155;
            --surface: #ffffff;
            --page-gradient: linear-gradient(135deg, var(--gray-100) 0%, var(--primary-bg) 100%);
            --header-gradient: linear-gradient(135deg, var(--primary) 0%, var(--accent) 50%, var(--primary-dark) 100%);
            --table-head-gradient: linear-gradient(135deg, var(--dark) 0%, var(--gray-700) 100%);
            --code-bg: #0f172a;
            --code-text: #a7f3d0;
            --failed-row-bg: #fef2f2;
            --failed-row-hover: #fee2e2;
            --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
            --shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
            --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
            --shadow-xl: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1);
            --radius: 12px;
            --radius-sm: 8px;
            --radius-lg: 16px;
        }
        [data-theme="dark"] {
            --primary: #34d399;
            --primary-light: #6ee7b7;
            --primary-dark: #059669;
            --primary-bg: #064e3b;
            --accent: #14b8a6;
            --success: #4ade80;
            --danger: #f87171;
            --warning: #fbbf24;
            --info: #60a5fa;
            --dark: #f8fafc;
            --gray-50: #111827;
            --gray-100: #1e293b;
            --gray-200: #334155;
            --gray-300: #475569;
            --gray-400: #64748b;
            --gray-500: #94a3b8;
            --gray-600: #cbd5e1;
            --gray-700: #e2e8f0;
            --surface: #1e293b;
            --page-gradient: linear-gradient(135deg, #0f172a 0%, #0b1220 100%);
            --header-gradient: linear-gradient(135deg, #047857 0%, #0f766e 50%, #065f46 100%);
            --table-head-gradient: linear-gradient(135deg, #111827 0%, #1f2937 100%);
            --code-bg: #020617;
            --code-text: #cbd5e1;
            --failed-row-bg: #3f1d1d;
            --failed-row-hover: #4c1d1d;
            --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.35);
            --shadow: 0 4px 6px -1px rgb(0 0 0 / 0.35), 0 2px 4px -2px rgb(0 0 0 / 0.35);
            --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.35), 0 4px 6px -4px rgb(0 0 0 / 0.35);
            --shadow-xl: 0 20px 25px -5px rgb(0 0 0 / 0.35), 0 8px 10px -6px rgb(0 0 0 / 0.35);
        }
    `;
}

/** @deprecated Use `getStandardThemeVariables` instead. */
export const getSimpleThemeVariables = getStandardThemeVariables;

export function getStandardDarkComponentOverrides(): string {
    return `
        body {
            background: var(--page-gradient);
            color: var(--gray-700);
        }
        .header { background: var(--header-gradient); }
        .stat-card, .meta-section, .filters, .test-table-container, .test-detail, .suite-status, .run-status {
            background: var(--surface);
            color: var(--gray-700);
        }
        .test-table thead { background: var(--table-head-gradient); color: white; }
        .test-table tbody tr:nth-child(even) { background: var(--gray-50); }
        .test-row.failed { background: var(--failed-row-bg) !important; }
        .test-row.failed:hover { background: var(--failed-row-hover) !important; }
        .stack-trace-content, .step-console-content, .step-stack-content {
            background: var(--code-bg);
            color: var(--code-text);
        }
        .report-footer {
            background: var(--table-head-gradient);
            color: white;
        }
    `;
}

/** @deprecated Use `getStandardDarkComponentOverrides` instead. */
export const getSimpleDarkComponentOverrides = getStandardDarkComponentOverrides;

export function getAdvancedDarkComponentOverrides(): string {
    return `
        body { background: var(--page-gradient); color: var(--text); }
        .hero-header { background: var(--hero-gradient); }
        .stat-card, .filters-panel, .meta-section, .sidebar, .detail-pane, .artifact-card, .pw-step-row {
            background: var(--panel);
            color: var(--text);
        }
        .pw-step-body, .detail-meta-grid div, .filter-group label {
            background: var(--panel-muted);
            color: var(--text);
        }
        .pw-step-row.failed { background: var(--failed-row-bg); }
        .pw-step-console, .error-box pre, .pw-step-stack {
            background: var(--code-bg);
            color: var(--code-text);
        }
        .pw-step-error, .error-box pre {
            background: var(--error-bg);
            color: var(--error-text);
        }
        .sidebar-test:hover, .sidebar-test.active { background: var(--primary-bg); }
        .browser-badge { background: var(--panel-muted); color: var(--text); border-color: var(--border); }
        .btn-secondary { background: var(--panel-muted); color: var(--text); }
    `;
}
