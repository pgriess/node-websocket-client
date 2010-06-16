var assert = require('assert');
var buffer = require('buffer');
var crypto = require('crypto');
var events = require('events');
var http = require('http');
var sys = require('sys');
var urllib = require('url');

var FRAME_NO = 0;
var FRAME_LO = 1;
var FRAME_HI = 2;

// Generate a Sec-WebSocket-* value
var createSecretKey = function() {
    // How many spaces will we be inserting?
    var numSpaces = 1 + Math.floor(Math.random() * 12);
    assert.ok(1 <= numSpaces && numSpaces <= 12);

    // What is the numerical value of our key?
    var keyVal = (Math.floor(
        Math.random() * (4294967295 / numSpaces)
    ) * numSpaces);

    // Our string starts with a string representation of our key
    var s = keyVal.toString();

    // Insert 'numChars' worth of noise
    var numChars = 1 + Math.floor(Math.random() * 12);
    assert.ok(1 <= numChars && numChars <= 12);
    
    for (var i = 0; i < numChars; i++) {
        var pos = Math.floor(Math.random() * s.length + 1);

        var c = Math.floor(Math.random() * 84);
        c = (c <= 15) ?
            String.fromCharCode(c + 0x21) :
            String.fromCharCode(c + 0x3a);

        s = s.substring(0, pos) + c + s.substring(pos, s.length);
    }

    // We shoudln't have any spaces in our value until we insert them
    assert.equal(s.indexOf(' '), -1);

    // Insert 'numSpaces' worth of spaces
    for (var i = 0; i < numSpaces; i++) {
        var pos = Math.floor(Math.random() * (s.length - 1)) + 1;
        s = s.substring(0, pos) + ' ' + s.substring(pos, s.length);
    }

    assert.notEqual(s.charAt(0), ' ');
    assert.notEqual(s.charAt(s.length), ' ');

    return s;
};

// Generate a challenge sequence
var createChallenge = function() {
    var c = ''; 
    for (var i = 0; i < 8; i++) {
        c += String.fromCharCode(Math.floor(Math.random() * 255));
    }

    return c;
};

// Get the value of a secret key string
//
// This strips non-digit values and divides the result by the number of
// spaces found.
var secretKeyValue = function(sk) {
    var ns = 0;
    var v = 0;

    for (var i = 0; i < sk.length; i++) {
        var cc = sk.charCodeAt(i);
        
        if (cc == 0x20) {
            ns++;
        } else if (0x30 <= cc && cc <= 0x39) {
            v = v * 10 + cc - 0x30;
        }
    }

    return Math.floor(v / ns);
}

// Get the to-be-hashed value of a secret key string
//
// This takes the result of secretKeyValue() and encodes it in a big-endian
// byte string
var secretKeyHashValue = function(sk) {
    var skv = secretKeyValue(sk);
   
    var hv = '';
    hv += String.fromCharCode((skv >> 24) & 0xff);
    hv += String.fromCharCode((skv >> 16) & 0xff);
    hv += String.fromCharCode((skv >> 8) & 0xff);
    hv += String.fromCharCode((skv >> 0) & 0xff);

    return hv;
};

// Compute the secret key signature based on two secret key strings and some
// handshaking data.
var computeSecretKeySignature = function(s1, s2, hs) { 
    assert.equal(hs.length, 8);

    var hash = crypto.createHash('md5');

    hash.update(secretKeyHashValue(s1));
    hash.update(secretKeyHashValue(s2));
    hash.update(hs);

    return hash.digest('binary');
};

