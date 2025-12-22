import { Router, Request, Response } from "express";
import { randomUUID } from "crypto";
import { prisma } from "../lib/prisma";
import { supabase, supabaseAdmin } from "../lib/supabase";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Organization Members
 *   description: Organization member management endpoints
 */

/**
 * @swagger
 * /api/organization-members/my-organization:
 *   get:
 *     summary: Get all members of the current user's organization
 *     tags: [Organization Members]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of organization members
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 organization:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     name:
 *                       type: string
 *                 members:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       userId:
 *                         type: string
 *                       organizationId:
 *                         type: string
 *                       role:
 *                         type: string
 *                       status:
 *                         type: string
 *                       user:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           email:
 *                             type: string
 *                           fullName:
 *                             type: string
 *                             nullable: true
 *                           disabled:
 *                             type: boolean
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get("/my-organization", async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace("Bearer ", "");

    if (!token) {
      return res.status(401).json({
        message: "No token provided",
      });
    }

    // Verify token with Supabase
    const {
      data: { user: supabaseUser },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !supabaseUser) {
      return res.status(401).json({
        message: "Invalid or expired token",
      });
    }

    // Get user from our database
    const user = await prisma.user.findUnique({
      where: { email: supabaseUser.email! },
      include: {
        memberships: {
          where: {
            status: "verified",
          },
          include: {
            organization: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    // Get the first verified organization (admin should only be in one org)
    const membership = user.memberships[0];

    if (!membership) {
      return res.status(404).json({
        message: "No organization found for this user",
      });
    }

    // Get all members of this organization
    const members = await prisma.organizationMember.findMany({
      where: {
        organizationId: membership.organizationId,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
            disabled: true,
            lastLogin: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.json({
      organization: {
        id: membership.organization.id,
        name: membership.organization.name,
      },
      members: members.map((m) => ({
        id: m.id,
        userId: m.userId,
        organizationId: m.organizationId,
        role: m.role,
        status: m.status,
        user: {
          id: m.user.id,
          email: m.user.email,
          fullName: m.user.fullName,
          disabled: m.user.disabled,
          lastLogin: m.user.lastLogin?.toISOString() || null,
        },
      })),
    });
  } catch (error) {
    console.error("Error fetching organization members:", error);
    res.status(500).json({
      message: "Failed to fetch organization members",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * @swagger
 * /api/organization-members/{userId}/toggle-disabled:
 *   patch:
 *     summary: Toggle disabled status of a user
 *     tags: [Organization Members]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     responses:
 *       200:
 *         description: User disabled status updated
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
/**
 * @swagger
 * /api/organization-members/invite:
 *   post:
 *     summary: Invite a user to the current user's organization
 *     tags: [Organization Members]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - role
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               role:
 *                 type: string
 *                 enum: [admin, viewer]
 *     responses:
 *       201:
 *         description: User invited successfully
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not admin of organization)
 *       500:
 *         description: Server error
 */
