FROM python:3.7.0

WORKDIR /opt/worker

ENV AMQP_URL=amqp://rabbitmq//

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY tasks.py .
COPY flow_tasks.py .

CMD celery worker -A tasks.app -l=info
