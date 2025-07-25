/**
 * Monitoring and metrics endpoints
 */

import { Router, Request, Response } from 'express';
import { queueManager } from '../../../queues/infrastructure/http/queue.routes';
import { messageRepository } from '../../../messages/infrastructure/http/message.routes';
import os from 'os';

export const monitoringRouter = Router();

interface SystemMetrics {
  timestamp: string;
  uptime: {
    process: number;
    system: number;
  };
  memory: {
    process: NodeJS.MemoryUsage;
    system: {
      total: number;
      free: number;
      used: number;
      percentUsed: number;
    };
  };
  cpu: {
    loadAvg: number[];
    cores: number;
  };
  application: {
    queue: {
      depth: Record<string, number>;
      processingRate: number;
      errorRate: number;
      dlqSize: number;
    };
    messages: {
      total: number;
      rate: number;
    };
    websocket: {
      connections: number;
      messageRate: number;
    };
  };
}

/**
 * GET /metrics
 * Prometheus-compatible metrics endpoint
 */
monitoringRouter.get('/metrics', async (req: Request, res: Response) => {
  try {
    const queueStatus = queueManager.getStatus();
    const messageCount = await messageRepository.count();
    
    // Format as Prometheus metrics
    const metrics = [
      '# HELP nodejs_process_uptime_seconds Process uptime in seconds',
      '# TYPE nodejs_process_uptime_seconds gauge',
      `nodejs_process_uptime_seconds ${process.uptime()}`,
      '',
      '# HELP nodejs_memory_heap_used_bytes Process heap memory usage',
      '# TYPE nodejs_memory_heap_used_bytes gauge',
      `nodejs_memory_heap_used_bytes ${process.memoryUsage().heapUsed}`,
      '',
      '# HELP queue_items_total Total items in queues by priority',
      '# TYPE queue_items_total gauge',
      `queue_items_total{priority="high"} ${queueStatus.queueSizes.high}`,
      `queue_items_total{priority="normal"} ${queueStatus.queueSizes.normal}`,
      `queue_items_total{priority="low"} ${queueStatus.queueSizes.low}`,
      `queue_items_total{priority="processing"} ${queueStatus.queueSizes.processing}`,
      `queue_items_total{priority="dlq"} ${queueStatus.queueSizes.dlq}`,
      '',
      '# HELP queue_processed_total Total processed queue items',
      '# TYPE queue_processed_total counter',
      `queue_processed_total ${queueStatus.totalProcessed}`,
      '',
      '# HELP queue_failed_total Total failed queue items',
      '# TYPE queue_failed_total counter',
      `queue_failed_total ${queueStatus.totalFailed}`,
      '',
      '# HELP message_store_size Total messages in store',
      '# TYPE message_store_size gauge',
      `message_store_size ${messageCount}`,
    ].join('\n');

    res.type('text/plain').send(metrics);
  } catch (error) {
    res.status(500).json({ error: 'Failed to collect metrics' });
  }
});

/**
 * GET /metrics/json
 * JSON-formatted metrics for custom dashboards
 */
monitoringRouter.get('/metrics/json', async (req: Request, res: Response) => {
  try {
    const queueStatus = queueManager.getStatus();
    const messageCount = await messageRepository.count();
    const memUsage = process.memoryUsage();
    const systemMem = {
      total: os.totalmem(),
      free: os.freemem(),
      used: os.totalmem() - os.freemem(),
      percentUsed: ((os.totalmem() - os.freemem()) / os.totalmem()) * 100
    };

    const metrics: SystemMetrics = {
      timestamp: new Date().toISOString(),
      uptime: {
        process: process.uptime(),
        system: os.uptime()
      },
      memory: {
        process: memUsage,
        system: systemMem
      },
      cpu: {
        loadAvg: os.loadavg(),
        cores: os.cpus().length
      },
      application: {
        queue: {
          depth: queueStatus.queueSizes,
          processingRate: queueStatus.currentRate,
          errorRate: queueStatus.totalFailed / Math.max(queueStatus.totalProcessed, 1),
          dlqSize: queueStatus.queueSizes.dlq
        },
        messages: {
          total: messageCount,
          rate: 0 // Would need time-series data
        },
        websocket: {
          connections: 0, // Would get from WebSocket adapter
          messageRate: 0
        }
      }
    };

    res.json(metrics);
  } catch (error) {
    res.status(500).json({ error: 'Failed to collect metrics' });
  }
});

/**
 * GET /metrics/queue
 * Detailed queue metrics
 */
monitoringRouter.get('/metrics/queue', (req: Request, res: Response) => {
  try {
    const status = queueManager.getStatus();
    
    res.json({
      timestamp: new Date().toISOString(),
      queue: {
        sizes: status.queueSizes,
        totals: {
          enqueued: status.totalEnqueued,
          processed: status.totalProcessed,
          failed: status.totalFailed,
          inDLQ: status.totalInDLQ
        },
        performance: {
          avgProcessingTime: status.avgProcessingTime,
          currentRate: status.currentRate
        },
        health: {
          isHealthy: status.queueSizes.dlq < 50,
          warnings: [],
          errors: []
        }
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to collect queue metrics' });
  }
});

/**
 * GET /metrics/system
 * System resource metrics
 */
monitoringRouter.get('/metrics/system', (req: Request, res: Response) => {
  try {
    const cpus = os.cpus();
    const cpuUsage = cpus.map((cpu, i) => ({
      core: i,
      model: cpu.model,
      speed: cpu.speed,
      times: cpu.times
    }));

    res.json({
      timestamp: new Date().toISOString(),
      hostname: os.hostname(),
      platform: os.platform(),
      arch: os.arch(),
      nodeVersion: process.version,
      uptime: {
        system: os.uptime(),
        process: process.uptime()
      },
      memory: {
        system: {
          total: os.totalmem(),
          free: os.freemem(),
          used: os.totalmem() - os.freemem(),
          percentUsed: ((os.totalmem() - os.freemem()) / os.totalmem()) * 100
        },
        process: process.memoryUsage()
      },
      cpu: {
        cores: cpus.length,
        usage: cpuUsage,
        loadAverage: os.loadavg()
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to collect system metrics' });
  }
});