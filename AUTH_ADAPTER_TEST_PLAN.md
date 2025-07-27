# Auth Adapter Test Plan

## Starting Time: 3:00 PM (if no PM response)

## Current Coverage Status
- Auth adapters: 0-3% coverage
- Potential gain: ~3% toward 50% target

## Adapters to Test
1. **JwtTokenManager** (0% coverage)
   - Token generation
   - Token validation
   - Token expiration
   - Refresh token handling

2. **PasswordHashManager** (3.44% coverage)
   - Password hashing
   - Password verification
   - Rehash detection

3. **ApiKeyManager** (0% coverage)
   - Key generation
   - Key validation
   - Rate limiting

4. **RoleBasedAccessControl** (0% coverage)
   - Permission checks
   - Role assignments
   - Role inheritance

5. **OAuth2Manager** (2.15% coverage)
   - Provider configuration
   - Token exchange
   - User info retrieval

## Test Priority
1. JwtTokenManager (most critical)
2. ApiKeyManager (high impact)
3. RoleBasedAccessControl (security critical)
4. PasswordHashManager (already has some coverage)
5. OAuth2Manager (complex, lower priority)