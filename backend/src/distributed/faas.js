const vm = require('vm');
const axios = require('axios');
const logger = require('../utils/logger');

class FaaSEngine {
  constructor(config, stateMachine) {
    this.config = config;
    this.stateMachine = stateMachine;
    this.functions = new Map(); // functionId -> { id, name, code, owner, createdAt }
    this.executionLog = []; // recent executions (keep last 50)
    
    // Pre-register built-in functions
    this._registerBuiltins();
  }

  _registerBuiltins() {
    // Built-in 1: Attendance report generator
    this.functions.set('builtin-attendance-report', {
      id: 'builtin-attendance-report',
      name: 'Attendance Report Generator',
      code: `
        const byDate = {};
        for (const r of context.stateMachine.attendance.getAll()) {
          byDate[r.date] = byDate[r.date] || { date: r.date, present: 0, absent: 0 };
          if (r.present) byDate[r.date].present++; else byDate[r.date].absent++;
        }
        const report = Object.values(byDate).map(d => ({ ...d, total: d.present + d.absent, percentage: Math.round(d.present / (d.present + d.absent) * 100) }));
        return { type: 'attendance-report', generatedAt: new Date().toISOString(), data: report };
      `,
      owner: 'system',
      builtin: true,
      createdAt: new Date().toISOString()
    });

    // Built-in 2: Booking summary formatter
    this.functions.set('builtin-booking-summary', {
      id: 'builtin-booking-summary',
      name: 'Booking Summary',
      code: `
        const bookings = context.stateMachine.booking.getAll();
        const summary = { pending: [], approved: [], rejected: [] };
        bookings.forEach(b => summary[b.status].push({ id: b.id, resource: b.resource, date: b.date, timeSlot: b.timeSlot, requestedBy: b.requestedBy }));
        return { type: 'booking-summary', generatedAt: new Date().toISOString(), counts: { pending: summary.pending.length, approved: summary.approved.length, rejected: summary.rejected.length }, data: summary };
      `,
      owner: 'system',
      builtin: true,
      createdAt: new Date().toISOString()
    });

    // Built-in: the same report, but executed on real AWS Lambda (Unit 4 — serverless on AWS)
    if (process.env.AWS_LAMBDA_URL) {
      this.functions.set('aws-lambda-attendance-report', {
        id: 'aws-lambda-attendance-report',
        name: 'Attendance Report (AWS Lambda)',
        remote: process.env.AWS_LAMBDA_URL,
        owner: 'aws-lambda',
        builtin: true,
        createdAt: new Date().toISOString()
      });
    }

    // Built-in 3: System health check
    this.functions.set('builtin-health-check', {
      id: 'builtin-health-check',
      name: 'System Health Check',
      code: `
        return {
          type: 'health-check',
          nodeId: context.nodeId,
          uptime: process.uptime(),
          memoryMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024 * 100) / 100,
          timestamp: new Date().toISOString()
        };
      `,
      owner: 'system',
      builtin: true,
      createdAt: new Date().toISOString()
    });
  }

  /**
   * Register a new user-defined function.
   */
  registerFunction(id, name, code, owner) {
    const func = { id, name, code, owner, builtin: false, createdAt: new Date().toISOString() };
    this.functions.set(id, func);
    logger.info(`FaaS: Function registered: ${name} (${id})`);
    return func;
  }

  /**
   * Execute a function by ID in a sandboxed VM context.
   * Returns { result, executionTime, nodeId }.
   */
  async execute(functionId) {
    const func = this.functions.get(functionId);
    if (!func) {
      throw new Error(`Function '${functionId}' not found`);
    }

    const startTime = Date.now();
    logger.info(`FaaS: Executing function: ${func.name} (${functionId})`);

    try {
      if (func.remote) {
        const { data } = await axios.post(func.remote, { records: this.stateMachine.attendance.getAll() }, { timeout: 10000 });
        return this._record({ functionId, functionName: func.name, nodeId: this.config.nodeId, executionTime: Date.now() - startTime, success: true, result: data, timestamp: new Date().toISOString() });
      }

      // Create a sandboxed context with limited access
      const sandbox = {
        context: {
          nodeId: this.config.nodeId,
          stateMachine: this.stateMachine,
          timestamp: Date.now()
        },
        process: { uptime: process.uptime.bind(process), memoryUsage: process.memoryUsage.bind(process) },
        Math: Math,
        Date: Date,
        JSON: JSON,
        console: { log: (...args) => logger.info(`FaaS[${func.name}]:`, ...args) },
        result: null
      };

      // Wrap code in an IIFE that assigns to result
      const wrappedCode = `result = (function() { ${func.code} })();`;
      
      const script = new vm.Script(wrappedCode, { timeout: 5000 });
      const ctx = vm.createContext(sandbox);
      script.runInContext(ctx);

      const executionTime = Date.now() - startTime;

      const execution = {
        functionId,
        functionName: func.name,
        nodeId: this.config.nodeId,
        executionTime,
        success: true,
        result: sandbox.result,
        timestamp: new Date().toISOString()
      };

      return this._record(execution);
    } catch (err) {
      const executionTime = Date.now() - startTime;
      const execution = {
        functionId,
        functionName: func.name,
        nodeId: this.config.nodeId,
        executionTime,
        success: false,
        error: err.message,
        timestamp: new Date().toISOString()
      };
      return this._record(execution);
    }
  }

  // Keep execution log (last 50)
  _record(execution) {
    this.executionLog.push(execution);
    if (this.executionLog.length > 50) this.executionLog.shift();
    return execution;
  }

  /**
   * List all registered functions (metadata only, no code).
   */
  listFunctions() {
    const list = [];
    for (const [, func] of this.functions) {
      list.push({ id: func.id, name: func.name, owner: func.owner, builtin: func.builtin, createdAt: func.createdAt });
    }
    return list;
  }

  /**
   * Get a function by ID (including code).
   */
  getFunction(id) {
    return this.functions.get(id) || null;
  }

  /**
   * Delete a user-defined function.
   */
  deleteFunction(id) {
    const func = this.functions.get(id);
    if (!func) throw new Error('Function not found');
    if (func.builtin) throw new Error('Cannot delete built-in functions');
    this.functions.delete(id);
    return { deleted: true, id };
  }

  /**
   * Get recent execution log.
   */
  getExecutionLog() {
    return [...this.executionLog].reverse();
  }
}

module.exports = { FaaSEngine };
