const { schedule } = require('@netlify/functions');
const { handler } = require('./daily-report');
exports.handler = schedule('@daily', async (event) => handler({ ...event, httpMethod: 'GET' }));
