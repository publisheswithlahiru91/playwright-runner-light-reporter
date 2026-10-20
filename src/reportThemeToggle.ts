import { ReportTheme } from './types';

export function renderReportThemeToggle(): string {
    return `
    <button type="button" class="report-theme-toggle" id="report-theme-toggle" title="Switch light/dark mode">
        <span class="report-theme-toggle-icon" aria-hidden="true">◐</span>
        <span class="report-theme-toggle-label" id="report-theme-toggle-label">Theme</span>
    </button>`;
}

export function getReportThemeToggleStyles(): string {
    return `
        .report-theme-toggle {
            position: fixed;
            top: 14px;
            right: 14px;
            z-index: 1000;
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 8px 14px;
            border-radius: 999px;
            border: 1px solid rgba(255,255,255,0.35);
            background: rgba(15, 23, 42, 0.55);
            color: #f8fafc;
            font-size: 0.8rem;
            font-weight: 600;
            cursor: pointer;
            backdrop-filter: blur(8px);
            box-shadow: 0 4px 14px rgba(15, 23, 42, 0.2);
        }
        [data-theme="dark"] .report-theme-toggle {
            background: rgba(255, 255, 255, 0.12);
            border-color: rgba(255, 255, 255, 0.25);
        }
        .report-theme-toggle:hover {
            transform: translateY(-1px);
            box-shadow: 0 6px 18px rgba(15, 23, 42, 0.28);
        }
        .report-theme-toggle-icon { font-size: 1rem; line-height: 1; }
    `;
}

export function getReportThemeToggleScript(defaultTheme: ReportTheme): string {
    return `
        (function initReportThemeToggle() {
            const storageKey = 'playwright-light-reporter-theme';
            const root = document.documentElement;
            const btn = document.getElementById('report-theme-toggle');
            const label = document.getElementById('report-theme-toggle-label');
            const configured = ${JSON.stringify(defaultTheme)};
            const saved = localStorage.getItem(storageKey);
            const initial = saved === 'dark' || saved === 'light' ? saved : configured;
            root.setAttribute('data-theme', initial);
            function refreshLabel() {
                const mode = root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
                if (label) label.textContent = mode === 'dark' ? 'Dark' : 'Light';
            }
            refreshLabel();
            btn?.addEventListener('click', () => {
                const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
                root.setAttribute('data-theme', next);
                localStorage.setItem(storageKey, next);
                refreshLabel();
            });
        })();
    `;
}
