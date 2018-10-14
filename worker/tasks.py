import os

from celery import Celery


AMQP_URL = os.environ.get(
    'AMQP_URL', 'amqp://guest:guest@localhost//')


app = Celery(__name__, broker=AMQP_URL, backend=AMQP_URL)


@app.task(name='tasks.hello')
def hello():
    return 'hello'
