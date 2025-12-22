import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { supabaseAdmin } from "../lib/supabase";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Invitations
 *   description: Invitation acceptance endpoints
 */

/**
 * @swagger
 * /api/invitations/accept:
 *   post:
 *     summary: Accept invitation and set password
 *     tags: [Invitations]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *               - password
 *             properties:
 *               token:
 *                 type: string
 *                 description: Invitation token from email
 *               password:
 *                 type: string
 *                 format: password
 *                 description: User password
 *     responses:
 *       200:
 *         description: Invitation accepted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 user:
 *                   type: object
 *                 session:
 *                   type: object
 *       400:
 *         description: Invalid token or password
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
router.post("/accept", async (req: Request, res: Response) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({
        message: "Token and password are required",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        message: "Password must be at least 6 characters long",
      });
    }

    if (!supabaseAdmin) {
      return res.status(500).json({
        message: "Supabase service role key not configured",
      });
    }

    // The token from the URL is an access_token (JWT) from Supabase
    // We can use it directly to get the user
    const { createClient } = await import("@supabase/supabase-js");
    const tempClient = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_ANON_KEY!
    );

    // Set the session with the access token to get user info
    const { data: sessionData, error: sessionError } =
      await tempClient.auth.setSession({
        access_token: token,
        refresh_token: token, // We'll get refresh token from the response
      });

    let supabaseUser;
    let userEmail: string;

    if (sessionError || !sessionData.session?.user) {
      // If setSession fails, try to get user directly with the token
      const { data: userData, error: userError } =
        await tempClient.auth.getUser(token);

      if (userError || !userData.user) {
        return res.status(400).json({
          message: "Invalid or expired invitation token",
          error:
            userError?.message ||
            sessionError?.message ||
            "Token verification failed",
        });
      }

      supabaseUser = userData.user;
      userEmail = supabaseUser.email!;
    } else {
      supabaseUser = sessionData.session.user;
      userEmail = supabaseUser.email!;
    }

    // Set the password for the user
    const { error: updateError } =
      await supabaseAdmin.auth.admin.updateUserById(supabaseUser.id, {
        password: password,
        email_confirm: true, // Confirm email since they accepted invitation
      });

    if (updateError) {
      return res.status(400).json({
        message: "Failed to set password",
        error: updateError.message,
      });
    }

    // Get user from our database with memberships
    let user = await prisma.user.findUnique({
      where: { email: userEmail },
      include: {
        memberships: {
          where: {
            status: "verified",
          },
          select: {
            role: true,
          },
        },
      },
    });

    // If user doesn't exist in our database, create them
    if (!user) {
      user = await prisma.user.create({
        data: {
          id: supabaseUser.id,
          email: userEmail,
          fullName: supabaseUser.user_metadata?.full_name || null,
        },
        include: {
          memberships: {
            where: {
              status: "verified",
            },
            select: {
              role: true,
            },
          },
        },
      });
    }

    // Find organization memberships with pending status
    const pendingMemberships = await prisma.organizationMember.findMany({
      where: {
        userId: user.id,
        status: "pending",
      },
      include: {
        organization: true,
      },
    });

    // Update all pending memberships to verified
    for (const membership of pendingMemberships) {
      await prisma.organizationMember.update({
        where: { id: membership.id },
        data: { status: "verified" },
      });

      // If this is the first verified member (owner), set ownerEmail
      const verifiedCount = await prisma.organizationMember.count({
        where: {
          organizationId: membership.organizationId,
          status: "verified",
        },
      });

      if (verifiedCount === 1) {
        // First person to accept - they become the owner
        await prisma.organization.update({
          where: { id: membership.organizationId },
          data: {
            ownerEmail: userEmail,
            status: "active",
          },
        });
      }
    }

    // Refresh user with updated memberships to get the role
    user = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        memberships: {
          where: {
            status: "verified",
          },
          select: {
            role: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(500).json({
        message: "Failed to fetch user after invitation acceptance",
      });
    }

    // Create a session for the user
    const { data: loginData, error: loginError } =
      await supabaseAdmin.auth.signInWithPassword({
        email: userEmail,
        password: password,
      });

    if (loginError || !loginData.session) {
      return res.status(400).json({
        message: "Failed to create session",
        error: loginError?.message || "Session creation failed",
      });
    }

    // Determine user role: super_admin from user.role, or organization member role
    let userRole: string | null = user.role; // super_admin or null
    
    // If not super_admin, get role from organization membership
    if (!userRole && user.memberships.length > 0) {
      // Use the first verified membership role
      userRole = user.memberships[0].role;
    }

    res.json({
      message: "Invitation accepted successfully",
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: userRole,
      },
      session: {
        access_token: loginData.session.access_token,
        refresh_token: loginData.session.refresh_token,
        expires_at: loginData.session.expires_at,
      },
    });
  } catch (error) {
    console.error("Error accepting invitation:", error);
    res.status(500).json({
      message: "Failed to accept invitation",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export { router as invitationRoutes };
