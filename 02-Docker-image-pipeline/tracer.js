// tracer.js
const initTracer = require('jaeger-client').initTracerFromEnv;

// Read configuration from the environment. Fallbacks provide sensible defaults for local testing.
const config = {
  serviceName: process.env.JAEGER_SERVICE_NAME || 'node-redis-service',
  reporter: {
    // Setting logSpans to true will print spans to stdout for debugging.
    logSpans: process.env.JAEGER_REPORTER_LOG_SPANS === 'true',
  },
  sampler: {
    // Sample all traces by default. Change to 'probabilistic' for production.
    type: process.env.JAEGER_SAMPLER_TYPE || 'const',
    param: parseFloat(process.env.JAEGER_SAMPLER_PARAM) || 1,
  },
};

// No explicit options needed, but can specify logger if desired.
const options = {};

// Initialize tracer. It will connect to the Jaeger agent or collector based on environment variables.
const tracer = initTracer(config, options);

module.exports = tracer;
