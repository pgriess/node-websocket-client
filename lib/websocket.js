var assert = require('assert');
var crypto = require('crypto');
var http = require('http');
var sys = require('sys');
var urllib = require('url');

// Generate a Sec-WebSocket-* value
createSecretKey = function() {
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
    if (!url) {
        throw new Error('No URL specified.');
    }

    if (!proto) {
        throw new Error('No protocol specified.');
    }

    var u = urllib.parse(url);
    if (u.protocol !== 'ws:') {
        throw new Error('Invalid URL protocol ' + u.protocol + ' specified.');
    }

    var k1 = createSecretKey();
    var k2 = createSecretKey();
    var c = createChallenge();

    var httpClient = http.createClient(u.port, u.hostname);
    var req = httpClient.request(
        '/' + url.replace(/([^\/]*\/){3}/, ''),
        {
            'Connection' : 'Upgrade',
            'Upgrade' : 'WebSocket',
            'Host' : u.hostname,
            'Sec-WebSocket-Protocol' : proto,
            'Sec-WebSocket-Key1' : k1,
            'Sec-WebSocket-Key2' : k2
        }
    );
    req.write(c);

    req.addListener('response', function(resp) {
        sys.debug('Got a response: ' + sys.inspect(resp));
    });

    httpClient.addListener('upgrade', function() {
        sys.debug('Arguments: ' + sys.inspect(arguments));
    });

    req.end();
};
exports.WebSocket = WebSocket;
