#!/usr/bin/env ts-node

/**
 * @fileoverview Security Test Runner
 * @description Comprehensive test runner for security components with detailed reporting
 * @author Web-Buddy Team
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

interface TestSuite {
  name: string;
  pattern: string;
  description: string;
  critical: boolean;
}

interface TestResults {
  suite: string;
  passed: number;
  failed: number;
  coverage: number;
  duration: number;
  critical: boolean;
}

const TEST_SUITES: TestSuite[] = [
  {
    name: 'JWT Authentication',
    pattern: 'src/auth/__tests__/token-manager.test.ts',
    description: 'JWT token generation, validation, and blacklisting',
    critical: true
  },
  {
    name: 'Authentication Service',
    pattern: 'src/auth/__tests__/auth-service.test.ts',
    description: 'User registration, login, and password validation',
    critical: true
  },
  {
    name: 'JWT Middleware',
    pattern: 'src/auth/__tests__/jwt-middleware.test.ts',
    description: 'JWT middleware with role-based access control',
    critical: true
  },
  {
    name: 'CSRF Protection Service',
    pattern: 'src/auth/__tests__/csrf/csrf-service.test.ts',
    description: 'CSRF token generation and validation',
    critical: true
  },
  {
    name: 'CSRF Middleware',
    pattern: 'src/auth/__tests__/csrf/csrf-middleware.test.ts',
    description: 'CSRF protection middleware with exemptions',
    critical: true
  },
  {
    name: 'Rate Limiting Service',
    pattern: 'src/security/__tests__/rate-limiting-service.test.ts',
    description: 'Rate limiting algorithms and multi-tier logic',
    critical: true
  },
  {
    name: 'Rate Limit Stores',
    pattern: 'src/security/__tests__/rate-limit-stores.test.ts',
    description: 'Redis and in-memory store operations',
    critical: false
  },
  {
    name: 'Performance Benchmarks',
    pattern: 'src/__tests__/security-benchmarks.test.ts',
    description: 'Performance benchmarks for security components',
    critical: false
  }
];

class SecurityTestRunner {
  private results: TestResults[] = [];
  private startTime: number = Date.now();

  constructor() {
    console.log('🛡️  Semantest Security Test Suite');
    console.log('=====================================\\n');
  }

  async runAllTests(): Promise<void> {
    console.log('Running comprehensive security tests...\\n');

    for (const suite of TEST_SUITES) {
      await this.runTestSuite(suite);
    }

    this.generateReport();
  }

  private async runTestSuite(suite: TestSuite): Promise<void> {
    console.log(`\\n🧪 Running ${suite.name} Tests`);
    console.log(`   ${suite.description}`);
    console.log(`   Critical: ${suite.critical ? '🔴 YES' : '🟡 NO'}`);
    console.log('   ----------------------------------------');

    const startTime = Date.now();
    
    try {
      const command = `npx jest ${suite.pattern} --coverage --verbose --passWithNoTests`;
      const output = execSync(command, { 
        encoding: 'utf8',
        cwd: process.cwd(),
        stdio: 'pipe'
      });

      const duration = Date.now() - startTime;
      const results = this.parseJestOutput(output, suite, duration);
      this.results.push(results);

      if (results.failed > 0) {
        console.log(`   ❌ ${results.failed} test(s) failed`);
        if (suite.critical) {
          console.log('   🚨 CRITICAL FAILURE: This test suite is critical for security!');
        }
      } else {
        console.log(`   ✅ All ${results.passed} test(s) passed`);
      }

      console.log(`   📊 Coverage: ${results.coverage.toFixed(1)}%`);
      console.log(`   ⏱️  Duration: ${duration}ms`);

    } catch (error) {
      console.log(`   ❌ Test suite failed to run: ${error}`);
      this.results.push({
        suite: suite.name,
        passed: 0,
        failed: 1,
        coverage: 0,
        duration: Date.now() - startTime,
        critical: suite.critical
      });
    }
  }

  private parseJestOutput(output: string, suite: TestSuite, duration: number): TestResults {
    // Parse Jest output to extract test results and coverage
    const passedMatch = output.match(/(\d+) passed/);
    const failedMatch = output.match(/(\d+) failed/);
    const coverageMatch = output.match(/All files[\\s\\S]*?(\d+\\.?\d*)%/);

    const passed = passedMatch ? parseInt(passedMatch[1]) : 0;
    const failed = failedMatch ? parseInt(failedMatch[1]) : 0;
    const coverage = coverageMatch ? parseFloat(coverageMatch[1]) : 0;

    return {
      suite: suite.name,
      passed,
      failed,
      coverage,
      duration,
      critical: suite.critical
    };
  }

  private generateReport(): void {
    const totalDuration = Date.now() - this.startTime;
    const totalPassed = this.results.reduce((sum, r) => sum + r.passed, 0);
    const totalFailed = this.results.reduce((sum, r) => sum + r.failed, 0);
    const avgCoverage = this.results.reduce((sum, r) => sum + r.coverage, 0) / this.results.length;
    
    const criticalFailures = this.results.filter(r => r.critical && r.failed > 0);
    const hasGoodCoverage = avgCoverage >= 90;

    console.log('\\n\\n📋 SECURITY TEST REPORT');
    console.log('=========================');
    console.log(`Total Tests: ${totalPassed + totalFailed}`);
    console.log(`✅ Passed: ${totalPassed}`);
    console.log(`❌ Failed: ${totalFailed}`);
    console.log(`📊 Average Coverage: ${avgCoverage.toFixed(1)}%`);
    console.log(`⏱️  Total Duration: ${totalDuration}ms`);

    console.log('\\n🔍 DETAILED RESULTS:');
    this.results.forEach(result => {
      const status = result.failed > 0 ? '❌' : '✅';
      const critical = result.critical ? '🔴' : '🟡';
      console.log(`${status} ${critical} ${result.suite}: ${result.passed}/${result.passed + result.failed} (${result.coverage.toFixed(1)}%)`);
    });

    console.log('\\n🛡️  SECURITY ASSESSMENT:');
    
    if (criticalFailures.length > 0) {
      console.log('🚨 SECURITY RISK: Critical security tests have failed!');
      console.log('   The following critical components have failing tests:');
      criticalFailures.forEach(failure => {
        console.log(`   - ${failure.suite}: ${failure.failed} failed test(s)`);
      });
      console.log('   ⚠️  Do not deploy until these issues are resolved!');
    } else {
      console.log('✅ All critical security tests passed');
    }

    if (hasGoodCoverage) {
      console.log(`✅ Good test coverage: ${avgCoverage.toFixed(1)}% (target: 90%)`);
    } else {
      console.log(`⚠️  Low test coverage: ${avgCoverage.toFixed(1)}% (target: 90%)`);
      console.log('   Consider adding more tests for better security assurance');
    }

    if (totalFailed === 0 && hasGoodCoverage && criticalFailures.length === 0) {
      console.log('\\n🎉 SECURITY TESTS: ALL CLEAR');
      console.log('   Your security implementation is well-tested and ready for deployment');
    } else {
      console.log('\\n⚠️  SECURITY TESTS: ISSUES FOUND');
      console.log('   Please address the issues above before deployment');
    }

    // Generate JSON report for CI/CD
    this.generateJSONReport();
  }

  private generateJSONReport(): void {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalTests: this.results.reduce((sum, r) => sum + r.passed + r.failed, 0),
        passed: this.results.reduce((sum, r) => sum + r.passed, 0),
        failed: this.results.reduce((sum, r) => sum + r.failed, 0),
        coverage: this.results.reduce((sum, r) => sum + r.coverage, 0) / this.results.length,
        duration: Date.now() - this.startTime,
        criticalFailures: this.results.filter(r => r.critical && r.failed > 0).length
      },
      suites: this.results,
      recommendations: this.generateRecommendations()
    };

    const reportPath = path.join(process.cwd(), 'test-results', 'security-test-report.json');
    
    // Ensure directory exists
    const dir = path.dirname(reportPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\\n📄 Detailed report saved: ${reportPath}`);
  }

  private generateRecommendations(): string[] {
    const recommendations: string[] = [];
    const avgCoverage = this.results.reduce((sum, r) => sum + r.coverage, 0) / this.results.length;
    
    if (avgCoverage < 90) {
      recommendations.push('Increase test coverage to at least 90% for security components');
    }

    const criticalFailures = this.results.filter(r => r.critical && r.failed > 0);
    if (criticalFailures.length > 0) {
      recommendations.push('Fix all critical security test failures before deployment');
    }

    const slowTests = this.results.filter(r => r.duration > 5000);
    if (slowTests.length > 0) {
      recommendations.push('Optimize slow test suites to improve development feedback cycle');
    }

    if (recommendations.length === 0) {
      recommendations.push('Security tests are in excellent condition. Consider adding edge case tests.');
    }

    return recommendations;
  }
}

// Run the tests if this script is executed directly
if (require.main === module) {
  const runner = new SecurityTestRunner();
  runner.runAllTests().catch(error => {
    console.error('Failed to run security tests:', error);
    process.exit(1);
  });
}

export default SecurityTestRunner;