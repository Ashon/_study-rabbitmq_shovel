var mqStompWsUrl = 'ws://localhost:15675/ws';
var mqVhost = '/';
var mqUsername = 'guest';
var mqPassword = 'guest';
var mqSubscribepath = '/exchange/from_rabbitmq';

var container = document.getElementById('container');
function whenSubscribe(e) {
  var msg = document.createElement('pre');
  msg.innerText = JSON.stringify(e.headers, null, 2);
  container.appendChild(msg);
  window.scrollTo(0, container.scrollHeight);
}

var ws = new WebSocket(mqStompWsUrl);
var client = webstomp.over(ws);
client.connect(mqUsername, mqPassword,
  function connected(e) {
    client.subscribe(mqSubscribepath, whenSubscribe);
  },
  function conenectionError() {
    console.log('connection error');
  },
  mqVhost
);
