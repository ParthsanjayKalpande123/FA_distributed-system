// Simple structured logger
const nodeId = process.env.NODE_ID || 'unknown-node';

function formatMessage(level, msg, data) {
  const timestamp = new Date().toISOString();
  let log = `[${timestamp}] [${nodeId}] [${level}] ${msg}`;
  if (data) {
    log += ` | ${JSON.stringify(data)}`;
  }
  return log;
}

module.exports = {
  info: (msg, data) => console.log(formatMessage('INFO', msg, data)),
  warn: (msg, data) => console.warn(formatMessage('WARN', msg, data)),
  error: (msg, data) => console.error(formatMessage('ERROR', msg, data)),
  // per-RPC debug lines (several per second) only when DEBUG is set, to keep CloudWatch log volume small
  debug: (msg, data) => process.env.DEBUG && console.debug(formatMessage('DEBUG', msg, data))
};
