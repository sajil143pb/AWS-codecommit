// app.js
const express = require('express');
const redis = require('redis');
const opentracing = require('opentracing');

const tracer = require('./tracer');

// Create Redis client (callback API). Connection options come from environment variables.
const redisClient = redis.createClient({
  host: process.env.REDIS_HOST || 'redis',
  port: parseInt(process.env.REDIS_PORT || '6379'),
});

// Express app setup
const app = express();

// Tracing middleware
app.use((req, res, next) => {
  // Extract parent span context from incoming headers (if any)
  const wireCtx = tracer.extract(opentracing.FORMAT_HTTP_HEADERS, req.headers);
  // Start a new span for the request. Use the extracted context as the parent.
  const span = tracer.startSpan(`HTTP ${req.method}`, { childOf: wireCtx });
  span.setTag(opentracing.Tags.HTTP_METHOD, req.method);
  span.setTag(opentracing.Tags.SPAN_KIND, opentracing.Tags.SPAN_KIND_RPC_SERVER);
  span.setTag(opentracing.Tags.HTTP_URL, req.originalUrl);

  // Store span on the request object so that other handlers can create child spans
  req.span = span;

  // When response finishes, set status code and finish the span
  res.on('finish', () => {
    span.setTag(opentracing.Tags.HTTP_STATUS_CODE, res.statusCode);
    if (res.statusCode >= 500) {
      span.setTag(opentracing.Tags.ERROR, true);
    }
    span.finish();
  });
  next();
});

// Utility to run a Redis command under a child span. Accepts a command name and arguments.
function tracedRedisCommand(parentSpan, command, args, callback) {
  const span = tracer.startSpan(`redis:${command}`, { childOf: parentSpan });
  span.setTag('db.type', 'redis');
  span.setTag('db.statement', `${command} ${args.join(' ')}`);

  // Append callback that finishes the span
  const wrappedCallback = function (err, result) {
    if (err) {
      span.setTag(opentracing.Tags.ERROR, true);
      span.log({ event: 'error', message: err.message });
    }
    span.finish();
    if (callback) callback(err, result);
  };

  // Execute the command
  redisClient[command](...args, wrappedCallback);
}

// Example route that reads and writes to Redis
app.get('/', (req, res) => {
  // Retrieve 'visits' counter from Redis
  tracedRedisCommand(req.span, 'get', ['visits'], (err, value) => {
    if (err) {
      res.status(500).send('Redis error');
      return;
    }
    const visits = parseInt(value) || 0;
    const newCount = visits + 1;
    // Update the counter
    tracedRedisCommand(req.span, 'set', ['visits', newCount.toString()], (err2) => {
      if (err2) {
        res.status(500).send('Redis error');
        return;
      }
      res.send(`Hello! You are visitor #${newCount}`);
    });
  });
});

// Start server
const port = parseInt(process.env.PORT || '5000');
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
