const { OAuth2Client } = require("google-auth-library");

const User = require("../models/User.model");
const AdminAuditLog = require("../models/AdminAuditLog.model");
const Batch = require("../models/Batch.model");
const Plan = require("../models/Plan.model");
const Subscription = require("../models/Subscription.model");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/response");
const {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  generateSecureToken,
  hashToken,
} = require("../utils/token");
const { setAuthCookies, clearAuthCookies } = require("../utils/cookies");
const { sendEmail, templates } = require("../services/email.service");
const {
  NOTIFICATION_TRIGGER,
  ROLES,
  AUTH_PROVIDERS,
  ADMIN_ACTIONS,
  BATCH_SOURCE,
  PLAN_KEYS,
  SUBSCRIPTION_STATUS,
} = require("../config/constants");

const getPrimaryClientUrl = () => (process.env.CLIENT_URL || "http://localhost:3000").split(",")[0].trim();

// Lazily instantiated Google OAuth2 client — used only to verify the ID token
// (JWT "credential") that Google Identity Services mints in the browser.
let googleOAuthClient = null;
const getGoogleClient = () => {
  if (!process.env.GOOGLE_CLIENT_ID) return null;
  if (!googleOAuthClient) googleOAuthClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
  return googleOAuthClient;
};

/**
 * The login screen has a "Student" / "Admin" toggle. `portal` carries that
 * choice so we can reject a mismatch *before* issuing any session — e.g. an
 * admin trying to enter through the Student tab, or vice versa. A user has
 * exactly one role in the DB; the toggle only decides which door they use.
 * Returns an AppError to forward, or null when the portal matches (or none
 * was supplied).
 */
const portalMismatchError = (portal, role) => {
  if (portal !== "student" && portal !== "admin") return null;
  const isAdminRole = role === ROLES.ADMIN || role === ROLES.SUPER_ADMIN;
  if (portal === "admin" && !isAdminRole) {
    return new AppError(
      "This is a student account. Please use the Student tab to sign in.",
      403
    );
  }
  if (portal === "student" && isAdminRole) {
    return new AppError(
      "This is an administrator account. Please switch to the Admin tab to sign in.",
      403
    );
  }
  return null;
};

async function reconcilePublicSubscription(user) {
  const batch = user.batch && typeof user.batch === "object" ? user.batch : null;
  if (!batch || batch.source !== BATCH_SOURCE.PUBLIC) return user;

  const subscription = await Subscription.findOne({ student: user._id })
    .sort({ createdAt: -1 })
    .populate("plan", "key");

  if (
    subscription?.status === SUBSCRIPTION_STATUS.ACTIVE &&
    subscription.expiresAt &&
    subscription.expiresAt.getTime() <= Date.now()
  ) {
    subscription.status = SUBSCRIPTION_STATUS.EXPIRED;
    await subscription.save();

    const trialBatch = await Batch.findOne({ slug: "public-trial", source: BATCH_SOURCE.PUBLIC });
    if (trialBatch) {
      user.batch = trialBatch._id;
      await user.save({ validateBeforeSave: false });
      await user.populate("batch", "name source slug");
    }
  }

  return user;
}

const shapeAuthUser = (user) => ({
  _id:         user._id,
  name:        user.name,
  email:       user.email,
  role:        user.role,
  batch:       user.batch,
  programType: user.programType,
  lastLoginAt: user.lastLoginAt,
});

// ─── Public Self-Registration ────────────────────────────────────────────────

