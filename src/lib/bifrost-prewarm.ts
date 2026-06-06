/**
 * Pre-warm Bifrost connections on server startup
 * This should be called from a server initialization script
 */

import { prewarmBifrostConnection } from './bifrost'

// Pre-warm connections when the module is imported
prewarmBifrostConnection()

// Also export the function for manual calls
export { prewarmBifrostConnection }