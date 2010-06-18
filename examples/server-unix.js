var sys = require('sys');
var ws = require('ws');

var srv = ws.createServer({ debug : true});
srv.addListener('connection', function(s) {
    sys.debug('Got a connection!');
});

srv.listen(process.argv[2]);