exports.register = asyncHandler(async (req, res, next) => {
  const { name, email, password, phone, programType } = req.body;

  const existing = await User.findOne({ email }).select("_id");
  if (existing) return next(new AppError("This email is already registered.", 409));

  const [trialBatch, trialPlan] = await Promise.all([
    Batch.findOne({ slug: "public-trial", source: BATCH_SOURCE.PUBLIC }),
    Plan.findOne({ key: PLAN_KEYS.TRIAL, isActive: true }),
  ]);

  if (!trialBatch || !trialPlan) {
    return next(new AppError("Public trial access is not configured. Please run seed:plans.", 500));
  }

  const now = new Date();
  const user = await User.create({
    name,
    email,
    phone: phone || null,
    password,
    programType: programType || null,
    role: ROLES.STUDENT,
    batch: trialBatch._id,
  });

  await Subscription.create({
    student: user._id,
    plan: trialPlan._id,
    status: SUBSCRIPTION_STATUS.TRIAL,
    startedAt: now,
    expiresAt: null,
  });

  const payload      = { id: user._id, role: user.role, email: user.email };
  const accessToken  = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);

  user.refreshTokenHash         = hashToken(refreshToken);
  user.previousRefreshTokenHash = null;
  user.lastLoginAt              = now;
  await user.save({ validateBeforeSave: false });
  await user.populate("batch", "name source slug");

  setAuthCookies(res, { accessToken, refreshToken });

  setImmediate(() => {
    sendEmail({
      to: user.email,
      subject: "Welcome to Exam Neeti",
      html: templates.selfRegisteredWelcome({
        name: user.name,
        dashboardUrl: `${getPrimaryClientUrl()}/student`,
      }),
      trigger: NOTIFICATION_TRIGGER.SELF_REGISTERED,
      recipientId: user._id,
      contextRef: user._id,
    }).catch((err) => console.error("[Auth] Welcome email failed:", err.message));
  });

  const responseData = { user: shapeAuthUser(user) };
  if (process.env.NODE_ENV !== "production") responseData.accessToken = accessToken;

  return sendSuccess(res, 201, "Registration successful.", responseData);
});

// ─── Login ────────────────────────────────────────────────────────────────────

exports.login = asyncHandler(async (req, res, next) => {
  const { email, password, portal } = req.body;

  const user = await User.findOne({ email, isActive: true })
    .select("+password")
    .populate("batch", "name source slug");

  if (!user || !(await user.comparePassword(password))) {
    return next(new AppError("Invalid email or password.", 401));
  }

  // Enforce the login screen's Student / Admin toggle before issuing any
  // session — an admin can't slip in through the Student tab, or vice versa.
  const mismatch = portalMismatchError(portal, user.role);
  if (mismatch) return next(mismatch);

  const payload      = { id: user._id, role: user.role, email: user.email };
  const accessToken  = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);

  // Store refresh token hash in DB for rotation / invalidation. Clear any
  // stale previous-hash from an earlier session so its rotation grace window
  // can't be used to resurrect a session that's no longer current.
  user.refreshTokenHash         = hashToken(refreshToken);
  user.previousRefreshTokenHash = null;
  user.lastLoginAt              = new Date();
  await user.save({ validateBeforeSave: false });
  await reconcilePublicSubscription(user);

  // Set httpOnly cookies — browser handles storage automatically
  setAuthCookies(res, { accessToken, refreshToken });

  // Audit log for admin/super_admin logins
  if (user.role === ROLES.ADMIN || user.role === ROLES.SUPER_ADMIN) {
    try {
      await AdminAuditLog.create({
        actor:     user._id,
        actorRole: user.role,
        action:    ADMIN_ACTIONS.LOGIN,
        metadata:  { email: user.email },
        ip:        req.ip || null,
        userAgent: req.headers?.["user-agent"] || null,
      });
    } catch (err) {
      console.error("[Audit] Login audit write failed:", err.message);
    }
  }

  // Return user info in body — tokens are in cookies (production).
  // In non-production, also return accessToken in body so frontend dev on
  // localhost can use it via Authorization: Bearer header (cross-origin
  // HTTP→HTTPS environments don't support SameSite=None cookies).
  const responseData = {
    user: shapeAuthUser(user),
  };

  // Only expose token in body in non-production for dev convenience
  if (process.env.NODE_ENV !== "production") {
    responseData.accessToken = accessToken;
  }

  return sendSuccess(res, 200, "Login successful.", responseData);
});

