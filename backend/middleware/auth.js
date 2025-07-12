// Authentication middleware
const requireAuth = (req, res, next) => {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  // Add user info to request object for easy access
  req.user = req.session.user;
  next();
};

module.exports = {
  requireAuth
};
