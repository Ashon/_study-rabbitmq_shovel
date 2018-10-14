#!/usr/bin/env python

import time

from tasks import hello


while True:
    task = hello.apply_async()
    print(f'ID={task}, RESULT={task.get()}')
