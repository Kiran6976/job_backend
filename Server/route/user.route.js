import express from "express";
import {
  register,
  login,
  logout,
  getProfile,
  updateProfile,
  googleAuth,
  getAllUsersAdmin,
  getUserStatsAdmin,
  updateUserRoleAdmin,
  updateUserStatusAdmin,
  deleteUserAdmin,
} from "../controller/user.controller.js";
import { isAuthenticated } from "../middleware/isAuthenticated.js";
import { singleUpload } from "../middleware/multer.js";

const router = express.Router();

router.route("/register").post(singleUpload, register);
router.route("/login").post(login);
router.route("/google-auth").post(googleAuth);
router.route("/logout").get(logout);
router.route("/profile").get(isAuthenticated, getProfile);
router.route("/profile/update").post(isAuthenticated, singleUpload, updateProfile);

// Admin User Management Routes
router.route("/admin/all").get(getAllUsersAdmin);
router.route("/admin/stats").get(getUserStatsAdmin);
router.route("/admin/:id/role").put(updateUserRoleAdmin);
router.route("/admin/:id/status").put(updateUserStatusAdmin);
router.route("/admin/:id").delete(deleteUserAdmin);

export default router;
