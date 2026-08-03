#!/usr/bin/env python3

import errno
import os
import pty
import select
import sys
import time

PROMPT = "Enter your choice (number):"
TIMEOUT_SECONDS = 10


def read_output(fd: int) -> bytes:
    try:
        return os.read(fd, 4096)
    except OSError as error:
        if error.errno == errno.EIO:
            return b""
        raise


def send_answers(fd: int, pending: str, answers: list[str]) -> str:
    while answers and PROMPT in pending:
        _, pending = pending.split(PROMPT, 1)
        os.write(fd, answers.pop(0).encode())
    return pending[-len(PROMPT) :]


def child_result(status: int, answers: list[str], output: str) -> int:
    if answers or "setup complete!" not in output:
        return 1
    return os.waitstatus_to_exitcode(status)


def run_interactive(binary: str, work_dir: str) -> int:
    pid, fd = pty.fork()
    if pid == 0:
        os.chdir(work_dir)
        os.execv(binary, [binary, "init"])

    answers = ["2\n", "1\n"]
    output = ""
    pending = ""
    deadline = time.monotonic() + TIMEOUT_SECONDS

    while time.monotonic() < deadline:
        readable, _, _ = select.select([fd], [], [], 0.1)
        if readable:
            data = read_output(fd)
            if not data:
                _, status = os.waitpid(pid, 0)
                return child_result(status, answers, output)
            text = data.decode(errors="replace")
            output += text
            pending = send_answers(fd, pending + text, answers)

    os.kill(pid, 9)
    os.waitpid(pid, 0)
    return 1


if __name__ == "__main__":
    raise SystemExit(run_interactive(sys.argv[1], sys.argv[2]))
