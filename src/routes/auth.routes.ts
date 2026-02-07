import { Router, Request, Response } from "express";
import { supabase } from "../lib/supabase";
import { prisma } from "../lib/prisma";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: Authentication endpoints using Supabase
 */

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login with email and password
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: User email address
 *               password:
 *                 type: string
 *                 format: password
 *                 description: User password
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     email:
 *                       type: string
 *                 session:
 *                   type: object
 *                   properties:
 *                     access_token:
 *                       type: string
 *                     refresh_token:
 *                       type: string
 *       400:
 *         description: Invalid credentials
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
router.post("/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password are required",
      });
    }

    // Authenticate with Supabase
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return res.status(400).json({
        message: "Invalid credentials",
        error: error.message,
      });
    }

    if (!data.user || !data.session) {
      return res.status(400).json({
        message: "Authentication failed",
      });
    }

    // Get user from our database (user should already exist from invitation)
    const user = await prisma.user.findUnique({
      where: { email: data.user.email! },
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
      return res.status(404).json({
        message: "User not found. Please accept an invitation first.",
      });
    }

    // Update last login timestamp
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    // Determine user role: super_admin from user.role, or organization member role
    let userRole: string | null = user.role; // super_admin or null

    // If not super_admin, get role from organization membership
    if (!userRole && user.memberships.length > 0) {
      // Use the first verified membership role
      userRole = user.memberships[0].role;
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: userRole,
      },
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at,
      },
    });
  } catch (error) {
    console.error("Error during login:", error);
    res.status(500).json({
      message: "Failed to login",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Logout user
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logout successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Logged out successfully
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post("/logout", async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace("Bearer ", "");

    if (token) {
      await supabase.auth.signOut();
    }

    res.json({
      message: "Logged out successfully",
    });
  } catch (error) {
    console.error("Error during logout:", error);
    res.status(500).json({
      message: "Failed to logout",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Get current user
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current user information
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
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
router.get("/me", async (req: Request, res: Response) => {
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

    // Get user from our database with memberships
    const user = await prisma.user.findUnique({
      where: { email: supabaseUser.email! },
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
      return res.status(404).json({
        message: "User not found",
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
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: userRole,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    });
  } catch (error) {
    console.error("Error fetching current user:", error);
    res.status(500).json({
      message: "Failed to fetch user",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * @swagger
 * /api/auth/forgot-password:
 *   post:
 *     summary: Request password reset email
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: User email address
 *     responses:
 *       200:
 *         description: Password reset email sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Password reset email sent
 *       400:
 *         description: Invalid email or error sending email
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
router.post("/forgot-password", async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        message: "Email is required",
      });
    }

    // Get frontend URL from environment for redirect
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";

    // Send password reset email via Supabase
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${frontendUrl}/reset-password`,
    });

    if (error) {
      return res.status(400).json({
        message: "Failed to send password reset email",
        error: error.message,
      });
    }

    // Always return success for security (don't reveal if email exists)
    res.json({
      message:
        "If an account with that email exists, a password reset link has been sent.",
    });
  } catch (error) {
    console.error("Error sending password reset email:", error);
    res.status(500).json({
      message: "Failed to send password reset email",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * @swagger
 * /api/auth/reset-password:
 *   post:
 *     summary: Reset password using access token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - password
 *               - access_token
 *             properties:
 *               password:
 *                 type: string
 *                 format: password
 *                 description: New password
 *               access_token:
 *                 type: string
 *                 description: Access token from Supabase after clicking reset link (frontend exchanges the token from email)
 *     responses:
 *       200:
 *         description: Password reset successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Password reset successfully
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
router.post("/reset-password", async (req: Request, res: Response) => {
  try {
    const { password, access_token } = req.body;

    if (!password || !access_token) {
      return res.status(400).json({
        message: "Password and access_token are required",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        message: "Password must be at least 6 characters long",
      });
    }

    // Create a Supabase client instance for this request
    const { createClient } = await import("@supabase/supabase-js");
    const supabaseWithToken = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_ANON_KEY!
    );

    // Verify the access token is valid
    const {
      data: { user },
      error: userError,
    } = await supabaseWithToken.auth.getUser(access_token);

    if (userError || !user) {
      return res.status(400).json({
        message: "Invalid or expired token",
        error: userError?.message || "Token verification failed",
      });
    }

    // Set the session with the access token to update password
    await supabaseWithToken.auth.setSession({
      access_token: access_token,
      refresh_token: access_token, // Frontend should ideally provide refresh_token
    });

    // Update the password
    const { error: updateError } = await supabaseWithToken.auth.updateUser({
      password: password,
    });

    if (updateError) {
      return res.status(400).json({
        message: "Failed to reset password",
        error: updateError.message,
      });
    }

    res.json({
      message: "Password reset successfully",
    });
  } catch (error) {
    console.error("Error resetting password:", error);
    res.status(500).json({
      message: "Failed to reset password",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     summary: Refresh access token using refresh token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refresh_token
 *             properties:
 *               refresh_token:
 *                 type: string
 *                 description: Refresh token from previous login
 *     responses:
 *       200:
 *         description: Token refreshed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 session:
 *                   type: object
 *                   properties:
 *                     access_token:
 *                       type: string
 *                     refresh_token:
 *                       type: string
 *                     expires_at:
 *                       type: number
 *       400:
 *         description: Invalid refresh token
 *       500:
 *         description: Server error
 */
router.post("/refresh", async (req: Request, res: Response) => {
  try {
    const { refresh_token } = req.body;

    if (!refresh_token) {
      return res.status(400).json({
        message: "Refresh token is required",
      });
    }

    // Create a Supabase client instance for this request
    const { createClient } = await import("@supabase/supabase-js");
    const supabaseClient = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_ANON_KEY!
    );

    // Refresh the session using the refresh token
    const { data, error } = await supabaseClient.auth.refreshSession({
      refresh_token,
    });

    if (error || !data.session) {
      return res.status(401).json({
        message: "Invalid or expired refresh token",
        error: error?.message || "Token refresh failed",
      });
    }

    res.json({
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at,
      },
    });
  } catch (error) {
    console.error("Error refreshing token:", error);
    res.status(500).json({
      message: "Failed to refresh token",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export { router as authRoutes };
