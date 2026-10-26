
const mongoose = require('mongoose');
require('dotenv').config();

const Show = require('../models/Show');

function generateSeats() {
  const seats = [];

  for (const row of ['A', 'B', 'C', 'D', 'E']) {
    for (let number = 1; number <= 10; number++) {
      seats.push({
        seatNumber: `${row}${number}`,
        isBooked: false,
      });
    }
  }

  return seats;
}

async function main() {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGO_URI is missing from your .env file');
    }

    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const shows = await Show.find({
      $or: [
        { seats: { $exists: false } },
        { seats: { $size: 0 } },
      ],
    });

    console.log(`Found ${shows.length} shows needing seats`);

    for (const show of shows) {
      // Recheck before saving in case the document changed.
      const updated = await Show.updateOne(
        {
          _id: show._id,
          $or: [
            { seats: { $exists: false } },
            { seats: { $size: 0 } },
          ],
        },
        { $set: { seats: generateSeats() } }
      );

      if (updated.modifiedCount === 1) {
        console.log(`Added 50 seats to show ${show._id}`);
      } else {
        console.log(`Skipped changed show ${show._id}`);
      }
    }

    console.log('Seat generation completed.');
  } catch (error) {
    console.error('Seat generation failed:', error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

main();