router.post("/invite", async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace("Bearer ", "");

    if (!token) {
      return res.status(401).json({
        message: "No token provided",
      });
    }

    // Verify token with Supabase
    const {
      data: { user: supabaseUser },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !supabaseUser) {
      return res.status(401).json({
        message: "Invalid or expired token",
      });
    }

    // Get current user from our database
    const currentUser = await prisma.user.findUnique({
      where: { email: supabaseUser.email! },
      include: {
        memberships: {
          where: {
            status: "verified",
          },
          include: {
            organization: true,
          },
        },
      },
    });

    if (!currentUser) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    // Get the first verified organization
    const membership = currentUser.memberships[0];

    if (!membership) {
      return res.status(404).json({
        message: "No organization found for this user",
      });
    }

    // Check if user is admin (only admins can invite)
    if (membership.role !== "admin") {
      return res.status(403).json({
        message: "Only admins can invite users to the organization",
      });
    }

    const { email, role } = req.body;

    if (!email || !role) {
      return res.status(400).json({
        message: "Email and role are required",
      });
    }

    if (!["admin", "viewer"].includes(role)) {
      return res.status(400).json({
        message: "Role must be 'admin' or 'viewer'",
      });
    }

    // Check if user is already a member of this organization
    const existingMember = await prisma.organizationMember.findFirst({
      where: {
        organizationId: membership.organizationId,
        user: {
          email: email,
        },
      },
    });

    if (existingMember) {
      return res.status(409).json({
        message: "User is already a member of this organization",
      });
    }

    // Get frontend URL for invitation redirect
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";

    if (!supabaseAdmin) {
      return res.status(500).json({
        message: "Supabase service role key not configured",
      });
    }

    // Check if user exists in Supabase Auth
    let supabaseUserId: string | null = null;

    try {
      const { data: usersData } = await supabaseAdmin.auth.admin.listUsers();
      const existingUser = usersData?.users?.find(
        (u) => u.email === email
      );

      if (existingUser) {
        supabaseUserId = existingUser.id;
      }
    } catch (error) {
      console.warn("Error checking existing users:", error);
    }

    // If user doesn't exist in Supabase Auth, invite them
    if (!supabaseUserId) {
      const { data: inviteData, error: inviteError } =
        await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
          data: {
            organization_name: membership.organization.name,
          },
          redirectTo: `${frontendUrl}/accept-invitation`,
        });

      if (inviteError) {
        console.error("Error inviting user:", inviteError);
        return res.status(400).json({
          message: "Failed to send invitation email",
          error: inviteError.message,
        });
      }

      if (inviteData?.user) {
        supabaseUserId = inviteData.user.id;
      }
    }

    // Get or create user in our database
    let targetUser = await prisma.user.findUnique({
      where: { email },
    });

    if (!targetUser) {
      // Use Supabase user ID if available, otherwise generate UUID
      const userId = supabaseUserId || randomUUID();

      targetUser = await prisma.user.create({
        data: {
          id: userId,
          email,
          fullName: null,
        },
      });
    } else if (supabaseUserId && targetUser.id !== supabaseUserId) {
      console.warn(
        `User ID mismatch for ${email}. Database: ${targetUser.id}, Supabase: ${supabaseUserId}`
      );
    }

    // Create organization member with pending status
    const newMember = await prisma.organizationMember.create({
      data: {
        userId: targetUser.id,
        organizationId: membership.organizationId,
        role,
        status: "pending",
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
            disabled: true,
            lastLogin: true,
          },
        },
      },
    });

    res.status(201).json({
      message: "User invited successfully",
      member: {
        id: newMember.id,
        userId: newMember.userId,
        organizationId: newMember.organizationId,
        role: newMember.role,
        status: newMember.status,
        user: {
          id: newMember.user.id,
          email: newMember.user.email,
          fullName: newMember.user.fullName,
          disabled: newMember.user.disabled,
          lastLogin: newMember.user.lastLogin?.toISOString() || null,
        },
      },
    });
  } catch (error) {
    console.error("Error inviting user:", error);
    res.status(500).json({
      message: "Failed to invite user",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

router.patch("/:userId/toggle-disabled", async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace("Bearer ", "");

    if (!token) {
      return res.status(401).json({
        message: "No token provided",
      });
    }

    // Verify token with Supabase
    const {
      data: { user: supabaseUser },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !supabaseUser) {
      return res.status(401).json({
        message: "Invalid or expired token",
      });
    }

    const { userId } = req.params;

    // Get the user to toggle
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!targetUser) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    // Toggle disabled status
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        disabled: !targetUser.disabled,
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        disabled: true,
      },
    });

    res.json({
      message: `User ${updatedUser.disabled ? "disabled" : "enabled"} successfully`,
      user: updatedUser,
    });
  } catch (error) {
    console.error("Error toggling user disabled status:", error);
    res.status(500).json({
      message: "Failed to toggle user disabled status",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export { router as organizationMembersRoutes };


