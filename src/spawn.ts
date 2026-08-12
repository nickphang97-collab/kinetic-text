export class CommandError extends Error {
  readonly exitCode = 4;
}

export interface CommandResult {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number;
}

export async function runCommand(argv: readonly string[], timeoutMs: number, cwd?: string): Promise<CommandResult> {
  const started = performance.now();
  const proc = Bun.spawn([...argv], { cwd, stdin: "ignore", stdout: "pipe", stderr: "pipe" });
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    proc.kill();
  }, timeoutMs);
  const [exitCode, stdout, stderr] = await Promise.all([
    proc.exited,
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]).finally(() => clearTimeout(timer));
  if (timedOut) {
    throw new CommandError(`${argv[0] ?? "command"} timed out after ${Math.round(performance.now() - started)}ms`);
  }
  return { stdout, stderr, exitCode };
}
