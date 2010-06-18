var sys = require('sys');
var WebSocket = require('websocket').WebSocket;

var ws = new WebSocket('ws+unix://' + process.argv[2], 'boffo');

ws.addListener('message', function(d) {
    sys.debug('Received message: ' + d.toString('utf8'));
});