// ─── Google Sign-In ──────────────────────────────────────────────────────────
//
// The browser (Google Identity Services) returns a signed ID token — the
// `credential` — after the user picks a Google account. We verify that token
// against Google's public keys here, then either log the matching user in or
// create a fresh student account (mirroring public self-registration). Google
// is never trusted for anything beyond "this verified email belongs to this
// person" — role, batch and access are always decided by our own DB.

exports.googleAuth = asyncHandler(async (req, res, next) => {
  const client = getGoogleClient();
  if (!client) {
    return next(new AppError("Google sign-in is not configured on this server.", 503));
  }

  const { credential, programType, portal } = req.body;

  let profile;
  try {
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    profile = ticket.getPayload();
  } catch {
    return next(new AppError("Google sign-in could not be verified. Please try again.", 401));
  }

  if (!profile?.email || profile.email_verified === false) {
    return next(new AppError("Your Google account email is not verified.", 401));
  }

  const email    = profile.email.toLowerCase();
  const googleId = profile.sub;
  const now      = new Date();

  let user = await User.findOne({ email })
    .select("+googleId")
    .populate("batch", "name source slug");
  let isNewUser = false;

  if (user) {
    if (!user.isActive) {
      return next(new AppError("This account has been deactivated. Please contact support.", 403));
    }

    // Respect the Student / Admin toggle for existing accounts too.
    const mismatch = portalMismatchError(portal, user.role);
    if (mismatch) return next(mismatch);

    // Link the Google identity to an existing (password) account on first use,
    // and backfill an avatar if we don't have one yet.
    let dirty = false;
    if (!user.googleId) {
      user.googleId = googleId;
      dirty = true;
    }
    if (!user.profilePicture && profile.picture) {
      user.profilePicture = profile.picture;
      dirty = true;
    }
    if (dirty) await user.save({ validateBeforeSave: false });
  } else {
    // Google sign-in only ever creates a student account. Someone who picked
    // the Admin tab and has no account can't be provisioned this way.
    if (portal === "admin") {
      return next(
        new AppError(
          "No administrator account is linked to this Google address. Admins sign in with email and password.",
          403
        )
      );
    }

    // No account yet — create a student exactly like public self-registration.
    const [trialBatch, trialPlan] = await Promise.all([
      Batch.findOne({ slug: "public-trial", source: BATCH_SOURCE.PUBLIC }),
      Plan.findOne({ key: PLAN_KEYS.TRIAL, isActive: true }),
    ]);

    if (!trialBatch || !trialPlan) {
      return next(new AppError("Public trial access is not configured. Please run seed:plans.", 500));
    }

    user = await User.create({
      name:           profile.name || email.split("@")[0],
      email,
      // Random, unusable password — keeps the schema consistent. A Google user
      // who wants a password can set one anytime via "forgot password".
      password:       generateSecureToken(48),
      googleId,
      authProvider:   AUTH_PROVIDERS.GOOGLE,
      profilePicture: profile.picture || null,
      programType:    programType || null,
      role:           ROLES.STUDENT,
      batch:          trialBatch._id,
    });

    await Subscription.create({
      student:   user._id,
      plan:      trialPlan._id,
      status:    SUBSCRIPTION_STATUS.TRIAL,
      startedAt: now,
      expiresAt: null,
    });

    await user.populate("batch", "name source slug");
    isNewUser = true;
  }

  // Issue the session — identical token/cookie handling to password login.
  const payload      = { id: user._id, role: user.role, email: user.email };
  const accessToken  = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);

  user.refreshTokenHash         = hashToken(refreshToken);
  user.previousRefreshTokenHash = null;
  user.lastLoginAt              = now;
  await user.save({ validateBeforeSave: false });

  if (!isNewUser) await reconcilePublicSubscription(user);

  setAuthCookies(res, { accessToken, refreshToken });

  if (user.role === ROLES.ADMIN || user.role === ROLES.SUPER_ADMIN) {
    try {
      await AdminAuditLog.create({
        actor:     user._id,
        actorRole: user.role,
        action:    ADMIN_ACTIONS.LOGIN,
        metadata:  { email: user.email, via: "google" },
        ip:        req.ip || null,
        userAgent: req.headers?.["user-agent"] || null,
      });
    } catch (err) {
      console.error("[Audit] Google login audit write failed:", err.message);
    }
  }

  if (isNewUser) {
    setImmediate(() => {
      sendEmail({
        to: user.email,
        subject: "Welcome to Exam Neeti",
        html: templates.selfRegisteredWelcome({
          name: user.name,
          dashboardUrl: `${getPrimaryClientUrl()}/student`,
        }),
        trigger: NOTIFICATION_TRIGGER.SELF_REGISTERED,
        recipientId: user._id,
        contextRef: user._id,
      }).catch((err) => console.error("[Auth] Google welcome email failed:", err.message));
    });
  }

  const responseData = { user: shapeAuthUser(user), isNewUser };
  if (process.env.NODE_ENV !== "production") responseData.accessToken = accessToken;

  return sendSuccess(
    res,
    isNewUser ? 201 : 200,
    isNewUser ? "Account created successfully." : "Login successful.",
    responseData
  );
});

