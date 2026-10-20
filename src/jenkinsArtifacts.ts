import * as fs from 'fs';
import * as path from 'path';
import { ReportRenderContext } from './types';

export interface JenkinsRunManifest {
    runId: string;
    status: 'passed' | 'failed';
    passed: number;
    failed: number;
    skipped: number;
    total: number;
    passRate: number;
    durationMs: number;
    environment: string;
    reportTitle: string;
    startedAt: string;
    finishedAt: string;
    reportHtml: string;
    latestHtml: string;
    emailSummaryText: string;
    emailSummaryHtml: string;
    historyHtml: string;
    jenkins?: {
        buildUrl?: string;
        jobName?: string;
        buildNumber?: string;
        nodeName?: string;
    };
}

function getRunStatus(context: ReportRenderContext): 'passed' | 'failed' {
    return context.suiteStats.failed > 0 ? 'failed' : 'passed';
}

function formatDurationMs(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes > 0) {
        return `${minutes}m ${remainingSeconds}s`;
    }
    return `${seconds}s`;
}

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function buildEmailSummaryText(context: ReportRenderContext, reportDir: string): string {
    const durationMs = context.endTime.getTime() - context.startTime.getTime();
    const passRate = context.suiteStats.total > 0
        ? ((context.suiteStats.passed / context.suiteStats.total) * 100).toFixed(1)
        : '0';
    const status = getRunStatus(context).toUpperCase();
    const lines = [
        `${context.options.reportTitle}`,
        `${context.options.reportSubtitle}`,
        '',
        `Status: ${status}`,
        `Run ID: ${context.runId}`,
        `Environment: ${context.environment.toUpperCase()}`,
        `Passed: ${context.suiteStats.passed}`,
        `Failed: ${context.suiteStats.failed}`,
        `Skipped: ${context.suiteStats.skipped}`,
        `Total: ${context.suiteStats.total}`,
        `Pass Rate: ${passRate}%`,
        `Duration: ${formatDurationMs(durationMs)}`,
        `Started: ${context.startTime.toISOString()}`,
        '',
        `Open report: ${path.join(reportDir, 'index.html')}`,
        `Latest copy: ${path.join(reportDir, 'latest.html')}`,
    ];

    if (process.env.BUILD_URL) {
        lines.push(`Jenkins build: ${process.env.BUILD_URL}`);
    }

    const failedTests = context.testResults.filter((test) => test.status === 'failed' || test.status === 'timedOut');
    if (failedTests.length > 0) {
        lines.push('', 'Failed tests:');
        for (const test of failedTests) {
            lines.push(`- ${test.fullTitle}`);
            if (test.error) {
                lines.push(`  ${test.error.split('\n')[0]}`);
            }
        }
    }

    return lines.join('\n');
}

function buildEmailSummaryHtml(context: ReportRenderContext, reportDir: string): string {
    const durationMs = context.endTime.getTime() - context.startTime.getTime();
    const passRate = context.suiteStats.total > 0
        ? ((context.suiteStats.passed / context.suiteStats.total) * 100).toFixed(1)
        : '0';
    const status = getRunStatus(context);
    const statusColor = status === 'passed' ? '#16a34a' : '#dc2626';
    const failedTests = context.testResults.filter((test) => test.status === 'failed' || test.status === 'timedOut');

    const failedList = failedTests.length > 0
        ? `<ul>${failedTests.map((test) => `<li><strong>${escapeHtml(test.title)}</strong>${test.error ? `<br><span style="color:#991b1b">${escapeHtml(test.error.split('\n')[0])}</span>` : ''}</li>`).join('')}</ul>`
        : '<p>No failures 🎉</p>';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(context.options.reportTitle)} Summary</title>
