import express, { Express, Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import { userRoutes } from "./routes/user.routes";
import { authRoutes } from "./routes/auth.routes";
import { organizationRoutes } from "./routes/organization.routes";
import { invitationRoutes } from "./routes/invitation.routes";
import { organizationMembersRoutes } from "./routes/organization-members.routes";

// Load environment variables
dotenv.config();

const app: Express = express();
const PORT = process.env.PORT || 3001;
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

// Middleware
app.use(
  cors({
    origin: FRONTEND_URL,
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Swagger configuration
const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "ModSecurity API",
      version: "1.0.0",
      description: "ModSecurity Backend API Documentation",
      contact: {
        name: "API Support",
      },
    },
    servers: [
      {
        url: `http://localhost:${PORT}`,
        description: "Development server",
      },
    ],
    components: {
      schemas: {
        User: {
          type: "object",
          properties: {
            id: {
              type: "string",
              format: "uuid",
              description: "User unique identifier",
            },
            email: {
              type: "string",
              format: "email",
              description: "User email address",
            },
            fullName: {
              type: "string",
              nullable: true,
              description: "User full name",
            },
            role: {
              type: "string",
              nullable: true,
              enum: ["super_admin", null],
              description: "User role (super_admin or null)",
            },
            createdAt: {
              type: "string",
              format: "date-time",
              description: "User creation timestamp",
            },
            updatedAt: {
              type: "string",
              format: "date-time",
              description: "User last update timestamp",
            },
          },
          required: ["id", "email", "createdAt", "updatedAt"],
        },
        Organization: {
          type: "object",
          properties: {
            id: {
              type: "string",
              format: "uuid",
              description: "Organization unique identifier",
            },
            name: {
              type: "string",
              description: "Organization name",
            },
            domains: {
              type: "array",
              items: {
                type: "string",
              },
              description: "Array of domain names",
            },
            ownerEmail: {
              type: "string",
              format: "email",
              nullable: true,
              description: "Email of the organization owner",
            },
            status: {
              type: "string",
              enum: ["active", "pending", "suspended", "disabled"],
              description: "Organization status",
            },
            createdAt: {
              type: "string",
              format: "date-time",
              description: "Organization creation timestamp",
            },
            updatedAt: {
              type: "string",
              format: "date-time",
              description: "Organization last update timestamp",
            },
            members: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  userId: { type: "string" },
                  organizationId: { type: "string" },
                  role: { type: "string" },
                  status: { type: "string", enum: ["pending", "verified"] },
                  createdAt: { type: "string", format: "date-time" },
                  updatedAt: { type: "string", format: "date-time" },
                  user: {
                    type: "object",
                    properties: {
                      id: { type: "string" },
                      email: { type: "string" },
                      fullName: { type: "string", nullable: true },
                    },
                  },
                },
              },
            },
          },
          required: [
            "id",
            "name",
            "domains",
            "status",
            "createdAt",
            "updatedAt",
          ],
        },
        Error: {
          type: "object",
          properties: {
            message: {
              type: "string",
              description: "Error message",
            },
            error: {
              type: "string",
              description: "Error details",
            },
          },
        },
      },
    },
  },
  apis: ["./src/routes/*.ts", "./src/server.ts"], // Path to the API files
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

// Swagger UI
app.use(
  "/docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    customCss: ".swagger-ui .topbar { display: none }",
    customSiteTitle: "ModSecurity API Documentation",
  })
);

// Health check endpoint
/**
 * @swagger
 * /health:
 *   get:
 *     summary: Health check endpoint
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Server is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 */
app.get("/health", (req: Request, res: Response) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/organizations", organizationRoutes);
app.use("/api/invitations", invitationRoutes);
app.use("/api/organization-members", organizationMembersRoutes);

// Root endpoint
app.get("/", (req: Request, res: Response) => {
  res.json({
    message: "ModSecurity API",
    version: "1.0.0",
    docs: "/docs",
  });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    message: "Route not found",
    path: req.path,
  });
});

// Error handler
app.use((err: Error, req: Request, res: Response, next: Function) => {
  console.error(err.stack);
  res.status(500).json({
    message: "Internal server error",
    error: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
  console.log(
    `📚 API Documentation available at http://localhost:${PORT}/docs`
  );
});

export default app;
