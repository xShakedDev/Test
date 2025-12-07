// Server logs storage (in-memory, max 1000 entries)
const serverLogs = [];
const MAX_LOGS = 1000;

// Override console methods to capture logs
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
const originalConsoleInfo = console.info;

function addLog(level, ...args) {
  const timestamp = new Date().toISOString();
  const message = args.map(arg => {
    if (typeof arg === 'object') {
      try {
        return JSON.stringify(arg, null, 2);
      } catch (e) {
        return String(arg);
      }
    }
    return String(arg);
  }).join(' ');
  
  serverLogs.push({
    timestamp,
    level,
    message
  });
  
  // Keep only last MAX_LOGS entries
  if (serverLogs.length > MAX_LOGS) {
    serverLogs.shift();
  }
}

console.log = function(...args) {
  addLog('log', ...args);
  originalConsoleLog.apply(console, args);
};

console.error = function(...args) {
  addLog('error', ...args);
  originalConsoleError.apply(console, args);
};

console.warn = function(...args) {
  addLog('warn', ...args);
  originalConsoleWarn.apply(console, args);
};

console.info = function(...args) {
  addLog('info', ...args);
  originalConsoleInfo.apply(console, args);
};

// Export functions to get and clear logs
function getServerLogs(limit = 500) {
  return serverLogs.slice(-limit);
}

function clearServerLogs() {
  serverLogs.length = 0;
}

module.exports = {
  getServerLogs,
  clearServerLogs
};

