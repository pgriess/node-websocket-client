// Verify that we can connect to a server over UNIX domain sockets.

var assert = require('assert');
var path = require('path');
var sys = require('sys');
var WebSocket = require('websocket').WebSocket;
var WebSocketServer = require('ws').Server;

var PATH = path.join(__dirname, 'sock.' + process.pid);

var serverGotConnection = false;
var clientGotOpen = false;

var wss = new WebSocketServer();
wss.addListener('listening', function() {
    var ws = new WebSocket('ws+unix://' + PATH);
    ws.addListener('open', function() {
        clientGotOpen = true;

        ws.close();
    });
});
wss.listen(PATH);
wss.addListener('connection', function(c) {
    serverGotConnection = true;

    wss.close();
});

process.addListener('exit', function() {
    assert.ok(serverGotConnection);
    assert.ok(clientGotOpen);
});
