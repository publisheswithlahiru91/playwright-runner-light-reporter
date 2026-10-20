export function getTraceCliCommand(traceRelativePath: string): string {
    return `npx playwright show-trace ${traceRelativePath.replace(/\\/g, '/')}`;
}
