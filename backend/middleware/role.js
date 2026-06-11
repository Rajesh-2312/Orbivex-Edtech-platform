/**
 * Role-based access control middleware.
 * Usage: roleMiddleware('teacher', 'admin')
 *
 * Supported roles: student | teacher | tpo | admin
 *
 * @param  {...string} allowedRoles - Roles that can access the route
 */
function roleMiddleware(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Access denied. Required roles: ${allowedRoles.join(', ')}`,
      });
    }
    next();
  };
}

module.exports = roleMiddleware;
