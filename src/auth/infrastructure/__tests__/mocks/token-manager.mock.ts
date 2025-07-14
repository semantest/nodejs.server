/**
 * Mock TokenManager for testing
 */

export const createMockTokenManager = () => {
  return {
    verifyAccessToken: jest.fn(),
    isTokenBlacklisted: jest.fn(),
    generateAccessToken: jest.fn(),
    generateRefreshToken: jest.fn(),
    blacklistToken: jest.fn(),
    rotateRefreshToken: jest.fn(),
    verifyRefreshToken: jest.fn(),
    clearUserTokens: jest.fn()
  };
};

export type MockTokenManager = ReturnType<typeof createMockTokenManager>;