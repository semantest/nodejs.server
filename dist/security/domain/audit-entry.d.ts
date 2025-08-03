import { Entity } from 'typescript-eda-domain';
/**
 * Audit Entry Entity
 *
 * Represents a single audit log entry capturing security-relevant events
 * in the Semantest platform for compliance and security monitoring.
 */
export declare class AuditEntry extends Entity {
    readonly timestamp: Date;
    readonly eventType: string;
    readonly eventSubtype: string;
    readonly success: boolean;
    readonly userId: string | null;
    readonly clientId: string | null;
    readonly correlationId: string;
    readonly ipAddress: string;
    readonly userAgent: string;
    readonly resource: string | null;
    readonly action: string;
    readonly outcome: string;
    readonly details: Record<string, any>;
    readonly riskScore: number;
    readonly complianceFlags: string[];
    readonly retentionDate: Date;
    readonly encryptedData?: string;
    readonly signature?: string;
    constructor(props: {
        id: string;
        timestamp: Date;
        eventType: string;
        eventSubtype: string;
        success: boolean;
        userId: string | null;
        clientId: string | null;
        correlationId: string;
        ipAddress: string;
        userAgent: string;
        resource: string | null;
        action: string;
        outcome: string;
        details: Record<string, any>;
        riskScore: number;
        complianceFlags: string[];
        retentionDate?: Date;
        encryptedData?: string;
        signature?: string;
    });
    /**
     * Calculates retention date based on compliance requirements
     */
    private calculateRetentionDate;
    /**
     * Determines retention period based on event type and compliance flags
     */
    private getRetentionDays;
    /**
     * Checks if the audit entry should be retained
     */
    shouldRetain(): boolean;
    /**
     * Returns a sanitized version of the audit entry for external consumption
     */
    toSanitized(): Record<string, any>;
    /**
     * Masks IP address for privacy
     */
    private maskIpAddress;
    /**
     * Converts to JSON for storage
     */
    toJSON(): Record<string, unknown>;
    /**
     * Creates an AuditEntry from stored data
     */
    static fromJSON(data: any): AuditEntry;
}
//# sourceMappingURL=audit-entry.d.ts.map