</head>
<body style="font-family:Segoe UI,Arial,sans-serif;background:#f8fafc;padding:24px;color:#1e293b;">
  <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #dbe3ef;border-radius:12px;overflow:hidden;">
    <div style="background:linear-gradient(135deg,#059669,#047857);color:#fff;padding:20px 24px;">
      <h1 style="margin:0 0 8px;font-size:22px;">${escapeHtml(context.options.reportTitle)}</h1>
      <p style="margin:0;opacity:0.9;">${escapeHtml(context.options.reportSubtitle)}</p>
    </div>
    <div style="padding:24px;">
      <p style="margin:0 0 16px;"><strong>Status:</strong> <span style="color:${statusColor};font-weight:700;text-transform:uppercase;">${status}</span></p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
        <tr><td style="padding:8px 0;"><strong>Run ID</strong></td><td>${escapeHtml(context.runId)}</td></tr>
        <tr><td style="padding:8px 0;"><strong>Environment</strong></td><td>${escapeHtml(context.environment.toUpperCase())}</td></tr>
        <tr><td style="padding:8px 0;"><strong>Passed / Failed / Skipped</strong></td><td>${context.suiteStats.passed} / ${context.suiteStats.failed} / ${context.suiteStats.skipped}</td></tr>
        <tr><td style="padding:8px 0;"><strong>Pass Rate</strong></td><td>${passRate}%</td></tr>
        <tr><td style="padding:8px 0;"><strong>Duration</strong></td><td>${formatDurationMs(durationMs)}</td></tr>
      </table>
      <h2 style="font-size:16px;margin:0 0 10px;">Failures</h2>
      ${failedList}
      <p style="margin-top:24px;font-size:13px;color:#64748b;">
        Attach <code>index.html</code> or open the archived report from <code>${escapeHtml(reportDir)}</code>.
        ${process.env.BUILD_URL ? `<br>Jenkins build: <a href="${escapeHtml(process.env.BUILD_URL)}">${escapeHtml(process.env.BUILD_URL)}</a>` : ''}
      </p>
    </div>
  </div>
</body>
</html>`;
}

export function writeJenkinsArtifacts(
    context: ReportRenderContext,
    reportDir: string,
    reportHtmlPath: string,
): JenkinsRunManifest {
    const html = fs.readFileSync(reportHtmlPath, 'utf-8');
    const indexPath = path.join(reportDir, 'index.html');
    const latestPath = path.join(reportDir, 'latest.html');
    const emailTextPath = path.join(reportDir, 'email-summary.txt');
    const emailHtmlPath = path.join(reportDir, 'email-summary.html');
    const manifestPath = path.join(reportDir, 'latest-run.json');

    fs.writeFileSync(indexPath, html);
    fs.writeFileSync(latestPath, html);
    fs.writeFileSync(emailTextPath, buildEmailSummaryText(context, reportDir));
    fs.writeFileSync(emailHtmlPath, buildEmailSummaryHtml(context, reportDir));

    const durationMs = context.endTime.getTime() - context.startTime.getTime();
    const passRate = context.suiteStats.total > 0
        ? Number(((context.suiteStats.passed / context.suiteStats.total) * 100).toFixed(1))
        : 0;

    const manifest: JenkinsRunManifest = {
        runId: context.runId,
        status: getRunStatus(context),
        passed: context.suiteStats.passed,
        failed: context.suiteStats.failed,
        skipped: context.suiteStats.skipped,
        total: context.suiteStats.total,
        passRate,
        durationMs,
        environment: context.environment,
        reportTitle: context.options.reportTitle,
        startedAt: context.startTime.toISOString(),
        finishedAt: context.endTime.toISOString(),
        reportHtml: indexPath,
        latestHtml: latestPath,
        emailSummaryText: emailTextPath,
        emailSummaryHtml: emailHtmlPath,
        historyHtml: path.join(reportDir, 'history.html'),
    };

    if (process.env.BUILD_URL || process.env.JOB_NAME || process.env.BUILD_NUMBER || process.env.NODE_NAME) {
        manifest.jenkins = {
            buildUrl: process.env.BUILD_URL,
            jobName: process.env.JOB_NAME,
            buildNumber: process.env.BUILD_NUMBER,
            nodeName: process.env.NODE_NAME,
        };
    }

    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    return manifest;
}

export function isCiEnvironment(): boolean {
    return Boolean(process.env.CI || process.env.JENKINS_URL || process.env.BUILD_NUMBER);
}
