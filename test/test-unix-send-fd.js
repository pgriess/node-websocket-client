// Verify that both sides of the WS connection can both send and receive file
// descriptors.

var assert = require('assert');
var fs = require('fs');
var path = require('path');
var sys = require('sys');
var WebSocket = require('websocket').WebSocket;
var WebSocketServer = require('ws').Server;

var PATH = path.join(__dirname, 'sock.' + process.pid);
var S_MSG = 'Server test: ' + (Math.random() * 100);

var clientReceivedData = false;
var clientReceivedFD = false;

var wss = new WebSocketServer();
wss.addListener('listening', function() {
    var ws = new WebSocket('ws+unix://' + PATH);
    ws.addListener('data', function(d) {
        assert.equal(d.toString('utf8'), S_MSG);

        clientReceivedData = true;
    });
    ws.addListener('fd', function(fd) {
        assert.ok(fd >= 0);

        clientReceivedFD = true;
        ws.close();
    });
});
wss.addListener('connection', function(c) {
    c.write(S_MSG, 0);
    wss.close();
});
wss.listen(PATH);

process.addListener('exit', function() {
    assert.ok(clientReceivedFD);
    assert.ok(clientReceivedData);

    try {
        fs.unlinkSync(PATH);
    } catch (e) { }
});
