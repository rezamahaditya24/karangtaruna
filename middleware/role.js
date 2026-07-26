const ROLE_HIERARCHY = { anggota: 0, pengurus: 1, bendahara: 2, super_admin: 3 };

function authorize(...roles) {
  return (req, res, next) => {
    const userRole = req.user?.role || 'anggota';
    const minLevel = Math.min(...roles.map(r => ROLE_HIERARCHY[r] ?? 0));
    const userLevel = ROLE_HIERARCHY[userRole] ?? 0;
    if (userLevel < minLevel) {
      return res.status(403).json({ error: 'Akses ditolak. Tidak memiliki izin yang cukup.' });
    }
    next();
  };
}

module.exports = { authorize };