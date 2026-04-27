const express = require('express');
const { authenticate, authorize } = require('../middleware/auth.cjs');

module.exports = function roleRoutes(prisma) {
  const router = express.Router();

  // GET all roles
  router.get('/', authenticate, async (req, res) => {
  try {
    const roles = await prisma.role.findMany();
    
    const safeRoles = roles.map(role => {
      let finalPermissions = role.permissions;
      
      // If it's the wildcard '*', keep it as a string
      // If it's a JSON string (like '["read", "write"]'), parse it
      if (typeof role.permissions === 'string' && role.permissions !== '*') {
        try {
          finalPermissions = JSON.parse(role.permissions);
        } catch (e) {
          finalPermissions = role.permissions; 
        }
      }
      
      return { ...role, permissions: finalPermissions };
    });

    res.json(safeRoles);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

  // CREATE a new role
  router.post('/', authenticate, authorize('roles.manage'), async (req, res) => {
    try {
      const { name, permissions } = req.body;
      
      if (!name) return res.status(400).json({ error: "Role name is required" });

      // FIX: Ensure we always stringify the permissions for SQLite
      const permissionsString = Array.isArray(permissions) 
        ? JSON.stringify(permissions) 
        : JSON.stringify([]);

      const role = await prisma.role.create({
        data: {
          name,
          permissions: permissionsString
        }
      });

      // ALWAYS return permissions as an array so the frontend doesn't crash
      res.status(201).json({
        ...role,
        permissions: JSON.parse(role.permissions)
      });
    } catch (error) {
      console.error("POST Role Error:", error);
      res.status(400).json({ error: error.message });
    }
  });

  // UPDATE an existing role
  router.put('/:id', authenticate, authorize('roles.manage'), async (req, res) => {
    try {
      const { id } = req.params;
      const { name, permissions } = req.body;

      const permissionsString = Array.isArray(permissions) 
        ? JSON.stringify(permissions) 
        : permissions;

      const updatedRole = await prisma.role.update({
        where: { id },
        data: {
          name,
          permissions: permissionsString,
        },
      });

      res.json({
        ...updatedRole,
        permissions: typeof updatedRole.permissions === 'string' 
          ? JSON.parse(updatedRole.permissions) 
          : updatedRole.permissions
      });
    } catch (error) {
      console.error("PUT Role Error:", error);
      res.status(500).json({ error: "Internal permission check error" });
    }
  });

  // DELETE a role (FIXED with safety checks)
  router.delete('/:id', authenticate, authorize('roles.manage'), async (req, res) => {
    try {
      const { id } = req.params;

      // Check if role is in use before deleting to prevent orphaned users
      const assignedUsers = await prisma.user.findFirst({
        where: { roleId: id }
      });

      if (assignedUsers) {
        return res.status(400).json({ 
          error: "Cannot delete role. Users are still assigned to this role." 
        });
      }

      await prisma.role.delete({ where: { id } });
      res.json({ message: "Role deleted successfully" });
    } catch (error) {
      console.error("DELETE Error:", error.message);
      res.status(500).json({ error: "Failed to delete role" });
    }
  });

  return router;
};