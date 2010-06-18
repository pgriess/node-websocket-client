var sys = require('sys');
var ws = require('ws');

var srv = ws.createServer({ debug : true});
srv.addListener('connection', function(s) {
    sys.debug('Got a connection!');

    s._req.socket.addListener('fd', function(fd) {
        sys.debug('Got an fd: ' + fd);
    });
});

srv.listen(process.argv[2]);
