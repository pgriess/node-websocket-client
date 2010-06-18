var assert = require('assert');
var sys = require('sys');
var WebSocket = require('websocket').WebSocket;
var WebSocketServer = require('ws').Server;

var PORT = 1024 + Math.floor(Math.random() * 4096);
var MSG = 'This is a test: ' + (Math.random() * 100);

var gotServerConnection = false;
var gotServerClose = false;
var gotClientOpen = true;
var gotClientData = true;

var wss = new WebSocketServer();
wss.listen(PORT, 'localhost');
wss.addListener('connection', function(c) {
    gotServerConnection = true;

    c.write(MSG);

    c.addListener('close', function() {
        gotServerClose = true;
        wss.close();
    });
});

var ws = new WebSocket('ws://localhost:' + PORT + '/', 'biff');
ws.addListener('open', function() {
    gotClientOpen = true;
});
ws.addListener('data', function(buf) {
    gotClientData = true;
    assert.equal(buf.toString('utf8'), MSG);

    ws.close();
});

process.addListener('exit', function() {
    assert.ok(gotServerConnection);
    assert.ok(gotClientOpen);
    assert.ok(gotClientData);
    assert.ok(gotServerClose);
});