// ─── Refresh Token ────────────────────────────────────────────────────────────

exports.refreshToken = asyncHandler(async (req, res, next) => {
  // Read from signed cookie first; fall back to request body for API clients
  const refreshToken =
    req.signedCookies?.refresh_token || req.body?.refreshToken;

  if (!refreshToken) {
    return next(new AppError("Refresh token not found. Please log in again.", 401));
  }

  // Verify signature
  let decoded;
  try {
    decoded = verifyRefreshToken(refreshToken);
  } catch {
    clearAuthCookies(res);
    return next(new AppError("Invalid or expired refresh token. Please log in again.", 401));
  }

  const submittedHash = hashToken(refreshToken);

  // Role/email come from the JWT claims, not a DB read — safe, because
  // authenticate.js never trusts the access token's role claim for
  // authorization either; it always re-reads the role from the DB per request.
  const payload         = { id: decoded.id, role: decoded.role, email: decoded.email };
  const newAccessToken  = generateAccessToken(payload);
  const newRefreshToken = generateRefreshToken(payload);
  const newHash         = hashToken(newRefreshToken);

  // FIX: Rotate atomically — the filter requires the CURRENTLY-stored hash to
  // match, so the "check + write" happens as one DB operation. Without this,
  // two concurrent refresh calls (multiple tabs, a client retry) can both read
  // the same valid hash before either writes, and whichever loses the race
  // then looks like "reuse" on its own next refresh — which used to nuke every
  // active session, forcing a hard logout even though no token was ever stolen.
  // 60s grace: comfortably absorbs the burst of parallel refreshes a data-heavy
  // page fires on load (and React dev double-effects) without meaningfully
  // weakening reuse detection — a token replayed a full minute later is still
  // caught outside this window.
  const GRACE_WINDOW_MS = 60 * 1000;
  const rotated = await User.findOneAndUpdate(
    { _id: decoded.id, refreshTokenHash: submittedHash, isActive: true },
    {
      refreshTokenHash:         newHash,
      previousRefreshTokenHash: submittedHash,
      refreshTokenRotatedAt:    new Date(),
    },
    { new: true }
  ).select("+passwordChangedAt isActive role email");

  let user = rotated;
  let isRaceLoser = false;

  if (!user) {
    // Presented hash didn't match the current one — could be genuine reuse of
    // a stale/stolen token, OR this request simply lost the rotation race
    // above. Re-read fresh state to tell the two apart: if the presented hash
    // matches what we just rotated FROM, and that rotation happened moments
    // ago, treat it as the benign race and let this caller through too.
    const current = await User.findById(decoded.id).select(
      "+refreshTokenHash +previousRefreshTokenHash +refreshTokenRotatedAt +passwordChangedAt isActive role email"
    );

    const withinGrace =
      current?.previousRefreshTokenHash === submittedHash &&
      current?.refreshTokenRotatedAt &&
      Date.now() - current.refreshTokenRotatedAt.getTime() < GRACE_WINDOW_MS;

    if (!current || !current.isActive || !withinGrace) {
      if (current) {
        current.refreshTokenHash         = null;
        current.previousRefreshTokenHash = null;
        await current.save({ validateBeforeSave: false });
      }
      clearAuthCookies(res);
      return next(
        new AppError("Refresh token reuse detected. All sessions invalidated. Please log in again.", 401)
      );
    }

    user = current;
    isRaceLoser = true;
  }

  // Reject if password changed after token was issued
  if (user.changedPasswordAfter(decoded.iat)) {
    clearAuthCookies(res);
    return next(new AppError("Password was recently changed. Please log in again.", 401));
  }

  if (!isRaceLoser) {
    // Canonical winner — cookies are shared across tabs, so this is the
    // state every open tab will converge on.
    setAuthCookies(res, { accessToken: newAccessToken, refreshToken: newRefreshToken });
  }
  // Race loser: a concurrent request already rotated the token and set the
  // canonical cookies moments ago. Don't overwrite them. In non-production the
  // fresh access token below lets the caller's retry proceed immediately without
  // waiting on cookie propagation; in production the body is empty by design
  // (httpOnly cookie is the source of truth there) and the retry instead relies
  // on the winner's Set-Cookie having already landed — safe in practice since
  // both requests originate from the same browser and the winner's response
  // typically arrives first, but not strictly guaranteed ordering.

  // Only expose token in body in non-production (httpOnly cookie is the source of truth in prod)
  const responseData = process.env.NODE_ENV !== "production"
    ? { accessToken: newAccessToken }
    : {};

  return sendSuccess(res, 200, "Token refreshed.", responseData);
});

