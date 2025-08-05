import { Message, MessageType, TestExecutePayload, TestStatusPayload } from '../types';
import { SemantestWebSocketServer } from '../server';
import { v4 as uuidv4 } from 'uuid';

export class TestHandler {
  private activeTests = new Map<string, any>();
  
  constructor(private server: SemantestWebSocketServer) {}
  
  async handleTestExecute(message: Message, client: any): Promise<void> {
    const payload = message.payload as TestExecutePayload;
    const executionId = uuidv4();
    
    // Send test started
    this.server.sendMessage(client.ws, MessageType.TEST_STARTED, {
      testId: payload.testId,
      executionId,
      startTime: Date.now(),
      environment: {
        browser: payload.options?.browser || 'chrome',
        version: '96.0.4664.110',
        os: 'linux'
      }
    }, message.id);
    
    // Store test execution
    this.activeTests.set(executionId, {
      testId: payload.testId,
      client: client.id,
      startTime: Date.now(),
      options: payload.options
    });
    
    // TODO: Execute actual test
    // For now, simulate test execution
    setTimeout(() => {
      this.completeTest(executionId, client);
    }, 5000);
  }
  
  private completeTest(executionId: string, client: any): void {
    const test = this.activeTests.get(executionId);
    if (!test) return;
    
    const duration = Date.now() - test.startTime;
    
    this.server.sendMessage(client.ws, MessageType.TEST_COMPLETED, {
      testId: test.testId,
      executionId,
      status: 'passed',
      duration,
      results: {
        assertions: {
          total: 5,
          passed: 5,
          failed: 0
        },
        screenshots: [],
        logs: []
      }
    } as TestStatusPayload);
    
    this.activeTests.delete(executionId);
  }
}