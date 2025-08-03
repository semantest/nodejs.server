import { AuditEntry } from './domain/audit-entry';
import { AuditRepository } from './domain/audit-repository';
/**
 * Security Event Analyzer
 *
 * Analyzes audit events for security threats, anomalies, and patterns
 * that may indicate malicious activity or security vulnerabilities.
 */
export declare class SecurityEventAnalyzer {
    private auditRepository;
    private readonly threatPatterns;
    private readonly anomalyDetectors;
    constructor(auditRepository: AuditRepository);
    /**
     * Analyzes an audit event for security threats
     */
    analyzeEvent(entry: AuditEntry): Promise<SecurityThreat[]>;
    /**
     * Evaluates a potential threat
     */
    private evaluateThreat;
    /**
     * Gets historical context for threat evaluation
     */
    private getHistoricalContext;
    /**
     * Correlates with recent events for advanced threat detection
     */
    private correlateWithRecentEvents;
    /**
     * Extracts patterns from related events
     */
    private extractPatterns;
    /**
     * Initializes threat patterns
     */
    private initializeThreatPatterns;
    /**
     * Initializes anomaly detectors
     */
    private initializeAnomalyDetectors;
    /**
     * Mock geolocation lookup (replace with actual service)
     */
    private getGeolocation;
    /**
     * Calculates distance between two coordinates
     */
    private calculateDistance;
}
interface SecurityThreat {
    id: string;
    type: string;
    severity: number;
    description: string;
    detectedAt: Date;
    auditEntryId: string;
    score: number;
    evidence: any;
    recommendations: string[];
    riskScore: number;
}
export {};
//# sourceMappingURL=security-event-analyzer.d.ts.map