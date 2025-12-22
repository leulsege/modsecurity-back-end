import { Router, Request, Response } from "express";
import { randomUUID } from "crypto";
import { prisma } from "../lib/prisma";
import { supabase, supabaseAdmin } from "../lib/supabase";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Organizations
 *   description: Organization management endpoints
 */

/**
 * @swagger
 * /api/organizations:
 *   get:
 *     summary: Get all organizations
 *     tags: [Organizations]
 *     responses:
 *       200:
 *         description: List of organizations
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Organization'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get("/", async (req: Request, res: Response) => {
  try {
    const organizations = await prisma.organization.findMany({
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                fullName: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.json(organizations);
  } catch (error) {
    console.error("Error fetching organizations:", error);
    res.status(500).json({
      message: "Failed to fetch organizations",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * @swagger
 * /api/organizations/my:
 *   get:
 *     summary: Get organizations where current user is a member
 *     tags: [Organizations]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of user's organizations
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Organization'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get("/my", async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace("Bearer ", "");

    if (!token) {
      return res.status(401).json({
        message: "No token provided",
      });
    }

    // Verify token and get user
    const {
      data: { user: supabaseUser },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !supabaseUser) {
      return res.status(401).json({
        message: "Invalid or expired token",
      });
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { email: supabaseUser.email! },
    });

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    // Get organizations where user is a member
    const memberships = await prisma.organizationMember.findMany({
      where: { userId: user.id },
      include: {
        organization: {
          include: {
            members: {
              include: {
                user: {
                  select: {
                    id: true,
                    email: true,
                    fullName: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    const organizations = memberships.map(
      (membership) => membership.organization
    );

    res.json(organizations);
  } catch (error) {
    console.error("Error fetching user organizations:", error);
    res.status(500).json({
      message: "Failed to fetch user organizations",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * @swagger
 * /api/organizations/{id}:
 *   get:
 *     summary: Get organization by ID
 *     tags: [Organizations]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Organization ID
 *     responses:
 *       200:
 *         description: Organization details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Organization'
 *       404:
 *         description: Organization not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const organization = await prisma.organization.findUnique({
      where: { id },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                fullName: true,
              },
            },
          },
        },
      },
    });

    if (!organization) {
      return res.status(404).json({
        message: "Organization not found",
      });
    }

    res.json(organization);
  } catch (error) {
    console.error("Error fetching organization:", error);
    res.status(500).json({
      message: "Failed to fetch organization",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * @swagger
 * /api/organizations:
 *   post:
 *     summary: Create a new organization
 *     tags: [Organizations]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - domains
 *               - adminEmail
 *             properties:
 *               name:
 *                 type: string
 *                 description: Organization name
 *               domains:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of domain names
 *               adminEmail:
 *                 type: string
 *                 format: email
 *                 description: Email of the admin to invite
 *     responses:
 *       201:
 *         description: Organization created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Organization'
 *       400:
 *         description: Invalid input
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post("/", async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace("Bearer ", "");

    if (!token) {
      return res.status(401).json({
        message: "No token provided",
      });
    }

    // Verify token and get user
    const {
      data: { user: supabaseUser },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !supabaseUser) {
      return res.status(401).json({
        message: "Invalid or expired token",
      });
    }

    // Get user from database
    const creator = await prisma.user.findUnique({
      where: { email: supabaseUser.email! },
    });

    if (!creator) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const { name, domains, adminEmail } = req.body;

    if (!name || !domains || !Array.isArray(domains) || domains.length === 0) {
      return res.status(400).json({
        message: "Name and domains (array) are required",
      });
    }

    if (!adminEmail) {
      return res.status(400).json({
        message: "Admin email is required",
      });
    }

    // Check if admin user exists in our database
    let adminUser = await prisma.user.findUnique({
      where: { email: adminEmail },
    });

    // Get frontend URL for invitation redirect
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";

    // Invite user via Supabase Admin API (creates user in Supabase Auth and sends email)
    if (!supabaseAdmin) {
      return res.status(500).json({
        message: "Supabase service role key not configured",
      });
    }

    // Try to find user in Supabase Auth by listing users
    let supabaseUserId: string | null = null;

    try {
      const { data: usersData } = await supabaseAdmin.auth.admin.listUsers();
      const existingUser = usersData?.users?.find(
        (u) => u.email === adminEmail
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
        await supabaseAdmin.auth.admin.inviteUserByEmail(adminEmail, {
          data: {
            organization_name: name,
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

    // Create or update user in our database
    if (!adminUser) {
      // Use Supabase user ID if available, otherwise generate UUID
      const userId = supabaseUserId || randomUUID();

      adminUser = await prisma.user.create({
        data: {
          id: userId,
          email: adminEmail,
          fullName: null,
        },
      });
    } else if (supabaseUserId && adminUser.id !== supabaseUserId) {
      // Update user ID to match Supabase if different
      // Note: This might cause issues if user already has relationships
      // In production, you might want to handle this differently
      console.warn(
        `User ID mismatch for ${adminEmail}. Database: ${adminUser.id}, Supabase: ${supabaseUserId}`
      );
    }

    // Create organization
    const organization = await prisma.organization.create({
      data: {
        name,
        domains,
        ownerEmail: null, // Will be set when first admin accepts
        status: "pending",
      },
    });

    // Create organization member with pending status
    await prisma.organizationMember.create({
      data: {
        userId: adminUser.id,
        organizationId: organization.id,
        role: "admin",
        status: "pending",
      },
    });

    // Fetch the created organization with members
    const createdOrg = await prisma.organization.findUnique({
      where: { id: organization.id },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                fullName: true,
              },
            },
          },
        },
      },
    });

    res.status(201).json(createdOrg);
  } catch (error: any) {
    console.error("Error creating organization:", error);

    if (error.code === "P2002") {
      return res.status(409).json({
        message: "Organization with this name or domain already exists",
      });
    }

    res.status(500).json({
      message: "Failed to create organization",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * @swagger
 * /api/organizations/{id}:
 *   put:
 *     summary: Update organization by ID
 *     tags: [Organizations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Organization ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: Organization name
 *               domains:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of domain names
 *               status:
 *                 type: string
 *                 enum: [active, pending, suspended, disabled]
 *                 description: Organization status
 *     responses:
 *       200:
 *         description: Organization updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Organization'
 *       400:
 *         description: Invalid input
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Organization not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.put("/:id", async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace("Bearer ", "");

    if (!token) {
      return res.status(401).json({
        message: "No token provided",
      });
    }

    // Verify token
    const {
      data: { user: supabaseUser },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !supabaseUser) {
      return res.status(401).json({
        message: "Invalid or expired token",
      });
    }

    const { id } = req.params;
    const { name, domains, status } = req.body;

    // Validate status if provided
    if (
      status &&
      !["active", "pending", "suspended", "disabled"].includes(status)
    ) {
      return res.status(400).json({
        message: "Status must be one of: active, pending, suspended, disabled",
      });
    }

    // Validate domains if provided
    if (domains && (!Array.isArray(domains) || domains.length === 0)) {
      return res.status(400).json({
        message: "Domains must be a non-empty array",
      });
    }

    const organization = await prisma.organization.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(domains && { domains }),
        ...(status && { status }),
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                fullName: true,
              },
            },
          },
        },
      },
    });

    res.json(organization);
  } catch (error: any) {
    console.error("Error updating organization:", error);

    if (error.code === "P2025") {
      return res.status(404).json({
        message: "Organization not found",
      });
    }

    res.status(500).json({
      message: "Failed to update organization",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * @swagger
 * /api/organizations/{id}:
 *   delete:
 *     summary: Delete organization by ID
 *     tags: [Organizations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Organization ID
 *     responses:
 *       200:
 *         description: Organization deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Organization deleted successfully
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Organization not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace("Bearer ", "");

    if (!token) {
      return res.status(401).json({
        message: "No token provided",
      });
    }

    // Verify token
    const {
      data: { user: supabaseUser },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !supabaseUser) {
      return res.status(401).json({
        message: "Invalid or expired token",
      });
    }

    const { id } = req.params;

    await prisma.organization.delete({
      where: { id },
    });

    res.json({
      message: "Organization deleted successfully",
    });
  } catch (error: any) {
    console.error("Error deleting organization:", error);

    if (error.code === "P2025") {
      return res.status(404).json({
        message: "Organization not found",
      });
    }

    res.status(500).json({
      message: "Failed to delete organization",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export { router as organizationRoutes };