// ─── Logout ───────────────────────────────────────────────────────────────────

exports.logout = asyncHandler(async (req, res, _next) => {
  // Clear DB hash (both current and grace-window previous) so this refresh
  // token can never be used again, including via the rotation race grace period.
  await User.findByIdAndUpdate(req.user.id, {
    refreshTokenHash:         null,
    previousRefreshTokenHash: null,
  });

  // Clear cookies from browser
  clearAuthCookies(res);

  return sendSuccess(res, 200, "Logged out successfully.");
});

// ─── Logout All Devices ───────────────────────────────────────────────────────

exports.logoutAll = asyncHandler(async (req, res, _next) => {
  // Bump passwordChangedAt → ALL access tokens for this user are instantly invalid
  // (authenticate.js rejects tokens issued before this timestamp)
  await User.findByIdAndUpdate(req.user.id, {
    refreshTokenHash:         null,
    previousRefreshTokenHash: null,
    passwordChangedAt:        new Date(),
  });

  clearAuthCookies(res);

  return sendSuccess(res, 200, "Logged out from all devices.");
});

// ─── Get Current User ─────────────────────────────────────────────────────────

exports.getMe = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id).populate("batch", "name source slug");

  if (!user || !user.isActive) {
    return next(new AppError("User not found.", 404));
  }

  await reconcilePublicSubscription(user);

  return sendSuccess(res, 200, "User profile fetched.", { user });
});

// ─── Forgot Password ──────────────────────────────────────────────────────────

