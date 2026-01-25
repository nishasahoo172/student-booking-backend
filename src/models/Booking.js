const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const Booking = sequelize.define("Booking", {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },

  user_id: { type: DataTypes.INTEGER, allowNull: false },
  vendor: { type: DataTypes.ENUM("Cisco", "Fortinet"), allowNull: false },
  course: { type: DataTypes.STRING(50), allowNull: false },

  rack: { type: DataTypes.INTEGER, allowNull: false },

  start_time: { type: DataTypes.DATE, allowNull: false },
  end_time: { type: DataTypes.DATE, allowNull: false },

  credits_used: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },

  status: {
    type: DataTypes.ENUM("RESERVED", "ACTIVE", "COMPLETED", "CANCELLED"),
    defaultValue: "RESERVED",
  },

  reminderSentAt: { type: DataTypes.DATE, allowNull: true },
}, {
  tableName: "bookings",
  timestamps: true,
  createdAt: "createdAt",
  updatedAt: "updatedAt",
});

module.exports = Booking;
