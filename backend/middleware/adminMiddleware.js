
const adminMiddleware = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      message: 'Authentication required.',
    });
  }

  if (String(req.user.role).toLowerCase() !== 'admin') {
    return res.status(403).json({
      message: 'Access denied. Admins only.',
    });
  }

  next();
};

module.exports = adminMiddleware;