exports.forgotPassword = asyncHandler(async (req, res, next) => {
  const { email } = req.body;

  const user = await User.findOne({ email, isActive: true });

  // Always same response — prevents email enumeration
  if (!user) {
    return sendSuccess(res, 200, "If that email is registered, a reset link has been sent.");
  }

  const rawToken    = generateSecureToken();
  const hashedToken = hashToken(rawToken);

  user.passwordResetToken   = hashedToken;
  user.passwordResetExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 min
  await user.save({ validateBeforeSave: false });

  const resetUrl = `${process.env.CLIENT_URL}/reset-password/${rawToken}`;

  try {
    await sendEmail({
      to:          user.email,
      subject:     "Password Reset Request — Exam Neeti",
      html:        templates.passwordReset({ name: user.name, resetUrl }),
      trigger:     NOTIFICATION_TRIGGER.PASSWORD_RESET,
      recipientId: user._id,
      contextRef:  user._id,
    });
  } catch (emailErr) {
    // FIX: Email failed — clear the orphaned token so the user can retry
    console.error("[Auth] forgotPassword email failed:", emailErr.message);
    user.passwordResetToken   = undefined;
    user.passwordResetExpires = undefined;
    await user.save({ validateBeforeSave: false });
    return next(new AppError("Failed to send reset email. Please try again later.", 502));
  }

  return sendSuccess(res, 200, "If that email is registered, a reset link has been sent.");
});

// ─── Reset Password ───────────────────────────────────────────────────────────

exports.resetPassword = asyncHandler(async (req, res, next) => {
  const { token }    = req.params;
  const { password } = req.body;

  const hashedToken = hashToken(token);

  const user = await User.findOne({
    passwordResetToken:   hashedToken,
    passwordResetExpires: { $gt: Date.now() },
    isActive: true,
  }).select("+password +passwordResetToken +passwordResetExpires");

  if (!user) {
    return next(new AppError("Reset token is invalid or has expired.", 400));
  }

  user.password                  = password;
  user.passwordResetToken        = undefined;
  user.passwordResetExpires      = undefined;
  user.refreshTokenHash          = null; // invalidate all active sessions
  user.previousRefreshTokenHash  = null;
  await user.save();

  // Clear any cookies still in browser
  clearAuthCookies(res);

  return sendSuccess(res, 200, "Password has been reset successfully. Please log in.");
});

// ─── Change Password ──────────────────────────────────────────────────────────

exports.changePassword = asyncHandler(async (req, res, next) => {
  const { currentPassword, newPassword } = req.body;

  const user = await User.findById(req.user.id).select("+password");

  if (!user || !(await user.comparePassword(currentPassword))) {
    return next(new AppError("Current password is incorrect.", 401));
  }

  // Save first — pre-save hook sets passwordChangedAt.
  // Tokens are generated AFTER save so their iat is always > passwordChangedAt,
  // preventing an immediate "password changed" rejection on the very next request.
  user.password = newPassword;
  await user.save(); // pre-save hook hashes password and sets passwordChangedAt

  const payload         = { id: user._id, role: user.role, email: user.email };
  const newAccessToken  = generateAccessToken(payload);
  const newRefreshToken = generateRefreshToken(payload);

  user.refreshTokenHash         = hashToken(newRefreshToken);
  user.previousRefreshTokenHash = null;
  await user.save({ validateBeforeSave: false });

  // Set fresh cookies so user stays logged in after password change
  setAuthCookies(res, { accessToken: newAccessToken, refreshToken: newRefreshToken });

  // Audit log for admins
  if (user.role === ROLES.ADMIN || user.role === ROLES.SUPER_ADMIN) {
    try {
      await AdminAuditLog.create({
        actor:     user._id,
        actorRole: user.role,
        action:    ADMIN_ACTIONS.PASSWORD_CHANGED,
        metadata:  { email: user.email, selfChange: true },
        ip:        req.ip || null,
        userAgent: req.headers?.["user-agent"] || null,
      });
    } catch (err) {
      console.error("[Audit] Password change audit write failed:", err.message);
    }
  }

  return sendSuccess(res, 200, "Password changed successfully.");
});
