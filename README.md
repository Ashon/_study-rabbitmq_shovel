# Message trace using Rabbit MQ Shovel

RabbitMQ shovel plugin을 활용한 메시지 트레이싱 공부

분산 태스크 프레임워크인 Celery를 이용하여 간단한 '메시지 브로커 - 워커' 구성을 만들어 보고,
RabbitMQ에서 실시간으로 worker로 흘러가는 메시지를 트레이싱 하기 위한 방법을 찾아보았음.

## Test architecture

테스트에 사용된 서비스 구성은 `docker-compose.yml`에 잘 정리되어 있다.
아래는 테스트에 사용된 서비스들의 간단한 구성도..

``` txt
                     +- localhost -----+
+-< send messages >--| ./flow_tasks.py |
|                    +-----------------+
|
|  +- rabbitmq --------------------+
+->| :5672 - mq port               |<+-< consume message >-+
   |                               |  \                    |
   | :15672 - management port      |  |          +-- celery worker --+
   +-------------------------------+  |          | +-- celery worker --+
                                      |          +-|                   |
                             < trace messages >    +-------------------+
                                      |
   +- external mq -----------------+  /
   | :5672 - mq port               |<+
   | :15672 - management port      |    +-- mon ------+
   | :15674 - websocket (webstomp) |<---| :8080 - web |
   +-------------------------------+    +-------------+
```

### RabbitMQ

celery worker의 메시지 브로커.

#### Enabled plugins

- rabbitmq_web_stomp
- rabbitmq_shovel
- rabbitmq_shovel_management

#### Before

기본적인 '메시지 브로커 - 워커' 구성

``` txt
           +--- amqp:// --------------------------+
           |                                      |
message ----> exchange --<routing-key>--> queue ----> worker
           |  <topic>                             |
           +--------------------------------------+
```

#### After

shovel 플러그인 설정을 통해 워커의 큐로 흘러가는 메시지를 fanout exchange로 우회시키고
fanout exchange에서, 다양한 큐들을 붙여서 메시지를 따로 처리할 수 있도록 구성한다.

기존 레거시 시스템에서 브로커로 던지는 메시지 형식을 변경할 필요가 없다.

``` txt
           +--- amqp:// ---------------------------+
           |                                       |
message ----> exchange -X-<routing-key>--> queue ----> worker
           |  <topic>                   /          |
           |   \_ shovel --> exchange -<           |
           |                 <fanout>   \_ queue ----> mon
           |                                       |
           +---------------------------------------+
```

- 해당 구성도는 기존 사용되던 AMQP 호스트의 exchange에 직접 모니터링이나 외부 API를 위한 큐를 붙여서 사용한다.
- 컨슈머들이 많아질 경우, fanout exchange의 특성으로 성능에 많은 영향을 줄 수 있다.

#### Federation using Shovel

* shovel은 여러 rabbitMQ 인스턴스들을 묶어서 federation 구성을 가능하게 해 준다.
* 기존 RabbitMQ 인스턴스의 성능을 가능한 유지하면서, 다른 MQ 인스턴스를 통해 메시지를 소화할 수 있다.

``` txt
           +--- amqp://worker ---------------------+
           |                                       |
message ----> exchange -X-<routing-key>--> queue ----> worker
           |  <topic>                   /          |
           |   \_ shovel --> exchange -<           |
           |                 <fanout>   \_ queue ----+
           |                                       | |
           +---------------------------------------+ |
                                                     |
           +--- amqp://external ---+                 |
           |                       |                 |
           | shovel <--------------------------------+
           |   |                   |
           |   V                   |
           | exchange --> queue-A ----> another worker
           | <fanout>  \_ queue-B ----> another API
           |                :      |     :
           +-----------------------+
```

### Celery worker

브로커로부터 메시지를 받아 작업을 수행.

#### Tasks
- 'tasks.hello': 'hello' 메시지를 리턴한다.

### Mon

브로커로 들어오는 메시지를 웹소켓을 이용해서 실시간으로 트레이싱한다.
webstomp를 이용해서 메시지를 실시간으로 브라우저 화면에 보이게 한다.

## Demo

docker-compose를 이용해서 간단한 서비스 스택을 만들고,
rabbitmq에 트레이싱을 위한 설정을 ansible을 이용해서 관리함.

### setup services

``` sh
$ docker-compose build
$ docker-compose up -d
```

### flow messages to broker

브로커에 1초마다 작업 메시지를 던진다.

``` sh
$ docker-compose exec worker ./flow_tasks.py
ID=6f1a6792-9115-4daa-bf51-ce5ff484818e, RESULT=hello
ID=3f830fde-cf4f-4f38-bfb7-70afaa9409d2, RESULT=hello
ID=b05198b7-aabb-4e29-94ff-59bff52ff241, RESULT=hello
:
```

### setup shovels

실제 서비스가 동작하고 있는 환경을 모방하기 위해서,
트레이싱 설정도 메시지가 흘러가고 있다는 가정하에 설정했다.

``` sh
$ cd ansible
$ ansible-playbook setup.yml
```

### open localhost:8080 with browser

브라우저로 접근해서 webstomp 메시지가 잘 들어오는지 확인한다.

### teardown services

``` sh
$ docker-compose down -v
```

## Conclusion

메시지 브로커로 RabbitMQ를 사용하는 실 환경에서 레거시 환경을 최대한 수정하지 않고,
새로운 서비스를 추가하여 부가적인 로직들을 수행할 수 있도록 하는 방법을 알아보았음.

실제로 Shovel을 설정 하였을 때 퍼포먼스 저하가 일어나긴 할 텐데, 얼마나 발생할 지는 잘 모르겠음.
하지만 그 부분에 대해서는 MQ 클러스터의 스케일업으로 충분히 소화 가능하다고 생각함.

Openstack의 경우, 각 컴포넌트간 메시지 브로커로 rabbitMQ를 사용하고 있고,
흘러가는 메시지들을 모니터링하고 디버깅하기 위한 stacktach라는 프로젝트가 있지만,
stacktach에서 사용되는 워커가 Celery만큼 견고하지 못하고, 실제로는 유실되는 메시지도 발생했었음.

shovel로 federation을 구성해서 openstack과 비즈니스의 bounded-context를
잘 해결할 수 있을 것 같다는 생각이 들었음.

아무튼 비단 Openstack뿐만 아니라, RabbitMQ를 사용하는 환경이면 충분히 비슷한 상황에 대한
해결책이 될 수 있지 않을까 함.

일단은 적용 해 보고... 또 무슨 문제가 생길지 겪어봐야 할 것 같다..ㅠㅠ

## References

- Stackoverflow RabbitMQ Federation - <https://stackoverflow.com/questions/19357272/when-to-use-rabbitmq-shovels-and-when-federation-plugin>
- RabbitMQ Federated Queues - <http://www.rabbitmq.com/federated-queues.html>
- RabbitMQ REST API Doc - <https://pulse.mozilla.org/api/>
- RabbitMQ Dynamic Shovel - <https://www.rabbitmq.com/shovel-dynamic.html>
- RabbitMQ WebStomp - <https://www.rabbitmq.com/web-stomp.html>
- Stomp over Websocket - <http://jmesnil.net/stomp-websocket/doc/>
- Openstack Stacktach - <https://github.com/openstack/stacktach>