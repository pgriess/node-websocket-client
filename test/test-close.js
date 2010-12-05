// Verify that a connection can be closed gracefully from both directions.

var assert = require('assert');
var WebSocket = require('../lib/websocket').WebSocket;
var WebSocketServer = require('websocket-server/ws/server').Server;

var PORT = 1024 + Math.floor(Math.random() * 4096);

var clientGotServerClose = false;
var serverGotClientClose = false;

var wss = new WebSocketServer();
wss.listen(PORT, 'localhost');
wss.on('connection', function(c) {
    c.on('close', function() {
        serverGotClientClose = true;
        wss.close();
    });

    c.close();
});

var ws = new WebSocket('ws://localhost:' + PORT);
ws.onclose = function() {
    assert.equal(ws.CLOSED, ws.readyState);
    clientGotServerClose = true;
};

process.on('exit', function() {
    assert.ok(clientGotServerClose);
    assert.ok(serverGotClientClose);
});
