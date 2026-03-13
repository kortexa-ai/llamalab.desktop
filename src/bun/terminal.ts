// Terminal session manager — spawns PTY via Python wrapper, bridges to RPC

import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";
import { HOME, getWorkspaceConfig } from "./config";

// Python PTY wrapper — creates a real pseudoterminal
const PTY_WRAPPER = `
import pty, os, sys, select, signal, fcntl, termios, struct, re

cwd = sys.argv[1] if len(sys.argv) > 1 else os.path.expanduser("~")
cols = int(sys.argv[2]) if len(sys.argv) > 2 else 80
rows = int(sys.argv[3]) if len(sys.argv) > 3 else 24
shell = os.environ.get("SHELL", "/bin/zsh")

os.chdir(cwd)
os.environ["COLUMNS"] = str(cols)
os.environ["LINES"] = str(rows)

pid, fd = pty.fork()
if pid == 0:
    os.execvp(shell, [shell, "-i"])
else:
    winsize = struct.pack("HHHH", rows, cols, 0, 0)
    fcntl.ioctl(fd, termios.TIOCSWINSZ, winsize)

    buf = b""
    try:
        while True:
            rlist, _, _ = select.select([sys.stdin.buffer, fd], [], [], 0.1)
            for r in rlist:
                if r == sys.stdin.buffer:
                    data = os.read(sys.stdin.buffer.fileno(), 4096)
                    if not data:
                        os.close(fd)
                        os.waitpid(pid, 0)
                        sys.exit(0)
                    buf += data
                    while True:
                        m = re.search(rb'\\x1b\\]9999;(\\d+);(\\d+)\\x07', buf)
                        if not m:
                            break
                        new_cols = int(m.group(1))
                        new_rows = int(m.group(2))
                        winsize = struct.pack("HHHH", new_rows, new_cols, 0, 0)
                        fcntl.ioctl(fd, termios.TIOCSWINSZ, winsize)
                        os.kill(pid, signal.SIGWINCH)
                        buf = buf[:m.start()] + buf[m.end():]
                    if buf:
                        os.write(fd, buf)
                        buf = b""
                elif r == fd:
                    try:
                        data = os.read(fd, 4096)
                        if not data:
                            break
                        sys.stdout.buffer.write(data)
                        sys.stdout.buffer.flush()
                    except OSError:
                        break
    except (KeyboardInterrupt, OSError):
        pass
    finally:
        try:
            os.kill(pid, signal.SIGTERM)
            os.waitpid(pid, 0)
        except:
            pass
`;

interface TerminalSession {
	proc: ChildProcess;
	cwd: string;
}

// Resolve ~ and validate CWD is within allowed paths
function resolveCwd(requested?: string): string {
	const config = getWorkspaceConfig();
	const fallback = config?.codeRoot || HOME;

	if (!requested) return fallback;

	let resolved = requested;
	if (resolved.startsWith("~/")) {
		resolved = path.join(HOME, resolved.slice(2));
	}
	resolved = path.resolve(resolved);

	// Allow codeRoot, researchDir, and HOME/src as base paths
	const allowed = [HOME];
	if (config) {
		allowed.push(config.codeRoot, config.researchDir);
	}
	if (!allowed.some((prefix) => resolved.startsWith(prefix))) {
		return fallback;
	}

	return resolved;
}

export class TerminalManager {
	private sessions = new Map<string, TerminalSession>();
	private nextId = 1;

	// Callbacks set by the main process to push RPC messages
	onOutput: ((sessionId: string, data: string) => void) | null = null;
	onExit: ((sessionId: string, code: number) => void) | null = null;

	start(params: {
		cwd?: string;
		cols: number;
		rows: number;
	}): { sessionId: string } {
		const sessionId = `term-${this.nextId++}`;
		const cwd = resolveCwd(params.cwd);
		const cols = params.cols || 80;
		const rows = params.rows || 24;

		const cleanEnv: Record<string, string> = {
			HOME,
			USER: process.env.USER || "",
			SHELL: process.env.SHELL || "/bin/zsh",
			PATH: process.env.PATH || "/usr/local/bin:/usr/bin:/bin",
			TERM: "xterm-256color",
			LANG: process.env.LANG || "en_US.UTF-8",
			EDITOR: process.env.EDITOR || "vim",
		};
		if (process.env.SSH_AUTH_SOCK)
			cleanEnv.SSH_AUTH_SOCK = process.env.SSH_AUTH_SOCK;

		const proc = spawn(
			"python3",
			["-c", PTY_WRAPPER, cwd, String(cols), String(rows)],
			{
				stdio: ["pipe", "pipe", "pipe"],
				env: cleanEnv,
			},
		);

		proc.stdout?.on("data", (chunk: Buffer) => {
			this.onOutput?.(sessionId, chunk.toString());
		});

		proc.stderr?.on("data", (chunk: Buffer) => {
			this.onOutput?.(sessionId, chunk.toString());
		});

		proc.on("exit", (exitCode) => {
			this.onExit?.(sessionId, exitCode ?? 1);
			this.sessions.delete(sessionId);
		});

		this.sessions.set(sessionId, { proc, cwd });
		return { sessionId };
	}

	input(sessionId: string, data: string): void {
		const session = this.sessions.get(sessionId);
		if (session?.proc.stdin?.writable) {
			session.proc.stdin.write(data);
		}
	}

	resize(sessionId: string, cols: number, rows: number): void {
		const session = this.sessions.get(sessionId);
		if (session?.proc.stdin?.writable) {
			session.proc.stdin.write(`\x1b]9999;${cols};${rows}\x07`);
		}
	}

	kill(sessionId: string): void {
		const session = this.sessions.get(sessionId);
		if (session) {
			session.proc.kill();
			this.sessions.delete(sessionId);
		}
	}

	killAll(): void {
		for (const [id] of this.sessions) {
			this.kill(id);
		}
	}
}