var WebSocket = function(url, proto) {
    // Parse
    if (!url || !proto) {
        throw new Error('Both url and protocol must be specified.');
    }

    var u = urllib.parse(url);
    if (u.protocol !== 'ws:') {
        throw new Error('Invalid URL protocol ' + u.protocol + ' specified.');
    }

    events.EventEmitter.call(this);

    // Retain a reference to our object
    var self = this;

    // Our underlying net.Stream instance
    var stream = undefined;

    // Frame parsing functions
    //
    // These read data from the given buffer starting at the given offset look
    // for the end of the current frame. If found, the current frame is emitted
    // and the function returns. Only a single frame is processed at a time.
    //
    // The number of bytes of completed frames read is returned, which the
    // caller is to use to advance along its buffer. If 0 is returned, no
    // completed frame bytes were found, and the caller should probably enqueue
    // the buffer as a continuation of the current message. If a complete frame
    // is read, the function is responsible fro resting 'frameType'.

    // Framing data
    var frameType = FRAME_NO;
    var bufs = [];
    var bufsBytes = 0;

    // Frame-parsing functions
    var frameFuncs = [
        // FRAME_NO
        function(buf, off) {
            if (buf[off] & 0x80) {
                throw new Error('High-byte frames not yet supported');
            }

            frameType = FRAME_LO;
            return 1;
        },

        // FRAME_LO
        function(buf, off) {
            assert.ok(bufs.length > 0 || bufsBytes == 0);

            // Find the first instance of 0xff, our terminating byte
            for (var i = off; i < buf.length && buf[i] != 0xff; i++)
                ;

            // We didn't find a terminating byte
            if (i >= buf.length) {
                return 0;
            }

            // We found a terminating byte; collect all bytes into a single buffer
            // and emit it
            var mb = null;
            if (bufs.length == 0) {
                mb = buf.slice(0, i);
            } else {
                mb = new buffer.Buffer(bufsBytes + i);

                var mbOff = 0;
                bufs.forEach(function(b) {
                    b.copy(mb, mbOff, 0, b.length);
                    mbOff += b.length;
                });

                assert.equal(mbOff, bufsBytes);

                buf.copy(mb, mbOff, 0, i);
            }

            process.nextTick(function() {
                var b = mb;
                return function() {
                    self.emit('data', b);

                    if (self.onmessage) {
                        self.onmessage(b.toString('utf8'));
                    }
                };
            }());

            frameType = FRAME_NO;
            return i - off + 1;
        },

        // FRAME_HI
        function(buf, off) {
            sys.debug('High-byte framing not yet supported');

            frameType = FRAME_NO;
            return buf.length - off;
        }
    ];

    // Handle data coming from our socket
    var dataListener = function(buf) {
        if (buf.length <= 0) {
            return;
        }

        var off = 0;
        var consumed = 0;

        do {
            if (frameType < 0 || frameFuncs.length <= frameType) {
                throw new Error('Unexpected frame type: ' + frameType);
            }

            consumed = frameFuncs[frameType](buf, off);
            off += consumed;
        } while (consumed > 0 && off < buf.length);

        if (consumed == 0) {
            bufs.push(buf.slice(off, buf.length));
            bufsBytes += buf.length - off;
        }
    };

    // External API
    self.close = function() {
        if (!stream) {
            return;
        }

        var f = function() {
            stream.end();
            stream.destroy();
            stream = undefined;
        };

        if (stream.write('', 'binary')) {
            f();
        } else {
            stream.addListener('drain', f);
        }
    };

    self.send = function(str) {
        if (!stream) {
            throw new Error('Cannot write to closed WebSocket client');
        }

        stream.write('\x00', 'binary');
        stream.write(str, 'utf8');
        stream.write('\xff', 'binary');
    };

    // Secrets used for handshaking
    var key1 = createSecretKey();
    var key2 = createSecretKey();
    var challenge = createChallenge();

    // Create the HTTP client that we'll use for handshaking. We'll cannabalize
    // its socket via the 'upgrade' event and leave it to rot.
    var httpClient = http.createClient(u.port || 80, u.hostname);

    httpClient.addListener('upgrade', (function() {
        var data = undefined;

        return function(req, s, head) {
            stream = s;

            stream.addListener('data', function(d) {
                if (!data) {
                    data = d;
                } else {
                    var data2 = new buffer.Buffer(data.length + d.length);
                    data.copy(data2, 0, 0, data.length);
                    d.copy(data2, data.length, 0, d.length);

                    data = data2;
                }

                if (data.length >= 16) {
                    var expected = computeSecretKeySignature(key1, key2, challenge);
                    var actual = data.slice(0, 16).toString('binary');

                    // Handshaking fails; we're donezo
                    if (actual != expected) {
                        self.emit('error', new Error('Invalid handshake from server'));
                        self.close();
                    }

                    // Un-register our data handler and add the one to be used
                    // for the normal, non-handshaking case. If we have extra
                    // data left over, manually fire off the handler on
                    // whatever remains.
                    //
                    // XXX: This is lame. We should only remove the listeners
                    //      that we added.
                    httpClient.removeAllListeners('upgrade');
                    stream.removeAllListeners('data');
                    stream.addListener('data', dataListener);

                    if (data.length > 16) {
                        stream.emit('data', data.slice(16, data.length));
                    }
                }
            });

            stream.emit('data', head);
        };
    })());

    var httpReq = httpClient.request(
        '/' + url.replace(/([^\/]*\/){3}/, ''),
        {
            'Connection' : 'Upgrade',
            'Upgrade' : 'WebSocket',
            'Host' : u.hostname,
            'Sec-WebSocket-Protocol' : proto,
            'Sec-WebSocket-Key1' : key1,
            'Sec-WebSocket-Key2' : key2
        }
    );

    httpReq.write(challenge);
    httpReq.end();
};
sys.inherits(WebSocket, events.EventEmitter);
exports.WebSocket = WebSocket;

// vim:ts=4 sw=4 et
