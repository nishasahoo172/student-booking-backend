await db.execute(`
  UPDATE bookings
  SET status = 'COMPLETED', updatedAt = NOW()
  WHERE status IN ('RESERVED','ACTIVE')
    AND endTime <= UTC_TIMESTAMP()
`);
