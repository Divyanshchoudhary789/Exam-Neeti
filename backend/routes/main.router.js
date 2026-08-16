const express = require("express");
const mainRouter = express.Router();

const authRoutes       = require("./auth.routes");
const userRoutes       = require("./user.routes");
const batchRoutes      = require("./batch.routes");
const sprintRoutes     = require("./sprint.routes");
const examRoutes       = require("./exam.routes");
const analyticsRoutes  = require("./analytics.routes");
const dashboardRoutes  = require("./dashboard.routes");
const reportRoutes     = require("./report.routes");
const probabilityRoutes = require("./probability.routes");
const adminTeamRoutes  = require("./adminTeam.routes");
const syllabusRoutes   = require("./syllabus.routes");
const questionRoutes   = require("./question.routes");

mainRouter.use("/auth",        authRoutes);
mainRouter.use("/users",       userRoutes);
mainRouter.use("/batches",     batchRoutes);
mainRouter.use("/sprints",     sprintRoutes);
mainRouter.use("/exams",       examRoutes);
mainRouter.use("/analytics",   analyticsRoutes);
mainRouter.use("/dashboard",   dashboardRoutes);
mainRouter.use("/reports",     reportRoutes);
mainRouter.use("/probability", probabilityRoutes);
mainRouter.use("/admin-team",  adminTeamRoutes);
mainRouter.use("/syllabus",    syllabusRoutes);
mainRouter.use("/questions",   questionRoutes);

module.exports = mainRouter;
