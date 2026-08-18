#!/usr/bin/env python3

import errno
import os
import pty
import select
import sys
import time

CHOICE_PROMPT = "Enter your choice (number):"
CHOICES_PROMPT = "Enter your choices (comma-separated numbers or press Enter for none):"
MAX_PROMPT_LENGTH = max(len(CHOICE_PROMPT), len(CHOICES_PROMPT))
TIMEOUT_SECONDS = 10


def read_output(fd: int) -> bytes:
    try:
        return os.read(fd, 4096)
    except OSError as error:
        if error.errno == errno.EIO:
            return b""
        raise


def send_answers(fd: int, pending: str, answers: list[tuple[str, str]]) -> str:
    while answers:
        prompt, answer = answers[0]
        if prompt not in pending:
            break
        _, pending = pending.split(prompt, 1)
        os.write(fd, answer.encode())
        answers.pop(0)
    return pending[-MAX_PROMPT_LENGTH:]


def child_result(status: int, answers: list[tuple[str, str]], output: str) -> int:
    if answers or "Configured 1 manifest(s)." not in output:
        return 1
    return os.waitstatus_to_exitcode(status)


def run_interactive(binary: str, work_dir: str) -> int:
    pid, fd = pty.fork()
    if pid == 0:
        os.chdir(work_dir)
        os.execv(binary, [binary, "init"])

    answers = [
        (CHOICE_PROMPT, "2\n"),
        (CHOICES_PROMPT, "1\n"),
        (CHOICE_PROMPT, "3\n"),
    ]
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
