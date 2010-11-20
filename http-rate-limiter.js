/**
 * A very simple node.js HTTP proxy providing usage rate limiting using Redis.
 *
 * Author: Josh Devins (info@joshdevins.net, http://joshdevins.net)
 */

var sys = require("sys"),
    http = require("http"),
    url = require("url");
var redis = require("./lib/node_redis.js");

var config = {
    proxy_port: 8080
};

/**
 * Provided a key, lookup in Redis what the usage rate is and pass through if under limit. If over or at limit,
 * return an error code to the user.
 */
function lookupKeyAndProxy(request, response, key) {

    sys.log("Usage rate lookup: " + key);

    // lookup in Redis by key
    

    if (false) {

        // rate limit reached
        sys.log("Usage rate limit hit: " + key);
        
        response.writeHead(403, { 'X-RateLimit-Hit' : '' });
        response.end();
        
        return;
    }

    sys.log("Proxying request for key: " + key);
    proxy(request, response);
}

/**
 * Proxy the request to the destination service.
 */
function proxy(request, response) {

    // sys.puts(sys.inspect(request));

    var hostSplit = request.headers.host.split(':');
    var host = hostSplit[0];
    var port = hostSplit[1];

    if (port == undefined) {
        port = {false : 80, true : 443}[request.socket.secure]
    }

    sys.log("Proxying to: " + host + ":" + port);

    var proxy = http.createClient(port, host, request.socket.secure);
    var proxy_request = proxy.request(request.method, request.url, request.headers);

    proxy_request.addListener('response', function(proxy_response) {

      proxy_response.addListener('data', function(chunk) {
        response.write(chunk, 'binary');
      });

      proxy_response.addListener('end', function() {
        response.end();
      });

      response.writeHead(proxy_response.statusCode, proxy_response.headers);
    });

    request.addListener('data', function(chunk) {
      proxy_request.write(chunk, 'binary');
    });

    request.addListener('end', function() {
      proxy_request.end();
    });
}

function serverCallback(request, response) {

    var auth = request.headers.authorization;
    var method = request.method;
    var uri = url.parse(request.url).pathname;
    
    var key = auth + "|" + method + "|" + uri;

    lookupKeyAndProxy(request, response, key);
}

// create Redis client
var redisClient = redis.createClient(6379, 'localhost');
redisClient.on("error", function (err) {
    sys.log("Redis connection error to " + client.host + ":" + client.port + " - " + err);
});

// startup server
sys.log("Starting HTTP usage rate limiter proxy server on port: " + config.proxy_port);
http.createServer(serverCallback).listen(config.proxy_port);
