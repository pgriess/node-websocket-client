A prototype [Web Socket](http://www.whatwg.org/specs/web-socket-protocol/)
client implementation for [node.js](http://nodejs.org).

Tested with
[miksago/node-websocket-server](http://github.com/miksago/node-websocket-server)
v1.2.00.

Requires Node.js patched with [this gist](http://gist.github.com/437842).

## Usage

    var sys = require('sys');
    var WebSocket = require('websocket').WebSocket;

    var ws = new WebSocket('ws://localhost:8000/biff', 'borf');
    ws.addListener('data', function(buf) {
        sys.debug('Got data: ' + sys.inspect(buf));
    });
    ws.onmessage = function(m) {
        sys.debug('Got message: ' + m);
    }

## API

This supports the `send()` and `onmessage()` APIs. The `WebSocket` object will
also emit `data` events that are node `Buffer` objects, in case you want to
work with something lower-level than strings.
