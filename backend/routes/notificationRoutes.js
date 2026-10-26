
const express = require('express');
const mongoose = require('mongoose');

const Notification = require('../models/Notification');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

const getUserId = (req) => req.user?._id || req.user?.id;

// GET /api/notifications
// Fetch the logged-in user's notifications.
router.get('/', authMiddleware, async (req, res) => {
  try {
    const userId = getUserId(req);

    const requestedLimit = Number.parseInt(req.query.limit, 10);
    const limit = Number.isInteger(requestedLimit)
      ? Math.min(Math.max(requestedLimit, 1), 100)
      : 30;

    const [notifications, unreadCount] = await Promise.all([
      Notification.find({ user: userId })
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean(),
      Notification.countDocuments({ user: userId, isRead: false }),
    ]);

    return res.status(200).json({
      notifications,
      unreadCount,
    });
  } catch (err) {
    console.error('Fetch notifications error:', err);
    return res.status(500).json({
      message: 'Unable to fetch notifications.',
    });
  }
});

// PATCH /api/notifications/read-all
// Mark all of the user's notifications as read.
router.patch('/read-all', authMiddleware, async (req, res) => {
  try {
    const userId = getUserId(req);

    const result = await Notification.updateMany(
      { user: userId, isRead: false },
      { $set: { isRead: true } }
    );

    return res.status(200).json({
      message: 'Notifications marked as read.',
      modifiedCount: result.modifiedCount,
    });
  } catch (err) {
    console.error('Mark all notifications read error:', err);
    return res.status(500).json({
      message: 'Unable to update notifications.',
    });
  }
});

// PATCH /api/notifications/:id/read
// Mark one of the user's notifications as read.
router.patch('/:id/read', authMiddleware, async (req, res) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        message: 'Invalid notification ID.',
      });
    }

    const notification = await Notification.findOneAndUpdate(
      { _id: id, user: userId },
      { $set: { isRead: true } },
      { returnDocument: 'after' }
    );

    if (!notification) {
      return res.status(404).json({
        message: 'Notification not found.',
      });
    }

    return res.status(200).json({
      message: 'Notification marked as read.',
      notification,
    });
  } catch (err) {
    console.error('Mark notification read error:', err);
    return res.status(500).json({
      message: 'Unable to update notification.',
    });
  }
});


module.exports = router;
