var assert = require('assert');
var sys = require('sys');
var WebSocket = require('websocket').WebSocket;
var WebSocketServer = require('ws').Server;

var PORT = 1024 + Math.floor(Math.random() * 4096);

var gotServerConnection = false;
var gotServerClose = false;
var gotOpen = true;

var wss = new WebSocketServer();
wss.listen(PORT, 'localhost');
wss.addListener('connection', function(c) {
    gotServerConnection = true;

    c.addListener('close', function() {
        gotServerClose = true;
        wss.close();
    });
});

var ws = new WebSocket('ws://localhost:' + PORT + '/', 'biff');
ws.addListener('open', function() {
    gotOpen = true;
    ws.close();
});

process.addListener('exit', function() {
    assert.ok(gotServerConnection);
    assert.ok(gotOpen);
    assert.ok(gotServerClose);
});
